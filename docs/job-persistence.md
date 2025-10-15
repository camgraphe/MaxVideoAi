# Job persistence & recovery cheat sheet

This note explains why a conversational assistant without database access cannot patch a job, how the hosted app is able to do so, and what manual steps you can run when you need to reconnect a Fal render to its MaxVideoAi job record.

## Why the assistant cannot "just update the job"

The conversational assistant that answers in this repository only manipulates files under version control. It does **not** run the Next.js server, nor does it hold credentials to the production Postgres instance or to Fal. As a result it cannot execute SQL, HTTP requests, or queue polling. All it can do is describe the steps you should run yourself or encode them in scripts/documentation.

By contrast, the deployed application loads `DATABASE_URL` at runtime, opens a connection pool with `pg`, and executes queries through the shared `query` helper. If the environment variable is missing the API immediately throws instead of falling back to any mock, which is why direct access to the database is required for job creation or updates.【F:frontend/src/lib/db.ts†L1-L27】

## How the runtime persists a job

1. `/api/generate` talks to Fal, then **inserts the job row before returning a success response**. Any failure while writing to `app_jobs` rolls back wallet reservations and surfaces a 500 status so the client never assumes a job exists without the DB record.【F:frontend/app/api/generate/route.ts†L364-L574】
2. Successful inserts are mirrored into `fal_queue_log`, capturing the Fal `request_id` alongside pricing metadata for later reconciliation.【F:frontend/app/api/generate/route.ts†L496-L520】
3. `/api/jobs` serves the dashboard and workspace. It refuses to operate when the database is unavailable, re-hydrates rows for the signed-in user, and normalizes media URLs so the UI can display thumbnails and videos sourced from Fal.【F:frontend/app/api/jobs/route.ts†L1-L139】
4. `/api/fal/poll` is a cron-safe endpoint that reads queued/running jobs, fetches their live status from Fal, and forwards the webhook payload to the shared updater so the same code path handles webhooks and manual polling.【F:frontend/app/api/fal/poll/route.ts†L1-L54】
5. `updateJobFromFalWebhook` resolves the Fal queue result, extracts the media URLs, normalizes the status, and updates `app_jobs` in place. This guarantees that as soon as Fal returns a video, the persisted job stores the canonical CDN link.【F:frontend/server/fal-webhook-handler.ts†L1-L189】

Because all those steps live on the server, the hosted app can reconcile jobs as long as it can reach both the database and Fal. The assistant cannot simulate that execution path.

## Manual recovery checklist

When a Fal run succeeds but the job row is missing or incomplete, you can follow the same sequence manually:

1. Look up the job by its Fal `request_id` in `app_jobs` and `fal_queue_log` to confirm whether the row exists and contains the correct provider link. The SQL snippet below matches what `/api/generate` and the webhook use internally.
   ```sql
   SELECT job_id, status, progress, video_url, provider_job_id, updated_at
     FROM app_jobs
    WHERE provider_job_id = '8b6d8cb6-b332-4282-a42d-9e77667a172a';

   SELECT job_id, status, created_at
     FROM fal_queue_log
    WHERE provider_job_id = '8b6d8cb6-b332-4282-a42d-9e77667a172a'
 ORDER BY created_at DESC;
   ```
2. If no row exists, recreate it with the same columns `/api/generate` fills (job id, prompt, pricing snapshot, etc.). If a row exists but is missing the CDN link or final status, run an `UPDATE` mirroring the fields the webhook touches.
   ```sql
   UPDATE app_jobs
      SET status = 'completed',
          progress = 100,
          video_url = 'https://v3b.fal.media/files/b/koala/2ZxXFbF3QO9lHooC7SDgP_STEKnOvc.mp4',
          thumb_url = COALESCE(thumb_url, NULL),
          provider_job_id = '8b6d8cb6-b332-4282-a42d-9e77667a172a',
          updated_at = NOW()
    WHERE job_id = 'job_d5bc0158-f7e5-4922-8a21-03ed55c1d5e2';
   ```
3. Trigger `/api/fal/poll` (POST) or wait for the next webhook to confirm the status converges. The route uses the same updater as the webhook so it will re-run the media extraction and status normalization logic shown above.【F:frontend/app/api/fal/poll/route.ts†L16-L54】【F:frontend/server/fal-webhook-handler.ts†L124-L189】
4. Finally, hit `/api/jobs/{job_id}` or reload the workspace. The client uses `useInfiniteJobs` to hydrate `recentJobs`, then promotes any new records into the local render list so the gallery reflects the persisted state.【F:frontend/lib/api.ts†L180-L260】【F:frontend/app/(workspace)/app/page.tsx†L343-L757】

Following those steps mirrors exactly what the hosted application does; the only difference is that you run the SQL and HTTP calls yourself when the automatic flow is interrupted.
