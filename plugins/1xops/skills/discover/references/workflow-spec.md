# Workflow spec: <job name>

| | |
|---|---|
| Status | draft · ready to build · built · in use |
| Evidence | <previous artefacts in `evidence/`, or "from memory"> |
| Tenant | <one tenant: company, team or customer> |
| Version | 0.1.0 (previous working version: <none or tag>) |
| Licence and author | <the licence the plugin ships under and the legal owner, from the owner; never assumed> |
| Scenario starter | <one row of `scenarios.md`, or "none"> |

## 0. The business (owner: business owner)
Copied from the workbook's Business sheet; the workbook wins when they differ.
- Objective (one, measurable, dated): <what changes, by how much, by when>
- Measures: <metric · baseline · target · source>, each source a file or system, never an estimate
- Value per run: <time saved × rate, cost avoided, or revenue protected, with its source; "not measured" if none>
- Payback: <runs or weeks until the build cost is repaid; "not measured" if no value per run>
- Lifecycle: <where the job sits: plan · build · run · review · retire>
- Channels: <where it must run: project folder · desktop workspace · chat · headless; each marked proven or not yet>
- Brand and names: <the team's words for the job, its outputs and its roles; vendor names only where the vendor's own term is the right one>

## 1. The job (owner: business owner)
- Decision it supports:
- Who acts on it (named owner):
- Trigger and frequency:
- Current artefact:
- Baseline: <minutes per run> by <role>, <runs per month>, reviewer <role>, cost per run <figure or "not measured">

## 2. A useful result (owner: analyst)
- A finding is actionable when:
- Routinely dismissed (exclusions):
- Thresholds and confidence:
- Worked example of an accepted result: `evidence/accepted-1.md`
- Worked example of a dismissed result: `evidence/dismissed-1.md`

## 3. Minimum data (owner: engineer)
| Source | Identifier expected | Time range | Approved connector | Doctor status |
|---|---|---|---|---|
| | | | <name or "not approved yet"> | <ready · signed out · missing · not checked> |

## 4. Authority (owner: administrator)
| Operation | Permission | Approver | Destination |
|---|---|---|---|
| Read costs | read | — | — |
| Draft a ticket | draft | — | <project> |
| File a ticket | after a yes | <name or role> | <project> |
| Change a resource | never · after a yes | <name or role> | — |

## 5. Customisation from the sample
| Change asked for | Rule it implies |
|---|---|

## 6. Proof of the first run
- Compared with: <previous artefact>
- Reviewer and pass mark:
- Known differences:
- Result: accepted · rejected · open

## 7. Improvement
- Corrections recorded in:
- Replay set: <at least five past cases in `evals/<case>/`>; each case lists its facts, one per line, so each becomes one grader
- Data a case reads: <files in `evals/<case>/inputs/`, or a saved tool reply in `evals/mocks/<connector>/`; never a live customer system>
- A change is approved by <role> and rolled back by <how>
- Version and record of changes: <`plugin.json` version; `CHANGELOG.md`>; a renamed command keeps its old name working

## Open questions
| Question | For role |
|---|---|
