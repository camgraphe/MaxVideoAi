# No application migrations here

This directory is intentionally free of active `.sql` migrations.

Supabase is Auth only for this project. The application database is Neon, and app schema migrations must go in [`../../neon/migrations`](../../neon/migrations).

If you are about to add a table such as `app_jobs`, `job_outputs`, `media_assets`, `user_assets`, billing, jobs, admin, or workspace data, stop and add the migration to Neon instead.
