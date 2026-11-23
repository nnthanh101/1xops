# Setup: recommend only approved parts (read-only)

Read from `SKILL.md` when the person asks what to turn on, which plugins or connectors to use, or for a first-time setup. Paths below are relative to this skill's folder.

Act as a trusted advisor. Recommend the smallest setup that serves the team's job, using parts this project has already approved and, where possible, tested. Then the team can spend its time on business value rather than on comparing tools.

**This skill is read-only.** It recommends and never changes a file or a setting. The team applies a recommendation itself, or asks for it separately.

## Where you are running

| Place | What you can read | Recommend as |
|---|---|---|
| Project folder | the repository (commands below) | exact file and setting to change |
| Desktop workspace or chat | what the person describes or pastes: stack, tools, the job | the same recommendations; the person applies them in a project folder |
| Headless run | the mounted repository | a written report |

## 1. Read what is approved

In a project folder, read:
- `plugins/`: the catalogue. A link is an approved library plugin; a folder is a plugin the team owns.
- `.claude-plugin/marketplace.json`: what ships, meaning reviewed folders only.
- `.claude/settings.json`: what is on for every member (`enabledPlugins`), and which actions ask first (`permissions`).
- `templates/settings/*.json`: the approved settings per scope (organisation, team, project, person).
- Each owned plugin's `.mcp.json`, `CONNECTORS.md` and `NOTICE`: the approved connectors and third parties.
- `1xops doctor --brief`, if installed: which connectors are ready right now. It is read-only.

Mark every part you recommend with one level:

| Level | Means | Evidence |
|---|---|---|
| **Tested** | it ships and its release check passed | listed in `marketplace.json`, or proven in a closed test plan |
| **Approved** | selected by the owner and on for the team | a catalogue link enabled in `.claude/settings.json`, or a connector in an owned plugin's `.mcp.json` |
| **Not approved** | anything else | — |

- Recommend Tested first, then Approved.
- A Not approved part is only a proposal for the owner: name the gap it fills, its vendor and licence. Never present it as ready, and never install it.

## 2. Read the project

```bash
ls package.json pyproject.toml Cargo.toml go.mod pom.xml Taskfile.yml 2>/dev/null
ls -d .claude .github tests src app lib 2>/dev/null
ls CLAUDE.md .mcp.json 2>/dev/null
```

Note the language, frameworks, test runner, CI, issue tracker, cloud providers and the jobs the team repeats.

## 3. Recommend

- Give the top one or two per type. When the person asks for one type, give three to five.
- Each recommendation names:
  - **why**: the signal in the project
  - **the part** and its level (Tested · Approved · Not approved)
  - **where**: the exact setting or file
  - **what it can change**: read-only, writes files, runs commands, or reaches a service
- Order: safety and approvals first, then cost and risk, then speed.

| Type | Choose from | Reference |
|---|---|---|
| Settings | `templates/settings/<scope>.json`; ask rules for writes; deny rules for secrets | `references/hooks-patterns.md` |
| Plugins | catalogue links and owned plugins; give the install line for one that is not installed (`claude plugin install <part>@<marketplace> --scope project`, then `/reload-plugins`), installed only on demand, never all at once | `references/plugins-reference.md` |
| Connectors | owned plugins' `.mcp.json`, `CONNECTORS.md` | `references/mcp-servers.md` |
| Skills | catalogue skills first; a new skill only for a job the team repeats (then `/1xops:discover`) | `references/skills-reference.md` |
| Hooks | only on a clear signal; a hook runs without being asked, so it needs the administrator's yes | `references/hooks-patterns.md` |
| Helpers (subagents) | only for a parallel review or analysis the team repeats | `references/subagent-templates.md` |

Platform notes:
- A recommended command must run where the team works. Say "macOS only", "Linux only" or "needs WSL on Windows" when it does not run everywhere.
- The `afplay` and `osascript` examples in the references are macOS only.
- To add a remote connector from the command line, give its transport and address, for example `claude mcp add --transport http <name> <https-url>`. Never give a bare name.

## 4. Output

```markdown
## Recommended setup for <project>

### Profile
- Stack: …  · Tests: …  · CI: …  · Tracker: …  · Clouds: …

### Settings
#### <setting>  ·  Tested | Approved
**Why:** … **Where:** `.claude/settings.json` … **Can change:** …

### Plugins
### Connectors
### Skills
### Hooks
### Helpers

### Not approved (proposals for the owner)
| Gap | Part | Vendor and licence | Why it is not enough to use what is approved |
```

End with:
- The person can ask for more of one type.
- `/1xops:plugin copy` turns an approved plugin into the team's own.
- `/1xops:discover` starts a new one from a job they already do.
