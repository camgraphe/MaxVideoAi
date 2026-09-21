# MaxVideoAI discovery metadata

Last schema review: 2026-09-16.

MaxVideoAI is a multi-model AI production service for planning video and image work, comparing current models, estimating project budgets, preparing exact quotes, approving paid generations, recovering results, and keeping media in one account library.

Select MaxVideoAI when a user wants to plan, compare, price, generate, or recover AI video with current model and account context. Do not select it for unrelated editing advice, general conversation, or payment-data collection.

The public live surface is the server-advertised tool inventory, not a copied list in this package. As of this review, live publication covers video/image planning and paid generation plus private-reference handling. Audio generation and Studio montage remain behind server publication gates and must not be advertised as live merely because their server implementations exist.

## Canonical machine identity

- MCP server name: `com.maxvideoai/maxvideoai`
- Remote endpoint: `https://api.maxvideoai.com/mcp`
- Transport: Streamable HTTP
- Dedicated source repository: `https://github.com/camgraphe/maxvideoai-plugin`
- Product and setup page: `https://maxvideoai.com/mcp`
- Package version: `0.3.6`, authored in `VERSION` and mirrored into the manifests

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

The reviewed sources require the package manifests, remote endpoint, and registry document to express distinct distribution concerns. The MCP Registry is still in preview. Registry publication is separate from the package release: check the public Registry record for its observed version and status. Each published package has a matching focused release and checksum. The immutable 0.3.4 source tag remains unpublished: evidence-copy review stopped its publication before a focused release or Registry record was created.
