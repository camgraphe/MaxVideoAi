# Data Platform Ownership

MaxVideoAI uses three separate data systems. Keep their responsibilities separate.

## Supabase

Supabase is for authentication.

- Browser auth uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Server auth helpers may use Supabase service credentials when needed.
- Auth email templates live in `supabase/templates`.
- Do not store application schema migrations in `supabase/migrations`.
- Do not use `supabase db push` for application tables.

## Neon

Neon is the primary application database.

- Server routes connect with `DATABASE_URL`.
- Application tables include `app_jobs`, `job_outputs`, `media_assets`, `user_assets`, billing, receipts, admin settings, legal reports, and workspace data.
- Migrations live in `neon/migrations`.
- Apply them with `pnpm db:migrate:neon`.

## Amazon S3

S3 is object storage for media files.

- Generated media, uploads, thumbnails, previews, keyframes, and exports are stored as objects.
- S3 configuration uses `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optionally `S3_PUBLIC_BASE_URL`.
- S3 stores bytes and public/private object URLs; Neon stores metadata and relationships.

## Rule Of Thumb

- Identity or sign-in flow: Supabase.
- SQL table or query used by the app: Neon.
- Image, video, audio, thumbnail, export file, or large binary: S3.
