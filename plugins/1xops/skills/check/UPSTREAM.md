# Origin of /1xops:check (setup mode)

The readiness part of `/1xops:check` is 1xops's own. The setup mode was `/1xops:recommend-setup` until 2026-11-24.

| | |
|---|---|
| Copied from | `claude-code-setup/skills/claude-automation-recommender` (plugin `claude-code-setup`) |
| Repository | https://github.com/anthropics/claude-plugins-official |
| Pinned commit | `30c0ac7ff8f2f6e741ed8204d5997f14bf80b481` |
| Copied on | 2026-11-20 |
| Licence | Apache-2.0: the repository's `LICENSE`; every third party is listed in its `NOTICE` |
| Modifications | Copyright 2026 Nhat-Thanh Nguyen (nnthanh101@gmail.com), OceanSoft.io (oceansoft.io), Apache-2.0 |

## What 1xops changed

- Renamed by outcome; SKILL.md rewritten: recommends only from the approved catalogue, settings templates and approved connectors, each marked Tested, Approved or Not approved; anything else is a proposal for the owner. Works on a described project in chat.
- Platform notes added; the incomplete connector command replaced by one with transport and address.
- `references/hooks-patterns.md`: notification examples marked macOS only. Other references kept as copied.

## Review before it ships

- read-only; runs listing commands (ls) and `1xops doctor --brief`, which is read-only
