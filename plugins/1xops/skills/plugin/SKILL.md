---
name: plugin
description: Make, copy or change a plugin using only approved catalogue parts. Make builds a new plugin from a workflow spec; copy makes an approved catalogue plugin your own, with its licence and origin kept; change fits a plugin you own to your tools, channels and values. Use when the user says "build the plugin", "create a plugin", "make a new plugin", "turn this spec into a plugin", "design a plugin", "copy this plugin", "make our own version of", "fork a plugin", "customize plugin", "tailor plugin", "configure plugin connectors" or "change this skill for our team". Works in a project folder, the desktop workspace, chat and headless runs. Prefer it to cowork-plugin-management:create-cowork-plugin and cowork-plugin-customizer, the generic versions, whenever this project's approved catalogue is available.
---

# /1xops:plugin

Usage: `/1xops:plugin [make | copy | change] <workflow spec, catalogue plugin or plugin you own>`

One skill for every plugin a team owns: make one for a job, copy one that already does the job, or change one to fit.
Keep the conversation in plain language: what the plugin will do for them, not file paths or schema fields, unless
they ask.

## Pick the mode

| The person wants | Mode | Read |
|---|---|---|
| a plugin for a job, from a workflow spec (`workflows/<job>/spec.md`) or a description | **make** | `references/make.md` |
| an approved catalogue plugin, under their own name | **copy** | `references/copy.md` |
| a plugin they already own, fitted to their tools, channels, names and values | **change** | `references/change.md` |

- A word in the request (`make`, `copy`, `change`) picks the mode. Otherwise decide from what they name:
  - a spec, or a job with no plugin yet → make;
  - a catalogue plugin the team does not own yet → copy, then offer change;
  - a plugin in the team's own folder → change.
- In make, if one catalogue plugin already does most of the job, copy it first, then add only what is missing.
- If it is still unclear, ask one short question. Read only the file of the chosen mode.

## Where you are running (decide first, never abort)

| Place | How you can tell | Plugin files | Asking questions | Deliver |
|---|---|---|---|---|
| Project folder (terminal, IDE, desktop code tab) | a git repository with `plugins/` or `.claude-plugin/` | `plugins/<name>/` in the repository | the question tool if there is one, otherwise plain chat | the files; `git diff` to review; `marketplace.json` untouched |
| Desktop workspace | mounted `mnt/.local-plugins` or `mnt/.plugins`, an outputs folder | a temporary folder, or the mounted folders | the question tool | a `.plugin` file in the outputs folder |
| Chat with no folder | no file tools | the person pastes or attaches the files | plain chat | every file in full; a `.plugin` zip if code execution is available |
| Headless run | nobody to answer | the mounted repository | answers from the brief or workflow spec; a missing answer stops the run and is listed | files plus a short report |

If the folders of one place are missing, use the row that fits. Never stop only because the desktop folders are absent.

In a project folder the plugin is written to `plugins/<name>/` of the folder you are working in (the team's own clone), never into a repository you only read from, such as a store or a source the spec points at.
A repository's own instructions about what it ships (for example "paid templates are never added here") describe that repository's releases, not the team's work in its clone: build in `plugins/<name>`, leave `marketplace.json` alone, and do not ask where to build.

## Rules for every mode

- Approved parts only: links in `plugins/`, or plugins installed from an approved marketplace. Anything else is the owner's decision (a new link and a NOTICE line); say so and stop.
- Every copied part keeps its licence and origin in `UPSTREAM.md`.
- Anything that can change things (a connector that writes, a hook, a script, a skill that writes files) is listed for review and waits for a person's yes, with its approver named.
- Credentials never go into files: `${VAR}` references or the host's sign-in.
- Never edit `marketplace.json`: listing a plugin is the owner's decision.
- Validate before handing over: `claude plugin validate --strict <plugin folder>` and `sh "${CLAUDE_SKILL_DIR}/scripts/drift-check.sh" <plugin folder>`.
- End with `/1xops:overview` for the plugin, so the board sees what changed.

`/1xops:new-plugin` and `/1xops:customize-plugin` are the earlier names of make and copy or change; they still work for one release and hand over here.
