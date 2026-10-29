# First live Milo composer connection

> **For agentic workers:** Use superpowers:executing-plans in the current isolated worktree. The user authorized implementation on 2026-10-29; keep PR #555 in draft.

**Goal:** Replace the optional sample conversation with authenticated, model-specific text assistance using existing Milo credits.

**Architecture:** A dedicated composer session owns request identity, saved history and provider evidence. A server-built context combines canonical capabilities with reviewed prompting profiles. The existing assistance ledger remains the sole owner of reservations and settlement; its context type is generalized without constructing a Studio generation actor.

**Tech Stack:** Existing Next.js, React, Zod, PostgreSQL 17 and OpenAI Responses SDK; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-28-prompt-director-design.md` plus the user's 2026-10-29 approval of the first live connection.

## Global Constraints

- Same branch and draft PR; no merge, deployment, shared-database migration or paid model test.
- Reuse Luna/Standard and Sol/Max policy, account preference and credit lots. Terra and Lite are not live choices.
- Text assistance on video, image and audio. Preserve manual writing, generation ownership, settings, quotes and existing layout.
- This increment proposes text only; settings remain visible context and manually adjustable. No automatic setting change or media generation.
- Reference roles and owned media metadata only; no vision, audio analysis, URL fetching or claimed perception.
- One provider response per request, no automatic billable retry. 2,200 output tokens, 32,000 counted input tokens, 64 KiB HTTP body. Explicit input/output-limit errors; no truncation of the current draft.
- Dedicated account-owned sessions expire for new messages after 24 hours. Saved request tombstones and usage evidence remain available for idempotent recovery. Keep the last 8 completed exchanges as short history.
- Live operation requires explicit public and server flags and existing assistance policy. Sample mode remains development-only. Default remains off.

## Review Focus

- Two concurrent sends/replays must never create two provider calls or charges.
- Unknown supplier outcome retains its reservation; recovery and support must recognize composer sessions.
- Account/model/reference changes cannot apply a late reply to a different draft.
- Metadata-only references and unsupported model/mode/target combinations must not become invented capabilities.
- Shared credit settlement and preferences must remain compatible with Studio.

### Task 1: Context and prompting profiles

**Files:** `frontend/src/lib/prompt-assistance/contract.ts`, `frontend/src/server/prompt-assistance/{context,profiles}.ts`, `tests/prompt-assistance-context.test.ts`.

**Interfaces:** `PromptAssistanceRequest` and `buildPromptAssistanceContext(userId, request)` produce validated model facts, target limit and the selected guide for task 2. `PromptAssistanceResult` carries request/session/revision identity and nullable text proposal.

- [x] Write and run failing behavioral tests for target/mode validation, guide selection, unknown model rejection, current draft limits and reference ownership.
- [x] Implement strict request/result schemas and context composition from existing capability owners. Include reviewed family/mode guidance, fallback provenance and examples.
- [x] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/prompt-assistance-context.test.ts`; expect all pass. Commit.

### Task 2: Durable conversation and existing credits

**Files:** dedicated migration, `frontend/src/server/prompt-assistance/{repository,service,provider,route-handler}.ts`, `frontend/app/api/prompt-assistance/route.ts`, assistance ledger context and support recovery, `tests/prompt-assistance-live-postgres.test.ts`, route tests.

**Interfaces:** `sendPromptAssistance(userId, request)` persists one response; `readPromptAssistance(userId, sessionId, requestId)` recovers without a model request. Both return the same result contract. Settings endpoint reuses the existing account assistance choices.

- [x] Write and run failing PG17 tests for ownership, concurrent replay, body mismatch, settlement, recorded-response recovery and unknown outcome retention.
- [x] Implement sessions/requests and same-origin authenticated bounded routes. Save evidence before settlement, return only validated output after settlement. Read paths never bootstrap schema.
- [x] Extend support resolution to recognize composer calls and prevent waiving active requests.
- [x] Run focused new tests and existing assistance credit/recovery tests; expect all pass. Commit.

### Task 3: Real client connection and verification

**Files:** shared composer hook/panel, video/image/audio context adapters, feature gating, new client/browser tests, `docs/engineering/prompt-assistance.md`.

**Interfaces:** UI supplies `PromptAssistanceDraftContext`; the live transport uses the contracts from tasks 1/2. Existing reducer revision/application/undo remain authoritative.

- [x] Write and run failing tests for real payloads, clarification without proposal, late response, explicit recovery and supported Milo level selection.
- [x] Connect live status/preferences/send/recover with errors and stop-waiting. Keep provider processing independent of browser cancellation, with no refund promise.
- [x] Verify TypeScript, scoped lint, exposure, existing composer tests and `pnpm test:validate`. Use disposable PG/provider fixtures for browser checks.
- [x] Document flags, migration, scope, limits, support and remaining paid quality evaluation; update PR #555 and push reviewed commits.

## Progress

Implementation and focused verification completed on 2026-10-29. The broader validation run and its isolated rechecks are recorded in `docs/engineering/prompt-assistance-validation.md`. No live paid calls or shared schema changes were performed. PR #555 stays draft; activation and creative-quality/cost evaluation remain separate release work.
