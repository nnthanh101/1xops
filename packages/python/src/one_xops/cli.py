"""1xops command line: doctor, install, config, profiles.

Nothing is changed unless you pass --yes; without it each command shows what it would do.
"""

from __future__ import annotations

import argparse
import configparser
import hashlib
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.text import Text

from one_xops import __version__
from one_xops import config_file as cf
from one_xops import settings as s
from one_xops import setup as wizard

console = Console()
if (
    not console.is_terminal
):  # piped (the assistant, evidence): size to content, never wrap like a terminal
    console = Console(width=400)

# Installing an edition replaces the other (or the free edition under its old marketplace name, 1xops).
INSTALL_STEPS = [
    [s.HOST, "plugin", "marketplace", "add", "anthropics/knowledge-work-plugins"],
    [s.HOST, "plugin", "uninstall", "1xops@1xops"],
    [s.HOST, "plugin", "marketplace", "remove", "1xops"],
    [s.HOST, "plugin", "marketplace", "add", "nnthanh101/1xops"],
    [s.HOST, "plugin", "install", "1xops@1ops"],
    # an existing install stays on its version until the host updates it: install, then update
    [s.HOST, "plugin", "marketplace", "update", "1ops"],
    [s.HOST, "plugin", "update", "1xops@1ops"],
]
SHOP = "https://shop.oceansoft.io"


def pin_steps(version: str) -> list[list[str]]:
    """One released version of the free edition (a rollback), or the latest again. The host keeps the source a
    marketplace was first added with, so it is removed and added back at the release tag, then the plugin installed."""
    source = "nnthanh101/1xops" if version == "latest" else f"nnthanh101/1xops#v{version}"
    return [
        [s.HOST, "plugin", "marketplace", "add", "anthropics/knowledge-work-plugins"],
        [s.HOST, "plugin", "marketplace", "remove", "1ops"],
        [s.HOST, "plugin", "marketplace", "add", source],
        [s.HOST, "plugin", "install", "1xops@1ops"],
    ]


def enterprise_steps(folder: str) -> list[list[str]]:
    """Free edition out, enterprise in: the same plugin name 1xops, from the unpacked bundle as marketplace 1xops."""
    return [
        [s.HOST, "plugin", "marketplace", "add", "anthropics/knowledge-work-plugins"],
        [s.HOST, "plugin", "uninstall", "1xops@1ops"],
        [s.HOST, "plugin", "marketplace", "remove", "1xops"],
        [s.HOST, "plugin", "marketplace", "add", folder],
        [s.HOST, "plugin", "install", "1xops@1xops"],
        [s.HOST, "plugin", "marketplace", "update", "1xops"],
        [s.HOST, "plugin", "update", "1xops@1xops"],
    ]


SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$")


def bundle_version(path: str) -> str:
    """The enterprise bundle's version, read without unpacking. ValueError if it is not a 1xops enterprise bundle."""
    import tarfile

    try:
        with tarfile.open(path, "r:gz") as tar:
            market = json.load(tar.extractfile(".claude-plugin/marketplace.json"))
            plugin = json.load(tar.extractfile("plugins/1xops/.claude-plugin/plugin.json"))
    except (
        OSError,
        EOFError,
        KeyError,
        tarfile.TarError,
        ValueError,
        TypeError,
        AttributeError,
    ) as exc:
        raise ValueError(f"{path} is not a 1xops enterprise bundle") from exc
    named = [d.get("name") if isinstance(d, dict) else None for d in (market, plugin)]
    if named != ["1xops", "1xops"]:
        raise ValueError(f"{path} is not a 1xops enterprise bundle")
    version = str(plugin.get("version", ""))
    if not SEMVER.match(version):  # it names the install folder: never a path
        raise ValueError(f"{path} is not a 1xops enterprise bundle (version {version!r})")
    return version


class OutOfTime(Exception):
    """The time given with --within ran out."""


_deadline: float | None = None  # set only while a session-start check runs


def _run(cmd: list[str], timeout: float = 20) -> tuple[int, str]:
    limit = timeout
    if _deadline is not None:  # each call gets only the time that is left
        left = _deadline - time.monotonic()
        if left <= 0:
            raise OutOfTime
        limit = min(timeout, left)
    try:
        p = subprocess.run(cmd, check=False, capture_output=True, text=True, timeout=limit)
    except subprocess.TimeoutExpired as exc:
        if limit < timeout:
            raise OutOfTime from exc
        return 1, str(exc)
    except OSError as exc:
        return 1, str(exc)
    return p.returncode, (p.stdout or p.stderr).strip()


def _mask(account: str) -> str:
    return f"****{account[-4:]}" if len(account) >= 4 else "****"


GUID = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)
ACCOUNT_ID = re.compile(r"(?<!\d)(?<!\d\.)\d{12}(?!\d|\.\d)")


def scrub(text: str) -> str:
    """An AWS account ID (exactly 12 digits, not part of a longer number or a decimal) and an Azure ID, masked:
    doctor output is pasted onto issues as evidence."""
    text = GUID.sub(lambda m: _mask(m.group(0)), str(text))
    return ACCOUNT_ID.sub(lambda m: _mask(m.group(0)), text)


def access_from_role(arn: str = "") -> str:
    """read: the role cannot change anything; write: it can; unknown: cannot tell from the name."""
    m = re.search(r":assumed-role/([^/]+)/", arn) or re.search(r":(user|root)\b", arn)
    role = m.group(1) if m else ""
    if re.search(r"readonly|viewonly|securityaudit|readaccess|viewer", role, re.IGNORECASE):
        return "read"
    if re.search(r"admin|poweruser|fullaccess|root", role, re.IGNORECASE):
        return "write"
    return "unknown"


ACCESS = {
    "read": "read-only",
    "write": "can change things: use a read-only role",
    "unknown": "access unknown: use a read-only role",
}


# ── container ───────────────────────────────────────────────────────────────

# In the 1xops image (it sets ONEXOPS_CONTAINER=1), sign-ins are made on the host and mounted in; nothing signs
# in inside. A marker, not /.dockerenv: CI runners and other containers keep the behaviour of a person's machine.
CONTAINER = os.environ.get("ONEXOPS_CONTAINER") == "1"
ON_HOST = " on the host" if CONTAINER else ""
HOST_ONLY = (
    s.HOST,
    "uv",
    "npx",
    "docker",
)  # the person's own machine: in a container, shown only when there
ENV_FILE = re.compile(r"^\.env(\..+)?$")
ENV_KEEP = re.compile(r"^\.env\.1xops$|\.(example|sample|template)$")


def _tilde(path: str) -> str:
    home = str(Path.home())
    return "~" + path[len(home) :] if path == home or path.startswith(home + "/") else path


def _mounts() -> dict[str, list[str]]:
    """Mount point: its options, from the kernel's own list (/proc/self/mountinfo). Empty outside Linux."""
    try:
        lines = Path("/proc/self/mountinfo").read_text().splitlines()
    except OSError:
        return {}
    return {
        f[4].replace("\\040", " "): f[5].split(",")
        for f in (ln.split(" ") for ln in lines)
        if len(f) > 5
    }


def _env_files(root: str, depth: int) -> list[str]:
    """`.env` files under root (names only, never read), `depth` folders down."""
    try:
        entries = sorted(os.scandir(root), key=lambda e: e.name)
    except OSError:
        return []
    found = []
    for e in entries:
        if (
            e.is_file(follow_symlinks=False)
            and ENV_FILE.match(e.name)
            and not ENV_KEEP.search(e.name)
        ):
            found.append(os.path.join(root, e.name))
        elif depth and e.is_dir(follow_symlinks=False) and e.name not in (".git", "node_modules"):
            found += _env_files(os.path.join(root, e.name), depth - 1)
    return found


def check_isolation() -> tuple[str, str]:
    """(status, detail) of what the container can reach besides the read-only sign-in.
    Reads file names, environment names and mount options only; no file content."""
    home = str(Path.home())
    mounts = _mounts()
    config = os.environ.get("AWS_CONFIG_FILE", "")
    aws = [m for m in mounts if m.startswith(home + "/.aws") or (config and m == config)]
    fixes = [f"{_tilde(m)} is writable: mount it with :ro" for m in aws if "ro" not in mounts[m]]
    ssh = Path(home, ".ssh")
    if ssh.is_dir() and any(ssh.iterdir()):
        fixes.append("SSH keys in ~/.ssh: remove that mount")
    if os.environ.get("SSH_AUTH_SOCK"):
        fixes.append("an SSH agent is passed in: remove SSH_AUTH_SOCK and its socket mount")
    for f in dict.fromkeys(
        filter(None, [os.environ.get("AWS_SHARED_CREDENTIALS_FILE"), f"{home}/.aws/credentials"])
    ):
        if Path(f).is_file():
            fixes.append(f"static AWS credentials file {_tilde(f)}: remove that mount")
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        fixes.append("static AWS key in AWS_ACCESS_KEY_ID: remove that -e")
    if Path(home, ".azure").is_dir():
        fixes.append(
            "default Azure login in ~/.azure: remove that mount, mount the Reader's own folder"
        )
    envs = list(dict.fromkeys(_env_files(os.getcwd(), 2) + _env_files(home, 0)))
    if envs:
        more = ", …" if len(envs) > 3 else ""
        fixes.append(
            f"host .env files ({', '.join(map(_tilde, envs[:3]))}{more}): remove that mount"
        )
    if fixes:
        return "check", "; ".join(fixes)
    return "ready", ", ".join(
        [
            "AWS folder read-only" if aws else "no AWS folder",
            "Azure folder its own" if os.environ.get("AZURE_CONFIG_DIR") else "no Azure folder",
            "no SSH keys, no static AWS credentials, no host .env files",
        ]
    )


# ── doctor ──────────────────────────────────────────────────────────────────


def check_tools() -> list[tuple[str, bool, bool, str]]:
    """(name, required, ok, detail) for each prerequisite. Read-only."""
    rows = []
    for name, required in [
        ("git", True),
        (s.HOST, True),
        ("uv", False),
        ("npx", False),
        ("docker", False),
        ("gh", False),
        ("aws", False),
        ("az", False),
    ]:
        path = shutil.which(name)
        if CONTAINER and name in HOST_ONLY and not path:
            continue
        if not path:
            rows.append((name, required, False, "not found on PATH"))
            continue
        code, out = _run([name, "--version"])
        rows.append((name, required, code == 0, out.splitlines()[0] if out else path))
    return rows


def check_edition() -> tuple[str, bool, bool, str]:
    """Which 1xops plugin edition is installed, from the host's own plugin records. Read-only."""
    folder = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / f".{s.HOST}") / "plugins"

    def read(name: str) -> dict:
        try:
            return json.loads((folder / name).read_text())
        except (OSError, ValueError):
            return {}

    installed = read("installed_plugins.json").get("plugins", {})

    def version(key: str) -> str:
        return (installed.get(key) or [{}])[0].get("version", "")

    if "1xops@1xops" in installed:
        source = read("known_marketplaces.json").get("1xops", {}).get("source", {})
        if source.get("repo") == "nnthanh101/1xops":
            return ("edition", False, False, "free, old marketplace name: run 1xops install --yes")
        return _edition_row("enterprise", version("1xops@1xops"))
    if "1xops@1ops" in installed:
        return _edition_row("free", version("1xops@1ops"))
    return ("edition", False, False, "plugin not installed: 1xops install --yes")


def _semver(text: str) -> tuple[int, ...]:
    """Major, minor, patch, padded with zeros so 1.2 equals 1.2.0, as in the Node channel."""
    parts = [int(n) for n in re.findall(r"\d+", text)[:3]]
    return tuple(parts + [0] * (3 - len(parts)))


def _edition_row(edition: str, plugin: str) -> tuple[str, bool, bool, str]:
    """The plugin and this command ship together: name the one that is behind, with its update."""
    found = f"{edition} {plugin}".strip()
    if not plugin or "+source" in __version__:  # a source checkout has no version to compare
        return ("edition", False, True, found)
    if _semver(plugin) > _semver(__version__):
        return (
            "edition",
            False,
            False,
            f"{found}; this 1xops command is {__version__}: uv tool install 1xops@latest (or npm install -g 1xops@latest)",
        )
    if _semver(plugin) < _semver(__version__):
        return (
            "edition",
            False,
            False,
            f"{found}; this 1xops command is {__version__}: run /plugin update 1xops in the assistant",
        )
    return ("edition", False, True, found)


READER_HINT = (
    f"use a Reader identity in its own folder: AZURE_CONFIG_DIR=~/.azure-reader az login{ON_HOST}"
)


def check_sign_in(aws_profile: str | None) -> list[tuple[str, bool, bool, str]]:
    """Read-only sign-in checks. Account IDs are masked, never printed in full."""
    rows = []
    if shutil.which("aws"):
        cmd = ["aws", "sts", "get-caller-identity", "--output", "json"]
        if aws_profile:
            cmd += ["--profile", aws_profile]
        code, out = _run(cmd)
        if code == 0:
            try:
                ident = json.loads(out)
            except ValueError:
                ident = {}
            ident = ident if isinstance(ident, dict) else {}
            access = access_from_role(ident.get("Arn", ""))
            rows.append(
                (
                    "aws sign-in",
                    False,
                    True,
                    f"signed in, account {_mask(ident.get('Account', ''))}",
                )
            )
            rows.append(("aws access", False, access == "read", ACCESS[access]))
        else:
            rows.append(("aws sign-in", False, False, f"not signed in (aws sso login{ON_HOST})"))
    if shutil.which("az") and not os.environ.get("AZURE_CONFIG_DIR"):
        # the default login is never read: it is a person's own, and it may change things
        rows.append(("azure sign-in", False, False, f"not checked: {READER_HINT}"))
    elif shutil.which("az"):
        code, _ = _run(["az", "account", "show", "--output", "none"])
        rows.append(
            (
                "azure sign-in",
                False,
                code == 0,
                "Reader folder signed in" if code == 0 else f"not signed in: {READER_HINT}",
            )
        )
    if shutil.which("gh"):
        code, _ = _run(["gh", "auth", "status"])
        rows.append(
            (
                "github sign-in",
                False,
                code == 0,
                "signed in" if code == 0 else "not signed in (gh auth login)",
            )
        )
    return rows


def aws_fix(error: str, profile: str) -> tuple[str, str]:
    """(status, fix) for a failed AWS identity call, from the AWS CLI's own error text."""
    if re.search(r"could not be found", error, re.IGNORECASE):
        return (
            "missing",
            f"profile {profile} not found: aws configure sso --profile {profile}, or set AWS_CONFIG_FILE",
        )
    if re.search(r"read-only file system.*\.aws/cli", error, re.IGNORECASE):
        return (
            "check",
            "mount only the AWS config file and ~/.aws/sso, read-only (README docker run line)",
        )
    if re.search(
        r"expired|refresh failed|sso.*token|nocredentials|unable to locate credentials|read-only file system",
        error,
        re.IGNORECASE,
    ):
        return "signed out", f"aws sso login --profile {profile}{ON_HOST}"
    first = next((line for line in error.splitlines() if line.strip()), "AWS identity call failed")
    return "check", first.removeprefix("aws: [ERROR]: ")[:120]


def azure_access(roles: list[str]) -> str:
    """read: Reader roles only; write: any role that can change things; unknown: no roles seen."""
    if not roles:
        return "unknown"
    if any(re.search(r"owner|contributor|administrator", r, re.IGNORECASE) for r in roles):
        return "write"
    if all(re.search(r"reader", r, re.IGNORECASE) for r in roles):
        return "read"
    return "unknown"


AZURE_ACCESS = {
    "read": "read-only",
    "write": "can change things: use a read-only (Reader) identity",
    "unknown": "access unknown: use a read-only (Reader) identity",
}


def _aws_connector(var: str, values: dict[str, str]) -> tuple[str, str, str]:
    name = f"aws {var}"
    profile = values.get(var) or os.environ.get(var, "")
    if not profile:
        return name, "missing", f"set {var} in .env.1xops or the shell (1xops setup)"
    if not shutil.which("aws"):
        return name, "missing", "install the AWS CLI"
    code, out = _run(
        ["aws", "sts", "get-caller-identity", "--output", "json", "--profile", profile]
    )
    if code != 0:
        status, fix = aws_fix(out, profile)
        return name, status, fix
    try:
        ident = json.loads(out)
    except ValueError:
        return name, "check", "AWS identity call returned no account"
    account = ident.get("Account", "")
    expected = (
        (values.get(var.replace("_PROFILE", "_ACCOUNT")) or "") if var.endswith("_PROFILE") else ""
    )
    if expected and account != expected:
        return (
            name,
            "wrong account",
            (
                f"profile {profile} is {_mask(account)}, this tenant expects {_mask(expected)}: "
                f"aws configure sso --profile {profile}"
            ),
        )
    access = access_from_role(ident.get("Arn", ""))
    detail = f"profile {profile}, account {_mask(account)}, {ACCESS[access]}"
    if long_lived_key(profile):
        return (
            name,
            "check",
            f"{detail}; long-lived access key: use SSO, aws configure sso --profile {profile}",
        )
    end = sso_end(profile) if SIGN_IN_ENDS is not None else None
    if end and SIGN_IN_ENDS is not None:
        SIGN_IN_ENDS[name] = (end, f"aws sso login --profile {profile}{ON_HOST}")
        detail += f", signed in until {end:%Y-%m-%d %H:%M} UTC"
    return name, "ready" if access == "read" else "check", detail


# connector: (when its sign-in ends, the sign-in command). A dict only during `1xops doctor`, fresh each run;
# None elsewhere, so the session-start check and setup make no extra calls.
SIGN_IN_ENDS: dict[str, tuple[datetime, str]] | None = None


def sso_end(profile: str) -> datetime | None:
    """When an SSO sign-in that cannot renew itself ends, from the AWS CLI's own cache; only `expiresAt` is read.
    A session that renews itself (sso_session) keeps a refresh token and its end is not stored: None."""
    key = ""
    for setting in ("sso_session", "sso_start_url"):
        code, out = _run(["aws", "configure", "get", setting, "--profile", profile])
        if code == 0 and out:
            key = out
            break
    if not key:
        return None
    cache = (
        Path.home() / ".aws" / "sso" / "cache" / f"{hashlib.sha1(key.encode()).hexdigest()}.json"
    )
    try:
        data = json.loads(cache.read_text())
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or "refreshToken" in data:
        return None
    m = re.match(r"(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)", str(data.get("expiresAt", "")))
    return datetime(*map(int, m.groups()), tzinfo=UTC) if m else None


def long_lived_key(profile: str) -> bool:
    """True when the shared credentials file holds a permanent access key for this profile. No value is kept."""
    path = os.environ.get("AWS_SHARED_CREDENTIALS_FILE") or "~/.aws/credentials"
    parser = configparser.RawConfigParser()
    try:
        parser.read(os.path.expanduser(path))
    except (configparser.Error, OSError, UnicodeDecodeError):
        return False
    return parser.has_option(profile, "aws_access_key_id") and not parser.has_option(
        profile, "aws_session_token"
    )


def _azure_connector(values: dict[str, str] | None = None) -> tuple[str, str, str]:
    values = values or {}
    if not shutil.which("az"):
        return "azure", "missing", "install the Azure CLI"
    fix = f"az login with a read-only (Reader) identity, in its own AZURE_CONFIG_DIR{ON_HOST}"
    code, out = _run(["az", "account", "show", "--query", "user.name", "--output", "tsv"])
    if code != 0 or not out:
        return "azure", "signed out", fix
    want_tenant, want_sub = (
        values.get("AZURE_TENANT_ID", ""),
        values.get("AZURE_SUBSCRIPTION_ID", ""),
    )
    # the subscription the server is given, by its ID: any one the identity can see, not only the CLI's default
    pick = ["--subscription", want_sub] if want_sub else []
    if want_tenant or want_sub:
        code, ids = _run(
            ["az", "account", "show", *pick, "--query", "[tenantId,id]", "--output", "tsv"]
        )
        if want_sub and code != 0:
            return (
                "azure",
                "wrong account",
                (
                    f"this identity cannot see subscription {_mask(want_sub)}: sign in with one that can, "
                    "AZURE_CONFIG_DIR=~/.azure-reader az login"
                ),
            )
        tenant, _, sub = ids.partition("\t") if code == 0 else ("", "", "")
        if want_tenant and tenant and tenant != want_tenant:
            return (
                "azure",
                "wrong account",
                (
                    f"tenant is {_mask(tenant)}, this tenant expects {_mask(want_tenant)}: "
                    "az login --tenant <AZURE_TENANT_ID>"
                ),
            )
        if want_sub and sub and sub != want_sub:
            return (
                "azure",
                "wrong account",
                (
                    f"subscription is {_mask(sub)}, this tenant expects {_mask(want_sub)}: "
                    "az account set --subscription <AZURE_SUBSCRIPTION_ID>"
                ),
            )
    code, roles = _run(
        [
            "az",
            "role",
            "assignment",
            "list",
            "--assignee",
            out,
            "--all",
            *pick,
            "--query",
            "[].roleDefinitionName",
            "--output",
            "json",
        ],
        timeout=60,
    )
    try:
        names = json.loads(roles) if code == 0 else []
    except ValueError:
        names = []
    access = azure_access(names)
    return "azure", "ready" if access == "read" else "check", AZURE_ACCESS[access]


GITHUB_WRITE = re.compile(
    r"^(repo|public_repo|workflow|gist|delete_repo|codespace|write:.*|admin:.*)$"
)


def _github_connector() -> tuple[str, str, str]:
    """GitHub sign-in of the gh CLI: ready only when the token cannot change things. Prints no token."""
    if not shutil.which("gh"):
        return "github", "missing", "install the GitHub CLI"
    code, out = _run(["gh", "auth", "status"])
    if code != 0:
        return "github", "signed out", "gh auth login --web"
    user = re.search(r"account (\S+)", out)
    who = f"signed in as {user.group(1)}" if user else "signed in"
    scopes = re.search(r"Token scopes:\s*(.+)", out)
    if not scopes or scopes.group(1).strip().strip("'") in (
        "",
        "none",
    ):  # fine-grained: no scopes to read
        return (
            "github",
            "check",
            f"{who}; a fine-grained token's access cannot be read from here: confirm it is read-only",
        )
    names = re.findall(r"'([^']+)'", scopes.group(1)) or scopes.group(1).replace(" ", "").split(",")
    writes = [n for n in names if GITHUB_WRITE.match(n)]
    if writes:
        return (
            "github",
            "check",
            f"{who}; the token can change things ({', '.join(writes)}): use a fine-grained read-only token",
        )
    return "github", "ready", f"{who}, read-only scopes"


def check_connectors(file: str, rows: list | None = None) -> list[tuple[str, str, str]]:
    """(connector, status, fix) for each connector in .env.1xops. Read-only identity calls only.
    Rows are added to `rows` as they are found, so a check that runs out of time keeps what it has."""
    rows = [] if rows is None else rows
    path = Path(file)
    if not path.is_file():
        rows.append(("connectors", "missing", f"no {file} here: run 1xops setup"))
        return rows
    try:
        cfg = cf.load(path)
    except (ValueError, OSError) as exc:
        rows.append(("connectors", "missing", str(exc)))
        return rows
    for key in (
        "AWS_CONFIG_FILE",
        "AZURE_CONFIG_DIR",
    ):  # this tenant's own, never another tenant's from the shell; in a container, the mount's (docker run -e)
        if cfg["values"].get(key) and not (CONTAINER and os.environ.get(key)):
            os.environ[key] = os.path.expanduser(cfg["values"][key])
    if not cfg["connectors"]:
        rows.append(
            ("connectors", "missing", f"ONEXOPS_CONNECTORS is empty in {file}: run 1xops setup")
        )
        return rows
    for connector in cfg["connectors"]:
        try:
            servers = s.load_profile(connector)["mcpServers"]
        except (ValueError, OSError) as exc:
            rows.append((connector, "missing", str(exc)))
            continue
        aws_vars, azure = [], False
        for server_name, server in servers.items():
            env = server.get("env", {})
            if "AWS_PROFILE" in env:
                aws_vars += cf.VAR.findall(env["AWS_PROFILE"])
            elif "AZURE_TENANT_ID" in env:
                azure = True
            elif server.get("type") == "http" and (server_name == "github" and shutil.which("gh")):
                rows.append(_github_connector())
            elif server.get("type") == "http" and PROBE and server.get("headers"):
                rows.append((server_name, *probe(server)))
            elif server.get("type") == "http":
                rows.append(
                    (
                        server_name,
                        "check",
                        f"signs in inside the host: run /mcp and choose {server_name}",
                    )
                )
            else:
                rows.append((server_name, "check", "no sign-in check for this connector"))
        for v in dict.fromkeys(aws_vars):
            rows.append(_aws_connector(v, cfg["values"]))
        if azure:
            rows.append(_azure_connector(cfg["values"]))
    return rows


NEEDS = re.compile(r"\$\{([A-Za-z0-9_]+)\}")
ENV_FIX = 'in .env.1xops, then start the assistant from a shell that ran eval "$(1xops env)"'


def folder_plugins() -> set[str]:
    """The plugins this folder turns on (`.claude/settings.json`, `.claude/settings.local.json`), so a check names
    the connectors the folder's job uses and not every library default. Read-only."""
    keys: set[str] = set()
    for name in ("settings.json", "settings.local.json"):
        try:
            enabled = json.loads((Path(".claude") / name).read_text()).get("enabledPlugins", {})
            keys |= {k for k, on in enabled.items() if on is True}
        except (OSError, ValueError, AttributeError):
            continue
    if Path(".env.1xops").is_file():  # a tenant folder runs the operations playbooks
        keys.add("operations@knowledge-work-plugins")
    return keys


def plugin_connectors() -> list[tuple[str, str, str]]:
    """(server (plugin), status, fix) for the servers of the installed 1xops plugin and of the plugins this folder
    turns on, from the host's own plugin records. Reads no token, makes no call."""
    folder = Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / f".{s.HOST}") / "plugins"
    try:
        installed = json.loads((folder / "installed_plugins.json").read_text()).get("plugins", {})
    except (OSError, ValueError, AttributeError):
        return []
    wanted = folder_plugins()
    rows = []
    for key, entries in installed.items():
        plugin = key.partition("@")[0]
        if plugin != "1xops" and key not in wanted:
            continue
        try:
            data = json.loads((Path(entries[0]["installPath"]) / ".mcp.json").read_text())
            servers = data.get("mcpServers", data)
            servers.items()
        except (OSError, ValueError, KeyError, IndexError, TypeError, AttributeError):
            continue
        for name, server in servers.items():
            if not isinstance(server, dict):
                continue
            label = f"{name} ({plugin})"
            unset = [
                v
                for v in dict.fromkeys(NEEDS.findall(json.dumps(server)))
                if not v.startswith("CLAUDE_") and not os.environ.get(v)
            ]
            if unset:
                rows.append(
                    (
                        label,
                        "broken",
                        (
                            f"{', '.join(unset)} not set. Fix: put "
                            f"{', '.join(v + '=<value>' for v in unset)} {ENV_FIX}"
                        ),
                    )
                )
            elif "url" in server and not str(server["url"]).strip():
                rows.append(
                    (
                        label,
                        "not connected",
                        (
                            "no server. Fix: connect it in the assistant's connector settings, "
                            "or list it in ONEXOPS_IGNORE in .env.1xops"
                        ),
                    )
                )
            elif name == "github" and shutil.which("gh"):
                rows.append((label, *_github_connector()[1:]))
            elif PROBE and server.get("headers"):
                rows.append((label, *probe(server)))
            else:
                rows.append(
                    (label, "in host", f"signs in inside the host: run /mcp and choose {name}")
                )
    return rows


PROBE = False  # doctor --probe: only then is a request sent to a connector's server


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is reported, never followed: urllib would send the token's header on to the new host."""

    def redirect_request(self, *args, **kwargs):
        return None


def probe(server: dict) -> tuple[str, str]:
    """(status, fix) from one MCP initialize request with the server's own header token. Sent only with --probe."""
    expand = lambda v: NEEDS.sub(lambda m: os.environ.get(m.group(1), ""), str(v))
    body = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-06-18",
            "capabilities": {},
            "clientInfo": {"name": "1xops", "version": __version__},
        },
    }
    headers = {k: expand(v) for k, v in server.get("headers", {}).items()}
    headers |= {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
    req = urllib.request.Request(
        expand(server.get("url", "")), json.dumps(body).encode(), headers, method="POST"
    )
    try:
        with urllib.request.build_opener(_NoRedirect).open(req, timeout=5) as res:
            code = res.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except (urllib.error.URLError, OSError, ValueError):
        return "broken", "does not answer: check the url and the network"
    if 200 <= code < 300:
        return "check", "answers; confirm the token is read-only"
    if 300 <= code < 400:
        return "unknown", f"answered {code}, a redirect elsewhere: check the url"
    if code in (401, 403):
        return "signed out", "token refused: put a valid read-only token in .env.1xops"
    return "unknown", f"answered {code}; cannot tell if it works: run /mcp in the assistant"


def connector_rows(file: str, rows: list) -> list[tuple[str, str, str]]:
    """The tenant's connectors and the plugin servers, minus the names in ONEXOPS_IGNORE."""
    try:
        values = cf.load(Path(file))["values"]
    except (ValueError, OSError):
        values = {}
    ignore = {n.strip() for n in values.get("ONEXOPS_IGNORE", "").split(",") if n.strip()}
    try:
        rows += plugin_connectors()
        check_connectors(file, rows)
    finally:
        rows[:] = [r for r in rows if r[0] not in ignore and r[0].split(" (")[0] not in ignore]
    return rows


RESULT_STYLE = {
    "ok": "green",
    "ready": "green",
    "missing": "red",
    "signed out": "yellow",
    "check": "yellow",
    "broken": "red",
    "not connected": "yellow",
    "wrong account": "red",
    "in host": "dim",
    "unknown": "yellow",
}


SKIP_AT_START = ("ready", "in host")
QUIET = ("signs in inside the host", "no sign-in check")


def _seconds(text: str) -> float:
    """--within: a finite, non-negative number of seconds (as the Node.js tool accepts)."""
    try:
        value = float(text)
    except ValueError:
        value = -1.0
    if not (0 <= value < float("inf")):
        raise argparse.ArgumentTypeError("--within must be a number of seconds")
    return value


def brief_text(file: str, within: float | None) -> str:
    """Session start: one line per connector that is not ready, with its fix. Nothing when all is ready.
    Never raises; a check that runs out of time or fails adds one line saying so."""
    global _deadline
    rows: list = []
    done = True
    _deadline = None if within is None else time.monotonic() + within
    try:
        if Path(file).is_file():  # not a tenant folder: nothing to say
            connector_rows(file, rows)
    except Exception:  # noqa: BLE001 (OutOfTime too: a session is never held up)
        done = False
    finally:
        _deadline = None
    lines = [
        f"{name}: {scrub(fix)}"
        for name, status, fix in rows
        if status not in SKIP_AT_START and not fix.startswith(QUIET)
    ]
    if not done:
        when = "" if within is None else f" in {within:g} s"
        lines.append(f"1xops: the check did not finish{when}; run 1xops doctor for the rest.")
    return "\n".join(lines)


def cmd_brief(args: argparse.Namespace) -> int:
    text = brief_text(args.file, args.within)
    if text and args.hook:  # the host's envelope; the text is the same
        print(
            json.dumps(
                {
                    "systemMessage": text,
                    "hookSpecificOutput": {
                        "hookEventName": "SessionStart",
                        "additionalContext": text,
                    },
                },
                ensure_ascii=False,
                separators=(",", ":"),
            )
        )
    elif text:
        print(text)
    return 0


def cmd_doctor(args: argparse.Namespace) -> int:
    if getattr(args, "brief", False) or getattr(args, "hook", False):
        return cmd_brief(args)
    global PROBE, SIGN_IN_ENDS
    PROBE = bool(getattr(args, "probe", False))
    SIGN_IN_ENDS = {}
    # The identity calls take seconds; a spinner on a terminal, nothing when piped.
    with console.status("Checking tools, sign-ins and connectors (read-only)…"):
        rows = check_tools() + ([] if CONTAINER and not shutil.which(s.HOST) else [check_edition()])
        rows += check_sign_in(args.aws_profile)
        connectors = connector_rows(args.file, [])
        isolation = [("isolation", "container", *check_isolation())] if CONTAINER else []
    rows = [r for r in rows if r[0] not in covered_sign_ins(connectors, args.aws_profile)]
    shown = [
        (
            name,
            "required" if required else "optional",
            "ok" if ok else ("missing" if required else "check"),
            detail,
        )
        for name, required, ok, detail in rows
    ]
    shown += isolation + [(name, "connector", status, fix) for name, status, fix in connectors]
    table = Table(title=f"1xops {__version__} doctor", title_style="bold")
    for col in ("check", "needed", "result", "detail"):
        table.add_column(col, overflow="fold")
    for name, needed, result, detail in shown:
        style = RESULT_STYLE[result]
        table.add_row(name, needed, Text(result, style=style), Text(scrub(detail)))
    console.print(table)
    checked = [r for r in shown if r[1] == "connector" and r[2] != "in host"]
    if checked:
        ready = sum(r[2] == "ready" for r in checked)
        console.print(
            f"Score: {ready} of {len(checked)} connectors ready", soft_wrap=True, highlight=False
        )
    for line in next_steps(shown):
        console.print(line, soft_wrap=True)
    failed = [r[0] for r in rows if r[1] and not r[2]]
    if failed:
        console.print(Text(f"Required: {', '.join(failed)}", style="red"), soft_wrap=True)
        return 1
    return 0


def covered_sign_ins(connectors: list, aws_profile: str | None = None) -> set[str]:
    """Sign-in rows to leave out: a connector of this folder already checks that provider with the folder's own
    profile or identity, and the shell's default sign-in would contradict it."""
    names = [c[0].split(" (")[0] for c in connectors]
    covered = set()
    if not aws_profile and any(n.startswith("aws ") for n in names):
        covered |= {"aws sign-in", "aws access"}
    if "azure" in names:
        covered.add("azure sign-in")
    if "github" in names:
        covered.add("github sign-in")
    return covered


def next_steps(shown: list[tuple[str, str, str, str]]) -> list[Text]:
    """What to do next, in table order: required tools and configured connectors that are not ok or ready.
    Optional tools stay in the table only."""
    todo = [
        (name, scrub(detail))
        for name, needed, result, detail in shown
        if result not in ("ok", "ready", "in host") and needed != "optional"
    ]
    soon = datetime.now(UTC) + timedelta(days=7)
    todo += [
        (name, f"sign-in ends {end:%Y-%m-%d %H:%M} UTC: {fix}")
        for name, needed, result, _ in shown
        if result == "ready" and name in (SIGN_IN_ENDS or {})
        for end, fix in [(SIGN_IN_ENDS or {})[name]]
        if end <= soon
    ]
    if not todo:
        return [Text("All set: nothing to fix.", style="green")]
    return [Text("Next:", style="bold")] + [
        Text(f"  {n}. {name}: {fix}") for n, (name, fix) in enumerate(todo, 1)
    ]


# ── install ─────────────────────────────────────────────────────────────────


def cmd_install(args: argparse.Namespace) -> int:
    if not shutil.which(s.HOST):
        console.print(f"[red]'{s.HOST}' CLI not found; run '1xops doctor'.[/]")
        return 1
    steps, folder, bundle = INSTALL_STEPS, None, None
    if args.pin is not None:
        if args.edition == "enterprise":
            print(
                "1xops install: --version is for the free edition; the enterprise bundle carries its own version",
                file=sys.stderr,
            )
            return 2
        if args.pin != "latest" and not SEMVER.match(args.pin):
            print("1xops install: --version must be x.y.z or latest", file=sys.stderr)
            return 2
        steps = pin_steps(args.pin)
    if args.edition == "enterprise":
        if not args.file:
            print(
                f"The enterprise edition is sold at {SHOP}. Download the bundle from your order, then run:"
            )
            print(
                "  1xops install --edition enterprise --file <1xops-enterprise-x.y.z.tar.gz> --yes"
            )
            return 2
        try:
            version = bundle_version(args.file)
        except ValueError as exc:
            console.print(Text(str(exc), style="red"), soft_wrap=True)
            return 2
        bundle, folder = args.file, str(Path.home() / ".1xops" / "enterprise" / version)
        steps = enterprise_steps(folder)
        console.print(Text(f"$ unpack {bundle} into {folder}", style="bold"), soft_wrap=True)
        if args.yes:
            import tarfile

            try:
                Path(folder).mkdir(parents=True, exist_ok=True)
                with tarfile.open(bundle, "r:gz") as tar:
                    tar.extractall(folder, filter="data")
            except (OSError, EOFError, tarfile.TarError) as exc:
                msg = f"{bundle} is not a safe 1xops enterprise bundle: {exc}"
                console.print(Text(msg, style="red"), soft_wrap=True)
                return 2
    for step in steps:
        # the host takes no scope for a marketplace update
        step = [*step] if step[2:4] == ["marketplace", "update"] else [*step, "--scope", args.scope]
        console.print(Text(f"$ {' '.join(step)}", style="bold"), soft_wrap=True)
        if not args.yes:
            continue
        code, out = _run(step, timeout=180)
        console.print(out, markup=False, highlight=False, soft_wrap=True)
        # removing the edition being replaced may fail harmlessly: it was not installed
        if code != 0 and "uninstall" not in step and "remove" not in step:
            return code
    if not args.yes:
        console.print("Dry run. Re-run with --yes to install.")
    return 0


# ── config ──────────────────────────────────────────────────────────────────


def diff_lines(a: list[str], b: list[str]) -> list[str]:
    """A line diff by longest common subsequence, removed lines first: the same algorithm as the Node.js CLI
    (diffLines in commands.mjs), so both print the same preview for any file. Settings files are small."""
    n, m = len(a), len(b)
    lcs = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            lcs[i][j] = lcs[i + 1][j + 1] + 1 if a[i] == b[j] else max(lcs[i + 1][j], lcs[i][j + 1])
    out, i, j = [], 0, 0
    while i < n or j < m:
        if i < n and j < m and a[i] == b[j]:
            out.append(f" {a[i]}")
            i, j = i + 1, j + 1
        elif i < n and (j == m or lcs[i + 1][j] >= lcs[i][j + 1]):
            out.append(f"-{a[i]}")
            i += 1
        else:
            out.append(f"+{b[j]}")
            j += 1
    return out


def _show_change(path: Path, before: dict, after: dict, lines_too: bool = True) -> bool:
    if before == after:
        console.print(Text(f"{path}: already up to date", style="dim"), soft_wrap=True)
        return False
    lines = [
        line
        for line in diff_lines(s.dumps(before).splitlines(), s.dumps(after).splitlines())
        if line[0] != " "
    ]
    added, removed = sum(line[0] == "+" for line in lines), sum(line[0] == "-" for line in lines)
    console.print(
        Text(f"{path}: {added} lines added, {removed} removed", style="bold"), soft_wrap=True
    )
    for line in lines if lines_too else []:
        console.print(Text(line, style="green" if line[0] == "+" else "red"), soft_wrap=True)
    return True


def _write(path: Path, data: dict) -> None:
    s.write(path, s.dumps(data))


def _resolve(args: argparse.Namespace) -> tuple[str, Path, Path | None, dict[str, dict]]:
    """Scope, folder, org output and {connector: values}, from .env.1xops or the flags."""
    if args.file:
        cfg = cf.load(Path(args.file))
        base = Path(args.file).resolve().parent  # a relative folder means: relative to this file
        out = (base / cfg["out"]).resolve() if cfg["out"] else None
        return cfg["scope"], (base / cfg["dir"]).resolve(), out, cfg["connectors"]
    out = Path(args.out).resolve() if args.out else None
    return args.scope, Path(args.dir).resolve(), out, {c: {} for c in args.connectors}


def cmd_config(args: argparse.Namespace) -> int:
    try:
        return _config(args)
    except (ValueError, OSError) as exc:
        console.print(Text(str(exc), style="red"), soft_wrap=True)
        return 2


def _config(args: argparse.Namespace) -> int:
    try:
        scope, project, out, connectors = _resolve(args)
        profiles = [(s.load_profile(name), values) for name, values in connectors.items()]
    except (ValueError, OSError) as exc:
        console.print(f"[red]{exc}[/]")
        return 2
    personal = scope in ("local", "personal")
    servers: dict = {}
    wanted = s.template(scope)
    for profile, values in profiles:
        # Shared files keep ${VAR}; private host config gets the person's values.
        servers.update(
            cf.substitute(profile["mcpServers"], values) if personal else profile["mcpServers"]
        )
        wanted = s.merge(wanted, {"permissions": profile.get("permissions", {})})

    planned: list[tuple[Path, dict]] = []
    target = s.settings_path(scope, project, out)
    before = s.read_json(target)
    after = s.merge(before, wanted)
    if _show_change(target, before, after, args.preview != "summary"):
        planned.append((target, after))

    host_cmds: list[list[str]] = []
    if servers:
        mcp_file = s.mcp_path(scope, project, out)
        if mcp_file:
            before = s.read_json(mcp_file)
            after = s.merge(before, {"mcpServers": servers})
            if _show_change(mcp_file, before, after, args.preview != "summary"):
                planned.append((mcp_file, after))
        else:
            host_scope = "user" if scope == "personal" else "local"
            for name, spec in servers.items():
                host_cmds.append(
                    [s.HOST, "mcp", "add-json", "-s", host_scope, name, json.dumps(spec)]
                )
                console.print(f"[bold]$ {s.HOST} mcp add-json -s {host_scope} {name} '…'[/]")

    if not args.yes:
        if not args.preview:
            console.print("Dry run. Re-run with --yes to write these changes.")
        return 0
    if host_cmds and not shutil.which(s.HOST):
        console.print(
            f"[red]{scope} scope adds connectors through the '{s.HOST}' CLI, which is not installed. "
            "Nothing was written. Install it, or use --scope team.[/]"
        )
        return 1
    for path, data in planned:
        _write(path, data)
        console.print(f"[green]wrote {path}[/]")
    for cmd in host_cmds:
        code, msg = _run(cmd)
        console.print(msg)
        if code != 0:
            return code
    if scope == "org":
        console.print(f"Give these files to IT to install in: {s.managed_dir()}")
    if not personal and any(values for _, values in profiles):
        console.print('Shared files use ${VAR}. Load your values with: eval "$(1xops env)"')
    return 0


TENANTS_AT_ONCE = (
    8  # each check signs in to AWS and Azure: a limit keeps 200 tenants from 400 sign-ins at once
)


def cmd_tenants(args: argparse.Namespace) -> int:
    """One line per tenant folder (a folder with its own .env.1xops) under a folder. Changes nothing."""
    root = Path(args.folder)
    folders = (
        sorted(p for p in root.iterdir() if p.is_dir() and (p / cf.DEFAULT_FILE).is_file())
        if root.is_dir()
        else []
    )
    if not folders:
        print(f"No tenant folders (a folder with its own {cf.DEFAULT_FILE}) under {root}.")
        return 0
    from concurrent.futures import ThreadPoolExecutor

    cmd = [sys.executable, "-P", "-m", "one_xops.cli", "doctor", "--brief", "--within", "8"]

    def check(folder: Path) -> tuple[int, list[str]]:
        p = subprocess.run(
            cmd,
            cwd=folder,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        return p.returncode, [ln for ln in p.stdout.splitlines() if ln.strip()]

    with ThreadPoolExecutor(max_workers=TENANTS_AT_ONCE) as pool:
        results = list(pool.map(check, folders))
    need = 0
    for folder, (code, lines) in zip(folders, results, strict=True):
        if code != 0:
            need += 1
            first = scrub(lines[-1]) if lines else "no output"
            print(f"✗ {folder.name}: the check failed (exit {code}): {first}")
        elif lines:
            need += 1
            more = f" (+{len(lines) - 1} more)" if len(lines) > 1 else ""
            print(f"✗ {folder.name}: {scrub(lines[0])}{more}")
        else:
            print(f"✓ {folder.name}: ready")
    print(f"{len(folders)} tenants, {need} need attention")
    return 1 if need else 0


def cmd_env(args: argparse.Namespace) -> int:
    """Print `export VAR=value` lines from .env.1xops, for team and org scopes."""
    try:
        cfg = cf.load(Path(args.file))
    except (ValueError, OSError) as exc:
        print(exc, file=sys.stderr)
        return 2
    for key, value in cfg["values"].items():
        if value == "~" or value.startswith("~/"):
            value = os.path.expanduser(value)
        print(f"export {key}={shlex.quote(value)}")
    return 0


def cmd_profiles(args: argparse.Namespace) -> int:
    print("1xops profiles is deprecated: use 1xops connectors", file=sys.stderr)
    return cmd_connectors(args)


def cmd_connectors(_: argparse.Namespace) -> int:
    table = Table(title="Connectors")
    for col in ("connector", "servers", "values (.env.1xops keys)", "description"):
        table.add_column(col)
    for name in s.builtin_profiles():
        p = s.load_profile(name)
        table.add_row(
            name,
            ", ".join(p["mcpServers"]),
            ", ".join(cf.variables(p)) or "—",
            p.get("description", ""),
        )
    console.print(table)
    console.print("Use your own: a .json file with an 'mcpServers' object, as a connector name.")
    return 0


# ── entry point ─────────────────────────────────────────────────────────────


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="1xops", description="1xops by OceanSoft.io")
    parser.add_argument("--version", action="version", version=f"1xops {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("doctor", help="check prerequisites, sign-in and connectors")
    p.add_argument("--aws-profile", help="AWS profile to check (default: current)")
    p.add_argument(
        "--file", default=cf.DEFAULT_FILE, help="connectors to check (default: .env.1xops)"
    )
    p.add_argument(
        "--brief", action="store_true", help="only connectors that are not ready, one line each"
    )
    p.add_argument("--hook", action="store_true", help="--brief in the host's session-start format")
    p.add_argument("--within", type=_seconds, help="seconds to spend, with --brief or --hook")
    p.add_argument(
        "--probe",
        action="store_true",
        help="send one request to each connector that signs in with a header token",
    )
    p.set_defaults(func=cmd_doctor)

    p = sub.add_parser("install", help="add the marketplaces and install the plugin")
    p.add_argument(
        "--scope",
        choices=("user", "project", "local"),
        default="user",
        help="host install scope: user (default), project (shared), local",
    )
    p.add_argument(
        "--edition",
        choices=("free", "enterprise"),
        default="free",
        help="free (default) or enterprise",
    )
    p.add_argument("--file", help="enterprise: the bundle downloaded from your order")
    p.add_argument(
        "--version",
        dest="pin",
        metavar="X.Y.Z",
        help="free edition: install this released version (roll back), or latest to return",
    )
    p.add_argument("--yes", action="store_true", help="run the commands (default: show them)")
    p.set_defaults(func=cmd_install)

    p = sub.add_parser("config", help="write settings and connectors for a scope")
    p.add_argument(
        "--scope",
        choices=s.SCOPES,
        default="team",
        help="org: managed files for IT · team: shared project settings (use --dir "
        "for a tenant folder) · local: you, this project · personal: you, every project",
    )
    p.add_argument("--dir", default=".", help="project or tenant folder (team/local scopes)")
    p.add_argument("--out", help="output folder for org scope (default: current folder)")
    p.add_argument(
        "--connectors",
        nargs="*",
        default=[],
        metavar="PROFILE",
        help="built-in profile names (see '1xops connectors') or .json files",
    )
    p.add_argument("--file", help="read scope, folder and connector values from .env.1xops")
    p.add_argument("--yes", action="store_true", help="write the changes (default: show a diff)")
    # used by setup: "summary" shows each file's line counts, "full" every line; neither prints the dry-run hint
    p.add_argument("--preview", choices=("summary", "full"), help=argparse.SUPPRESS)
    p.set_defaults(func=cmd_config)

    p = sub.add_parser("env", help="print export lines for the values in .env.1xops")
    p.add_argument("--file", default=cf.DEFAULT_FILE)
    p.set_defaults(func=cmd_env)

    p = sub.add_parser("setup", help="guided setup: asks questions, writes .env.1xops")
    p.add_argument("--file", default=cf.DEFAULT_FILE)
    p.set_defaults(func=wizard.run)

    p = sub.add_parser("tenants", help="status of every tenant folder under a folder")
    p.add_argument(
        "folder", nargs="?", default=".", help="the folder that holds the tenant folders"
    )
    p.set_defaults(func=cmd_tenants)

    p = sub.add_parser("connectors", help="list the built-in connectors: aws, azure, itsm")
    p.set_defaults(func=cmd_connectors)
    p = sub.add_parser("profiles")  # deprecated in 0.4: still works, says the new name
    p.set_defaults(func=cmd_profiles)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
