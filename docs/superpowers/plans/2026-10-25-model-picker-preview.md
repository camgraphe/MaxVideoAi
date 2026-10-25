# Model picker preview implementation plan

> Execution: native in this session with a fresh whole-branch review, following superpowers:executing-plans. The user explicitly approved correction and preview integration; no new design approval is required.

**Goal:** Integrate the approved model selection dialog with real contextual prices, bounded network work and verified mobile behavior, delivered as an unmerged preview PR.

**Architecture:** Keep EngineSelect's controlled public API and existing workspace preparation/application owners. Add a lazy dialog, an editorial projection from the existing authored policy, and context adapters for video/image. Share bounded, short-lived estimate requests with the video comparison; authoritative generation quotes remain unchanged.

**Tech Stack:** Existing Next.js, React, TypeScript, CSS modules, Node/tsx tests, DOM tests and CUA browser verification. No new dependencies.

**Spec:** Approved V4 and production review at `/Users/adrienmillot/Desktop/MaxVideoAi V2/output/audits/2026-10-25-model-selection/prototype/INTEGRATION.md` and adjacent `production-review/REVIEW.md`.

## Global constraints

- Quality: Seedance 2.5, Wan 3 Prime, Kling 3.0 Omni Pro. Balance: Wan 3, FLUX 3 Max. Budget: MiniMax H3. These are editorial categories, not absolute price tiers.
- No authored identity/catalog projections or price formulas are duplicated. Prices come from existing estimate endpoints; no snapshot prices ship.
- Opening/closing has no generation, wallet or prompt/media persistence effect. Draft selection applies only through the existing owner after differences are confirmed.
- No operation change or loss of references to make a recommendation fit. Missing source means no fabricated price.
- Six recommended scenarios maximum; other prices only on visible rows. Debounce 200 ms, TTL 60 seconds, concurrency three; share in-flight work, prevent stale account/scenario replies.
- Families stack vertically; search crosses closed families. Phone text stays readable and touch controls stay reachable. Compact short desktop windows without shrinking type.
- Preview only. Preserve shared Desktop checkout; PR from `codex/model-picker-preview`; no merge or production deployment.

## Review focus

1. Account or tariff revision changes while quotes are running must not expose obsolete amounts.
2. Closing with queued quotes must stop unnecessary queued work; reopening an active quote must deduplicate.
3. Modify/Extend references must retain identity and requested operation across candidate preparation.
4. Blank prompts should still allow useful price estimates; unavailable/missing media must remain truthful.
5. Small screens, long translated names, current model outside shortlist and changed settings must stay understandable and keyboard reachable.

### Task 1: Bounded estimate service

Files: new `frontend/lib/model-picker-estimates.ts`, shared quote hook and `tests/model-picker-estimates.test.ts`.
Interface: an estimate queue with canonical keys, success-only TTL cache, leases for queued cancellation, deduplication and account/revision invalidation; returns amount/currency and timing.
- [ ] Write/run failing tests for maximum concurrency, deduplication, TTL, cancellation, stale revision and error retry.
- [ ] Implement the service; preserve generation preflight ownership.
- [ ] Run focused tests, record evidence and commit.

### Task 2: Context and editorial adapters

Files: existing `agent-model-editorial-policy.json`; new browser policy projection and video/image picker adapter modules; focused behavior tests.
Interface: `EnginePickerContext` supplies context text, per-model settings/changes/eligibility and estimate descriptors; adapter preparation never mutates a live draft.
- [ ] Test exact approved ordering, absent/unavailable models, blank prompt, source preservation, operation mismatch and explicit setting changes.
- [ ] Implement using real registry, workspace candidate preparation and existing image estimate contracts.
- [ ] Connect comparison to the shared estimate service and verify existing behavior tests.

### Task 3: Shared responsive dialog

Files: lazy `EnginePickerDialog.client.tsx`, focused state/row/copy/CSS modules, EngineSelect integration, DOM tests.
Interface: controlled current model + optional context; emits chosen model only on apply, visible IDs only while open; all families and detail view share one dialog.
- [ ] Add failing DOM tests for cancel, confirmation, search/families, focus, stale selection and price states.
- [ ] Implement FR/EN/ES copy, approved groups, readable mobile rows, compact short-height layout and 44 px information targets.
- [ ] Verify inherited EngineSelect contracts and preserve explicit multi-selection comparison browser behavior.

### Task 4: Workspace integration

Files: WorkspaceAppReadyView, shell/dock/EngineSettingsBar prop wiring, image composer wiring and route-local adapters; related contracts.
- [ ] Wire video and image pricing context without moving orchestrator responsibilities.
- [ ] Reuse existing application transaction; confirm changed settings once, block reference loss/mode changes.
- [ ] Verify selected defaults/memory/link/project priority and existing workspace/image tests.

### Task 5: Preview and evidence

- [ ] Focused tests, lint, type checking, full build and applicable CI validation.
- [ ] Fresh whole-branch review; fix substantive findings with regression tests.
- [ ] Commit/push and open draft PR; attach PR; wait for Git-backed preview.
- [ ] Test real prices and mobile flows, cold/warm opens, rapid search, close/reopen, quote errors and bounded requests. Record actual timings with measurement limits.
- [ ] Deliver preview URL, validation evidence and remaining limitations. Do not merge.
