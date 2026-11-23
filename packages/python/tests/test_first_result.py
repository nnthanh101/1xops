"""TEST-001 (#22) for story #5: `1xops doctor` / `/1xops:check` shows each connector as ready, signed out or
missing with the exact fix, and changes nothing. Fake `aws` and `az` programs stand in for the real tools, so the
real subprocess path runs offline. Fixtures are for tests only; the release proof uses the published artifacts."""

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from one_xops import cli

REPO = Path(__file__).resolve().parents[3]

AWS_SHIM = """#!/bin/sh
echo "aws $*" >> "$SHIM_LOG"
role() { echo '{"Account":"123456789012","Arn":"arn:aws:sts::123456789012:assumed-role/'"$1"'/me"}'; }
case "$FAKE_AWS" in
  ready) role ReadOnlyAccess ;;
  admin) role AdministratorAccess ;;
  expired) echo "The SSO session associated with this profile has expired" >&2; exit 255 ;;
  notfound) echo "The config profile (readonly) could not be found" >&2; exit 255 ;;
esac
"""
AZ_SHIM = """#!/bin/sh
echo "az $*" >> "$SHIM_LOG"
case "$1 $2" in
  "account show") [ "$FAKE_AZ" = signedout ] && exit 1; echo reader@example.invalid ;;
  "role assignment")
    case "$FAKE_AZ" in
      reader) echo '["Reader","Cost Management Reader"]' ;;
      contributor) echo '["Reader","Contributor"]' ;;
    esac ;;
esac
"""


@pytest.fixture
def shims(tmp_path: Path, monkeypatch):
    """Fake aws/az first on PATH; a log of every call; a working folder with a settings file."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    for name, text in (("aws", AWS_SHIM), ("az", AZ_SHIM)):
        (bin_dir / name).write_text(text)
        (bin_dir / name).chmod(0o755)
    log = tmp_path / "calls.log"
    log.touch()
    work = tmp_path / "work"
    work.mkdir()
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ['PATH']}")
    monkeypatch.setenv("SHIM_LOG", str(log))
    for var in ("AWS_BILLING_PROFILE", "AWS_OPERATIONS_PROFILE", "FAKE_AWS", "FAKE_AZ"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.chdir(work)

    class Ctx:
        calls = lambda self: log.read_text().splitlines()
        folder = work

        def settings(self, text: str) -> str:
            (work / ".env.1xops").write_text(text)
            return str(work / ".env.1xops")

    return Ctx()


def tree_hash(folder: Path) -> str:
    h = hashlib.sha256()
    for p in sorted(folder.rglob("*")):
        h.update(str(p.relative_to(folder)).encode())
        if p.is_file():
            h.update(p.read_bytes())
    return h.hexdigest()


AWS_FILE = "ONEXOPS_CONNECTORS=aws\nAWS_BILLING_PROFILE=readonly\nAWS_OPERATIONS_PROFILE=readonly\n"


def rows_for(file: str, prefix: str) -> list[tuple[str, str, str]]:
    return [r for r in cli.check_connectors(file) if r[0].startswith(prefix)]


@pytest.mark.parametrize(
    ("mode", "status", "fix"),
    [
        ("ready", "ready", "profile readonly, account ****9012, read-only"),
        (
            "admin",
            "check",
            "profile readonly, account ****9012, can change things: use a read-only role",
        ),
        ("expired", "signed out", "aws sso login --profile readonly"),
        (
            "notfound",
            "missing",
            "profile readonly not found: aws configure sso --profile readonly, or set AWS_CONFIG_FILE",
        ),
    ],
)
def test_aws_connector_states(shims, monkeypatch, mode, status, fix):
    monkeypatch.setenv("FAKE_AWS", mode)
    rows = rows_for(shims.settings(AWS_FILE), "aws ")
    assert [r[0] for r in rows] == ["aws AWS_BILLING_PROFILE", "aws AWS_OPERATIONS_PROFILE"]
    assert all(r[1] == status and r[2] == fix for r in rows)


def test_aws_profile_not_set_says_where_to_set_it(shims):
    rows = rows_for(shims.settings("ONEXOPS_CONNECTORS=aws\n"), "aws ")
    assert (
        "aws AWS_BILLING_PROFILE",
        "missing",
        "set AWS_BILLING_PROFILE in .env.1xops or the shell (1xops setup)",
    ) in rows
    assert shims.calls() == []  # no profile, so no call at all


def test_aws_cli_missing_says_install(shims, monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda _name: None)
    rows = rows_for(shims.settings(AWS_FILE), "aws ")
    assert {r[1:] for r in rows} == {("missing", "install the AWS CLI")}


@pytest.mark.parametrize(
    ("mode", "status", "fix"),
    [
        (
            "signedout",
            "signed out",
            "az login with a read-only (Reader) identity, in its own AZURE_CONFIG_DIR",
        ),
        ("contributor", "check", "can change things: use a read-only (Reader) identity"),
        ("reader", "ready", "read-only"),
    ],
)
def test_azure_connector_states(shims, monkeypatch, mode, status, fix):
    monkeypatch.setenv("FAKE_AZ", mode)
    assert rows_for(shims.settings("ONEXOPS_CONNECTORS=azure\n"), "azure") == [
        ("azure", status, fix)
    ]


def test_http_connectors_say_where_to_sign_in(shims):
    rows = cli.check_connectors(shims.settings("ONEXOPS_CONNECTORS=itsm\n"))
    assert rows == [
        ("atlassian", "check", "signs in inside the host: run /mcp and choose atlassian")
    ]


def test_empty_and_refused_settings_say_missing_with_the_reason(shims):
    empty = cli.check_connectors(shims.settings("ONEXOPS_CONNECTORS=\n"))
    assert empty[0][:2] == ("connectors", "missing") and "run 1xops setup" in empty[0][2]
    refused = cli.check_connectors(
        shims.settings("ONEXOPS_CONNECTORS=aws\nAWS_SECRET_ACCESS_KEY=x\n")
    )
    assert refused[0][:2] == ("connectors", "missing") and "AWS_SECRET_ACCESS_KEY" in refused[0][2]


READ_ONLY_CALLS = (
    "aws sts get-caller-identity ",
    "aws configure get ",  # local config, no call to AWS
    "az account show ",
    "az role assignment list ",
)


@pytest.mark.parametrize(
    ("aws", "az"),
    [
        ("ready", "reader"),
        ("admin", "contributor"),
        ("expired", "signedout"),
        ("notfound", "reader"),
    ],
)
def test_check_changes_nothing_and_only_reads_identity(shims, monkeypatch, aws, az):
    monkeypatch.setenv("FAKE_AWS", aws)
    monkeypatch.setenv("FAKE_AZ", az)
    file = shims.settings(
        "ONEXOPS_CONNECTORS=aws,azure,itsm\nAWS_BILLING_PROFILE=readonly\nAWS_OPERATIONS_PROFILE=readonly\n"
    )
    before = tree_hash(shims.folder)
    cli.check_connectors(file)
    assert tree_hash(shims.folder) == before
    calls = shims.calls()
    assert calls, "the shims were never reached: the check cannot pass for the wrong reason"
    assert all(c.startswith(READ_ONLY_CALLS) for c in calls), calls


@pytest.mark.skipif(not shutil.which("node"), reason="Node.js not installed")
def test_python_and_node_print_the_same_connector_rows(shims, monkeypatch):
    monkeypatch.setenv("FAKE_AWS", "expired")
    monkeypatch.setenv("FAKE_AZ", "contributor")
    file = shims.settings(
        "ONEXOPS_CONNECTORS=aws,azure,itsm\nAWS_BILLING_PROFILE=readonly\nAWS_OPERATIONS_PROFILE=readonly\n"
    )
    node_bin = REPO / "packages" / "npm" / "bin" / "1xops.mjs"
    py_main = "import sys; from one_xops.cli import main; sys.exit(main())"
    py = subprocess.run(
        [sys.executable, "-c", py_main, "doctor", "--file", file],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
        env={**os.environ, "COLUMNS": "300"},
    )
    js = subprocess.run(
        ["node", str(node_bin), "doctor", "--file", file],
        capture_output=True,
        text=True,
        timeout=180,
        check=False,
        env={**os.environ, "COLUMNS": "300"},
    )

    def connector_rows(out: str) -> list[str]:
        return [re.sub(r" +", " ", ln).strip() for ln in out.splitlines() if " connector " in ln]

    rows = connector_rows(py.stdout)
    assert len(rows) >= 4, py.stdout + py.stderr
    assert rows == connector_rows(js.stdout), js.stdout + js.stderr


# ── the plugin command and the README ────────────────────────────────────────


def front_matter(text: str) -> dict[str, str]:
    block = text.split("---")[1]
    return dict(line.split(": ", 1) for line in block.strip().splitlines())


def test_check_command_runs_only_doctor():
    text = (REPO / "plugins/1xops/skills/check/SKILL.md").read_text()
    allowed = front_matter(text)["allowed-tools"]
    assert allowed == "Bash(1xops doctor:*), Bash(command -v 1xops)"
    body = text.split("---", 2)[2].lower()
    for verb in ("aws sso login", "aws configure", " rm ", "sudo"):
        assert verb not in body, verb  # the command may name a fix, never run one
    install = re.search(r"uv tool install 1xops", text)
    assert install and "uv tool install 1xops" in (REPO / "README.md").read_text()


def test_readme_install_is_three_commands_and_licence_is_apache():
    readme = (REPO / "README.md").read_text()
    block = re.search(r"## Get started\s+```bash\n(.*?)```", readme, re.DOTALL)
    assert block, "README has no install block under 'Get started'"
    commands = [ln for ln in block.group(1).splitlines() if ln.strip()]
    assert len(commands) == 3, commands
    assert "/1xops:check" in readme
    manifest = json.loads((REPO / "plugins/1xops/.claude-plugin/plugin.json").read_text())
    assert manifest["license"] == "Apache-2.0"
    assert manifest["repository"] == "https://github.com/nnthanh101/1xops"
    assert "Apache License" in (REPO / "LICENSE").read_text()
    notice = (REPO / "NOTICE").read_text()
    assert "1xops" in notice and "OceanSoft" in notice


def test_readme_relative_links_resolve():
    readme = (REPO / "README.md").read_text()
    for target in re.findall(r"\]\((?!https?:|#|mailto:)([^)\s#]+)", readme):
        assert (REPO / target).exists(), target
