# Studio media analysis implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add explicitly requested, bounded Sol media analysis while keeping Studio a creation assistant and preserving simple Luna edits.

**Architecture:** Pure contracts project effective capabilities. Analysis preparation produces a reviewable quote; confirmation reserves existing Studio credit lots and queues a dedicated worker. Owned source extraction and provider dispatch are bounded, durable and independent of generation completion. Existing revisioned timeline commands remain the editing owner.

**Tech Stack:** TypeScript, Next.js, Zod, PostgreSQL, FFmpeg, existing OpenAI SDK and Studio credits.

**Spec:** `docs/superpowers/specs/2026-10-06-studio-media-analysis-design.md`

## Global constraints

- Luna retains image vision, generation preparation and simple timeline edits.
- Sol analysis requires a concrete client objective, exact owned reference, bounded scope and confirmed credit ceiling.
- A generated or assembled result never starts an analysis or critique automatically.
- 30 seconds is a planning hint; exact generation capabilities own duration decisions.
- Preserve originals, private-media boundaries, linked audio, manual revisions, idempotent recovery and immutable historical tariffs.
- No production migration, deployment or feature activation in this worktree.
- Audio, precise beats, overlays and rendered-film review are exposed only when their effective profiles are qualified. No invented prices.
- User approved execution on 2026-10-06 and reuse of the existing OpenAI key; implement inline without another plan handoff.

## Review focus

- Repeated generation completion/polling must produce zero analysis jobs and zero analytical provider calls.
- A selected foreign, hidden, replaced or deleted reference must fail before paid dispatch.
- Lost replies and unknown supplier usage must not dispatch or debit twice.
- Concurrent chat and analysis must share credit/campaign locks and honor purchased-credit suspension.
- A long musical brief or several known clips must not silently truncate the soundtrack or force paid content analysis.

### Task 1: Creative workflow and effective capabilities

**Files:** `frontend/lib/studio/media-analysis-contract.ts`, `frontend/src/server/studio/conversation-director-instructions.ts`, `tests/studio-media-analysis-contract.test.ts`.

**Interfaces:** `studioAnalysisCapabilities(model, availability)`; strict preparation/confirmation/result schemas used by subsequent tasks.

- [x] Write and run failing tests for both models, explicit analysis scope, no completion trigger, simple assemblies and profile bounds.
- [x] Implement strict pure contracts and creation-first director guidance covering hooks, end cards, music placement, long assemblies and completion stop.
- [x] Run focused contract/director tests and commit.

### Task 2: Owned bounded extraction and provider adapters

**Files:** `frontend/src/server/studio/media-analysis/{policy,source,provider}.ts`, `tests/studio-media-analysis-runtime.test.ts`.

**Interfaces:** validated versioned policy; `extractStudioAnalysisSource` returns timestamped private frames/audio; provider receives the same payload used for token counting and returns observations plus exact usage.

- [x] Write/run failing tests for source limits, interval coverage, decode timeouts, model/usage mismatches, unsafe outputs and audio profile gating.
- [x] Implement bounded owned-source extraction, exact time mapping and native provider adapters; private temporary files always cleaned.
- [x] Verify with local measured media fixtures, no live paid call, and commit.

### Task 3: Durable analysis and shared credit funding

**Files:** `neon/migrations/64_studio_media_analysis.sql`, `frontend/src/server/studio/media-analysis/{repository,service,worker}.ts`, shared assistance credit/campaign owners, `frontend/scripts/run-studio-analysis-worker.ts`, `tests/studio-media-analysis-postgres.test.ts`.

**Interfaces:** prepare/read/confirm service for a Studio actor; queued worker freezes policy/source/consent, persists dispatch before the provider, saves output before settlement, retains unknown holds.

- [ ] Write/run failing disposable-PostgreSQL tests for ownership, expiry, double confirmation, changed source, shared funding, paused credits, concurrency and lost-response replay.
- [ ] Implement explicit migration and separate analysis consumer of the same credit lots/campaign, with no fake Responses call rows or read-time schema/grants.
- [ ] Implement worker reservation and settlement recovery; no generation completion callback.
- [ ] Run financial integration tests and commit.

### Task 4: Conversation tools and review cards

**Files:** conversation action/draft contracts and executor/director owners; analysis API handler/routes; route-local analysis hook/card; `tests/studio-media-analysis-tools.test.ts`, `tests/studio-media-analysis-route.test.ts`.

**Interfaces:** nonspending capability handoff; `analysis.prepare` yields a quote ending the turn, `analysis.read` reads owned saved observations; client alone confirms model plus credit ceiling.

- [ ] Write/run failing tests for forced Luna calls, frozen model, same-origin/body guards, one quote per turn and saved recovery.
- [ ] Wire tools, immutable draft projection, explicit Sol selection and preparation/confirmation/status card with existing account/session lifecycle guards.
- [ ] Verify accessible failure/pending/recovery states and commit.

### Task 5: Practical assembly and music source timing

**Files:** canonical conversation timeline edit contracts/owner and tests; Studio director guidance.

**Interfaces:** existing image/audio inserts and revisioned edits; exact optional source-in frame for supplied music/selected portions, no implicit soundtrack generation or analysis.

- [ ] Write/run failing tests for source offsets, source duration limits, audio layering and a supplied long soundtrack on an empty sequence.
- [ ] Extend canonical edit input only where required; retain schema parity and existing manual edit protection.
- [ ] Verify simple known-plan long assembly, hook/end-image insertion and music placement without analysis dispatch; commit.

### Task 6: Integration, documentation and branch review

**Files:** engineering analysis guide, Studio architecture/economics guides, worker scripts and CI test registration.

- [ ] Run `npm run test:editor`, appropriate PostgreSQL integration, TypeScript, frontend lint, exposure and diff checks; browser smoke the modified paths.
- [ ] Document policy qualification/activation, worker operations, unknown-use recovery and available versus deferred profiles.
- [ ] Review complete branch and fix actionable findings with regression tests.
- [ ] Commit the reviewed candidate and report verified behavior and exact remaining activation requirements; do not merge or deploy.
