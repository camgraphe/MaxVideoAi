# Tool delivery fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation and one fresh whole-branch review.

**Goal:** Correct finishing output size/rotation handling, reject no-op video upscales before a wallet debit, and show actionable localized failure messages.
**Architecture:** Preserve existing tool orchestration, quote owners, ownership, pinned downloads and refund/idempotency contracts. Probe already downloaded finishing output bytes locally; source URL reads keep the import limit. Validate target upscale eligibility through one shared pure predicate used by server quote and execution.
**Tech Stack:** Next.js, TypeScript, Node test/tsx, FFprobe, existing Fal client.
**Spec:** User request in this chat following the read-only production audit of 2026-11-15.

## Global constraints
- Source import remains 50 MiB by default; finishing provider output stays bounded at 500 MiB.
- Compare display dimensions using FFprobe rotation metadata; never accept arbitrary resizing by swapping dimensions blindly.
- No provider re-submission, production data repair, pricing policy changes or historical receipt changes.
- Failures retain exactly-once refunds and transient polling failures remain pending.
- All customer messages support EN/FR/ES and never expose provider URLs, raw errors or internal identifiers.

## Review focus
- Negative/270-degree rotation, rotate tags, and ordinary landscape files.
- Oversized downloaded output is probed without a second source-limited download; failed validation leaves no published output.
- Equal/lower targets in both portrait and landscape are rejected by quote and execution before payment.
- Factor-mode upscale and accepted-job recovery remain valid.
- Moderation and persistence errors remain distinguishable without falsely promising a refund before settlement.

## Task 1: Finishing media recovery
Files: toolbox-video-metadata.ts, finishing-output.ts, toolbox video metadata and finishing output tests.
- [x] Add regression tests for rotated metadata and already downloaded output over 50 MiB; run RED.
- [x] Add a bounded local-byte probe shared by source probing and output persistence; normalize display dimensions and validate before upload.
- [x] Run focused media/finishing tests GREEN.

## Task 2: Upscale preflight
Files: tools-upscale.ts, upscale.ts, toolbox-quote.ts and focused upscale tests.
- [x] Add equal/lower target and portrait tests plus a real runner/database assertion of zero job/debit/provider submission; run RED.
- [x] Reuse one target eligibility validator in quote and run before pricing/reservation, preserving factor mode and existing-job replay.
- [x] Run focused unit/architecture/PostgreSQL tests GREEN.

## Task 3: Actionable failure messages
Files: finishing errors/status/run, tool routes, localized finishing/upscale quote presentation and DOM tests.
- [x] Add moderation, invalid output, network recovery and localized UI regression tests; run RED.
- [x] Return safe typed failure codes, preserve detailed server classification, and render localized actionable messages in submission and polling/quote errors.
- [x] Run focused tool tests and PostgreSQL refund checks GREEN.

## Final validation
- [x] Frontend lint, exposure lint, TypeScript, diff whitespace and relevant architecture checks.
- [x] Run appropriate validation suites per CI guide; smoke-test local tools with controlled fixtures.
- [x] Fresh whole-branch review; resolve material findings; commit the isolated candidate.

## Execution record

- Tasks 1–3 implemented and exercised through real FFprobe, PostgreSQL 17 and DOM tests.
- Source imports retain their 50 MiB default. Output inspection consumes the already downloaded bytes before publication, bounded at 500 MiB.
- Rotation fixtures use an explicit display matrix; the project's FFprobe 4.4 and the system probe both confirm its axes.
- Independent read-only review found two material cases. Both were reproduced before correction: completion winning a submission-error race, and missing output cadence being misreported as a storage failure.
- The execution path now reads terminal state before asserting a refund or returning a concurrent completed result. Invalid probe content uses a typed media validation error, separate from process/storage faults.
- Browser verification: real FinishingSession recovery with controlled API/shell adapters, Chromium at 1365×900 and 390×844; moderation/save causes and settled refund text rendered, no page errors. Browser plugin was unavailable.
- Full fast validation: 11,350 passed, 1 failed, 1 skipped. The failure is the existing GitHub asset freshness check in github-assets.test.ts; its code, manifest, referenced assets and READMEs are unchanged from origin/main. No freshness timestamps were rewritten.
- Final focused verification, lint/type checks and commit are recorded with the candidate. No production data repair, paid submission or release is part of this fix.


Final focused result: 109 passed, 0 failed, 0 skipped. Frontend TypeScript passed; frontend lint passed with 7 pre-existing warnings in unrelated files; exposure lint and diff whitespace passed.
