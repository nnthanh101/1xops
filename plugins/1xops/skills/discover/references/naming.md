# Naming, from the Lifecycle sheet

Read from `SKILL.md` when proposing the names of the plugin, its commands, skills, agents and connectors.

| Part | Named for | Form |
|---|---|---|
| Plugin (namespace) | the buyer's product | their product name, lowercase kebab-case |
| Command | an outcome a team asks for | verb-noun: `ship-theme`, `launch-product` |
| Skill | a capability | domain noun: `liquid-theme`, `shop-agent` |
| Agent | a team role | role noun: `liquid-developer`, `merchandiser` |
| Connector (MCP) | the vendor system | the vendor's own name, never renamed |

Choose each name in this order, and say which rule chose it:
1. **The vendor's name**, when the stage reuses a vendor's command, skill or connector (for example `commerce-builder:review-commerce-agent`). Depend on it by name; never copy it under a new name.
2. **The team's own word** from their documents (for example a task they already run).
3. **The industry's standard term** (for example "headless storefront", "theme", "shopping agent" or "merchant agent").
4. **Only then a new verb-noun outcome.**

Use the words the teams already use in their documents. A name never carries the edition, the vendor of the builder or a version. Once shipped, a name never changes meaning.
