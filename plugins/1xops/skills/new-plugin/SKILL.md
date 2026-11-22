---
name: new-plugin
description: Build a new plugin from a workflow spec, using only approved catalogue parts. Use when the user says "build the plugin", "create a plugin", "make a new plugin", "scaffold a plugin", "turn this spec into a plugin" or "design a plugin". Works in a project folder, the desktop workspace, chat and headless runs. Prefer it to cowork-plugin-management:create-cowork-plugin, the generic version, whenever this project's approved catalogue is available.
---

# /1xops:new-plugin

Usage: `/1xops:new-plugin <workflow spec path, or a one-line description>`

Build a plugin that does one job the team already does, from approved parts, and prove it against the job's own evidence.

Keep the conversation in plain language: what the plugin will do, not file paths or schema fields, unless the person asks.

## Where you are running

| Place | Write the plugin to | Deliver |
|---|---|---|
| Project folder | `plugins/<name>/` (never listed in `marketplace.json` by this skill) | the files; `git diff` to review |
| Desktop workspace | a temporary folder | a `.plugin` file in the outputs folder |
| Chat with no folder | — | every file in full; a `.plugin` zip if code execution is available |
| Headless run | the mounted repository | the files plus a report; unanswered design questions stop the run and are listed |

## Start from the job, not from components

1. **Spec.**
   - Read the workflow spec: `workflows/<job>/spec.md`, or the one the person gives. If `workflows/<job>/plugin.xlsx` exists, its role sheets win over the spec for business rules, integrations and access. Say so when they differ.
   - If there is none, run `/1xops:discover` first. A one-line description is not enough to build from.
   - If the spec has no step 6 (proof) or step 7 (improvement), say so and stop.
   - Name the commands, skills, agents and connectors from the workbook's Lifecycle sheet. If a name breaks the naming table in `/1xops:discover`, propose a fix and ask.
2. **Reuse before building.**
   - Look in the approved catalogue first: links in `plugins/`, and plugins installed from approved marketplaces.
   - If one already does most of the job, use `/1xops:customize-plugin` to fork it. Then add only what is missing.
   - If one skill of a catalogue plugin fits, copy only that skill, with its origin recorded: `/1xops:customize-plugin`'s `references/copy-one-skill.md`.
   - Build from scratch only when nothing fits, and say why.
3. **Plan the components.**
   - Show one table, including the types you decided not to use:

     | Component | Count | Purpose |
     |---|---|---|
     | Skills | 1 | <the job, as one skill> |
     | Connectors | n | <each from the spec's step 3, approved only> |
     | Agents | 0 | not needed |
     | Hooks | 0 | not needed |

   - Start with one skill per job.
   - Add agents or hooks only when the person asks and the spec needs them. A hook runs without being asked, so it needs the administrator's yes.
   - A team of agents fits when the spec has jobs a reviewer judges separately, for example collecting evidence and checking dependencies. The lead is the command the person runs; it hands each job to one agent and keeps the decision with a named person. Then rejected results and model cost can be counted per agent. Leave runs of many helpers off unless the volume needs them, and say why.
   - Get a yes before building.
4. **Design.**
   - Each skill:
     - its trigger phrases, from the words in the spec's evidence
     - its steps
     - the permission of each operation, from the spec's step 4
   - Each connector:
     - which approved server
     - how the person signs in
     - read-only first
   - Ask only what the spec leaves open, then confirm.

## Build

Create, in this order:
1. `.claude-plugin/plugin.json`:
   - `name` in kebab-case, in the team's own namespace
   - `version` `0.1.0`
   - `description`, `author` and `license`, from the spec's Licence and author row; if it is empty, ask, and in a headless run stop and list it
2. One `skills/<job>/SKILL.md` per job. Write the body as instructions to follow, verb first:
   - Under 3,000 words, with detail in `references/`.
   - A third-person description with real trigger phrases.
   - Each operation states its permission from the spec. Anything above "read" waits for a person's yes, and names the approver.
   - Each finding names its source. The skill never presents an estimate as a measured figure.
3. `agents/<role>.md` for each agent in the plan: a `description` with when to hand it work, and a `tools` list with only what its job needs (built-in tools and the approved connectors' tools). An agent with no `tools` list inherits every tool. An agent never gets a tool that writes to a system the spec keeps read-only. In a skill or command, `allowed-tools` lets those tools run without asking, so list only read tools there and leave anything that changes things out, so the host asks first; use `disallowed-tools` for a tool the job must never use.
4. Shared files once, in the plugin's root `references/`: the rules every skill follows, report formats, glossaries. Each skill points to them as `../../references/<file>` (the plugin's own, two folders up from the skill); never copy one into a skill's folder (see `references/component-schemas.md`, Shared references).
5. `references/agent-rules.md` and the workbook's hidden `_agents` sheet, one row per part: its purpose, why it is there, what happens if it is missing, its business value, the critical-thinking check and the mental model it applies. Agents read it before they act; it never goes into the README or the page.
6. `.mcp.json`, only for approved connectors from the spec:
   - Use `${VAR}` for every credential or host-specific value.
   - Never write a secret into a file.
   - Use HTTPS for remote servers.
   - If the host refuses to write `.mcp.json` (some headless runs do), write the same content to `mcp.proposed.json` in the plugin folder and say the owner renames it after review; never leave it only in the README.
7. `evals/<case>/`: one folder per case from the spec's `evals/` (accepted, dismissed and the replay set), in the format `claude plugin eval` runs (`references/component-schemas.md`, Evals):
   - `prompt.md` with `runs: 3`;
   - one grader per fact (`regex` where exact, `llm` otherwise), never one grader listing every fact;
   - one `tool_used` grader that the plugin's own skill or command ran;
   - `inputs/` for files, `evals/mocks/<connector>/` for saved tool replies.
   They are the plugin's first test.
8. `README.md`: what it does, who approves what, the connectors and how to sign in, and what has not been proven yet.
9. `CHANGELOG.md`, starting with `0.1.0` and one line per change a person would notice.
10. `UPSTREAM.md`, when any part was copied from the catalogue: the origin and the review list (see `/1xops:customize-plugin`).

Reference material:
- `references/component-schemas.md`: exact formats of skills, agents, hooks, connectors and commands
- `references/example-plugins.md`: three example plugins

Use `${CLAUDE_PLUGIN_ROOT}` for paths inside hooks and connector settings. Never hardcode an absolute path.

Use `~~category` placeholders only if the person says the plugin will be shared outside their organisation. Then add a `CONNECTORS.md` (see the references).

## Check and deliver

1. Summarise each component and its purpose. Ask for changes.
2. Validate:
   - With the command line: `claude plugin validate --strict plugins/<name>`.
   - Without it, check by hand:
     - `plugin.json` is valid JSON with a kebab-case `name`
     - every skill folder has a `SKILL.md`
     - hooks sit under a top-level `"hooks"` object
     - every referenced file exists
   - Run `sh "${CLAUDE_SKILL_DIR}/scripts/drift-check.sh" plugins/<name>`; it fails when a skill keeps its own copy of a shared file.
   - Fix every error before going on.
3. Run `claude plugin eval <plugin>` when it is available, otherwise run the job once on each case in `evals/`, with synthetic or redacted data. Show the result next to the expected one, with every difference. The reviewer named in the spec accepts or rejects it. Record the answer in the spec's step 6.
   - A plugin with `dependencies` loads nothing from its folder when a dependency is not installed, and says nothing. Before the eval, check that its commands are listed (`claude -p --plugin-dir <plugin> "list the /<name>: commands"`). If none are listed, run the eval on a copy without `dependencies`, and say which cases need a dependency:

     ```bash
     t=$(mktemp -d) && cp -R plugins/<name> "$t/" && python3 -c "import json,sys;p=sys.argv[1];d=json.load(open(p));d.pop('dependencies',None);json.dump(d,open(p,'w'),indent=2)" "$t/<name>/.claude-plugin/plugin.json" && claude plugin eval "$t/<name>"
     ```
   - Read the eval's delta over the no-plugin run. A delta of 0 means the plugin did not change the answer, so the result proves nothing about it.
4. Deliver for the place you are running in (table above). Zip to a temporary folder first, then copy:

   ```bash
   cd <plugin> && zip -r "$TMPDIR/<name>.plugin" . -x "*.DS_Store" && zip -j "$TMPDIR/<name>.plugin" <repo>/LICENSE <repo>/NOTICE && cp "$TMPDIR/<name>.plugin" <outputs>/
   ```

5. **Ship, when the person says it is ready.**
   - Raise `version` in `plugin.json` (a patch unless the person picks more) and add a `CHANGELOG.md` line. A host updates an installed plugin only when its version changes.
   - A renamed command or skill keeps its old name working for one release, marked as replaced, so nothing a person learned breaks.
   - Propose the plugin's `marketplace.json` entry (name, source folder, one-line description) and stop: listing it is the owner's decision.
6. Tell the person:
   - It ships only after review, once listed in `marketplace.json`.
   - Run `1xops doctor` first if it has connectors.
   - `/1xops:capture-learnings` keeps its instructions current after each run.
