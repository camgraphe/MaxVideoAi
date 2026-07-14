# MaxVideoAI MCP host compatibility matrix

Last verified: 2026-07-12

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
| Codex CLI 0.144.1 | `codex mcp add <name> --url …`; OAuth via `codex mcp login <name> --scopes …` | Full local PKCE flow passes: protected-resource discovery, dynamic registration, MaxVideoAI login and consent, token exchange, and one authenticated `list_models` call returning 40 models | Default `mcp add` OAuth requested `phone` and was not approved; explicit `mcp login --scopes openid,email,profile` then completed PKCE and one read-only `list_models` call returned 42 models | Hosted read-only login passes; default add flow remains blocked |
| Codex app / library | Direct remote MCP URL or curated distribution | Server shape is independent of library inclusion | Installation, consent UI, refresh, revocation, and tool rendering not yet exercised | Pending hosted smoke test |
| Claude Code 2.1.207 | `claude mcp add --transport http …`; OAuth via `claude mcp login` | Local protected-resource discovery, dynamic registration, login, three-scope consent, token exchange, connection UI, revocation, loss of authentication, and explicit reapproval all pass | Preview deployment unavailable; authenticated tool call blocked because Claude Code itself has no Anthropic session on this machine | Local OAuth/revocation passes; hosted tool smoke pending |
| Claude Desktop 1.20186.1 | Custom remote connector at the public staging `/mcp` URL | Not applicable | Dynamic registration, staging login, explicit `openid email profile` consent, all three read-only tools, revocation, authentication loss, fresh reapproval, reconnect, and a post-reconnect `list_models` call pass | Hosted read-only checks pass; token-expiry refresh pending |

Codex CLI 0.144.1 was exercised through the complete local OAuth flow. The older locally bundled 0.46.0 client did not follow RFC 9728 protected-resource discovery and fell back to `/authorize`; do not use it as compatibility evidence. OpenAI’s API also supports remote MCP URLs, bearer authorization, and filtering by `readOnlyHint`: [OpenAI MCP tool reference](https://platform.openai.com/docs/api-reference/responses/create#responses-create-tools).

During the 0.144.1 local test, Codex requested every standard scope advertised by the Supabase authorization server, including `phone`, even though the MaxVideoAI protected-resource metadata advertises only `openid`, `email`, and `profile`. The consent UI exposed all four scopes before approval. Resolve this host/provider scope mismatch before enabling production discovery.

The same mismatch recurred against HTTPS staging. The current CLI starts OAuth
as part of `mcp add`; that default request included `phone` and was stopped
before approval. Keeping the registered entry and then running explicit
`mcp login --scopes openid,email,profile` produced a new consent page with only
those three scopes and the expected loopback callback. That least-privilege
flow completed successfully, and an ephemeral read-only Codex session called
`list_models` exactly once and returned 42. The default first-run experience
remains a production blocker even though an explicit safe login path works.

Claude Code 2.1.207 requested exactly `openid email profile`. Revoking its grant from `/account/connections` immediately changed `claude mcp get` from `Connected` to `Needs authentication`; reconnecting required a new MaxVideoAI approval. An actual Claude-authored tool call remains pending until Claude Code is signed into an Anthropic account.

Claude Desktop 1.20186.1 requested exactly `openid email profile` and displayed
the expected `https://claude.ai/api/mcp/auth_callback` return address. It
rendered exactly three read-only tools. `list_models` returned 39 public models,
`recommend_models` returned factual capability trade-offs, and
`get_account_status` omitted the account email while returning a zero-dollar
wallet, disabled trial, and the staging connections URL. Claude drafted the
creative prompt and reference-image plan itself without calling a media tool.
No generation, upload, quote, wallet mutation, or trial tool was exposed.

Revoking Claude from the staging connections page removed the grant. The next
approved read-only call returned `Authentication required`; reconnecting showed
a new three-scope consent page and required fresh approval. A post-reconnect
`list_models` call then succeeded.

Anthropic documents `claude mcp add --transport http <name> <url>` and browser OAuth through `/mcp`, including automatic refresh and a clear-authentication control: [Claude Code MCP documentation](https://docs.anthropic.com/en/docs/claude-code/mcp).

## Commands for preview verification

Codex CLI:

```bash
codex mcp add maxvideoai --url https://api.maxvideoai.com/mcp
codex mcp login maxvideoai --scopes openid,email,profile
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
