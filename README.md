# 🥇 ONE 🧰 Cloud & AI Operations ⚙️

**Build your own plugin from approved, proven parts. Keep your team in control.**

1xops is a free, open-source toolkit from [OceanSoft.io](https://www.oceansoft.io) that acts as a trusted advisor for your team's assistant. Show it a job your team already does, and it builds your own plugin from approved, tested parts, so your team spends its time on the business result rather than on choosing and wiring tools. It also connects the assistant to your cloud accounts and your Jira and Confluence, read-only, for one person, a team or a whole organisation.

> **Status:** v0.3.1 is published on [PyPI](https://pypi.org/project/1xops/), [npm](https://www.npmjs.com/package/1xops), [Docker Hub](https://hub.docker.com/r/nnthanh101/1xops) and [ghcr.io](https://github.com/users/nnthanh101/packages/container/package/1xops).

## What you can do today

| You are | You get |
|---|---|
| A team lead | Show the last time you did a job; get your own plugin built from approved parts, with its licence and origin kept and nothing shipped before review |
| A platform lead | One command sets up the same connections and safeguards for every team, project or person, from one file |
| An engineer | A check of what is installed and signed in on your machine, with the fix for anything missing |
| A security or compliance lead | Connections to your cloud accounts and Jira that can read but not change anything, and a preview of every change before it is made |

## Commands

| Command | What it does |
|---|---|
| `1xops doctor` | Each tool, sign-in and connector as ready, check, signed out, wrong account or missing, with a score and one fix each. Account and Azure IDs masked. Changes nothing |
| `1xops doctor --brief` | Only the connectors that are not ready, one line each; the plugin runs it when a session starts |
| `1xops doctor --probe` | Also sends one request to each connector that signs in with a header token, to see if it answers |
| `1xops install --yes` | Adds the marketplaces and installs the 1xops plugin |
| `1xops setup` | Guided: asks a few questions, writes `.env.1xops`, signs in and checks access is read-only |
| `1xops config --scope org\|team\|local\|personal` | Settings and connectors for a scope; shows the change, writes it with `--yes` |
| `1xops env` | Export lines for the values in `.env.1xops` |
| `1xops tenants [FOLDER]` | The status of every tenant folder under a folder |
| `1xops connectors` | The built-in connectors (aws, azure, itsm), their servers and the `.env.1xops` keys each needs |

## Planned

| Outcome | For | Story |
|---|---|---|
| The assistant asks before any AWS or Azure write, or a call on an expired sign-in or the wrong account | Cloud engineers | [1XOPS-010](https://github.com/nnthanh101/1xops/issues/43) |
| Runbooks, change requests, status reports and risk assessments from your own tools, read-only, in 15 minutes | Platform engineers | [1XOPS-011](https://github.com/nnthanh101/1xops/issues/48) |

Cost checks, change requests from a Terraform plan, AI spend, evidenced runbooks and status from the project board are in the enterprise edition at [shop.oceansoft.io](https://shop.oceansoft.io).

## Get started

```bash
uv tool install 1xops     # or: npm install -g 1xops  (Node.js only, no Python)
1xops install --yes       # add the 1xops plugin to your assistant
1xops setup               # choose connectors; every change is shown before it is written
```

Then, in your assistant, five steps build your own plugin, free and included: `/1xops:check` says what is ready and what to turn on, `/1xops:discover` turns a job you already do into a workflow spec, `/1xops:plugin` makes the plugin from it (or copies a catalogue plugin as your own, or changes one you own), `/1xops:overview` gives it two professional outputs from one set of facts (an Excel workbook where each role owns its own sheet, and one page your leadership can read), and `/1xops:improve` turns every correction into a test for the next version. The operations playbooks (`/1xops:change-request`, `vendor-review`, `process-doc`, `capacity-plan`, `compliance-tracking`, per tenant) are in the enterprise edition, built with the same builder.

**Upgrade to the enterprise edition:** buy it at [shop.oceansoft.io](https://shop.oceansoft.io), download the bundle from your order, then run `1xops install --edition enterprise --file 1xops-enterprise-x.y.z.tar.gz --yes`. Same `/1xops:*` names, one plugin: the free edition is replaced, nothing to relearn. `1xops doctor` shows the installed edition. It shows each connector as **ready**, **signed out** or **missing**, with the exact fix, and changes nothing. The same check runs on the command line as `1xops doctor`. See [setup](docs/setup.md).

## Your data stays yours

- **Read-only identities.** Connect with read-only sign-ins only: an AWS read-only role, an Azure Reader identity. `1xops doctor` shows the access of each sign-in and flags any that can change things.
- **Read-only connections.** AWS, Azure and Jira/Confluence are connected through each vendor's own server, pinned to a known version. Azure runs in read-only mode, and every Jira or Confluence action asks first.
- **Nothing changes until you say yes.** Every configuration change is shown first and written only when you confirm.
- **No secrets in files.** Sign-in stays with AWS SSO, `az login` and Atlassian's own sign-in.

### Read-only checks in a container

Sign in on your machine (`aws sso login`, `AZURE_CONFIG_DIR=~/.azure-reader az login`), then run the checks in the image, which carries the AWS CLI, the Azure CLI and `gh`. The container sees only your settings file, your AWS config and SSO sign-in (read-only), and the Azure Reader identity's own folder. It cannot reach your SSH keys, other sign-ins or any project's `.env`:

```bash
docker run --rm \
  -v "$PWD/.env.1xops:/work/.env.1xops:ro" \
  -v "${AWS_CONFIG_FILE:-$HOME/.aws/config}:/home/os/.aws/config:ro" -e AWS_CONFIG_FILE=/home/os/.aws/config \
  -v "$HOME/.aws/sso:/home/os/.aws/sso:ro" \
  -v "$HOME/.azure-reader:$HOME/.azure-reader" -e AZURE_CONFIG_DIR="$HOME/.azure-reader" \
  nnthanh101/1xops doctor
```

The `isolation` row shows what the container can reach. It is **ready** when the AWS folder is read-only, the Azure folder is its own, and there are no SSH keys, no static AWS credentials and no `.env` files. Otherwise its fix names the mount to remove. When a sign-in ends, the fix says to sign in again on your machine; nothing in the container signs in or writes to your AWS folder. The Azure folder is mounted at the same path because a Reader service principal's certificate is stored by its full path. A token in the mounted sign-in can still be read inside the container, so the identity itself must be read-only.

## Free vs paid

| | 1xops (this repository) | OceanSoft Cloud & AI Operations |
|---|---|---|
| Price | Free, Apache-2.0 | Fixed-price assessment, then monthly |
| Who runs it | You, on your own systems | OceanSoft, with your team |
| What you get | Self-serve setup, checks and playbooks | **Assessment:** a read-only review of your AWS, Azure and AI spend, with priced findings, evidence and a 90-day plan. **Managed:** OceanSoft runs the approved automations and reports verified savings every month. |
| Where | GitHub | [www.oceansoft.io](https://www.oceansoft.io) · [shop.oceansoft.io](https://shop.oceansoft.io) |

OceanSoft helps NZ and Australian businesses implement and maintain practical AWS, Azure and AI workflows.

## Contributing

Ideas and bugs: [open an issue](https://github.com/nnthanh101/1xops/issues). To contribute code, start with [setup](docs/setup.md).

## Licence

Apache-2.0 ([LICENSE](LICENSE)). Copyright, trademarks and third-party components: [NOTICE](NOTICE).
