# The page: order, brand and state

Read from `SKILL.md` when writing the page for the first time, or when a section, the brand or the state changes.

- **Order on the page:** each section answers one question the board asks, in plain words, with no role labels.
  Page controls, not a section: a key (🟢 proven · 🟡 built, not proven · 🔵 planned) and a View for switch (Leadership, Finance, Engineering, Data, Security, All) at the top, which outline each reader's sections and dim the rest; nothing is hidden. Tag each section with the readers it serves (`data-for`). When someone asks for the page's sections, start at 1.
  1. The outcome in the owner's words, who it serves, then Outcome · Win · Risk if not.
  2. What it returns and what it costs: today, target, measured, results accepted; cost per accepted result, running cost per run, results rejected, review minutes per accepted result. Only figures the Job and Proof sheets hold.
  3. The decision asked, with who reviewed it.
  4. Who decides what: one card per role that owns a sheet, so no one person makes every decision.
  5. Does it work: reproduces the last real run, where it is proven, connections ready, approved and licensed parts, a second person can run it. Each answer with its evidence.
  6. What data it uses: sources, scope, period, the standard it is read in, where results go, where the data stays.
  7. Who can access what: how people and the service sign in to each system, read or change, how access is withdrawn and where each run's access is recorded; then the approvals and how each is enforced.
  8. Results on real cases, then the next versions. Each open question is in plain words, with the role that answers it; a question only the builder can answer (a missing rules file, a tools list) goes in the closed section.
  9. Evidence behind the claims: one note per figure or claim, with its source and date.
  10. Closed at the end, for reviewers: how it works, the parts, what each part can use, the team of agents (delete that lane when there are none).
- **Brand:** the page wears the buyer's brand from the Brand sheet:
  - the display name, the logo (`assets/logo.png` in the plugin, with an emoji fallback) and the legal line;
  - two colour tokens on the root element: `style="--brand:#…; --brand-accent:#…"`.
  The stylesheet lightens the brand colour in dark mode. With no Brand sheet, keep the neutral defaults; never invent a brand.
- **State pill**, one of:
  - `PLANNED` (spec only)
  - `BUILT` (folder exists)
  - `VALIDATED` (strict validation passed)
  - `PROVEN` (the pass mark from the spec was met on a real case)
  - `LISTED` (in `marketplace.json`)

  The title attribute holds the one-line reason.
