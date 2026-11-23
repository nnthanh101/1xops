# Where each fact on the page comes from

Read from `SKILL.md` before writing or refreshing the page. Record each fact with the file it came from.

| Card on the page | Read from |
|---|---|
| Every role's decisions | `plugin.xlsx` (after the sync above) |
| Name, version, description, owner | `.claude-plugin/plugin.json` |
| The job, the owner, the decision it supports, the pass mark | the workflow spec (`workflows/<job>/spec.md`, linked in the plugin README) |
| Skills and commands, and what each can change | `skills/*/SKILL.md` (and a legacy `commands/*.md`) (frontmatter `allowed-tools`, and the operations table in the README) |
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
