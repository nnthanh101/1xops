# Scenario starters

A starter shortens step 0: pick the row closest to the team's job, then replace every value with the team's own, measured
on its own data. A starter is a set of questions, not answers: never copy a measure, a figure or a threshold from it into
a spec. If no row fits, write "none" and start from the last real run.

| Starter | Decision it supports | Measures to ask for | Data to name in step 3 | Permissions to expect in step 4 | First replay cases |
|---|---|---|---|---|---|
| Commerce increment | Is this storefront change ready to ship on every channel? | conversion and checkout completion before and after (bot traffic filtered), page speed, failed checks per release | theme and storefront code, the store's catalogue, live pages | read the store; drafts and staged changes; publishing and admin after a named yes | a change that broke one channel only; a price shown wrongly; a release blocked by a check |
| Shopping assistant | May the assistant answer and fill a cart for shoppers? | answered-without-human share, wrong-price or wrong-stock answers (target 0), cart hand-offs to checkout | catalogue search, cart, store policies; a public sample store for tests | read catalogue; cart writes only from the shopper's own session; never place an order or charge | an out-of-stock item; a policy question it cannot answer; a request outside the catalogue |
| Cloud cost review | Which costs do we cut this month, and who approves each? | monthly spend against budget, savings proposed and realised, time to a decision | a billing export in a standard format, inventory, open change tickets | read billing and inventory; draft change tickets; resource changes never, or after a yes | an idle resource safely removed; a saving dismissed for a dependency; a commitment purchase |
| Cloud operations | Is this change or incident handled by the runbook, with evidence? | time to restore, changes without rollback plan (target 0), repeat incidents | runbooks, change records, monitoring alerts, read-only cloud sign-in | read only in the cloud; draft change requests; writes proposed for a person to run | a failed change rolled back; an alert with no runbook; a change approved late |
| AI spend and use | Is AI use inside budget and policy, team by team? | spend per team and per outcome, requests outside policy, reused prompts and skills | usage exports from each AI provider, the approved list of tools | read usage; draft a policy exception; budget changes after a yes | a team over budget; an unapproved tool; a cost spike from one job |
| Answer-engine content | Will buyers and assistants find and trust our product pages? | pages with complete structured data, answer-engine citations, organic sessions | product and guide pages, search console exports, the page's markdown copy | read pages and exports; draft copy; publishing after a yes | a page missing price or stock data; a guide quoted wrongly; a duplicate page |

Each starter becomes a plugin the same way: discover writes the spec, `/1xops:plugin make` builds it, and the replay
cases above are replaced by the team's own past runs before anything is proven.
