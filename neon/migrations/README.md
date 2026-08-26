# Neon migrations

This directory is the canonical home for MaxVideoAI application database migrations.

Use it for:

- `app_jobs`, `job_outputs`, `media_assets`, `user_assets`
- billing, receipts, pricing, app settings
- admin, analytics, legal report, and workspace tables

Run migrations with:

```bash
pnpm db:migrate:neon
```

`DATABASE_URL_UNPOOLED` (preferred) or `DATABASE_URL` must be a direct Neon connection. The
runner parses and normalizes the URL hostname, accepts only direct `*.neon.tech` hosts, and rejects
`-pooler` PgBouncer URLs because schema migrations require session-safe direct connections. Each
migration file runs with `ON_ERROR_STOP` inside a single transaction. Do not use the Supabase
project connection string for these files.

## Reserved MCP migration order

The cross-plan MCP migrations are reserved in this order:

1. `30_mcp_paid_generation.sql`
2. `31_mcp_trial_entitlements.sql`
3. `32_mcp_reference_uploads.sql`
4. `33_mcp_acquisition_funnel.sql`
5. `38_mcp_chatgpt_acquisition_attribution.sql`

Migration 33 is intentionally present but unapplied while 30–32 are absent. It contains a
database prerequisite guard and must not be promoted or applied until all three prerequisite
tables exist. Do not create placeholder migrations to bypass that guard.

Migration 38 keeps ChatGPT acquisition distinct from Codex in the signed landing context,
OAuth binding, immutable funnel ledger, and admin reporting. It must run after migration 33.
