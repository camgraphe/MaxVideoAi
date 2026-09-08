# Activity first-load latency — 8 September 2026

## Scope and environment

The implementation starts from `0eb139aa5` (qualified source `45c45a812`) on the
isolated branch `codex/activity-first-load-latency`. No source worktree, main/app
branch, production data, provider, payment, or storage service was modified.

The database benchmark used disposable Neon branch
`preview/codex/activity-latency-20260908` (`br-flat-darkness-aeri6c9s`), recreated
from the qualification snapshot time on the same main parent and expiring
2026-09-09T16:00:00Z. The launcher verifies branch identity, parent,
non-default/non-primary state, expiry, and endpoint before every run. It loads the
connection string only in memory and omits provider/payment/storage credentials.
Read-only runs set PostgreSQL `default_transaction_read_only=on`. No account or
job identifier, prompt, or media URL was printed.

Runtime: local Node 23.9 (repository target: Node 22), PostgreSQL/Neon over the
same local network path. Page size was 24. Each reported baseline/candidate run
used a fresh Node process and the same account chosen in memory as the account
with the largest copied history. The Neon compute was warm for the comparable
three-run sets; database and response caches were not shared between accounts.

## Root cause evidence

Source inspection found that the first jobs GET awaited `ensureBillingSchema`
before auth/listing and that output enrichment awaited
`ensureMediaLibrarySchema`. Those bootstraps contain 89 and 19 sequential
query/executor calls respectively. The route could then synchronously repair
missing legacy outputs and re-read them.

A preliminary read-only run woke the compute in 2,493.3 ms. After that wake, five
samples measured the chronological query at 133.9–165.7 ms and the 24-job output
query at 120.9–197.8 ms (the first list sample was 661.2 ms). These reads cannot
account for the prior 17–18 second endpoint observations.

Three fresh-process baseline runs on the warm compute measured:

| Run | Billing schema | List | Media schema | Outputs | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 12,312.1 ms | 408.8 ms | 2,858.4 ms | 395.1 ms | 16,098.7 ms |
| 2 | 12,438.0 ms | 414.9 ms | 2,729.0 ms | 139.6 ms | 15,841.4 ms |
| 3 | 12,160.4 ms | 373.9 ms | 2,772.4 ms | 126.0 ms | 15,600.0 ms |

The median baseline was 15,841.4 ms. Runtime schema work consumed about 15
seconds and reproduces the existing stable `/api/jobs?limit=24` observations of
17.267 and 18.455 seconds. This demonstrates request-time DDL/seed bootstrap as
the dominant cause; auth, the chronological query, output enrichment SQL, and
locks were not assumed responsible.

## Correction

- The jobs list no longer runs `ensureBillingSchema` on GET.
- Output listing accepts an explicit `ensureSchema:false`; all existing callers
  retain the historical default. Only the migrated Activity list opts out.
- The first page no longer waits for legacy output repair writes. Existing
  `job_outputs` still enrich the response; when an output projection is absent,
  the exact `app_jobs` original/settings/status mapping remains intact.
- Stale audio reconciliation, explicit Fal refresh, provider-id deduplication,
  pagination, account/source isolation, pending observations, and all media
  actions remain unchanged.
- Non-production `JOBS_ROUTE_TIMING=1` exposes only bounded phase durations in
  `Server-Timing` and a matching server log line.

## Comparable after measurements

Three fresh-process candidate runs used the same warm compute, copied account,
24-item page, and code path. PostgreSQL was forced read-only, proving that the
candidate does not depend on schema or backfill writes. The internal account
selection query is included in total time so that first connection setup is not
hidden.

| Run | Connection/account selection | List | Outputs | Total |
| --- | ---: | ---: | ---: | ---: |
| 1 | 922.1 ms | 525.0 ms | 125.2 ms | 1,572.3 ms |
| 2 | 885.7 ms | 542.3 ms | 125.9 ms | 1,554.0 ms |
| 3 | 880.4 ms | 537.0 ms | 124.6 ms | 1,542.1 ms |

Median dropped from 15,841.4 ms to 1,554.0 ms: 14,287.4 ms faster, a 90.2%
reduction (10.2×). A fourth read-only check measured 1,576.4 ms and confirmed
zero stale audio jobs and zero missing output projections among the 24 returned
jobs.

## Limits

This is reproducible server data-path evidence, not a production Core Web Vitals
or field claim. The available Chrome/Codex preview did not share the authenticated
qualification session on port 3037, so its visitor request was excluded from the
comparison. An authenticated browser run should still be completed before merge
if a reusable safe session becomes available. The bounded instrumentation remains
available for that run.

Neon compute wake latency remains: the preliminary cold read needed about 2.5
seconds before subsequent reads. The correction removes approximately 15 seconds
of application-controlled sequential schema work; it does not claim to remove
database cold-start latency. Deployments must apply canonical Neon migrations
before this read path runs. A missing/outdated schema now produces the existing
503 database-unavailable response instead of attempting request-time repair.

## Verification

- Focused Activity, jobs lifecycle, continuation, and media-library contracts:
  67 passed, 0 failed.
- Full repository validation: 4,472 passed, 0 failed in 96.9 seconds.
- Frontend TypeScript (`tsc --noEmit`), frontend lint, public exposure lint, and
  `git diff --check`: passed.
- Sanitized production build: passed, including model/media prebuild gates and
  861 generated static pages. The existing Supabase Edge Runtime warning and the
  local Node 23 versus repository Node 22 engine warning remain non-blocking.
