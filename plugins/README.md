# Plugins: build your own from proven free parts

This folder is the catalogue. It holds a link to each selected free, open-source plugin of trusted vendors, beside the plugins built from them, so every part you can build from is in one visible place.

| Kind | In this folder as | Ships to customers |
|---|---|---|
| **Library** | a link into `upstream/<vendor>/` (`knowledge-work-plugins`, `agent-toolkit-for-aws`, `shopify-ai-toolkit`, `vercel-plugin`, `hashicorp-agent-skills`, `superpowers`, `claude-plugins-official`, `anthropic-skills`, `commerce-agents`; more vendors to come), each pinned | never: a part to build from |
| **Worked example** | a folder: `1xops` | yes: it is listed in [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) |
| **Your own** | a folder you built from the library, under your own name | only after review, once you list it in your `marketplace.json` |

**1xops is the worked example.** It is built from this same catalogue, with the same parts and steps you use, so it proves the path end to end. Build your own 1xops-like plugin the same way.

**Build your own.** Start from a job you already do: `/1xops:discover` writes the workflow spec, and `/1xops:plugin make` builds the plugin from it. To start from a library plugin instead, `/1xops:plugin copy` copies it once into its own folder here, renamed into your namespace, with its licence, NOTICE line and origin (`UPSTREAM.md`, with the pinned commit) kept, and lists every step that can change things. A link never turns into a copy in place: the copy is a new folder, and the link stays in the catalogue.

**Review before it ships.** A library plugin can carry servers or steps that change things. For example, the AWS library's `aws-core`, `aws-data-analytics` and `aws-startup-advisor` use a server that can call any AWS API, so a read-only role is what keeps them read-only. Check every skill and server of your copy, and run `1xops doctor`, before you list it.

**Approved means on for the whole team.** Every link here is turned on for every member by the shared settings file (`.claude/settings.json`, one marketplace per vendor), so a clean clone gets the whole catalogue with no personal setup. A link added here is enabled there in the same commit. Versions follow each vendor's main branch; `upstream/` keeps the reviewed commit. A plugin that can change things acts only with the member's read-only sign-in (`1xops doctor` first).

**One exception to "on for everyone".** `aws-agents-for-devsecops` stays in the catalogue (link and pin) but is not on by default: its server needs `DEVOPS_AGENT_TOKEN`, a token each member creates, and without it every session shows an error. A member who has one turns the plugin on in their own `.claude/settings.local.json` (`"enabledPlugins": {"aws-agents-for-devsecops@agent-toolkit-for-aws": true}`) and sets the token in their own environment.

**What ships is decided in one file.** Links here never ship; only entries in `marketplace.json` do, and only folders (the release check refuses a link).

**Skill libraries.** `upstream/anthropic-skills` holds skills, not plugin folders, so it has no link here (the release check needs a `plugin.json` in every folder of `plugins/`). It is enabled through its marketplace instead. On now: `document-skills` (docx, pdf, pptx, xlsx), so the skills you build can hand over real Word, PDF, PowerPoint and Excel files; call them as `document-skills:docx`. `skill-creator` and `frontend-design` are already on from the official plugins. Approved but not on yet: `mcp-builder`, `internal-comms`, `web-artifacts-builder`, `webapp-testing`; they come only in a bundle with skills nobody selected.

**Library updates.** A library changes only when its pin in `upstream/` moves; the links follow that pin. Your copies never change by themselves.

**Free and paid.** This open-source repository shows how a one-off plugin is built from trusted vendors' free plugins. Advanced capabilities and high-value template plugins, built the same way, are available from [OceanSoft.io](https://www.oceansoft.io).
