# Wrap-up (when asked, or at the end of a build)

Read from `SKILL.md` when the person asks to wrap up, or at the end of a build.

Reply in this order, short and in tables:
1. One sentence on what the buyer now owns, in their own words from the spec.
2. **What you own**: one row per component (skill, command, connector, hook, agent, setting): what it is, what it can change, who approves, and its card on the page.
3. **Proof**: what is proven (with the evidence file) and what is not yet.
4. **Next**: one or two next versions that matter most for this job, each with what it gives and what it needs. Everything else stays on the page's version rail.
5. A quiet hygiene sweep, mentioning only what the person must act on:
   - a secret-looking value in a file
   - a write with no approver, or an approval that is written only
   - an agent with no `tools` list (it inherits every tool), or a skill whose `allowed-tools` lets a change run without asking
   - a connector with no known sign-in for people or for the assistant
   - a part with no purpose or value in the rules layer: keep or remove?
   - a copied part with no licence
   - an unlisted folder they think is shipped

Do not change the plugin here. Changes go through `/1xops:plugin`. To record what this session learned, use `/1xops:improve`.
