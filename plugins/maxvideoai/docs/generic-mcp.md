# Connect MaxVideoAI from a compatible remote MCP client

**Short answer:** use `https://api.maxvideoai.com/mcp` as a remote Streamable HTTP endpoint, then complete browser OAuth. Your client must explicitly support remote Streamable HTTP and the required OAuth flow. Client-specific compatibility must be verified independently before you rely on planning, approval, generation, or result recovery.

## What does this guide prove today?

![Completed MaxVideoAI workspace result paired with the same saved video in the MaxVideoAI Library](../assets/demos/brief-to-video-workflow.webp)

This is current MaxVideoAI product proof, not native host proof for your MCP client. It proves a completed MaxVideoAI result and Library continuity, not your client's connection, interface, or approval behavior.

## Who can use this route?

Use it only with a client that documents support for remote MCP servers over Streamable HTTP and OAuth. Local-only clients, clients limited to standard input/output transport, or clients that cannot open browser authorization need a different supported integration. A successful endpoint entry is not enough; test the tools and permission boundary in that exact client.

## How do I configure the endpoint?

1. Open your client's remote MCP server or connector settings.
2. Choose **Streamable HTTP** if a transport must be selected.
3. Enter `https://api.maxvideoai.com/mcp` exactly.
4. Do not append a token, query string, password, API key, or custom credential.
5. Start the connection and complete MaxVideoAI OAuth in your browser.
6. Review the discovered tools before enabling them.
7. Start with a planning request that does not spend credits.

```text
Name: MaxVideoAI
Transport: Streamable HTTP
Endpoint: https://api.maxvideoai.com/mcp
Authentication: browser OAuth
```

## What permissions should I expect?

The connected workflow can read current model information, authorized account state, and private Library media when needed. It can write a prepared request and exact quote. Planning and quote preparation do not spend credits. Explicit approval authorizes exactly one paid generation attempt.

Review both the client's tool permissions and the MaxVideoAI OAuth grant. Disable tools you do not need, especially in clients that can invoke actions automatically.

## How do I verify the client safely?

Ask the client for current model comparison and named budgets, with a direct instruction to stop before any generation.

**Example**: “Use MaxVideoAI to compare current models for two product shots. Calculate two named budgets and do not prepare or approve paid work.”

Verify that the response is current, no credits were spent, and no secret was placed in the endpoint. Then test quote preparation separately before considering a deliberately small paid request.

## How do I disconnect it?

Remove or disable the MaxVideoAI server in the client's connector settings. Revoke the corresponding OAuth connection from your MaxVideoAI account connection settings. If the client caches tools, clear or refresh that connection before reconnecting.

## Sources

- [Model Context Protocol 2025-06-18: Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports#streamable-http)
- [MaxVideoAI connection and compatibility evidence](https://maxvideoai.com/docs/mcp)

Last reviewed: 2026-08-28.
