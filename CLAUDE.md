# 1xops: rules for sessions working in this repo

Owner and only IP holder: nnthanh101 | oceansoft.io. Public prose (README, docs, issues) names no AI vendor, tool or "agent".

## What ships
- One product, three native channels, the same commands and byte-identical output files:
  PyPI = native Python (`packages/python`), npm = native Node.js (`packages/npm`, no dependencies), Docker image.
  No channel may need another channel's runtime. Never ship a wrapper or launcher.
- Docker image: `FROM nnthanh101/runbooks:<version>-cli` (AWS CLI, Azure CLI, gh), pinned by digest, built from `uv.lock` (house style: adlc-framework/.devcontainer).
  Bump the digest when runbooks is rebuilt. Never a separate base image for 1xops.
- Settings live in `.env.1xops` (non-secret `KEY=value`; secret-looking keys are refused). Guided setup: `1xops setup`.
- Dependencies: latest stable, official only. A new third party needs the owner's yes and a line in `NOTICE`.

## The product: build your own plugin from proven free parts
- Customers build a plugin from proven, free, open-source plugins of trusted vendors. They can only do that when every
  part is in one visible place, so `plugins/` is the catalogue: a link to each plugin **the owner selected** from each
  `upstream/<vendor>/` submodule (pinned, never shipped: `knowledge-work-plugins`, `agent-toolkit-for-aws`; next Shopify,
  Vercel, Azure…), beside the plugins we build. The owner selects; a session never adds or removes a catalogue link on
  its own (partner-built plugins are not selected). Never move the catalogue out of `plugins/`, never
  narrow it to "only 1xops". A new vendor = a submodule in `upstream/` + one link per selected plugin (vendor prefix if names clash).
- **1xops is the worked example**, one target built from the same catalogue a customer uses; building it proves the DIY
  path end to end. Each customer builds their own 1xops-like plugin the same way, with the same parts and steps: copy a
  library plugin once into its own folder, rename it into its namespace, keep its licence and NOTICE line, review
  every skill or server that can change things. Tools: the free plugin itself is the builder (`/1xops:discover`,
  `plugin` (make, copy, change; `scripts/fork.sh`); `1xops plugin new` on the command line later.
- **Free 1xops is the DIY builder and trusted advisor; operations playbooks are paid.** It recommends only approved,
  tested settings, plugins and official components so the customer focuses on business value. OceanSoft is its first
  customer: the enterprise plugin (`1xops-enterprise/plugins/1xops`) is built with it, from proven free plugins plus
  repeatable workflows, judged on buyer urgency and measurable value, differentiation, fit and feasibility,
  willingness to pay and recurring value, and expansion.
- **Shipping is controlled in one file.** Links in `plugins/` never ship; only entries in
  `.claude-plugin/marketplace.json` do, and only reviewed folders (CI refuses a link).
- **Free vs paid.** This open-source repository demonstrates how a one-off DIY plugin is built from trusted vendors'
  free plugins (working names: 1ops & 1xops DIY plugins). Advanced capabilities and high-business-value template
  plugins are built the same way and sold by oceansoft.io (enterprise edition), never added here.
- Guide: `plugins/README.md`; decision: `docs/adr/0001-distribution.md`.

## How to work
- `task` lists everything; logic lives in `scripts/`, decisions in `docs/adr/`. Add code only with a named business purpose.
- Local first: run `task gate` (lint, tests, act, image, UX proof, as CI and a customer will) before saying done or asking for a commit.
- Deliverables live in `~/Projects/1xops`, tracked by Git, on `develop`. A doc, rule, README or link the owner asks for is
  written there directly and committed; never in a sibling folder. Only code that needs `task gate` uses a worktree.
- End state first: before changing files or folders, say in one line what will exist when done (`~/Projects` holds one
  folder per repo: `1xops`, `1xops-enterprise`, `command-center`); at the end run `ls ~/Projects` and show it matches.
- Git: code works on `feature/*` in its own worktree inside the repo (`git worktree add .claude/worktrees/<slug> -b feature/<slug>`, git-ignored; never a new folder in `~/Projects`), never by
  switching the owner's checkout; prove it with `task gate`, stage it on `develop` (`git merge --squash`),
  delete the branch and the worktree. The session commits and releases, but first asks the owner one question with
  scored options, each with its business value (version, now or hold); on yes it runs `task release STORY=n` end to end, then
  proves the published package. The owner's only step is one click on the protected `release` environment, which the
  session opens in the owner's browser. A session never approves a deployment itself and never force-pushes.
- Guard rails advise or ask; they never block the owner.
- Cloud access is read-only. Sessions use only read-only sign-ins: an AWS read-only role, from `AWS_BILLING_PROFILE` / `AWS_OPERATIONS_PROFILE`, never a typed name; an Azure Reader identity in its own `AZURE_CONFIG_DIR`, never the owner's own login. Run `1xops doctor` before the first cloud call; a row saying `can change things` means stop. Any AWS or Azure write asks first (`.claude/settings.json`), and the session proposes it, the owner runs it. Follow skill `/1xops:read-only-cloud` (enterprise edition). The identity is the boundary; the rules only ask.

## Commands: one namespace
Every command and skill is `/1xops:<name>`, free or enterprise; `<name>` is the outcome in kebab-case, never the edition,
vendor or version; a shipped name never changes meaning. Free (this repository): five skills in the order a team uses them, `check` (ready, setup) → `discover` → `plugin` (make, copy,
change) → `overview` → `improve` (capture, audit), then back to `plugin` for the next version. Earlier names kept for one release:
`recommend-setup` (now `check setup`), `new-plugin` and `customize-plugin` (now `plugin`), `capture-learnings` and `improve-instructions` (now `improve`). The enterprise edition carries these unchanged, plus the
operations playbooks (`tenant-setup`, `change-request`, `vendor-review`, `process-doc`, `capacity-plan`,
`compliance-tracking`, moved from free on 2026-11-20 with their names unchanged) and everything else, in the same-named
`1xops` plugin in the private `1xOps/1xops-enterprise` repository. Marketplaces: free `1ops` (`1xops@1ops`), enterprise `1xops` (`1xops@1xops`). Table: `plugins/1xops/README.md`.

## Release standard
SemVer, tag `vX.Y.Z`, one version for PyPI, npm and the image. Next version = latest published + 1 patch:
`task release STORY=n` is the default, for fixes, UX and added commands that break nothing. `BUMP=minor` or `BUMP=major`
only when the owner picks it in the release question; never inflate the version. A command that is renamed keeps its old
name working, deprecated, so it is still a patch. Commits follow Conventional Commits (`feat:`, `fix:`, `chore:`) and say `Refs #N`.

## Definition of done
A criterion is done only when it is proven end to end as a customer: the published package, installed and operated
in a real terminal (Terminal.app or iTerm2, screenshots with `screencapture`), read-only sign-ins and read-only
operations only. The proof stays local in `tmp/` and is summarised to the owner in chat; it is **never posted** on an
issue or anywhere public, because it can carry customer or tenant names. Write no new test code unless the owner asks; prove by running it end to end (`task ux`). Existing tests stay as the regression net.
Commits say `Refs #N`, never `Closes`. A session ticks a box only when its case is proven and seen, then asks the owner one
question to approve; on the owner's yes it closes the issue in the owner's browser while the owner watches. Never close without that yes.

**Finish a story yourself; the owner only approves.** A session does everything up to the owner's yes, without being asked:
build, `task gate`, run every criterion as a customer, look at the screenshots, tick the boxes in the story and its test plan,
and move the story to Approval. Then it asks the owner **one** question with the evidence in three lines (what was proven,
what the customer gains, what is not proven). On the owner's yes it closes the story, its tasks and its test plan and moves the board to Done,
and opens the issue in the browser to confirm it. "For you to close" without that question is a deferral, not a hand-over.
First ask what the change ships through: a plugin file, a test or a workflow ships with `develop`, with no release; only package code needs `task release`.

## Backlog: one story, one test plan, tasks just in time
- **Story `1XOPS-NNN`** (issue type Feature, assigned to the owner) says what must be true and why it matters: Persona, Scenario (*Startup*, *Enterprise*), Story, Business value, one SMART **Objective**, Tasks and Acceptance criteria as tick boxes (Given/When/Then, measurable), the test plan link, Edition. Customer-facing; nothing else.
- **Test plan `TEST-NNN`**, one per story, always (sub-issue, type Task), says how we know it is true: Setup (clean machine, read-only identity, real account or fixture), How (data, steps), one tick-box case per criterion, and the pass mark. Evidence stays local. Without it, done depends on whoever checks; that is how 0.2.4 shipped green with a broken screen.
- **Tasks `TASK-NNN`** are broken out just in time: tick boxes in the story until it moves to Ready, then sub-issues (type Task).
- Tags: one `type:`, one `edition:`, one `cap:`, plus `cloud:` when it applies; one milestone per release; free stories on board 15, premium on board 11.
- **Scaffold, not text.** 5W1H, why, what-if, LEAN/5S/3T, INVEST and the audience check (CEO, CTO, CFO, CDO, CSO; the owner as accountable approver) are the session's checklist for covering every angle. Use them in reasoning and coordination; never write them into issues, the README or docs.
- Skill: `invest-story` (1xops-enterprise `.claude/skills`).

## Mistakes already made here. Do not repeat them
| Mistake | Rule |
|---|---|
| The npm package was a launcher that needed Python and uv, kept only to read YAML | Native code per channel; change the file format before adding a runtime |
| `cmd \| tail; echo $?` reported tail's exit code; zsh did not word-split `$X`; empty output was read as a pass | Capture the exit code of the command itself (`cmd >log; echo $?` or `PIPESTATUS`); a check that printed nothing failed |
| A test harness error (non-root image writing to `/`) looked like a product failure | Before reporting a failure, prove the check can pass, under the same user and paths the customer has |
| An issue closed by `Closes #13` with criteria unproven | `Refs #N`; proof on the published artifact first |
| A Dockerfile written from scratch on `python:3.14-slim` (386 MB, unpinned, unlocked) | Reuse the owner's platform images and their conventions first; measure before and after |
| `1xops doctor` (17 Nov 2026) found the default Azure login on the owner's Mac can change things | Sessions never use the owner's own cloud login; read-only identity only, checked with `1xops doctor` first |
| 0.2.4 shipped a misaligned table header; a literal `[bold]…[/]`, rows wrapped at 80 columns and 65 profiles listed twice reached the wizard. All 50 unit tests passed | A change to what a person sees is done only when seen: `task ux` (real terminal, clean container, checks + screenshots) passes, and the screenshots are looked at. Skill `visual-verify` (1xops-enterprise) |
| `rich` was removed to make stdout byte-identical, which cost the customer the UX | Byte-identical means the files and piped output. On a terminal, Python uses `rich` to the full (tables, colour, spinner, prompts) and Node.js draws the same natively |
| Release proof reported registry lag as a product failure, twice | The proof waits for the files an install fetches and retries a channel that printed nothing; it still fails a version that does not exist |
| A pty capture rendered to SVG was shown as a terminal screenshot | Say what it is. A real screenshot is `screencapture -l` of a Terminal.app or iTerm2 window; without Screen Recording permission, ask the owner to grant it or take it |
| CI failed on `ruff format --check` because `task test` never ran it and the change was handed over without act | `task gate` runs exactly what CI runs, locally, before every hand-over |
| A blocking git hook, a GitHub App, two approvals for one release, four tasks for one goal | Least that delivers the outcome; one command, one approval |
| Test plans were folded into stories to look lean; 5W1H and audience notes were written into issues | Lean keeps what the end user values: one test plan per story, always. The scaffold stays in reasoning, never in customer-facing text |
| The git hooks were made assistant-only, so the owner lost the advice; before that, the secret scan could leave GitHub Desktop waiting on Docker | Hooks advise everyone and never block: the owner overrides any advice and can switch it off per clone (`git config git-standard.advice off`); slow checks have a time limit |
| The owner's checkout was switched to a feature branch; the owner's next commit landed on it, and switching back failed on their unsaved edit | Feature work lives in its own worktree. A branch that holds an owner commit is fast-forwarded into `develop`, never deleted |
| The SSO cache's `expiresAt` was taken as "when the sign-in ends"; on the real machine it was the hourly token of a session that renews itself | Read the real file on this machine before building on what a field means; show a value only where it is true, never a guess |
| `--probe` used `urllib`, which follows a redirect and sends the token's header to the new host | A request that carries a credential never follows a redirect; a 3xx is reported, not followed |
| A parser treated "no scopes found" as "no write scopes", which would have shown a fine-grained GitHub token as ready | Access that cannot be read is `check`, never `ready`: when parsing fails, fall toward the safer verdict |
| `ruff format packages/python` reformatted a file outside the change; a stale, ignored copy of the templates made Node read old rules | Run tools on the gate's own paths (`src tests`); remove generated copies before comparing the two channels |
| A proof listener stopped before the second channel ran, and `localhost` resolved to IPv6 in Node, so the channels looked different | The harness outlives every run and uses `127.0.0.1`; a difference is a product failure only after the same check passed the other way |
| `git commit -a` swept in 20 files of the owner's unsaved work; a later `git commit --amend` rewrote a commit another session had already pushed, and the push was rejected | Stage named files only (`git add <paths>`); never `-a`. Never `--amend` or reset a commit you did not just make: `git fetch` and read `git log origin/develop` first |
| A scripted find-and-replace edited the first of two identical lines, in the Node.js job instead of the publish check; the gate caught it | After a scripted edit, read the `git diff` before the gate; make the edit match a line that is unique |
| `env -i` left `node` off the PATH, so the npm channel looked broken; a screenshot grabbed the front window, which was an idle Terminal | Prove the check can pass before calling it a product failure; capture the window you started (`window whose tabs contains t`) and look at it before citing it |
| The plugin version was never bumped by the release, and Claude Code updates an installed plugin only when it changes, so a fix on `develop` never reached existing installs | The plugin version is the release version: `release.sh` sets it and the Release check compares it with PyPI and npm |
| A session ended its answer with "for you to close", then with a list of next steps | See "Finish a story yourself": prove, tick, move to Approval, ask one question, close on yes |
| A story waited on the owner for steps the session could do itself (a read-only proof profile, a sign-in prompt, ticking proven boxes) | Do every real, read-only step yourself; stop only for an approval, a credential only the owner can create, or a cloud write |
| A release was bumped to 0.4.0 because a command was added; the owner wanted 0.3.2, and the tag had to be removed after the merge | A patch by default; the version is one of the scored options in the release question, asked before the release starts |
| SSO tiles were reported as passing from clicks with a session already open; two of them (GitHub, Slack) were not SSO at all, and the tenant's status page, which already said so, was not read first | Read the tenant's status page first; a sign-in is ✅ only after a clean test (signed out, then launched); on a failure read the identity provider's sign-in log; report ✅ / 🔑 / 🛠️ / ⏳, without alarm |
| A connector catalogue was called done while the README the owner named was not synced; a requested doc was hidden in a sibling worktree | Done means every named target is synced, with one status page per tenant and the rest linking to it; a requested doc goes in the owner's checkout. Give the full path and its git state |
| The catalogue was changed without the owner: 5 partner-built plugins, bio-research and pdf-viewer were linked though never picked (all removed) | The owner selects the catalogue; a session proposes a link change and makes it only on a yes, and removes only what was named |
| The DIY rule and README were edited in `../1ops-diy-rule`, a sibling worktree, again after the same lesson | Requested docs, rules and links are written in `~/Projects/1xops` on `develop` and committed; a worktree is only for code that needs the gate |
| "Customers see only 1xops" was read as "remove the catalogue": all 21 upstream links were deleted from `plugins/` (e68c14e) and had to be reverted | The product is DIY from one visible catalogue; 1xops is its worked example. Keep every link; `marketplace.json`, not the folder, decides what ships. When a request seems to narrow the model, ask before deleting |
| A folder cleanup created a new sibling worktree (`~/Projects/1xops-enterprise-cc`) without saying so | Worktrees live in `.claude/worktrees/<slug>` inside the repo; say before creating one and remove it in the same session; check `ls ~/Projects` against the end state |
| `mv` commands handed to the owner reused a folder name; running one again sent the real `command-center` repo to the Trash | A command handed to the owner checks what it acts on (`git remote get-url origin`) before moving it, so running it twice does nothing; never reuse a name in the same set |
| A one-line reply was taken as approval to fold a public Apache-2.0 npm product into the private enterprise repo | A change that crosses public/private, licence or publishing lines gets one question with its costs, and waits for the answer; small reversible steps are just done |
