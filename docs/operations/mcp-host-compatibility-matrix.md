# MaxVideoAI MCP host compatibility matrix

This matrix separates protocol evidence from real hosted OAuth evidence. Do not mark a host as compatible until the preview deployment, consent, refresh, revocation, and reconnect checks have all been completed without copying credentials or user data into this file.

## Foundation under test

- Resource URL: `https://api.maxvideoai.com/mcp`
- Transport: MCP Streamable HTTP, stateless JSON responses
- Authentication: OAuth 2.1 authorization code with PKCE through Supabase Auth
- SDK contract: `@modelcontextprotocol/sdk` `1.29.0`
- Tools: `get_account_status`, `list_models`, `recommend_models`
- Mutations available: none; media generation, uploads, quotes, wallet debit, and trial credit remain disabled

## Matrix

| Host | Connection mechanism | Local evidence | Hosted OAuth evidence | Status |
| --- | --- | --- | --- | --- |
| MCP TypeScript SDK 1.29.0 | In-memory client and raw Streamable HTTP fixtures | `initialize`, `tools/list`, all three tool calls, structured content, annotations, and safe errors pass | Not applicable | Protocol contract passes |
| Codex CLI 0.46.0 | `codex mcp add --url …`; OAuth via `codex mcp login` with the remote MCP client enabled | Local CLI advertises Streamable HTTP URL registration and experimental OAuth login | Preview deployment not available | Pending hosted smoke test |
| Codex app / library | Direct remote MCP URL or curated distribution | Server shape is independent of library inclusion | Installation, consent UI, refresh, revocation, and tool rendering not yet exercised | Pending hosted smoke test |
| Claude Code | `claude mcp add --transport http …`; authenticate from `/mcp` | Anthropic documents remote HTTP and OAuth login with secure refresh | Claude binary is not installed in this workspace; preview deployment not available | Pending hosted smoke test |

Codex’s locally installed CLI confirms `--url` for Streamable HTTP and an OAuth login command. OpenAI’s API also supports remote MCP URLs, bearer authorization, and filtering by `readOnlyHint`: [OpenAI MCP tool reference](https://platform.openai.com/docs/api-reference/responses/create#responses-create-tools).

Anthropic documents `claude mcp add --transport http <name> <url>` and browser OAuth through `/mcp`, including automatic refresh and a clear-authentication control: [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Commands for preview verification

Codex CLI:

```bash
codex mcp add --url https://api.maxvideoai.com/mcp maxvideoai
codex mcp login -c experimental_use_rmcp_client=true maxvideoai
codex mcp get maxvideoai
```

Claude Code:

```bash
claude mcp add --transport http maxvideoai https://api.maxvideoai.com/mcp
claude mcp get maxvideoai
```

Then open `/mcp` in Claude Code to authenticate. Use disposable preview accounts and remove the connection after the test.

## Required evidence before changing production flags

- Host and exact version
- Dynamic or manual OAuth client registration result
- Protected-resource and authorization-server discovery result
- Login, consent denial, consent approval, token exchange, refresh, revocation, and reconnect result
- Tool list names and annotations as rendered by the host
- Structured result rendering for all three tools
- Confirmation that no exact price, email address, credential, prompt, or private media URL appears
- Evidence link to sanitized logs or screenshots

Production status remains blocked until both Codex and one Claude-compatible host pass every item.
