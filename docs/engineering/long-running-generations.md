# Long-running Fal video generations

## Invariants

- Video upscale and the public Fal video submission route enqueue work and return acceptance. A web request must not wait for the render to finish.
- `src/lib/fal-queue-submit.ts` makes one queue POST. It intentionally bypasses SDK submission retries: losing the acknowledgment does not prove that a paid request was rejected.
- Video upscale requires a client request ID. Its user-scoped job ID and request fingerprint are reserved under a PostgreSQL advisory transaction lock, together with the wallet debit. Only the winning reservation submits. Replaying that intent, including after a refund, never submits again.
- The browser retains that intent through ambiguous network errors and refreshes. Separate devices or explicitly different request IDs are separate intents; this is not a universal provider-level exactly-once guarantee.
- Persist the provider request ID before returning acceptance. A token-authenticated webhook can also recover a lost acknowledgment through its app-job correlation parameter. An unresolved submission stays pending for reconciliation, never automatic replacement.
- Polling read errors, unknown statuses and elapsed attention thresholds are not terminal provider failures. Continue checking the same provider request. The 55/90-minute thresholds do not authorize refunding or rerunning it.
- Late nonterminal events cannot downgrade completed or failed jobs. Completion must preserve a previously refunded payment status.

## Media integrity

`server/upscale-duration-integrity.ts` compares probed video-stream duration with the saved source duration. Its tolerance is two frames, not a percentage that could hide seconds missing from long clips. Failed metadata inspection remains retryable. Legacy jobs without source metadata cannot receive this validation retroactively.

A shortened output is retained as private diagnostic evidence in the job settings, not delivered as a successful upscale. The failure and exact original-wallet-charge refund commit in one transaction. Failed refund persistence rolls back the failure, so normal reconciliation can retry it. Concurrent settlement produces one refund.

`src/server/audio/video-mux-args.ts` pads the audio before `-shortest`; the original video stream determines the end. It copies video without inventing frames, trimming silent tails, or re-encoding the video. This cannot repair frames already missing in a provider output.

Outputs larger than the 80 MiB remux budget, or without a declared size, take a bounded disk-streaming exact-original copy path. The current direct-copy budget is 450 MiB, with a 120-second source-body deadline. These are infrastructure limits, not trimming instructions. Oversized/incomplete bodies must never publish a partial original. Files above this budget still require a larger/streaming worker; this change does not promise unlimited file support.

## Verification and release checklist

1. Run focused upscale/Fal tests, including disposable PostgreSQL concurrency and refund rollback tests, and real ffmpeg mux-duration tests.
2. Run frontend lint, exposure check, TypeScript, production build and `git diff --check`.
3. Verify the deployed webhook token, callback URL and Fal polling cron. Do not print tokens. A deployment without a callback can poll known IDs, but cannot automatically recover a lost acknowledgment.
4. After release, run one explicitly budgeted small video upscale. Confirm one app job, one debit and one Fal request; refresh/retry the same intent during processing. Compare source/output video duration and frame count, durable output and final payment status.
5. Exercise a simulated long-running provider in tests; do not deliberately pay for duplicate production renders to test retry logic.

## Remaining audited risks

- The multi-step audio generation pipeline and some image tools still wait synchronously for Fal. They need resumable per-stage provider request IDs and asynchronous continuation before being described as safe for arbitrarily long processing. Disabling fallback alone does not fix serverless termination.
- Direct video-provider paths already describe stalled renders as requiring manual review before retry/refund; this audit did not redesign their workers.
- New upscale intents without a durable provider ID are excluded from legacy stale-provisional automatic refunds. Support must reconcile ambiguous acceptance before deciding refund/retry. This intentionally trades automatic recovery for duplicate-charge prevention when both acknowledgment and webhook are unavailable.
- Ordinary provider-terminal-failure refunds still use the pre-existing shared refund path; the new transactional duration rejection does not certify every legacy refund writer.

## Incident reference, 11 September 2026

App job `tool_upscale_7564ceba-d0d7-4ba0-ad71-ae4daf713295`, Fal request `01a08df0-6c51-7882-a9ba-06e6c0903165`: provider success after approximately 15m23s despite a 300-second application timeout. Original video had 145 frames; Fal output had 136. The provider original was already shorter, so application storage was not the source of those nine missing frames. The mechanism inside Fal is not established.

Wallet charge receipt 10462: USD 5.58. Manual refund receipt 10505: USD 5.58. Estimated provider cost is about USD 1.20 based on source-frame output megapixels; this is not a verified per-request billing-event amount. No replacement render is needed merely to establish these facts.
