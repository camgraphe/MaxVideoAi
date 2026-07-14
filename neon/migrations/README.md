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
runner rejects `-pooler` PgBouncer URLs because schema migrations require session-safe direct
connections. Do not use the Supabase project connection string for these files.

## Reserved MCP migration order

The cross-plan MCP migrations are reserved in this order:

1. `30_mcp_paid_generation.sql`
2. `31_mcp_trial_entitlements.sql`
3. `32_mcp_reference_uploads.sql`
4. `33_mcp_acquisition_funnel.sql`

Migration 33 is intentionally present but unapplied while 30–32 are absent. It contains a
database prerequisite guard and must not be promoted or applied until all three prerequisite
tables exist. Do not create placeholder migrations to bypass that guard.
