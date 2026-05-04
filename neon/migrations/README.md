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

`DATABASE_URL` must point to Neon. Do not use the Supabase project connection string for these files.
