# Activity feed

Activity is the authenticated chronological generation history rendered by
`frontend/app/(core)/jobs`. Its initial collection uses one 24-item
`useInfiniteJobs` feed and keeps explicit server-side source filters for video,
image, audio, storyboard, character, angle, upscale, and background removal.

## Owners

- `frontend/lib/api-jobs.ts` owns SWR pagination, account/source scope isolation,
  stable observations, and late-response protection. Other workspaces also use
  this hook; Activity changes must preserve their polling and cache behavior.
- `frontend/app/api/jobs/route.ts` owns the web transport, auth, stale-status
  reconciliation, provider-id deduplication, output enrichment, and starter
  fallback.
- `frontend/src/server/generations/recent-generations.ts` owns the account-scoped
  chronological `app_jobs` query and cursor.
- `frontend/server/media-library/job-outputs.ts` owns `job_outputs` reads and the
  exact output overlay applied to the web payload.
- Neon migrations are the production schema authority. Runtime schema helpers
  remain compatibility/bootstrap tools for explicit local, development, and
  mutation paths.

## Initial read-path contract

The latency-sensitive jobs list must read already-migrated `app_jobs` and
`job_outputs` tables. It must not wait for `ensureBillingSchema`,
`ensureMediaLibrarySchema`, or legacy output backfill before returning the first
page. These helpers perform many sequential DDL/seed statements and made a new
runtime's first Activity request wait for schema maintenance unrelated to the
requested account data.

`listJobOutputsByJobIds(ids)` keeps its historical default and ensures the media
schema for existing mutation/local-development consumers. The Activity list is
the explicit exception: it calls `listJobOutputsByJobIds(ids, {
ensureSchema: false })` after deployment migrations have established the table.
Do not broaden this opt-out to a caller that may run before migrations.

Missing `job_outputs` entries do not erase media from Activity. The mapped
`app_jobs` original, thumbnail, preview, render list, settings, and status remain
the response fallback; stored output rows override only the matching fields when
present. Completed generation, webhook, polling, repair, and admin paths remain
responsible for durable output projection. Do not reintroduce synchronous repair
writes in the list request.

Stale audio expiry and explicitly requested Fal refresh keep their existing
status-reconciliation behavior. They are separate from schema/output repair and
must retain account ownership and payment safeguards.

## Diagnostics

Set `JOBS_ROUTE_TIMING=1` in a non-production runtime to add a bounded
`Server-Timing` header and one server log line. Allowed phases are schema, auth,
list, stale audio, Fal refresh, outputs, and starter fallback; durations are
clamped to 120 seconds. No user id, job id, prompt, URL, filter value, or media
metadata is emitted. Production ignores the flag.

For comparisons, keep source commit, database snapshot/account, page size,
runtime freshness, compute/cache warmth, and individual runs constant. A request
count reduction or development HMR timing is not latency evidence. Record server
data-path results separately from authenticated browser and Core Web Vitals
results.

## Verification

- `tests/jobs-feed-lifecycle.test.ts` for source/account transitions,
  pagination, refresh, pending observations, and late responses.
- `tests/jobs-api-route-architecture.test.ts` for the migrated-table read
  boundary.
- `tests/jobs-route-timing.test.ts` for bounded non-personal diagnostics.
- `tests/recent-generations-service.test.ts` and media continuation/library
  contracts for query ownership and exact originals.
- Compare first-page server latency before and after on the same guarded dataset;
  do not claim browser or field improvement without browser/field evidence.
