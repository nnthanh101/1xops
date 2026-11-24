# 🥇 ONE 🧰 Cloud & AI Operations ⚙️

**Turn a job your team already does into your own plugin, from approved parts. Keep every decision with your people.**

1xops is a free, open-source builder. You show it one real job: a store change, a cost review, an incident. It interviews
the people who own the job, builds a plugin your team runs with one command, and hands the board one page and each role
one sheet. Nothing is published, merged or changed without a yes.

> **Status:** v0.4.4 on [PyPI](https://pypi.org/project/1xops/), [npm](https://www.npmjs.com/package/1xops), [Docker Hub](https://hub.docker.com/r/nnthanh101/1xops) and [ghcr.io](https://github.com/users/nnthanh101/packages/container/package/1xops).

## Why I built 1xops

> Shoppers describe what they need; they rarely know a product's name. I wanted my store to answer them and fill the
> cart, on both of my storefronts, while I keep the store, the prices and every decision. 1xops built that plugin from
> one job I already do. Start with yours: `git clone`, then `/1xops:check`.

## Who it is for

| You are | Your question | What you get |
|---|---|---|
| **The business owner** | Is this worth doing, and what do I decide? | One page: the outcome in your words, what changes, what is inside, what is proven and the one decision asked |
| **The engineering lead** | Can my team run it, and is it built from parts we trust? | A plugin in your own repository, built only from approved catalogue parts, validated and loaded before it is called built |
| **Finance** | What does it cost, and what did it return? | Only measured figures. Anything not measured yet is said once, plainly, never estimated |
| **Security** | What can it touch? | Read-only by default; every change waits for a named person's yes |
| **A forward deployed engineer** | How do I get a customer from idea to a working pilot? | Five commands, the same at every customer, with the customer's own words and brand in every output |

## The lifecycle: five commands

```text
check  →  discover  →  plugin  →  overview  →  improve  ↺
ready?    the job       build it    one page +   every correction
          in their      from        one sheet    becomes a test for
          words         approved    per role     the next version
                        parts
```

| Step | You type | What happens | You get |
|---|---|---|---|
| 1 | `/1xops:check` | Reads what is installed and signed in on this machine. Changes nothing | Each tool and connection as ready or not, most important first, with one fix each |
| 2 | `/1xops:discover` | Starts from **"show me the last time you did this job"**. Reads your own pages and documents, says back what it found in five lines, then interviews you **with scored options** | `workflows/<job>/spec.md` and `plugin.xlsx` |
| 3 | `/1xops:plugin make` | Shows one plan, waits for your yes, then builds from approved parts only | `plugins/<name>/` in your own folder, checked to load |
| 4 | `/1xops:overview` | Turns the same facts into two outputs that stay in sync | `plugin-overview.html` for the board, `plugin.xlsx` for the team |
| 5 | `/1xops:improve` | Turns today's corrections and decisions into tests and instruction lines, applied only after a yes | A better next version, back to step 3 |

### Discover asks, you pick

Every interview round is a short set of questions, each with two to four options in your business words. Each option
has a score and the value it gives, and the recommended one comes first:

```text
Who should this serve first?
  1. Shoppers, then the store team who edit the theme (Recommended) · 93 · fewer lost sales, no code for daily edits
  2. The store team only                                            · 71 · faster edits, shoppers unchanged
  3. Other: type your own
```

Options come from what it read about your business, never from an industry default. It never proposes a number or a
date you did not give. What you cannot answer is marked open, with the role who owns it, and the interview goes on.

### Two outputs, one set of facts

- **`plugin-overview.html`: one page the board reads in two minutes.** The outcome in your words and who it serves.
  What changes (today and with the plugin, measured or in your own words). The decision asked. **What's inside**: every
  helper, command, skill and connection, grouped, each with what it does for whom. Gaps are said once, as "Not proven
  yet". How it is built stays in a closed section for reviewers.
- **`plugin.xlsx`: one workbook, one sheet per role.** It opens straight in Excel. The business owner owns Business,
  Job and Business rules. The engineer owns Integrations and Components; Components is grouped by kind, so the parts
  read in order. The administrator owns Access. The reviewer owns Proof. Edit a sheet, and the plugin and the page
  follow after a yes.

## Real-world scenarios

Start from the closest one. Each is a set of questions, not answers: every figure comes from your own last run.

| Scenario | The decision it supports | You bring |
|---|---|---|
| **Storefront and shopping assistant** | May shoppers ask in their own words and get the product in their cart, the same on the Shopify theme and the Next.js site? | your store's public pages, the theme your team edits |
| **Store change on every channel** | Is this change ready to ship on every channel? | the last change, its pages and checks |
| **Cloud cost review** | Which costs do we cut this month, and who approves each? | a billing export, read-only sign-in |
| **Cloud operations** | Is this change or incident handled by the runbook? | runbooks, change records, alerts |
| **AI spend and use** | Is AI use inside budget and policy, team by team? | usage exports, the approved tool list |
| **Answer-engine content** | Will buyers and assistants find and trust our product pages? | product and guide pages, search exports |

A worked example: a Shopify brand wants shoppers to find products by describing them. `check` says the folder is ready.
`discover` reads the store's public pages and asks three rounds of scored questions. `plugin make` builds
`plugins/1commerce/`. `overview` gives the board one page and the team one workbook. `improve` keeps what the owner
corrected.

## Get started

```bash
uv tool install 1xops     # or: npm install -g 1xops  (Node.js only, no Python)
1xops install --yes       # adds the 1xops plugin
1xops setup               # choose connections; every change is shown before it is written
```

Then type `/1xops:check` in your assistant, and follow the five steps. To try it in one folder first:

```bash
git clone https://github.com/nnthanh101/1xops your-1xops && cd your-1xops
```

and open your assistant there with the plugin from `plugins/1xops` loaded.

## Command line

| Command | What it does |
|---|---|
| `1xops doctor` | Each tool, sign-in and connection as ready, check, signed out, wrong account or missing, with one fix each. IDs masked. Changes nothing |
| `1xops doctor --brief` | Only what is not ready, one line each |
| `1xops install --yes` | Adds the marketplaces and installs the 1xops plugin |
| `1xops setup` | Guided: writes `.env.1xops`, signs in and checks access is read-only |
| `1xops config --scope org\|team\|local\|personal` | Settings and connections for a scope; shows the change, writes it with `--yes` |
| `1xops tenants [FOLDER]` | The status of every tenant folder under a folder |
| `1xops connectors` | The built-in connections (aws, azure, itsm) and the settings each needs |

## Your data stays yours

- **Read-only by default.** AWS read-only roles, an Azure Reader identity, read-only store and site reads. `1xops doctor` flags any sign-in that can change things.
- **Nothing changes until you say yes.** Every build, file and configuration change is shown first.
- **No secrets in files.** Sign-in stays with each provider's own sign-in. The interview never asks for passwords, keys or tokens.
- **Your brand, your folder.** Outputs carry your name and colours, and live in your own repository.

The read-only container check is described in [setup](docs/setup.md).

## Free and paid

| | 1xops (this repository) | Enterprise edition |
|---|---|---|
| What | The five-step builder, the catalogue of approved parts, the command line | The same `/1xops:*` commands, plus ready-made plugins and the operations playbooks, built the same way |
| Who runs it | Your team | Your team, with engineers beside you for the pilot |
| Price | Free and open source | [oceansoft.io](https://www.oceansoft.io) |

## Contributing

Ideas and bugs: [open an issue](https://github.com/nnthanh101/1xops/issues). To contribute code, start with [setup](docs/setup.md).

## Licence

Apache-2.0 ([LICENSE](LICENSE)). Copyright, trademarks and third-party components: [NOTICE](NOTICE).
