# MaxVideoAI

Cinematic video pipeline orchestrator built with Next.js 15, Tailwind, Drizzle ORM, and a Postgres backend.

## Prerequisites
- Node.js 18+
- Docker (for the local Postgres service)

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Copy environment variables and adjust as needed
   ```bash
   cp env.example .env.local
   ```
3. Start Postgres locally
   ```bash
   npm run db:up
   ```
4. Apply the database schema and seed demo data
   ```bash
   DATABASE_URL=postgres://maxvideoai:maxvideoai@localhost:5432/maxvideoai npm run db:push
   npm run db:seed
   ```
5. Launch the app
   ```bash
   npm run dev
   ```

The marketing site is available at `http://localhost:3000/`, and the dashboard routes live under `/dashboard`.

## Database Tooling
The project uses [Drizzle ORM](https://orm.drizzle.team/) with `drizzle-kit` for migrations. Helpful commands:

- `npm run db:generate` – generate a SQL migration from the TypeScript schema (`src/db/tables.ts`).
- `npm run db:push` – apply pending migrations to the target database.
- `npm run db:migrate` – run existing migrations (useful in CI).
- `npm run db:seed` – populate demo users, presets, jobs, and usage metrics.
- `npm run db:studio` – launch the Drizzle Studio UI.
- `npm run db:down` – stop the local Postgres container.

## Model Presets & Capabilities
- Generation now routes through FAL.ai adapters (Veo 3 Quality/Fast, Kling, Pika, Nano Banana).
- Each preset references a capability registry (`src/data/models.ts`) so the form surfaces the right controls (image init, masks, reference video, audio, FPS, CFG scale, etc.).
- Advanced options and source assets are serialised into job metadata so the downstream provider adapter can submit the correct payload to FAL.

## Asset Uploads
- The generate form lets producers attach init images, masks, reference frames, or ref videos via `/api/uploads`.
- `/api/uploads` now returns an S3/R2 presigned POST (see `src/lib/storage/presign.ts`). Configure `S3_*` variables in `.env.local` to enable the flow.
- The client uploads directly to your bucket and receives the public file URL, which is forwarded to the render adapter in job metadata.
- Set `FAL_KEY` (or the legacy `FAL_API_KEY`) and optionally `FAL_API_BASE` / `FAL_TIMEOUT_MS` so the backend can launch and manage renders through FAL.
- When using FAL webhooks, expose `APP_URL` (public base URL) and optionally tweak `FAL_WEBHOOK_PATH`; enable queue logs globally with `FAL_QUEUE_LOGS_DEFAULT=1` if you want verbose polling traces by default.
- Si ton bucket S3 est en mode "Object Ownership: Bucket owner enforced", ajoute une bucket policy `s3:GetObject` publique (ou passe par CloudFront) pour rendre les fichiers lisibles après upload.

## Project Structure Highlights
- `src/app/(marketing)` – public marketing pages.
- `src/app/(dashboard)` – authenticated product surface (generate, jobs, billing, settings).
- `src/db/tables.ts` – Drizzle schema definition.
- `src/db/client.ts` – Postgres connection helper shared across API routes and scripts.
- `scripts/seed-db.ts` – demo data loader used for local development.

## Next Steps
- Monitor the FAL webhook feed and add additional observability (metrics, retries) as needed.
- Persist job events/output assets from provider callbacks.
- Introduce real auth and billing once the persistence layer is stable.
