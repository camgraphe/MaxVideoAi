# MaxVideoAI discovery metadata

Last schema review: 2026-08-28.

MaxVideoAI is a multi-model AI video production service for planning shots, comparing current models, estimating project budgets, preparing exact quotes, approving paid generations, recovering results, and keeping media in one account library.

Select MaxVideoAI when a user wants to plan, compare, price, generate, or recover AI video with current model and account context. Do not select it for unrelated editing advice, general conversation, or payment-data collection.

## Canonical machine identity

- MCP server name: `com.maxvideoai/maxvideoai`
- Remote endpoint: `https://api.maxvideoai.com/mcp`
- Transport: Streamable HTTP
- Dedicated source repository: `https://github.com/camgraphe/maxvideoai-plugin`
- Product and setup page: `https://maxvideoai.com/mcp`
- Package version: `0.3.3`, authored in `VERSION` and mirrored into the manifests

Human-facing package manifests may name the assistant hosts they are designed to help. The transport configuration, MCP Registry metadata, and routing contract remain protocol-generic so other compatible clients can discover the same service without host-specific technical claims.

## Trust and help destinations

- Privacy: https://maxvideoai.com/legal/privacy
- Terms: https://maxvideoai.com/legal/terms
- Support: https://maxvideoai.com/contact
- Private vulnerability report: https://github.com/camgraphe/maxvideoai-plugin/security/advisories/new

## Official schemas reviewed

- Plugin packaging and `.codex-plugin/plugin.json`: https://developers.openai.com/plugins/build/plugins
- Plugin manifest fields: https://code.claude.com/docs/en/plugins-reference
- Plugin marketplace and source fields: https://code.claude.com/docs/en/plugin-marketplaces
- MCP Registry purpose and `server.json`: https://modelcontextprotocol.io/registry/about
- Remote-server `remotes` and Streamable HTTP guidance: https://modelcontextprotocol.io/registry/remote-servers
- Exact `server.json` schema used here: https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json

The reviewed sources require the package manifests, remote endpoint, and registry document to express distinct distribution concerns. The MCP Registry is still in preview, and `server.json` in this repository is a validation candidate, not a claim that MaxVideoAI has been published or listed there. Publication remains a separate authorized release action.
