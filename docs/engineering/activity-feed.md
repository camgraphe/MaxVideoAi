# Activity feed

Activity is the authenticated chronological generation history rendered by
`frontend/app/(core)/jobs`. Its initial collection uses one 24-item
`useInfiniteJobs` feed and keeps explicit server-side source filters for video,
image, audio, storyboard, character, angle, upscale, and background removal.
The same `/api/jobs` collection endpoint also serves workspace consumers, so its
initialized-schema requirement applies to every consumer, not only Activity.

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
- The explicit baseline bootstrap plus Neon migrations are the production schema
  authority. Runtime schema helpers remain compatibility tools for that bounded
  operational command and mutation paths.

## Initial read-path contract

The latency-sensitive jobs list must read already-migrated `app_jobs` and
`job_outputs` tables. It must not wait for `ensureBillingSchema`,
`ensureMediaLibrarySchema`, or legacy output backfill before returning the first
page. These helpers perform many sequential DDL/seed statements and made a new
runtime's first Activity request wait for schema maintenance unrelated to the
requested account data.

`listJobOutputsByJobIds(ids)` keeps its historical default and ensures the media
schema for existing mutation/local-development consumers. The jobs collection
is the explicit exception: it calls `listJobOutputsByJobIds(ids, {
ensureSchema: false })` after deployment migrations have established the table.
Do not broaden this opt-out to a caller that may run before migrations.

Missing `job_outputs` entries do not erase media from Activity. The mapped
`app_jobs` original, thumbnail, preview, render list, settings, and status remain
the response fallback; stored output rows override only the matching fields when
present. Completed generation, webhook, polling, repair, and admin paths remain
responsible for durable output projection. Do not reintroduce synchronous repair
writes in the list request.

For legacy videos, `preview_frame` remains the pure in-memory `thumbUrl` fallback
when `thumb_url` is empty and no output projection exists. This preserves the
existing poster for Save to Library without a list-time write, remote fetch, or
synthetic output id.

## New database initialization

The ordered Neon migrations are incremental and do not contain the original
`app_jobs` baseline. A genuinely empty database must therefore run the explicit
baseline command before the migrations:

```bash
APPLICATION_DATABASE_URL='<direct target URL>' pnpm db:bootstrap:neon
DATABASE_URL_UNPOOLED='<same direct target URL>' pnpm db:migrate:neon
```

The bootstrap ignores inherited `DATABASE_URL`, requires a separately supplied
direct non-pooled Neon URL, and is never invoked by a request, build, or deploy
hook. Its local-PostgreSQL escape hatch works only under `NODE_ENV=test` with an
explicit test-only flag. Apply it only to an authorized new target; established
databases normally need only the ordered migrations.

`tests/application-schema-bootstrap-postgres.test.ts` qualifies the complete
empty PostgreSQL → explicit baseline → all migrations → read-only jobs/output
query sequence. A missing/incompatible primary `app_jobs` schema makes the jobs
route return 503. A missing/incompatible optional `job_outputs` projection is
caught and returns the exact `app_jobs` fallback with 200.

Stale audio expiry and explicitly requested Fal refresh keep their existing
status-reconciliation behavior. They are separate from schema/output repair and
must retain account ownership and payment safeguards.

Audio expiration treats the feed snapshot only as a candidate. The route-local
`jobs-stale-audio.ts` helper locks the current owned row and checks its current
surface, active status, missing media and last-update age again. It returns `true`
only after an expiration commits; the collection reloads only those expired IDs.
The terminal update and any wallet refund share one transaction through
`refundAudioChargeInExecutor` in the canonical audio receipt owner. That owner
validates the persisted debit and an existing refund, so neither caller-supplied
prices nor a stale snapshot can define the credit. Completion or recent progress
wins when committed before the lock. Concurrent expiration creates at most one
refund. Missing/inconsistent paid ledger data or any failed write rolls back both
state and money; the route logs the reconciliation error and preserves the row.
Unpaid/free jobs expire without wallet writes. None of these paths initializes
schema or contacts a provider.

## Browser focus ownership

Status polling has a separate owner in `frontend/lib/job-status-polling.ts`.
Each mounted feed registers its pending jobs under the confirmed account. A
shared account/job entry retains one timer until its last subscriber leaves;
changing a source or closing another feed cannot remove a live subscriber's
timer. Final statuses and manual-review states stop polling. HTTP 401/403/404 stop
automatic retries. Transient errors back off from the normal 15-second cadence
to 30 and then at most 60 seconds, stopping after five consecutive errors.
Explicit public Refresh renews a nonterminal retry budget; same-account sign-in
or token renewal resumes a denied request. Automatic error revalidation never
renews that budget. Status errors do not automatically revalidate the collection:
that would start a separate SWR retry chain after authentication fails. Account lifetime is checked in memory, so blocked session
storage cannot disable polling or permit late account responses to affect another
feed. A fresh
successful status observation can recover an exhausted or renewed-session entry.
In-flight results cannot recreate a disposed entry, and status events from a
previous principal are suppressed. The existing account-scoped in-flight and
15-second successful-response coalescing in `api-job-status.ts` remains intact.
A reopened feed cannot join a retired owner's request; stale completion cannot
replace or remove a newer in-flight request. A current cached observation still
reaches the feed before the poller stops on a terminal result.

`tests/jobs-polling-lifecycle.test.ts` uses the real SWR feed and status transport
adapter with controlled HTTP responses and time. It covers closing feeds,
independent sources, shared subscribers, permanent/transient errors, recovery and
late account responses. `tests/jobs-feed-lifecycle.test.ts` no longer replaces the
polling implementation with no-op stubs.

`SWRFocusResync` owns the shared API/jobs/engines/pricing refresh on application
routes, including visibility restoration and BFCache `pageshow`. A five-second
throttle coalesces these signals and emits one `wallet:invalidate` notification.
`focus-resync-policy.ts` is shared with `SWRProvider`: its middleware disables
native SWR focus only for keys handled by that owner and only on those routes.
Other keys retain native SWR behavior, and media-library lists retain their
explicit focus opt-out. Do not add a second session watchdog that mutates the
same cache. Reconnect and polling policies remain independent.

SWR Infinite remains under its native focus owner: its page-key loader must reach
the public `infinite` middleware unchanged, and SWR excludes its aggregate cache
from filtered `mutate` calls. The provider recognizes that middleware before
resolving ordinary dependent keys. Activity therefore refreshes its first page
once on native focus; paginated media lists retain their explicit focus opt-out.

`tests/public-watch-runtime-remount.test.ts` exercises the actual runtime with
React and SWR: one fetch per owned string/tuple/function key, wallet notification,
visibility/page-show bursts, cleanup, media-list exclusions and native focus on
other keys and outside the shared-owner routes. This proves request-count
behavior, not a measured page-latency or Core Web Vitals improvement.
`tests/swr-focus-infinite.test.ts` covers initial loading, second-page loading,
focus behavior and the mounted `/login` → `/app` transition with real SWR Infinite.

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
- `tests/jobs-stale-audio-postgres.test.ts` for current-state revalidation, concurrent
  completion/expiration, exact debit reconciliation and atomic rollback on PG17.
- `tests/recent-generations-service.test.ts` and media continuation/library
  contracts for query ownership, exact originals, and legacy poster fallback.
- `tests/application-schema-bootstrap-postgres.test.ts` for the new-database
  initialization sequence outside request handling.
- Compare first-page server latency before and after on the same guarded dataset;
  do not claim browser or field improvement without browser/field evidence.
