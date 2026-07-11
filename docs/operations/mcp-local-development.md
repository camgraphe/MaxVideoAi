# MaxVideoAI MCP local development

This setup runs the MCP transport, MaxVideoAI consent screen, and Supabase OAuth 2.1 server entirely on loopback addresses. It does not enable the production MCP flags or modify the hosted Supabase project.

## Requirements

- Docker Desktop running
- Node.js and the repository dependencies installed
- Supabase CLI `2.54.11` or newer; the commands below use `npx supabase@latest`
- Codex CLI or another Streamable HTTP MCP client

## 1. Start an isolated local Supabase project

Use a temporary directory so the local OAuth experiment cannot be confused with the repository's hosted Supabase configuration:

```bash
mkdir -p /tmp/maxvideoai-mcp-local
npx supabase@latest init --workdir /tmp/maxvideoai-mcp-local --yes
```

In `/tmp/maxvideoai-mcp-local/supabase/config.toml`, set the Auth site URL and enable the OAuth server:

```toml
[auth]
site_url = "http://127.0.0.1:3100"
additional_redirect_urls = ["http://127.0.0.1:3100/**"]

[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

Then start Supabase:

```bash
npx supabase@latest start --workdir /tmp/maxvideoai-mcp-local
```

The default local endpoints used by this guide are:

- Supabase API and Auth: `http://127.0.0.1:54321`
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Supabase Studio: `http://127.0.0.1:54323`
- Mailpit: `http://127.0.0.1:54324`

Verify that OAuth is enabled before starting MaxVideoAI:

```bash
curl --fail http://127.0.0.1:54321/auth/v1/.well-known/oauth-authorization-server
```

The local gateway exposes the issuer-relative discovery form above. Hosted Supabase also exposes the RFC 8414 root form at `/.well-known/oauth-authorization-server/auth/v1`.

## 2. Start MaxVideoAI with the local-only MCP override

Read the local publishable/anonymous key with `npx supabase@latest status --workdir /tmp/maxvideoai-mcp-local`. Start the frontend with these environment values, replacing `<local-anon-key>`:

```bash
MCP_LOCAL_ENABLED=true \
MCP_API_HOST=127.0.0.1:3100 \
MCP_RESOURCE_URL=http://127.0.0.1:3100/mcp \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3100 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key> \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
SUPABASE_SITE_URL=http://127.0.0.1:3100 \
NEXT_PUBLIC_COOKIE_DOMAIN= \
COOKIE_DOMAIN= \
pnpm --prefix frontend dev --hostname 127.0.0.1 --port 3100
```

`MCP_LOCAL_ENABLED` is deliberately ineffective in production. In development it also fails closed unless both MCP values identify the same explicit loopback `/mcp` endpoint. Paid generation, trial credit, and provider execution remain controlled by their independent static flags.

## 3. Verify discovery and authentication

```bash
curl --fail http://127.0.0.1:3100/.well-known/oauth-protected-resource/mcp
curl -i http://127.0.0.1:3100/mcp
```

The discovery response must advertise `http://127.0.0.1:54321/auth/v1`. The unauthenticated MCP request must return `401` with a `WWW-Authenticate` link to the protected-resource metadata.

Create a disposable local user through Supabase Studio or the local Auth API, then register and authenticate Codex:

```bash
codex mcp add --url http://127.0.0.1:3100/mcp maxvideoai-local
codex mcp login maxvideoai-local
```

The full flow was verified with Codex CLI `0.144.1`. The older `0.46.0` client does not follow the protected-resource discovery chain correctly. If the installed binary is older, run the current CLI without changing the global installation:

```bash
npx --yes @openai/codex@latest mcp login maxvideoai-local
```

Approve the request on the MaxVideoAI consent screen. The current foundation exposes only the safe read-only account, model-listing, and model-recommendation tools.

## Cleanup

```bash
codex mcp remove maxvideoai-local
npx supabase@latest stop --workdir /tmp/maxvideoai-mcp-local
```

Use `--no-backup` with the Supabase stop command only when the disposable local database can be deleted.
