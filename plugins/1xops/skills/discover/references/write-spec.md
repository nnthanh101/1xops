# Write the spec, the workbook, the evidence and the cases (project folder)

Read from `SKILL.md` when writing the files in a project folder. Paths below are relative to this skill's folder.

- **Project folder:**
  - Write `workflows/<job-slug>/spec.md` from `references/workflow-spec.md`.
  - Write `workflows/<job-slug>/plugin.xlsx` from `references/plugin-template.xlsx`: copy the template, then fill each role's own sheet from the answers (Job, Business rules, Integrations, Access, Proof, Next).
    - Delete the example rows, and leave an unanswered field empty with its role under Next → Open question.
    - Each sheet holds one Excel table. Write data from the row under its header, never on it, and keep its columns as they are. Then run `python3 "${CLAUDE_SKILL_DIR}/scripts/workbook.py" fit workflows/<job-slug>/plugin.xlsx`: it puts back a header that data overwrote and extends every table to its last filled row, so Excel opens the file without a repair prompt. The workbook is ready only when it prints `workbook: ok`.
    - Write a `_sync` row (sheet, ID or field, fingerprint) for every fact you fill, not only the thresholds, so `/1xops:overview` sees any later edit.
    - Integrations: for each connector, fill how people sign in, how the assistant signs in and when it is available from the project's `CONNECTORS.md` when there is one (copy its status symbol: ✅ 🔑 🛠️ ⏳ ➖), and Ready now from `1xops doctor --brief`. Never guess a status.
    - Access: fill Enforced by for each operation (an ask rule, a tools list, the host's prompt or a read-only identity). Write "written only" when nothing enforces it, and list it under Next → Open question for the administrator.
    - Job: fill Who it serves, Win, when it works, and Risk, if it is not done, in the owner's words; leave them empty for the business owner rather than guess.
    - The hidden `_agents` sheet is for agents and builders: one row per planned part with its purpose, why it is there, what happens if it is missing, its business value, the critical-thinking check and the mental model it applies. Never copy these labels into the spec's prose for the owner.
    - Use the `xlsx` skill if it is available. Otherwise use Python with openpyxl.
    - If neither is available, write the spec only and say that the workbook needs the `xlsx` skill.
  - The workbook is where each role edits its own decisions; `/1xops:overview` keeps it and the plugin in sync.
  - Put the redacted previous artefacts in `workflows/<job-slug>/evidence/`: `last-run.md`, `accepted-1.md`, `dismissed-1.md`, and the branded sample `sample-<brand>.md`.
  - Put each replay case in `workflows/<job-slug>/evals/<case>/`, in the format `claude plugin eval` runs (shapes in `/1xops:plugin`'s `references/component-schemas.md`, Evals):
    - `prompt.md`, the input the plugin gets, with `runs: 3`;
    - `graders/`, **one file per fact** a correct answer must contain or must not, so one wrong fact does not fail the whole case; a `regex` grader when the fact is exact, an `llm` grader otherwise;
    - one `tool_used` grader that the plugin's own skill or command ran, so a pass without the plugin does not count;
    - `inputs/` for the files the case reads, and a saved tool reply in `evals/mocks/<connector>/` when a case calls a connector; never a live customer system.
  - Change no other file. Stage only the files you wrote (`git add <those paths>`), so they show up for review; never commit or push. The person commits.
