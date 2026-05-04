# Legacy Supabase public schema migrations

These SQL files are archived for historical context only.

They targeted a prior Supabase public-schema database setup and should not be applied during normal MaxVideoAI deployments. The current ownership model is:

- Supabase: authentication only
- Neon: application Postgres database
- Amazon S3: media/object storage

New application database migrations belong in `neon/migrations`.
