# Generation timing and pending state

`frontend/server/generate-metrics.ts` owns two distinct readings:

- `app_generate_metrics` records request lifecycle events. The route logger measures request elapsed milliseconds and tags new payloads `durationSource=request_elapsed`. Acceptance is recorded at reservation; a pending/running provider submission must not emit a second acceptance or a completion event. Historical completion-classified rows include asynchronous submission durations and are not render timing samples. Admin request-event counts retain that legacy history; they are not counts of unique completed jobs.
- Observed generation timing joins completed `app_jobs` to the first exact `completed` or `poll:completed` event in `fal_queue_log`, measured from job creation in milliseconds. It includes queue and delivery time until completion was recorded, not just provider inference. Canonical catalog aliases are joined before aggregation. `poll:result` and `poll:completed:skipped` do not qualify. These reads do not initialize schemas, modify jobs or repair historical metrics.

## Adaptive creator estimates

Migration `45_generation_timing_samples.sql` adds an append-once timing ledger and a generic `app_jobs` completion trigger. A video job contributes when it is completed with a nonempty video URL. The trigger also handles delivery of a video URL after status became completed. The unique job key prevents polling/webhook races and migration replays from counting twice. Already completed jobs undergoing media repairs do not acquire invented samples, and their recorded completion timestamps never move. New models/providers use the same trigger automatically; no per-model timing configuration is required.

The migration recovers all available historical successful completion logs (earliest exact `completed` or `poll:completed`), falling back to a completed provider attempt belonging to the job and its final provider. Rows without reliable evidence are left out. It does not change existing jobs, outputs, charges or request metrics. Historical logs/attempts may finish after preview work; `job_completion` records output availability at the job transition. The source is retained so this difference remains auditable. This is observed end-to-end wait, not provider inference latency. Old completed jobs with insufficient metadata may contribute only to an engine mean.

`frontend/server/generation-timing.ts` reads aggregate cells for engine, engine+mode and engine+mode+duration+resolution. Catalog aliases are resolved before aggregation and resolution casing/whitespace is normalized during capture. Provider identity is retained in the ledger for diagnosis; the first estimator pools providers within a model/mode because the client does not know the final provider before submission. Aspect ratio does not select a timing cell. No per-job information, prompts or media URLs are returned to the browser.

`frontend/lib/generation-timing.ts` selects a matching cell. Five or more observations use the cell mean; fewer blend progressively with the parent mean. An unstable engine-level cell is rejected; a child cell falls back to its parent when its standard deviation divided by the square root of its sample count exceeds one quarter of its mean. This heuristic guards against unstable cohorts without deleting slow samples; it is not a formal confidence interval. All historical observations seed empty/recently sparse cases. Once a cell has five completions in the last 30 days, its recent mean replaces its historical mean. Below that threshold, historical evidence has at most five observations' weight alongside recent measurements. The threshold is a conservative initial policy, not a confidence guarantee. Long real waits are retained; no arbitrary resolution/duration multiplier is applied to observed cells. New models without observations retain the explicit heuristic fallback.

`/api/engines/averages` returns this matrix plus compatible engine-level averages/counts and `source=completion_event`. If the migration is not installed, it falls back to the legacy log-based means. The optional principal-scoped SWR request remains independent of catalog loading, refreshes every five minutes while active, and revalidates on a new `jobs:status` completion event. Duplicate completion events are coalesced by job, and listeners are removed on scope change/unmount. The selected submission mode and resolution now accompany duration into local render preparation. Running jobs retain their original estimate; new estimates never postpone playable output.

Admin timing averages/P95 in `generate-metrics.ts` remain the separate legacy log-based reading. Public benchmarks and their minimum-job/distinct-user privacy thresholds remain separate and unchanged. Neither estimates nor more observations guarantee that each successive prediction is more accurate; provider congestion and model updates can still change waiting times.

### Rollout and verification

Apply migration 45 explicitly through the Neon migration workflow before deploying the new reader. There is no schema bootstrap or historical repair in GET requests. The migration can be replayed safely; deploy rollback can leave the collector in place without changing existing job readers. Test a production branch copy before promoting schema changes. The repository change alone does not install a migration or deploy production code.

`tests/generation-timing-postgres.test.ts` uses disposable PostgreSQL to verify historical logs, provider-attempt recovery, duplicate logs, replay, delayed media, immutable capture, a new model/provider, a changed eleven-render mean, and SELECT-only aggregate reads. `tests/generation-timing-matrix.test.ts` verifies exact matching, sparse fallback, resolution normalization and recent/historical weighting. `tests/engine-averages-client.test.ts` verifies optional catalog loading, matrix delivery and completion-driven refresh without duplicate refreshes.

Production read-only audit on 2026-09-15 identified 3,150 recoverable completion-log samples and 449 additional provider-completion samples; reliable log evidence starts on 2026-01-21. These are pre-migration coverage counts, not a claim that the migration was applied or prediction error improved. The earliest jobs date to October 2025 but lack trustworthy timing evidence.

`frontend/lib/generation-observation.ts` defines optional browser observation metadata. `app_jobs.progress` remains a legacy internal field and is never enough to display a provider percentage. A finite percentage must carry explicit provider provenance; zero is retained and values are bounded. `/api/jobs/[jobId]` can project a finite `progress`/`percent` field directly from a Fal status response, but Fal's queue API has no universal percent contract. Absent percentages stay absent. No percent is inferred from brand/model identity, elapsed time, logs, BytePlus/Kling progress floors or copy progress 90.

Stages reflect stored queued/running status, the provider's explicit IN_PROGRESS state, and evidenced delivery-copy state. Unknown pending remains unknown. A completed status with no available media is displayed as finalizing while the existing poller resolves delivery. Terminal results and newer checks cannot regress to stale pending status. The Fal status update is guarded against racing a terminal webhook, and rereads the owned record if that update loses the race.

`GenerationPendingStatus` is a presentation clock only. Active workspace polling uses a 15-second cadence and stops on completed media or failure, including completed videos with no thumbnail. Concurrent authenticated browser status requests coalesce per principal/job while in flight; successful responses are reused for 15 seconds within the same principal/job scope. Audio polling holds one request in flight and keeps its five-second interval stable across state updates. A failed transport or degraded server check retains the last successful check time; silence over 30 seconds is shown as a stale check. Elapsed time, estimated total, overdue and degraded checks remain separate. Clocks are outside live announcements. Completed media is shown immediately, including saved pending records with legacy `minReadyAt` values.

Validation uses injected query results, mocked HTTP and local browser fixtures only; it does not establish production sample availability, SQL execution plans or provider health. No production database, storage, provider generation or schema setup is required for these tests.

## Waiting presentation

`GenerationPendingStatus` owns the localized stage, display clock and timing labels. `GenerationPendingArtwork` owns only the decorative eight-pose sprite loop. Its transparent 4×2 PNG sheet uses 256px cells with aligned baselines; it never implies provider progress. CSS animation respects reduced motion and stops for terminal observations. Unmounting the status component disposes the display interval.

`ProcessingOverlay` uses the existing app panel, ink and muted tokens for both themes. Named size-container queries scale the waiting layout to the preview tile; very small multi-take tiles prioritize status and timing over decoration and secondary notes. The shared status component stays transparent for audio and lightbox consumers.

Retry copy says “Refreshing the status…” and overdue copy explains that creation time can vary. These presentation changes preserve degraded/stale detection and the last successful check time; actual failures still render the error state. `tests/generation-completion-preview.test.ts` covers the real preview tile switching from pending to playable output (or error) and disposing its clock. No estimate delays completed output.

## Accuracy qualification

The initial exploratory comparison used the 629 samples from the 30-day audit and
471 predictions with at least five earlier engine observations. Splitting by
creation day, the baseline mean absolute error was 241 seconds and the matrix
with its stability guard was 250 seconds; median absolute error was 99 versus
97 seconds. Completion timestamps were unavailable in that export, and the guard
was added after inspecting these data. This is neither an independent backtest nor
evidence of an overall accuracy gain. The implementation supplies the requested
reference cells and automatic collection; any precision claim needs subsequent
predictions evaluated against real completions. Keep this distinction when
communicating “learning” to customers.

## Active job reconciliation (September 2026 correction)

The seven provider cron fallbacks run once a minute. An empty queue makes no provider calls.
Authenticated `/api/jobs/[jobId]` reads also refresh the single active direct job through
`refresh-direct-generation.ts`, which reuses the same six direct provider poll owners.
Fal retains its existing status owner. The dispatcher exhaustively covers `VideoProviderKey`.

Migration 47 and `generation-poll-state.ts` provide a shared per-job 15-second throttle
and lease across browser tabs, request workers and cron. Completed/cancelled jobs cannot
acquire it. Success records `checked_at`; database rereads and failed lookups do not
advance it. The lease is released in `finally`; a crashed worker expires after two
minutes. Browser clocks use this provider evidence. Browser request coalescing/cache
prevents duplicate panel requests, and the iteration loop stops when its scope or
tracked job is gone. Closing the browser leaves the one-minute cron recovery active.
This is an operating cadence, not a guaranteed latency bound during provider failures,
worker crashes, large backlogs or durable media-copy retries. Existing quota/batch
limits remain; no second submission or paid generation is made by this mechanism.

Selected previews keep their selected layout/identity but refresh their items from
live pending groups and recent history. Completion cannot revert to an older pending
snapshot. The same rule applies in the expanded viewer, including after active rows
are removed on synchronization into history.

Migration 46 retains original app completion timestamps and adds optional
`provider_duration_ms`. Alibaba's explicit submit/end timestamps are subtracted in
their common timezone (no guessed timezone conversion). This includes its queue and
generation, but excludes app detection/copy delay. The estimator prefers this evidence
where available; other providers keep the existing delivery-time sample. These are
approximate estimates with different measurement coverage, not an SLA. Original
end-to-end delivery evidence is preserved for auditing delay. Malformed/missing provider
timestamps fall back to the original sample. Existing data is backfilled and both
completion orderings (provider attempt first or app completion first) are supported.
Older `settings.resolution` snapshots are recovered without changing any job or media.

The WAN 3 Prime incident was caused by two historical 38-minute app reconciliation
records for provider jobs lasting 209.530 and 167.981 seconds. Their engine-wide mean
was accepted without the child-cell stability guard. That guard now also covers the
root cell, and rejected matrix means cannot return through the legacy average fallback.
