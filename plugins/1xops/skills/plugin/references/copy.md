# Copy: make a catalogue plugin your own

Read from `SKILL.md` when one approved catalogue plugin already does most of the job. The copy gets the team's name and keeps its licence and origin. Paths below are relative to this skill's folder.

1. **Source.**
   - Pick a plugin from the approved catalogue: a link in `plugins/`, or a plugin the host lists as installed from an approved marketplace.
   - If the person names something outside it, say it is not approved yet. Adding it is the owner's decision: a new link and a NOTICE line. Stop there.
2. **Name.**
   - Lowercase kebab-case, in the team's own namespace.
   - Never a vendor's name, the edition or a version number.
   - Confirm it once.
3. **Copy.**
   - In a project folder, run: `sh "${CLAUDE_SKILL_DIR}/scripts/fork.sh" plugins/<source> <new-name>` (`CLAUDE_SKILL_DIR` is this skill's folder; outside Claude Code, use the folder that holds this `references/` folder). Add `--notice NOTICE` after the person says yes to the NOTICE line.
   - What the script does:
     - copies the files, following the catalogue link; stops if a link inside the plugin leaves it, or a file name holds a control character
     - renames only the plugin's own `name`
     - keeps the plugin's licence, or takes the repository's licence text
     - records the origin without any sign-in that may be in the repository address
     - writes `UPSTREAM.md` with the source, pinned commit, date, licence and a review list; a file it could not read is listed as "check by hand", never left out
     - refuses an existing folder, never edits `marketplace.json`, and exits non-zero on any problem
   - Elsewhere, do the same steps with the tools you have:
     - copy every file
     - change only `name` in `.claude-plugin/plugin.json`
     - keep or add the licence
     - write `UPSTREAM.md` with the same table and review list (shape below)
4. **Review.**
   - Show the review list: every connector, hook, script, and skill that can run commands or write files.
   - For each item, ask: keep, remove, or keep but ask a person first. Remove only on a yes.
5. **NOTICE.** Show the NOTICE line. Add it only on a yes.
6. **Ship rule.** Tell the person:
   - The copy ships only after review, once they list it in `marketplace.json`.
   - The release check refuses a link and accepts a reviewed folder.
   - If the copy has connectors, run `1xops doctor` before listing it.

`UPSTREAM.md` shape (the review list sits in a plain-text block, so no name in it can hide another line):

````markdown
# Origin of <name>
| | |
|---|---|
| Copied from | `<path in the vendor repository>` (plugin `<old name>`) |
| Repository | <vendor repository URL, without any sign-in> |
| Pinned commit | `<commit>` |
| Copied on | <YYYY-MM-DD> |
| Licence | <licence>, <which file> |

## Review before it ships
```text
- connector: <name>
- hook: <hook file> runs on <event> without being asked: <command>
- script: <path>
- can write or run commands: <file>
- helper with every tool (no tools list): <file>
- check by hand: <a file that could not be read>
```
````

Rules:
- The link stays in the catalogue. A fork is a new folder, never a link turned into a copy in place.
- A fork never changes by itself. To take an upstream update:
  1. Compare the source at the recorded commit with the new pin.
  2. Show the difference.
  3. Apply only what the team approves.
  4. Update `Pinned commit`.

## Deliver

- **Project folder:** the changed files. Point to `git diff` so the change can be reviewed.
- **Desktop workspace:** zip to a temporary folder first, then copy it to outputs. Name the file after the plugin's `name`, excluding any `setup/` folder:

  ```bash
  cd <plugin> && zip -r "$TMPDIR/<name>.plugin" . -x "setup/*" -x "*.DS_Store" && cp "$TMPDIR/<name>.plugin" <outputs>/
  ```
- **Chat:** every changed file in full, and the zip if code execution is available.

## Summary for the person

Group what you learned by source: their answers, documents, chat. Then list:
- connectors connected now
- connectors still to connect, and how
- anything left in the review list
