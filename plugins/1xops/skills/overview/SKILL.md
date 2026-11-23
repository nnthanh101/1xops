---
name: overview
description: Show a plugin you built or copied as one page a CEO, a CTO or a security lead can read, covering what it does, what it is built from, who approves what, what is proven and what comes next. Then refresh it after every change, and close a session with a recap. Use when the user says "overview", "show me the plugin", "plugin page", "wrap up", "where does my plugin stand" or "share the plugin", and at the end of /1xops:plugin. Works in a project folder, the desktop workspace, chat and headless runs.
---

# /1xops:overview

Usage: `/1xops:overview [plugin folder]`. Without a folder, use the plugin built or copied in this session, or ask which one.

The page is the outcome of a build: one place where the buyer sees what they now own. Its facts come from the plugin's own files, so the page never says more than the folder proves.

## Two outputs, one set of facts

| File | For | What |
|---|---|---|
| `plugin.xlsx` | the people who own the rules | data first: one sheet per role (Job, Business rules, Integrations, Access, Proof, Next), plus Components filled from the folder, a hidden `_sync` sheet and a hidden `_agents` sheet (the rules layer, below). Template: `../discover/references/plugin-template.xlsx` |
| `plugin-overview.html` | CEO, CTO, CFO, security lead, approver | one page from the same facts (template `references/overview-template.html`), light and dark, readable on a phone, printable |
| `overview.css` | the page | copied once from `references/overview.css`, linked and never inlined, never edited in the plugin |

All three live in the plugin's own folder; the workbook may also stay in `workflows/<job>/` where `/1xops:discover` wrote it. Before the first write, show the paths and ask for a yes. Write nothing else. Never touch `marketplace.json`.

## Keep the workbook and the plugin in sync

Both sides can be edited. Before refreshing, compare them with `references/sync.md`: show every difference, apply a one-sided change after a yes, let the person pick when both changed, and finish with `../discover/scripts/workbook.py fit` until it prints `workbook: ok`.

## 1. Read the facts

Read only what exists, and record each fact with the file it came from.

Take each card's facts from the source `references/facts.md` names for it: the workbook (after the sync), `plugin.json`, the spec, the skills' frontmatter, `.mcp.json`, hooks, `UPSTREAM.md`, `evals/` and `1xops doctor --brief`.

Rules:
- **Facts only.** A field with no source shows `not yet` (or `open`), never a guess.
- **No timings, money or volumes** unless the spec states them. Quote the owner's own words for the job and the value.
- **Mask account numbers** (`****1234`). Never name a customer or a person the spec does not name.
- **Plain words only.** Above the closed section, write for the board and the people who run the job: outcomes, money, proof, data and access. Translate a part into what it means for them ("reads billing data with a read-only identity; changes nothing"), never a tool list. The rules layer stays off the page.

The hidden `_agents` sheet and the plugin's `references/agent-rules.md` are for agents and builders only (`references/rules-layer.md`); the page never shows their labels.

## 2. Write or refresh the page

- **First time:**
  - Copy `references/overview.css` next to the page.
  - Write `plugin-overview.html` from the template. Fill each `data-slot` (named `Sheet.field`) from the workbook or the plugin files, and delete the example content.
  - Keep the template's structure, its light and dark modes, the theme switch and its print styles.
- **Later:** Edit only the slots whose facts changed. Never rewrite the whole page.
- **Who the page is for.** The board first (chief executive, technology, finance, data and security officers), then the people who run the job (for example a platform engineer, a FinOps lead, a head of platform, a security administrator). The builder is not the audience: never name the builder, a tool or a model above the closed section at the end, and say what a part means for the business, not how it is built.
- **Order, brand and state:** follow `references/page.md`: ten sections in the order the board asks its questions, the buyer's own brand from the Brand sheet (never an invented one), and one state pill (`PLANNED`, `BUILT`, `VALIDATED`, `PROVEN`, `LISTED`) with its one-line reason.
- **Drift**, beside the pill: run `sh "${CLAUDE_SKILL_DIR}/../plugin/scripts/drift-check.sh" <plugin>` and show its last line (`drift: ok`, or the number of copies). A copy of a shared file means a skill may read an old rule: show it in red with the files it names.
- Mark every skill, command, connector or hook that can change things with the `change` chip and its approver. Anything above "read" with no approver shows `approver: open` in red.

## 3. Show it

- **Project folder or desktop:** open the page (`open plugin-overview.html`, `xdg-open` on Linux, `start` on Windows) and say its path.
- **Chat:** return the page and the stylesheet as files, or in full if files are not available.
- **Headless:** write the files and list any `open` fields.

## 4. Wrap-up

When asked, or at the end of a build, close the session with `references/wrap-up.md`: what the buyer now owns, proof, next, and a short hygiene sweep.

Do not change the plugin here. Changes go through `/1xops:plugin`. To record what this session learned, use `/1xops:improve`.
