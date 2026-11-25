# Provider attempt lifecycle

The attempt ledger is owned by `frontend/src/server/video-providers/provider-attempts.ts`.
Submission adapters retain the genuine primary-provider rejection when starting a
fallback. A Fal submission returning HTTP 202 with `ok: true`, `deferred: true` and
`status: running` is ongoing work. `isDeferredFalSubmission` owns that predicate;
the Kling, Alibaba, Luma and Vertex fallback adapters must not mark it failed.
When known, the provider request ID is recorded as accepted for later polling.

Completion clears `error_code`, `error_class` and `fallback_eligible` only on the
matching attempt. Terminal reconciliation binds the public job, current provider
and provider request ID. It never clears an earlier provider's real rejection.
Completed attempts cannot regress through late failure/polling updates, and late
acceptance cannot overwrite terminal diagnostics. Customer job status, delivered
media and wallet receipts remain owned by the generation lifecycle.

## Fal account cutover

The server selects the first configured credential from `FAL_API_KEY` (explicit
override), `FAL_DIRECT_KEY` (direct account) and `FAL_KEY` (Vercel Marketplace).
Fal queue submissions use the selected credential. With both account keys
configured, a 404 on an authenticated Fal queue status or result read can be
retried once against the other account using the same request ID. The exact
Fal queue origin and read path are checked before sending the alternate
credential. Receipt ownership and terminal reconciliation stay with their
existing callers.

Keep the integration-provided `FAL_KEY` available for operator marketing runs.
Choose it explicitly in the isolated generation process, which determines the
Fal account used to submit and retrieve that output.

## Historical completed Fal repair

Run `frontend/scripts/repair-completed-fal-attempts.ts` with the configured database
and explicit numeric **app_jobs row IDs**. Start in the frontend directory:

```bash
pnpm exec tsx scripts/repair-completed-fal-attempts.ts --dry-run --job-row-id=9314 --expect=1
pnpm exec tsx scripts/repair-completed-fal-attempts.ts --apply --job-row-id=9314 --expect=1
```

Repeat `--job-row-id` for a bounded batch (maximum 50). Inspection is read only;
application requires an exact expected count. Eligible rows are completed current
Fal attempts on completed jobs with a delivered video and the exact stale
`fal_fallback_failed` plus deferred-running response. Application locks jobs and
attempts, compares their full inspected snapshots, rechecks eligibility, and
aborts the entire transaction if either changed. It clears only error fields and
fallback eligibility; the normal timestamp trigger updates `updated_at`. It does
not modify jobs, receipts, media, costs, provider snapshots or genuine earlier
attempts. Explicit `DATABASE_URL` takes precedence over local dotenv files.

`tests/fal-fallback-attempt-recovery.test.ts` executes all four fallback adapters.
`tests/provider-attempt-recovery-postgres.test.ts` and
`tests/completed-fal-attempt-repair-postgres.test.ts` verify completion, late
responses, snapshot guards and atomic repair against disposable PostgreSQL.
