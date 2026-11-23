# Change: adapt a plugin you own to your organisation

Read from `SKILL.md` when the person wants a plugin they already own fitted to their tools, channels, names and values. Paths below are relative to this skill's folder.

### Choose the kind of tailoring
- Search the plugin for `~~` placeholders (`grep -rn '~~[[:alnum:]]'`). Ignore matches inside code fences or backticks, and ignore reference files that only teach the pattern.
- **Real placeholders remain** → generic setup: replace each with the organisation's tool or value.
- **None, and the person named a part** → scoped: touch only that part.
- **None, and the request is broad** → general: read the plugin, then ask what should change.
- Never rename the plugin or its skills when changing one. Renaming is what copying is for (`references/copy.md`).
- Treat a legacy `commands/` folder like skills.

### Steps
1. **Intent.** If the request already says what to change, use it. Otherwise ask one short open question about that part.
2. **Context.** If the host has knowledge connectors (chat, documents, email), search them for tool names, channels, project keys and conventions (see `references/search-strategies.md`). Only search for what this plugin needs. Never compile personal information about people.
3. **List the changes in plain words**, for example "Learn where change requests are filed".
4. **Apply each change.**
   - Use what the person or the connectors made clear without asking again.
   - Ask about the rest. Do not assume an industry default.
   - If the person skips, leave the value as it was.
5. **Connectors.**
   - Prefer, in order:
     1. connectors this project already approved: the catalogue plugins' `.mcp.json` and the owner's list
     2. then the host's connector directory, if the host offers a registry search tool (its name differs between hosts; see `references/mcp-servers.md`)
   - Propose any connector that is not approved yet. Never add it without the owner's yes.
   - Credentials never go into files: use `${VAR}` references or the host's sign-in.
6. **Validate.** Run `claude plugin validate --strict <plugin folder>` when the command line is available. Otherwise check by hand:
   - `plugin.json` is valid JSON with a kebab-case `name`
   - every skill folder has a `SKILL.md`
   - hooks sit under a top-level `"hooks"` object

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
