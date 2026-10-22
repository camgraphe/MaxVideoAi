# Luma Modify readiness

**Goal:** Correct source timing and direct cost accounting, and prepare an admin-only 5-second background replacement trial.

**Architecture:** Keep existing provider routing, canonical billing, owned-media validation and polling owners. A shared pure Luma source contract validates measured source timing before quotes and payment. Modify initially admits only exact 5s/10s sources matching the selected duration. Reframe admits sources up to 10s and explicitly sends the selected 5s/10s output duration. No automatic trimming or arbitrary-duration price inference.

**Tech Stack:** Next.js/TypeScript, node:test/tsx, existing Luma Agents REST adapter.

**Spec:** User approval on 2026-10-22; official Agents editing, reframing and pricing guides reviewed on that date. Editing maximum 18s, Reframe maximum 10s/200MB. Modify published cost rows cover 5s/10s; HDR costs 2x SDR, EXR 3x. Existing production flags are disabled.

**Global Constraints:** Isolated branch from origin/main; preserve shared Desktop checkout. No production environment writes, paid generations, tariff changes, automatic Fal fallback for source modes, SDK migration, or optional 360p/extend work. Generated catalog comes from its generator. Missing or mismatched owned metadata fails before spending.

**Review Focus:** Web/MCP quote and execution parity; source URL/asset binding; no unpriced durations; Reframe explicit duration; HDR/EXR attempt accounting; admin rollout flags do not inadvertently activate public or image traffic.

### Task 1: Source timing contract

- [x] Add regression tests for Web preflight, execution context and canonical pricing: owned 5s/10s source succeeds, unknown/8s/over-limit/mismatched selection fails, foreign source cannot supply timing. Reframe source 11s fails and selected 10s reaches payload.
- [x] Implement `validateLumaSourceVideoTiming({engineId, mode, sourceDurationSec, durationSec})` returning a safe failure or null. Reuse in Web preflight, execution and canonical pricing. Require owned source references and mode-specific source fields (Modify18s/Reframe10s). Preserve other providers.
- [x] Regenerate engine catalog. Run focused source/media/Luma/MCP tests; expected all pass after observing new failures.

### Task 2: Direct cost and provider payload

- [x] Add behavioral tests for generation/Edit HDR2x and EXR3x, invalid cost scenarios unavailable, accepted attempt stores the correct cost.
- [x] Extend optional provider cost flags and forward normalized HDR/EXR. Explicitly serialize Reframe output duration. Keep retail amounts unchanged.
- [x] Run payload/routing/pricing/submission/poll suites; expected all pass. Commit implementation and tests.

### Task 3: Activation preparation and delivery

- [x] Refresh Ray3.2 prompting sources while preserving legacy Ray2 guidance.
- [x] Document exact admin-only flags, release prerequisites, a 5s/720p SDR Modify prompt, fresh quote/approval and one-attempt recovery, durable playback/cost acceptance and rollback.
- [x] Run registry generation/check, TypeScript, lint/exposure and appropriate focused checks. Review the complete diff with a fresh reviewer; fix substantive findings with regression evidence. Prepare a PR and report remaining production activation/test steps accurately.

## Delivery evidence

Prepared in PR #497; production flags and tariffs remain unchanged. No paid trial.
The independent whole-branch review found a source-binding bypass: alternate video
slots could select another clip while borrowing the verified source duration.
The fix rejects extra/duplicate/alternate-slot videos and carries the verified URL
and duration together. Regression tests failed before the fix, then passed. A
composer regression also reproduced two source pickers; deduplication retains one
picker with the active mode's source limit.

After the review fixes: 212 focused tests pass, TypeScript passes, ESLint has no
errors (six existing warnings). The earlier optimized local build passed, as did
MCP client checks (173 passed, one existing skip), registry and exposure checks.
Full local validation was attempted but interrupted after unrelated disposable
PostgreSQL starts exhausted macOS shared memory (`shmget: No space left on device`).
The first affected test passed when rerun in isolation. Required CI integration,
financial and browser lanes must still pass on the final commit before release;
no authenticated live Luma trial has been performed.
