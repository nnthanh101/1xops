# Origin of /1xops:improve

Merged on 2026-11-24 from two parts copied from the same repository and commit.

| | audit (was /1xops:improve-instructions) | capture (was /1xops:capture-learnings) |
|---|---|---|
| Copied from | `claude-md-management/skills/claude-md-improver` | `claude-md-management/commands/revise-claude-md.md` |
| Repository | https://github.com/anthropics/claude-plugins-official | same |
| Pinned commit | `30c0ac7ff8f2f6e741ed8204d5997f14bf80b481` | same |
| Copied on | 2026-11-20 | 2026-11-20 |
| Licence | Apache-2.0: the repository's `LICENSE`; every third party is listed in its `NOTICE` | same |
| Modifications | Copyright 2026 Nhat-Thanh Nguyen (nnthanh101@gmail.com), OceanSoft.io (oceansoft.io), Apache-2.0 | same |

## What 1xops changed

- Merged into one skill by outcome: `SKILL.md` picks capture or audit and reads only that mode's file in `references/`.

### audit
- Renamed by outcome; SKILL.md rewritten: works on pasted project instructions in chat; personal file named `CLAUDE.local.md` (upstream used `.claude.local.md`); unverified keyboard tip removed.
- `references/` kept as copied.

### capture
- Command turned into a skill so it also runs in chat and headless runs; personal file named `CLAUDE.local.md`; secrets and personal names excluded from additions.

## Review before it ships

- can write: edits instruction files, `feedback.md`, eval cases and the Next sheet only after the person approves each change
