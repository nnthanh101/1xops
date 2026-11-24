# Keep the workbook and the plugin in sync

Read from `SKILL.md` before refreshing a page whose workbook or plugin may have changed. Paths below are relative to this skill's folder.

Proven on 21 Nov 2026 on a real plugin: a change on one side applied after a yes, and both sides changed at once offered as a choice. Show every difference before changing anything.

Both can be edited: an analyst changes a threshold in Excel, and an engineer changes a skill in the folder.
- `_sync` holds a fingerprint (a hash) of each fact at the last sync.
- **Only one side changed a fact:** show the difference as a short table (fact, old, new, which side) and apply it to the other side after a yes.
- **Both sides changed the same fact:** show both values and let the person pick. Never merge silently.
- **A rule the owning role did not change:** never change it on its sheet without that role's yes. Name the role in the question.
- **A fact with no fingerprint:** compare it with the plugin and with `git` history, report it as a sync gap, and offer to record its fingerprint.
- After a sync, update `_sync`, then run `python3 "${CLAUDE_SKILL_DIR}/../discover/scripts/workbook.py" fit <plugin.xlsx>` (it extends each table to its last row, puts back an overwritten header, and groups the Components rows: agents, commands, skills, connectors) and refresh the page only after it prints `workbook: ok`.
