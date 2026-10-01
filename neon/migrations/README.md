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

These files are incremental and do not establish the original `app_jobs`
baseline on an empty database. For a newly created application database, run the
explicit baseline bootstrap first, then apply the migrations:

```bash
APPLICATION_DATABASE_URL='<direct target URL>' pnpm db:bootstrap:neon
DATABASE_URL_UNPOOLED='<same direct target URL>' pnpm db:migrate:neon
```

The baseline command intentionally ignores inherited `DATABASE_URL`, accepts a
direct non-pooled Neon hostname, and is not part of request or build startup.
Use it only for an authorized new target. Existing databases normally apply only
the ordered migrations.

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
6. `39_mcp_quote_lifetime.sql`

Migration 33 is intentionally present but unapplied while 30–32 are absent. It contains a
database prerequisite guard and must not be promoted or applied until all three prerequisite
tables exist. Do not create placeholder migrations to bypass that guard.

Migration 38 keeps ChatGPT acquisition distinct from Codex in the signed landing context,
OAuth binding, immutable funnel ledger, and admin reporting. It must run after migration 33.

Migration 39 extends newly prepared MCP generation quotes to 45 minutes while retaining the
historical 10-minute constraint form for immutable existing rows. Apply it before deploying the
runtime that creates 45-minute quotes.

Migration 44 follows the MCP reference-asset deletion migration and preserves the dedicated
`mcp-reference-staging/` namespace in storage ownership, fences, and cleanup. Apply it before
deploying a staging runtime that prefixes reusable originals and thumbnails.

Migration 48 admits the coarse `glama` MCP client-family value in the audit
constraint. Apply `48_mcp_client_family_glama.sql` before deploying the runtime
that records Glama initialization events; it does not rewrite existing
`other` or NULL attribution. Because the runner replays every file, migrations
42 and 48 both preserve the already-expanded Glama constraint. They accept
only the known 41/42/48 constraint definitions and stop for manual review if
another change has altered that constraint. Test the ordered 42 → 48 sequence
on a branch of production before applying it to production.

## Generation timing collector

`45_generation_timing_samples.sql` installs the generic video-completion collector and
recovers available historical completion evidence. Apply before deploying the adaptive
`/api/engines/averages` reader. It is independent of the MCP tables but expects existing
`app_jobs`, `fal_queue_log` and `provider_attempts`. Test on a production branch copy
before promotion; see `docs/engineering/generation-observations.md` for semantics and
rollback. The migration does not repair or update source jobs.

## Gallery opening slots

`53_playlist_opening.sql` follows migration52 and adds optional four-video opening IDs. It is additive and replayable; it does not change any destination or media. Before applying it, test on a database branch. Runtime readers and ordinary curation retain compatibility without the column; the new admin selector appears only after migration. Do not apply migrations from a public request.

## MCP Mini supplier raster correction (migration 60)

Apply `60_mcp_trial_provider_rasters.sql` after migration 31 and before deploying
the corrected Mini trial estimator. New 5s 480p estimates are 18 cents for 16:9
and 9:16, and 17 cents for 1:1. New quote insertion and confirmation use the
current estimator; an older prepared quote must be prepared again. Accepted
historical trial quotes retain their original 17/10-cent funding snapshots.

Migration 31's replay now preserves the two known definitions of the cost CHECK
helper. Migration 60 upgrades an existing installation as well as a fresh one,
and preserves all canonical request, zero-customer-charge, private funding and
audit constraints. Replaying 31/60 does not rewrite quote or audit rows. Both
refuse an unfamiliar helper definition. This change has only been applied to
disposable local PostgreSQL fixtures, not a hosted database.
