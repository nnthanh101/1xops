---
name: check
description: Show what is ready and what needs action for this folder (tools, sign-ins, connectors), most important first, each with its fix; and, when asked, recommend the setup to turn on, drawn only from what this project approved (settings, plugins, connectors, skills, hooks, helpers), each marked tested, approved or not approved. Changes nothing. Use when the user says "check", "what is ready", "what do I need to fix first", "is this machine ready", "what should we turn on", "recommend a setup", "set up this project", "which plugins should we use", "first-time setup" or "what automations would help", and before the first build in a folder. Prefer it to claude-code-setup:claude-automation-recommender, the generic version, whenever this project has an approved catalogue.
allowed-tools: Bash(1xops doctor:*), Bash(command -v 1xops)
---

# /1xops:check

Usage: `/1xops:check [setup] [connectors|plugins|skills|hooks|helpers|settings]`

The first step of every build, and read-only: what is ready, what to fix first, and what to turn on next.

| The person wants | Mode | Do |
|---|---|---|
| to know what is ready and what to fix (the default) | **ready** | the steps below |
| a recommendation of what to turn on: settings, plugins, connectors, skills, hooks, helpers | **setup** | read `references/setup.md` and follow it; it recommends only approved parts and changes nothing |

`/1xops:recommend-setup` is the earlier name of setup; it still works for one release and hands over here.

## Ready

Run `1xops doctor` in the current folder. It prints one row per check: `check | needed | result | detail`, then a `Next:` list. Read every row, then reply for a business reader, not as a copy of the table.

### Reply

1. One headline line, in bold:
   - every row ok, ready or in host: **✅ Ready: nothing needs action.**
   - otherwise: **⚠️ N items need action, M are ready.** (count the rows)
2. A table of only the rows that need action, sorted by importance: required first, then optional, then connectors.

   | | What | Why it matters | Fix |
   |---|---|---|---|
   | 🔴 | a `required` row that is not ok | the work cannot start | the exact fix from `detail` or `Next:`, as code |
   | 🟠 | a row whose detail says it **can change things**, or `broken` | a safety or a breakage risk | the fix, as code |
   | 🟡 | any other row that is not ok (`check`, `missing`, `not connected`, `signed out`) | that part will not work yet | the fix, as code |

   - "What" is the check's name in plain words (for example "AWS sign-in", "GitHub connector (1xops)").
   - "Why it matters" is one short clause that you write. Never invent a cause the row does not state.
   - Keep the fix word for word from doctor's output. Never shorten a command, a path or a key.
3. One line listing what is ready, folded: `🟢 Ready: git, claude, uv, … (n)`. Connectors that sign in inside the host go here as `in host: github, notion, …`, with the fix once: `run /mcp and choose <name>`.
4. One closing line: `Full output: run 1xops doctor in a terminal. A plugin's readiness also shows on its page: /1xops:overview.`

Rules:
- No other headings or prose. Never put the whole doctor table in the reply. Nothing in the reply may be wider than 100 characters: wrap the fix onto its own line instead.
- Account numbers stay masked exactly as doctor prints them.
- Every fact comes from doctor's output. Add no score, percentage, folder or project name, or count that doctor did not print, except the two counts in the headline.
- Do not run anything else, sign in, or change any file.

## When 1xops is not installed

If `command -v 1xops` prints nothing, reply with only this:

```
1xops is not installed. Install it, then run /1xops:check again:
  uv tool install 1xops        (or: npm install -g 1xops)
```
