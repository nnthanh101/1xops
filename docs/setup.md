# Setup

Two audiences: people who **use** 1xops, and the maintainer who **releases** it. Decisions behind each step are in [docs/adr](adr/).

## Use 1xops

| Step | Command |
|---|---|
| Check prerequisites and sign-in | `uvx 1xops doctor` |
| Install the plugin, or update an existing install | `uvx 1xops install --yes` |
| Go back one release (same day, no waiting for a fix) | `uvx 1xops install --version 0.4.0 --yes`, then restart the assistant |
| Return to the latest release | `uvx 1xops install --version latest --yes` |
| Configure (guided) | `uvx 1xops setup` or `npx 1xops setup` → writes `.env.1xops`, shows the diff, asks before writing |
| Configure (file) | `uvx 1xops config --file .env.1xops --yes` |
| Team or org scope: load your values | `eval "$(uvx 1xops env)"` |

Scopes, the `.env.1xops` format and the connector profiles are in the [command-line README](../packages/python/README.md). Keep a personal `1xops.yaml` out of git.

Going back one release removes the plugin's marketplace, adds it back at that release's tag and installs it: the assistant keeps the source a marketplace was first added with, so a re-add alone changes nothing. Your settings and `.env.1xops` are not touched.

## Contribute (every clone)

```bash
git clone --recurse-submodules https://github.com/nnthanh101/1xops && cd 1xops
git config core.hooksPath .githooks      # secret scan, commit message and quick checks, as advice
git config submodule.recurse true       # every pull also updates upstream/
# every push from a branch other than develop or main runs the tests locally with act first (.githooks/pre-push)
```

Shared settings (permissions, plugin marketplaces, enabled plugins) come from `.claude/settings.json` in Git. Personal additions go in `.claude/settings.local.json`, which Git ignores.

Done means every acceptance criterion is proven on what the customer receives (the published package or the real asset), in a clean environment, with the command and its real output posted on the issue; only the maintainer closes it, and pull requests say `Refs #N`, never `Closes`.

Rules: one capability per pull request, proven on a real asset (fixtures are for tests only); official vendor libraries only, and anything third-party needs the maintainer's approval and a line in [NOTICE](../NOTICE).

Flow ([ADR 0003](adr/0003-git-standard.md)):

1. A session works on its own `feature/*` branch, syncs `develop` into it and proves it locally (pre-push runs the tests with act).
2. It lands the change on `develop` **staged, not committed** (`git merge --squash`), then deletes the feature branch locally and on GitHub.
3. The maintainer reviews `git diff --staged`, commits and pushes `develop`. GitHub runs the tests (the Release workflow; it publishes only from a `v*` tag).
4. `develop` reaches `main` by a pull request the maintainer merges; each release is a `v*` tag on `main`.

Sessions never commit, merge or push on `develop` or `main`, and never merge pull requests. GitHub Actions runs only for `develop`, `main`, tags, the monthly schedule or by hand.

## Release (maintainer, once)

Each step names who does it. Tokens are typed only by the maintainer, never by a session, and never into a file in the repository.

| # | Step | Where | Who | Done when |
|---|---|---|---|---|
| 1 | Rulesets: `develop` and `main` cannot be force-pushed or deleted; `main` takes only a pull request | `gh api` (below) | session, with the maintainer's yes | `bash ../landing-zone/scripts/git-standard.sh audit .` shows `rules` pass |
| 2 | Environment `release`: required reviewer = maintainer; deployments from tags `v*` only | Settings → Environments | session, with the maintainer's yes | the release waits for approval |
| 3 | PyPI trusted publisher (pending): project `1xops` (registered 2026-11-17), owner `nnthanh101`, repo `1xops`, workflow `release.yml`, environment `release` | pypi.org → Your account → Publishing | maintainer, browser | listed under pending publishers |
| 4 | npm, first release only: granular token, *publish* on package `1xops`, 7-day expiry | npmjs.com → Access Tokens | maintainer | `gh secret set NPM_TOKEN --env release -R nnthanh101/1xops` |
| 5 | Docker Hub mirror: access token, *Read & Write*, repository `nnthanh101/1xops` | hub.docker.com → Personal access tokens | maintainer | `gh secret set DOCKERHUB_USERNAME --env release` and `gh secret set DOCKERHUB_TOKEN --env release` |
| 6 | Actions may open pull requests (monthly upstream bump) | Settings → Actions → General | session, with the maintainer's yes | the bump workflow opens its PR |
| 7 | Local act secrets | `cp .secrets.act.example .secrets`, filled in by the maintainer | maintainer | `.secrets` stays untracked |

After the first release:

| # | Step | Who |
|---|---|---|
| 8 | npm → package `1xops` → Settings → Trusted publisher: GitHub Actions, `nnthanh101/1xops`, `release.yml`, environment `release`; then `gh secret delete NPM_TOKEN --env release` and revoke the token | maintainer |
| 9 | ghcr.io package `1xops` → visibility *public*, linked to the repository | maintainer |
| 10 | Review the Docker Hub waiver by its date in [ADR 0002](adr/0002-release-identity.md) | maintainer |

Step 1 commands (read them before running; each applies one ruleset):

```bash
gh api -X POST repos/nnthanh101/1xops/rulesets --input .github/rulesets/develop.json
gh api -X POST repos/nnthanh101/1xops/rulesets --input .github/rulesets/main.json
```

## Release a version

1. Set the version on `develop` and push it. If you skip this, `task release` stops and prints the one line to run.
2. `task release VERSION=x.y.z STORY=n`, then approve the `release` environment once, at the link it prints. It merges `develop` into `main` once the checks pass, tags it, waits for PyPI, npm and the images, installs the release from every channel in clean containers and keeps that proof in `tmp/` (never posted: it can carry tenant names).

`task status` shows what customers can install today, the proof kept in `tmp/` and CI health.

### Continuous delivery

| Step | What runs | Who |
|---|---|---|
| Every change | `task gate`: lint, tests, the Release workflow with act, the image, the UX proof, and, when the plugin changed since the last release, `task evals` (each case's score with the plugin, without it, and the gain) | the session, before a hand-over |
| Early access | ring 0: the maintainer and working sessions run `develop` (the marketplace source `nnthanh101/1xops#develop`); ring 1: the first customer's own folder runs the candidate for its next real job before the release | no extra approval |
| Release | `task release`: the gate, one approval, the publish, `verify-release.sh` on every channel, then `task member-proof` (a new member installs the release and builds and copies a plugin from synthetic inputs) | the owner approves once |
| After a bad release | `1xops install --version <previous> --yes` for anyone affected, then a patch | anyone |
| Every month | `task metrics`: releases a week, lead time, change failure rate, time to restore | the owner reads it |

Model runs in `task evals` and `task member-proof` use your own sign-in and cost money; `task evals` stops at `MAX_USD` (15 by default). Their reports stay in `tmp/` and are never published.
