# Job reservation journey context (MEAS-01 v1)

A newly reserved video/image job can retain four immutable server facts. They describe
its **reservation boundary**, not acquisition, a browser visit, first use or completion.
`app_jobs.created_at` remains the reservation timestamp. Media `surface` and journey
`entry_surface` are independent dimensions.

## Product contract and authority

| Column (nullable, no default) | v1 value / authority |
| --- | --- |
| `entry_surface text` | `generator`, `tool`, `studio`, `mcp`, `unknown` |
| `entry_source text` | `web_route`, `confirmed_actor`, `unknown` |
| `journey_version smallint` | `1`; legacy/uninstrumented rows may remain NULL |
| `entry_release_sha text` | Full lowercase 40-character Git SHA from server `VERCEL_GIT_COMMIT_SHA`; NULL when absent/invalid |

Allowed pairs are generator/web_route; tool, studio or mcp/confirmed_actor; and
unknown/unknown. A bundle is either entirely NULL or v1 with one of these pairs and
a valid optional SHA. The CHECK ends with `IS TRUE`, rejecting partial NULL bundles.
A BEFORE UPDATE trigger uses `IS DISTINCT FROM` for all four fields. It rejects
changes, clearing values and legacy NULL-to-value backfills. Status, progress,
settings, provider lifecycle and other existing mutations remain allowed.

`frontend/src/server/generations/job-journey-context.ts` builds frozen snapshots.
Its web builder accepts only server environment. The confirmed builder reuses
`requireGenerationActor`: OAuth maps to mcp, studio-session to studio, toolbox-session
to tool. Actor/project/client ownership still belongs to the existing authenticated
boundary and quote gate. Shape validation alone does not authorize an actor.
The normalizer rejects malformed internal context before financial reservation;
an absent optional argument records unknown/unknown/v1 with the validated server SHA.
It does not infer generator from missing quotes. A provided snapshot retains its
captured release when normalized later.

No body, metadata, source string, authOrigin, header, referrer, catalog revision,
analytics consent or browser identifier supplies these fields. Context travels in
a separate TypeScript argument. It contains no new personal data.

## Covered writes and continuations

| Boundary | Construction | Atomic writer |
| --- | --- | --- |
| Authenticated `/api/generate` | Web builder after the existing user gate | Initial video job INSERT |
| Authenticated `/api/images/generate` | Web builder after the existing user gate | Initial image job INSERT |
| Video/image wallet confirmation | Confirmed builder after locked quote ownership and `quoteMatchesActor`, only on fresh wallet reservation | Same initial video/image INSERTs in the caller-owned transaction |

`generator` proves entry through that server API; external callers of the same
endpoint do not become measured website visitors. The two shared writers validate
context after their existing-job check and before any new wallet reservation.
They append the four fields to the existing INSERT using the same executor.
A failed INSERT rolls back financial changes. There is no best-effort side write.

Existing-job returns never update context, including all-NULL legacy jobs.
Already-reserved provider continuations, callbacks and retries do not rebuild it.
Duplicate/concurrent confirmations keep one logical job/charge and the first
snapshot across release A to B. Raw legacy quote parser compatibility remains
unchanged; the actor at a new authorized reservation supplies new proof. A parser's
OAuth fallback is never used as historical analytical evidence.

Audio, included MCP trials, imports and specialized tool products are outside the
promised coverage. A shared writer called without context may record explicit
unknown; this is not evidence that its boundary is instrumented. No admin panel,
MCP input schema, GA4 event, Clarity behavior or client tracking changes here.

## Explicit migration before runtime

Migration: `neon/migrations/81_job_journey_context.sql`. Number 81 was free at base
`4c35aaf1e18715d0d3c0d84ae96d056728cd55a4`. Confirm it is still free when integrating.
The baseline CREATE TABLE declares the columns; it does not ALTER existing databases
or install the new contract at request time. Fresh bootstrap also needs the migration.
The existing transaction/idempotency/rollback owners are unchanged.

This PR prepares the migration; it does **not** apply it to any live database.
A later separately authorized delivery follows `docs/deployment/github-vercel.md`:

1. Reconcile current main and concurrent migrations; review the committed migration.
2. Rehearse on disposable/staging PostgreSQL. The ALTER/constraint validation locks
   `app_jobs`; measure its duration before choosing the live application window.
3. Apply this explicit migration through the authorized migration procedure using a
   direct database connection, before either host runs the new writer. For a bounded
   migration invocation, use `psql "$JOURNEY_DATABASE_URL" --single-transaction -v
   ON_ERROR_STOP=1 -f neon/migrations/81_job_journey_context.sql` with the connection
   supplied privately. Do not source credentials into a report or run a full migration
   replay accidentally.
4. Verify all four columns have the expected types, NULL allowed and no defaults;
   verify `pg_get_constraintdef` for `app_jobs_journey_context_check`, and enabled
   `app_jobs_journey_context_immutable` plus `pg_get_functiondef` for its function.
   Reapplication is idempotent; an unexpected existing definition must stop delivery
   for review, not be silently repaired. No UPDATE/backfill is authorized.
5. Only then deliver the reviewed Git commit by the normal PR/main/Vercel path.
   Verify `maxvideoai.com` and `api.maxvideoai.com` against that merged commit.
6. Record the UTC start of actual coverage for each delivered boundary, contract 1
   and deployed SHA. These dates remain **unset** for this draft.

Without the migration, a new writer fails its INSERT and the reservation transaction
rolls back; no successful empty measurement or provider submission is manufactured.
Rollback the application to its previous runtime while retaining columns, CHECK and
trigger. Older writers can still insert all NULL. Do not erase facts, backfill,
replay paid jobs or force real generation/payment to demonstrate coverage.

## Read-only aggregate projection v1

Canonical SQL: [`../analytics/job-journey-origin-coverage-v1.sql`](../analytics/job-journey-origin-coverage-v1.sql).
Collector: `frontend/scripts/_lib/job-journey-coverage.ts`, with no HTTP endpoint.
`collectJobJourneyCoverage({executor,start,end,adminUserIds})` requires finite Date
bounds with start < end, a read-only executor and static admin IDs held in memory.
It first checks every referenced table/column using `pg_attribute`/`to_regclass`.
Missing schema returns `{status:'unavailable',projectionVersion:1,missing:[...]}`;
no aggregate query, DDL or zero-activity claim follows. Permission/connection/query
errors propagate. It does not fetch credentials or initialize schema. For a stable
snapshot, call it inside a caller-owned read-only REPEATABLE READ transaction.

The SQL binds `$1` UTC start inclusive, `$2` UTC end exclusive and `$3` static
admin ID text array. Internal grain is exact `user_id` AND `job_id`. Output is only
aggregate dimensions/counts, never prompts, account IDs, job IDs or OAuth clients.
Static admin IDs, `app_admins` and roles admin/super_admin/staff/internal are excluded.
Jobs with no owner or outside the creation window are excluded. Failed states and
unknown coverage remain. Audio, Storyboard, NULL media, external FAL imports and
included MCP trials appear explicitly as `out_of_scope`.

Resolution rules, in priority order:

1. Out-of-scope media/funding; then malformed present context = `inconsistent`.
2. Multiple distinct raw quote origins = `conflict`; unsupported raw origins =
   `inconsistent`; a known direct origin disagreeing with raw quote origin = `conflict`.
3. A valid v1 job context is direct `job_context_v1` evidence. Explicit unknown stays
   unknown even if one raw quote origin exists; a non-instrumented caller is not relabeled.
4. Only all-NULL legacy jobs may use `quote_history`: raw oauth/studio-session/
   toolbox-session from matching wallet quotes in accepted/failed state, created
   before the cutoff. Raw NULL is not OAuth evidence. Multiple quotes are aggregated,
   never selected by recency. Foreign-account quotes cannot contribute.
5. No evidence = `unknown`/`no_evidence`. Historical context version/SHA remain NULL.

Counts include jobs, per-group distinct accounts, current completed+paid_wallet jobs,
missing bundles, explicit unknown, missing valid-context SHA and updates at/after the
cutoff. `all_non_admin` and `without_documented_flags` overlap: the latter excludes
active restrictions or fraud-cleanup audit evidence. Groups/scopes must not be summed
as global unique accounts. Current statuses are not historical completion-time replay
or GA4 conversion. Empty activity after delivery does not validate a boundary.
Do not compare quote_history cohorts as versions of direct job instrumentation.

## Synthetic verification

C01–C04: helper mapping, server SHA, invalid internal bundles, frozen snapshots.
C05–C09: repeated migration on legacy/fresh baseline, strict SQL NULL handling,
immutability, existing legacy rows, concurrency, INSERT failure and missing schema
rollback on disposable PG17. C10: execute both real route adapters with mocked gates
and executors, forged body/headers and denied authentication. C11–C14: same account
across three actors and both media, wrong owner/client/project/origin, confirmation
races, provider mock, financial rollback and release A/B recovery. C12's missing
legacy quote origin is tested at the injected confirmation dependency: the actual
current SQL gate intentionally refuses raw NULL origins, and is unchanged.
C15–C18: aggregate fixtures with conflicts, partial bundles, raw nulls, foreign quotes,
cutoff equality, admin/flag exclusions and unavailable schema, under READ ONLY.
Acquired consent/role lifecycle tests retain their own browser contract; this context
never reads consent and adds no analytics caller. No real provider, storage, Auth or
Stripe operation is needed. See the scoped delivery receipt for executed evidence.
