---
name: improve
description: Improve a plugin and the project's instructions from what people said and did, with every change applied only after a yes. Capture turns this session's corrections, requests and habits into test cases, feature requests and short instruction lines; audit scores the instruction files (CLAUDE.md and its local and package versions, or instructions pasted into chat) and proposes fixes. Use when the user says "capture the feedback", "turn my comments into tests", "capture what we learned", "remember this for next time", "update CLAUDE.md with this session", "revise the instructions", "check our instructions", "audit CLAUDE.md", "improve CLAUDE.md", "are our instructions current" or "project memory", and at the end of a working session. Prefer it to claude-md-management:revise-claude-md and claude-md-improver, the generic versions.
---

# /1xops:improve

Usage: `/1xops:improve [capture | audit] [what to focus on, a path, or pasted instructions]`

Make the next session better than this one: every correction becomes a test, every new need a feature request, every
working habit one short instruction line, and the instruction files stay current. Nothing changes before the person
says yes.

## Pick the mode

| The person wants | Mode | Read |
|---|---|---|
| to keep what this session taught: corrections, requests, decisions, habits | **capture** | `references/capture.md` |
| their instruction files checked, scored and fixed | **audit** | `references/audit.md` |

- A word in the request (`capture`, `audit`) picks the mode. At the end of a session, or after "remember this", use capture; for "check" or "audit" the instructions, use audit.
- If it is still unclear, ask one short question. Read only the file of the chosen mode.

## Where you are running

| Place | Instructions are | Apply changes |
|---|---|---|
| Project folder | instruction files on disk (`CLAUDE.md`, `CLAUDE.local.md`, package and folder versions) | edit only the files the person approves |
| Desktop workspace or chat | the project instructions the person pastes | return the improved text in full, to paste back |
| Headless run | files in the mounted repository | write the proposal; apply only what the brief approves |

## Rules for every mode

- Show every change first (a diff, or a table row), then apply only what the person says yes to; a no changes nothing.
- One line per idea; instructions are read at the start of every session, so short wins.
- Leave out what the code already shows, generic advice, one-off fixes, and anything secret: tokens, keys, account numbers, customer or personal names (mask them).
- Use the person's own words for what they said, and never merge two people's points.

`/1xops:capture-learnings` and `/1xops:improve-instructions` are the earlier names of capture and audit; they still work for one release and hand over here.
