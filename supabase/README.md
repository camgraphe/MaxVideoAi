# Supabase

Supabase is used for authentication and auth-related configuration only.

Do not place MaxVideoAI application database migrations here. Application tables live in Neon and their migrations belong in [`../neon/migrations`](../neon/migrations).

Use this directory for:

- Supabase Auth configuration
- email templates under `templates/`
- local Supabase CLI config needed for auth development
- reviewed Auth-only functions under `auth/`; these are applied explicitly to Supabase, separately from application releases

Do not run `supabase db push` to migrate MaxVideoAI application tables.

`auth/mcp_oauth_grant_is_active.sql` is a service-only boolean check of existing
Auth consent/session records. It creates no application tables and changes no
user sessions. Follow [the OAuth verification guide](../docs/engineering/mcp-oauth-verification.md)
before applying it. A checked-in SQL file is not evidence that it is installed.
