# Supabase

Supabase is used for authentication and auth-related configuration only.

Do not place MaxVideoAI application database migrations here. Application tables live in Neon and their migrations belong in [`../neon/migrations`](../neon/migrations).

Use this directory for:

- Supabase Auth configuration
- email templates under `templates/`
- local Supabase CLI config needed for auth development

Do not run `supabase db push` to migrate MaxVideoAI application tables.
