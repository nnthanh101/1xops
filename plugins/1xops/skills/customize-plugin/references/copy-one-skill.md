# Copy one skill, not a whole plugin

When the team's plugin needs only one skill from a catalogue plugin, copy that skill alone:
`sh "${CLAUDE_SKILL_DIR}/scripts/copy-skill.sh" plugins/<source>/skills/<skill> plugins/<team-plugin>`.
- It refuses a skill that already exists there, a link that leaves the skill, and file names with control characters.
- It appends one row to the receiving plugin's `UPSTREAM.md`: source, repository, pinned commit, date and licence.
- Review the copied skill the same way (step 4), and add its NOTICE line on a yes (step 5).
