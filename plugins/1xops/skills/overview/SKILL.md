---
name: overview
description: Show a plugin you built or copied as one page a CEO, a CTO or a security lead can read, covering what it does, what it is built from, who approves what, what is proven and what comes next. Then refresh it after every change, and close a session with a recap. Use when the user says "overview", "show me the plugin", "plugin page", "wrap up", "where does my plugin stand" or "share the plugin", and at the end of /1xops:new-plugin or /1xops:customize-plugin. Works in a project folder, the desktop workspace, chat and headless runs.
---

# /1xops:overview

Usage: `/1xops:overview [plugin folder]`. Without a folder, use the plugin built or copied in this session, or ask which one.

The page is the outcome of a build: one place where the buyer sees what they now own. Its facts come from the plugin's own files, so the page never says more than the folder proves.

## Two outputs, one set of facts

| File | For | What |
|---|---|---|
| `plugin.xlsx` | the people who own the rules | data first: one sheet per role (Job, Business rules, Integrations, Access, Proof, Next), plus Components filled from the folder, a hidden `_sync` sheet and a hidden `_agents` sheet (the rules layer, below). Template: `../discover/references/plugin-template.xlsx` |
| `plugin-overview.html` | CEO, CTO, CFO, security lead, approver | one page from the same facts (template `references/overview-template.html`), light and dark, readable on a phone, printable |
| `overview.css` | the page | copied once from `references/overview.css`, linked and never inlined, never edited in the plugin |

All three live in the plugin's own folder; the workbook may also stay in `workflows/<job>/` where `/1xops:discover` wrote it. Before the first write, show the paths and ask for a yes. Write nothing else. Never touch `marketplace.json`.

## Keep the workbook and the plugin in sync

Proven on 21 Nov 2026 on a real plugin: a change on one side applied after a yes, and both sides changed at once offered as a choice. Show every difference before changing anything.

Both can be edited: an analyst changes a threshold in Excel, and an engineer changes a skill in the folder.
- `_sync` holds a fingerprint (a hash) of each fact at the last sync.
- **Only one side changed a fact:** show the difference as a short table (fact, old, new, which side) and apply it to the other side after a yes.
- **Both sides changed the same fact:** show both values and let the person pick. Never merge silently.
- **A rule the owning role did not change:** never change it on its sheet without that role's yes. Name the role in the question.
- **A fact with no fingerprint:** compare it with the plugin and with `git` history, report it as a sync gap, and offer to record its fingerprint.
- After a sync, update `_sync`, extend each edited sheet's Excel table to its last row, then refresh the page.

## 1. Read the facts

Read only what exists, and record each fact with the file it came from.

| Card on the page | Read from |
|---|---|
| Every role's decisions | `plugin.xlsx` (after the sync above) |
| Name, version, description, owner | `.claude-plugin/plugin.json` |
| The job, the owner, the decision it supports, the pass mark | the workflow spec (`workflows/<job>/spec.md`, linked in the plugin README) |
| Skills and commands, and what each can change | `skills/*/SKILL.md`, `commands/*.md` (frontmatter `allowed-tools`, and the operations table in the README) |
| Connectors | `.mcp.json`: name, host, read or write |
| Hooks | `hooks/hooks.json`: event and what it runs. Each hook is marked "runs without being asked" |
| Who it serves | the Job sheet's Who it serves row and the spec's step 1: the decision owner, who acts on the result, and the people who run the job |
| Outcome · Win · Risk if not | the Job sheet: the outcome (the measurable result), Win, when it works, and Risk, if it is not done, in the owner's words |
| Who decides what | the Start sheet (which role owns which sheet) and each sheet's Reviewed by row. One card per role: what it owns and decides; who it works with (the person, and an agent where one helps: 👤🤖); what a person approves; what it is measured by (or not yet measured); its next step from the Next sheet, with what the business risks if it is not done |
| Evidence behind the claims | for every figure and claim above the closed section: the file or command it came from and its date. A claim with no source says "not yet measured" and names what would measure it |
| Does it work | the Proof sheet and the spec's pass mark (reproduces the last real run), the Proof sheet's Place column, `1xops doctor --brief`, the Components sheet's origin and licence, and whether a second person has run it. "not yet" where nothing shows it |
| What data it uses | the Integrations sheet (source, identifier masked, time range, output format), the Business rules sheet's period, the standard a source is read in (for example a published billing format) and where results and data stay (Access sheet: destination) |
| Connectors and sign-ins | for each server in `.mcp.json`: the project's `CONNECTORS.md` if there is one (how people sign in, with its status symbol ✅ 🔑 🛠️ ⏳ ➖ as written there; the assistant's identity; when it is available) and `1xops doctor --brief` for whether it is ready now. Integrations sheet: People sign in, Assistant signs in as, Ready now, Available |
| What each part can use | the servers in `.mcp.json`, the plugin's own scripts (`scripts/`, `bin/`), and per part: an agent's `tools` list limits it, and `disallowedTools` removes tools; an agent with neither inherits every tool, shown as "every tool" in red. A skill's or command's `allowed-tools` only lets those tools run without asking, and `disallowed-tools` removes tools; any other tool still waits for the host's prompt, shown as "any tool, the host asks". Show red when `allowed-tools` lets something that changes things (Write, Edit, a broad Bash pattern, a connector write) run without asking |
| Team of agents | `agents/*.md`: each agent's job and tools, and which command or skill hands work to it. A hosted agent definition, if the plugin has one, says whether runs of many helpers are on and whether an advisor is set. Mark both "not proven" until a run shows them |
| Approval enforced | for each Access row: an ask or deny rule in the project's `.claude/settings.json` (`permissions.ask`, `permissions.deny`; a plugin cannot ship one), a `disallowed-tools` or `disallowedTools` entry, an agent's `tools` list that leaves the operation out, a hook that asks, a read-only identity, or the host's own prompt, which asks only while the person's permission mode asks. If none applies, "written only", shown as a warning |
| Places | the Proof sheet: each place (project folder, desktop workspace, chat, hosted runs) is 🟢 only when a case passed there |
| Cost of running it | the Proof sheet: Model cost (from each run's own result, for example `total_cost_usd` in a JSON result, in the currency it reports), Verdict and Reviewer minutes. Never estimate a cost and never convert a currency |
| Agents, settings | `agents/*.md`, `settings.json` |
| Origin and licence | `UPSTREAM.md` and the NOTICE line: source, pinned commit, what changed |
| Who approves each operation | the spec's authority table (step 4): read · draft · after a yes · never |
| Readiness | `1xops doctor --brief` if the command is installed (read-only), otherwise "not checked" |
| Proof | `evals/`, the spec's step 6 result, `claude plugin validate --strict` exit code if run in this session |
| Next versions | the spec's open questions and anything deferred in this session |

Rules:
- **Facts only.** A field with no source shows `not yet` (or `open`), never a guess.
- **No timings, money or volumes** unless the spec states them. Quote the owner's own words for the job and the value.
- **Mask account numbers** (`****1234`). Never name a customer or a person the spec does not name.
- **Plain words only.** Above the closed section, write for the board and the people who run the job: outcomes, money, proof, data and access. Translate a part into what it means for them ("reads billing data with a read-only identity; changes nothing"), never a tool list. The rules layer stays off the page.

### The rules layer (for agents and builders, never on the page)

The hidden `_agents` sheet and `references/agent-rules.md` in the plugin hold, for each part, its purpose, why it is there, what happens if it is missing, its business value, the critical-thinking check it applies and the mental model it uses (for example: know why a thing exists before removing it; ask what would make a result wrong). Agents read them before they act; the page never shows these labels or any checklist name.
- Fill a missing row from the plugin's own files and the spec, and mark it `open` for the owning role.
- A part with no purpose or no business value is a question for the wrap-up: keep it or remove it.

## 2. Write or refresh the page

- **First time:**
  - Copy `references/overview.css` next to the page.
  - Write `plugin-overview.html` from the template. Fill each `data-slot` (named `Sheet.field`) from the workbook or the plugin files, and delete the example content.
  - Keep the template's structure, its light and dark modes, the theme switch and its print styles.
- **Later:** Edit only the slots whose facts changed. Never rewrite the whole page.
- **Who the page is for.** The board first (chief executive, technology, finance, data and security officers), then the people who run the job (for example a platform engineer, a FinOps lead, a head of platform, a security administrator). The builder is not the audience: never name the builder, a tool or a model above the closed section at the end, and say what a part means for the business, not how it is built.
- **Order on the page:** each section answers one question the board asks, in plain words, with no role labels.
  0. A key (🟢 proven · 🟡 built, not proven · 🔵 planned) and a View for switch (Leadership, Finance, Engineering, Data, Security, All) that outlines each reader's sections and dims the rest; nothing is hidden. Tag each section with the readers it serves (`data-for`).
  1. The outcome in the owner's words, who it serves, then Outcome · Win · Risk if not.
  2. What it returns and what it costs: today, target, measured, results accepted; cost per accepted result, running cost per run, results rejected, review minutes per accepted result. Only figures the Job and Proof sheets hold.
  3. The decision asked, with who reviewed it.
  4. Who decides what: one card per role that owns a sheet, so no one person makes every decision.
  5. Does it work: reproduces the last real run, where it is proven, connections ready, approved and licensed parts, a second person can run it. Each answer with its evidence.
  6. What data it uses: sources, scope, period, the standard it is read in, where results go, where the data stays.
  7. Who can access what: how people and the service sign in to each system, read or change, how access is withdrawn and where each run's access is recorded; then the approvals and how each is enforced.
  8. Results on real cases, then the next versions. Each open question is in plain words, with the role that answers it; a question only the builder can answer (a missing rules file, a tools list) goes in the closed section.
  9. Evidence behind the claims: one note per figure or claim, with its source and date.
  10. Closed at the end, for reviewers: how it works, the parts, what each part can use, the team of agents (delete that lane when there are none).
- **Brand:** the page wears the buyer's brand from the Brand sheet:
  - the display name, the logo (`assets/logo.png` in the plugin, with an emoji fallback) and the legal line;
  - two colour tokens on the root element: `style="--brand:#…; --brand-accent:#…"`.
  The stylesheet lightens the brand colour in dark mode. With no Brand sheet, keep the neutral defaults; never invent a brand.
- **State pill**, one of:
  - `PLANNED` (spec only)
  - `BUILT` (folder exists)
  - `VALIDATED` (strict validation passed)
  - `PROVEN` (the pass mark from the spec was met on a real case)
  - `LISTED` (in `marketplace.json`)

  The title attribute holds the one-line reason.
- **Drift**, beside the pill: run `sh "${CLAUDE_SKILL_DIR}/../new-plugin/scripts/drift-check.sh" <plugin>` and show its last line (`drift: ok`, or the number of copies). A copy of a shared file means a skill may read an old rule: show it in red with the files it names.
- Mark every skill, command, connector or hook that can change things with the `change` chip and its approver. Anything above "read" with no approver shows `approver: open` in red.

## 3. Show it

- **Project folder or desktop:** open the page (`open plugin-overview.html`, `xdg-open` on Linux, `start` on Windows) and say its path.
- **Chat:** return the page and the stylesheet as files, or in full if files are not available.
- **Headless:** write the files and list any `open` fields.

## 4. Wrap-up (when asked, or at the end of a build)

Reply in this order, short and in tables:
1. One sentence on what the buyer now owns, in their own words from the spec.
2. **What you own**: one row per component (skill, command, connector, hook, agent, setting): what it is, what it can change, who approves, and its card on the page.
3. **Proof**: what is proven (with the evidence file) and what is not yet.
4. **Next**: one or two next versions that matter most for this job, each with what it gives and what it needs. Everything else stays on the page's version rail.
5. A quiet hygiene sweep, mentioning only what the person must act on:
   - a secret-looking value in a file
   - a write with no approver, or an approval that is written only
   - an agent with no `tools` list (it inherits every tool), or a skill whose `allowed-tools` lets a change run without asking
   - a connector with no known sign-in for people or for the assistant
   - a part with no purpose or value in the rules layer: keep or remove?
   - a copied part with no licence
   - an unlisted folder they think is shipped

Do not change the plugin here. Changes go through `/1xops:customize-plugin` or `/1xops:new-plugin`. To record what this session learned, use `/1xops:capture-learnings`.
