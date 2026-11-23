# Origin of /1xops:plugin

Merged on 2026-11-24 from two skills copied from the same repository and commit.

| | make (was /1xops:new-plugin) | copy and change (was /1xops:customize-plugin) |
|---|---|---|
| Copied from | `cowork-plugin-management/skills/create-cowork-plugin` | `cowork-plugin-management/skills/cowork-plugin-customizer` |
| Repository | https://github.com/anthropics/knowledge-work-plugins | same |
| Pinned commit | `e91a134584eb798bac7fb0379358006a2b63b965` | same |
| Copied on | 2026-11-20 | 2026-11-20 |
| Licence | Apache-2.0: the repository's `LICENSE`; every third party is listed in its `NOTICE` | same |
| Modifications | Copyright 2026 Nhat-Thanh Nguyen (nnthanh101@gmail.com), OceanSoft.io (oceansoft.io), Apache-2.0 | same |

## What 1xops changed

- Merged into one skill by outcome: `SKILL.md` picks make, copy or change and reads only that mode's file in `references/`.
- make: a plugin with dependencies gets their install lines in its README and is done only when its commands load in a clean session; the page and README say where it runs.

### make
- Renamed by outcome; SKILL.md rewritten: starts from a workflow spec (/1xops:discover), reuses an approved catalogue plugin before building, adds the spec's examples as evaluation cases, delivers per place.
- `references/component-schemas.md`: hooks example wrapped in a top-level "hooks" object; hook decisions updated to allow, deny, ask.
- `references/example-plugins.md` kept as copied.

### copy and change
- Renamed by outcome; SKILL.md rewritten: runs in a project folder, the desktop workspace, chat and headless runs instead of aborting outside the desktop workspace.
- Added Fork mode and `scripts/fork.sh`: copy into the team's own name, keep licence and origin, list what can change things, never edit `marketplace.json`.
- Placeholder search ignores code and reference files that only teach the pattern; connectors limited to approved ones; registry tools named as host-specific.
- `references/` and `examples/` kept as copied, plus one note in `references/mcp-servers.md`.

## Review before it ships

- script: scripts/fork.sh (copies files into a new folder; with --notice, appends one line to NOTICE)
- script: scripts/copy-skill.sh (copies one skill into the team's plugin, with its origin)
- make writes plugin files only after the person approves the plan
