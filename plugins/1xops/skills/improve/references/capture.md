# Capture: turn this session into changes

Read from `SKILL.md` at the end of a working session, or when the person says what to keep. Nothing is written or applied before a yes.

Review this session for two things:
- **What people said:** every question, correction, comment or steer from the person (the human in the loop).
- **What would have made the session faster.**

Turn each one into the right kind of change, so the plugin gets better with every review and the person can see they were heard.

## 0. Sort what people said

Each item becomes exactly one of these:

| Type | When | Becomes |
|---|---|---|
| Test case | the person corrected a result ("that figure is wrong", "this data is real") | a replay case in `workflows/<job>/evals/<case>/` (`prompt.md` + `graders/expected.md`), so the mistake can't come back |
| Feature request | the person asked for something the plugin can't do yet | one line in the job's Next sheet (or `feedback.md`): what, for whom, and the version it lands in |
| Instruction fix | the person stated a rule or a preference ("always ask before…") | a one-line addition to the instructions (steps 1–5 below) |
| Answered | a question that was answered and needs no change | listed only, so nothing is lost |

Write them to `workflows/<job>/feedback.md` (or to the reply in chat) as a table:

| # | Said by (role) | Their words | Type | Why it matters | What it changes | If we don't |
|---|---|---|---|---|---|---|

Rules:
- Use their own words.
- One row per item, and never merge two people's points.
- Mask customers', people's and account names.
- Nothing is written or applied until the person says yes to each row. A no leaves that row out and changes nothing.

## 1. Reflect

What was missing at the start that cost time?
- commands used or found
- code style and patterns followed
- test approaches that worked
- environment or configuration quirks
- warnings, failures and their fixes
- decisions the owner made that should not be asked again

## 2. Find where each addition belongs

**Project folder:**

```bash
find . -name "CLAUDE.md" -o -name "CLAUDE.local.md" 2>/dev/null | grep -v node_modules | head -20
```

- `CLAUDE.md`: shared with the team, in Git.
- `CLAUDE.local.md`: personal, kept out of Git.

**Desktop workspace or chat:** the project instructions the person pastes. If they paste nothing, write the additions as a block they can paste.

## 3. Draft

- **One line per idea**, in the form `<command or pattern>`: `<why it matters>`. Instructions are read at the start of every session, so short is better.
- **Leave out:**
  - what is obvious from the code
  - generic advice
  - one-off fixes that will not recur
  - anything secret: tokens, keys, account numbers, customer or personal names

## 4. Show the changes

````markdown
### Update: ./CLAUDE.md
**Why:** <one line>
```diff
+ <the addition>
```
````

## 5. Apply after a yes

- **Project folder:** edit only the files the person approves: the instructions, `feedback.md`, the eval cases and the Next sheet.
- **Chat:** return the final text to paste.
- **Headless run:** write the proposal and apply nothing unless the brief approves it.
