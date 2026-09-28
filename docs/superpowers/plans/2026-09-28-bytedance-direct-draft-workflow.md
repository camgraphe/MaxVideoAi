# ByteDance Direct and Draft Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete direct BytePlus execution for the current ByteDance family and add a priced, durable Seedance Draft → final workflow without changing customer prices or historical jobs.

**Architecture:** Keep each public model identity in the authored model registry. Add BytePlus provider profiles and Draft task handling beside the existing direct adapters; persist Draft/final lineage server-side and reuse canonical preflight, quote, charge, poll and refund paths. Promote routes only after canaries, then remove ByteDance-specific Fal compatibility choices.

**Tech Stack:** TypeScript, Next.js App Router, React, PostgreSQL/Neon, `@maxvideoai/pricing`, Node tests with `tsx`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md`

## Global Constraints

- Preserve all user work on the current dirty branch; use an isolated checkout at execution time and stage only this plan's files.
- Keep customer prices, existing credits and historical receipts unchanged. Draft and final are two distinct quotes, jobs and charges.
- Keep the existing public Seedance identities and URLs; Draft is not an extra model in `model-registry.json`.
- BytePlus announces Seedance 1.5 shutdown on 2026-11-11. Direct 1.5 remains in scope as a temporary bridge if the account supports it; add a dated disable/replacement guard and preserve historical reads.
- Every Draft/final operation must be account-bound, idempotent, within the provider's seven-day Draft validity, and subject to the existing authorization and quote-confirmation boundaries.
- Do not use Fal identifiers on BytePlus or remove Fal paths for unrelated models and already-running jobs.
- Follow `docs/engineering/model-registry.md`, `pricing-engine.md`, `media-delivery.md`, the workspace and Studio `AGENTS.md` files, and the applicable architecture contracts before edits.

## Review Focus

- Expired or foreign Draft ID: rejected before charging (Task 2 test).
- Repeated finalization click or retry: at most one charge per accepted final request (Task 2 test).
- Final fails after successful Draft: Draft remains owned and paid; only the final charge follows existing refund rules (Task 2 test).
- Generated face from Seedream Lite loses BytePlus trust after storage copying: capability stays unadvertised until a same-account original-output canary passes (Task 4 test).
- Existing Fal jobs during route retirement: status, playback, receipts and refunds continue using their recorded provider (Task 5 test).

---

### Task 1: Direct Seedance 1.5 provider profile

**Files:**
- Modify: `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`, `byteplus-modelark-payload.ts`, and `byteplus-modelark-profile-policy.ts`.
- Modify: `frontend/src/config/fal-engines/seedance-1-5.ts` and the focused direct submission/poll owners.
- Test: `tests/byteplus-seedance-profiles.test.ts`, `tests/generate-byteplus-submission.test.ts`, `tests/byteplus-provider-architecture.test.ts`.

**Interfaces:** Extend `BytePlusSeedanceProfile` with the 1.5 model/config/pricing profile; `resolveBytePlusSeedanceRouteProfile()` must recognize its canonical engine ID without changing the published model identity. The existing submit/poll result contract remains the consumer interface.

- [ ] Add failing cases for 1.5 text-to-video, first/last-frame image-to-video, 480p/720p/1080p, audio on/off, malformed inputs, provider errors, and the currently unsupported modes.
- [ ] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/byteplus-seedance-profiles.test.ts tests/generate-byteplus-submission.test.ts`; require the new cases to fail for missing direct support.
- [ ] Implement the 1.5 profile, payload and cost facts through the existing direct adapter, retaining the Fal route until canary acceptance.
- [ ] Verify direct 1.5 availability in this account and add a shutdown check, a dated owner reminder, and a safe replacement/disable path before the published deactivation date; never silently route a paid request to a different model.
- [ ] Run those tests and `tests/byteplus-provider-architecture.test.ts`; require all to pass and commit only Task 1 files.

### Task 2: Durable Seedance 2.5 Draft and final lifecycle

**Files:**
- Create: `frontend/src/server/video-providers/byteplus-modelark-draft.ts` for `buildSeedance25DraftRequest()` and `buildSeedance25FinalRequest()`.
- Create: `frontend/server/seedance-draft-links.ts` for owned Draft/final lookup and state transitions.
- Create: `neon/migrations/50_seedance_draft_links.sql` after checking the latest migration number at implementation time; if 50 is occupied, use the next available number.
- Modify: `frontend/app/api/generate/_lib/byteplus-submission.ts`, `frontend/server/byteplus-poll.ts`, and the existing preflight/billing orchestration.
- Test: `tests/byteplus-seedance-draft.test.ts`, `tests/generate-byteplus-submission.test.ts`, `tests/byteplus-poll.test.ts`.

**Interfaces:** `buildSeedance25DraftRequest(input)` emits `draft: true` with 480p; `buildSeedance25FinalRequest(draftProviderTaskId)` emits a `draft_task` content item with 1080p and no re-specified inherited inputs. `seedance-draft-links.ts` stores `userId`, `draftJobId`, provider task ID, creation/expiry, final job ID and state; it exposes owned lookup and atomic finalization reservation.

- [ ] Write failing tests for provider payloads, seven-day expiry, same-account ownership, pending/failed Drafts, duplicate finalization, separate quotes/charges, and final-only refund behavior.
- [ ] Run the three focused tests; require failures on the new cases.
- [ ] Implement persistence, payload, canonical preflight/charge reuse, polling and lineage; never accept a client-supplied provider task ID as authority.
- [ ] Run focused tests and `pnpm pricing:baseline` plus `pnpm pricing:public-baseline`; require unchanged existing rows and commit only Task 2 files.

### Task 3: Creator controls and 1.5 Draft parity

**Files:**
- Modify: `frontend/components/library/MediaActionPanel.client.tsx` and the route-local workspace/Studio action owner chosen after reading their nested `AGENTS.md` files.
- Modify: `frontend/src/server/video-providers/byteplus-modelark-draft.ts` for 1.5's provider-specific Draft rules.
- Modify: `frontend/src/server/mcp/tools/prepare-generation.ts` and `confirm-generation.ts` only if their existing contracts can represent Draft/final safely; otherwise keep the mode undiscoverable in MCP until a separately tested tool is implemented.
- Test: `tests/seedance-2-5-workspace-contract.test.ts`, `tests/mcp-generation-capabilities.test.ts`, `tests/byteplus-seedance-draft.test.ts`, the relevant Studio contract test.

**Interfaces:** A completed Draft exposes a user-facing `Finaliser en 1080p` action that requests a fresh canonical final quote. The UI receives only an owned MaxVideoAI Draft job ID and server-projected eligibility/expiry, never an editable BytePlus task ID.

- [ ] Add failing UI and API tests for Draft quote display, final-price confirmation, expiry state, loading/errors, and the original Draft remaining accessible after finalization.
- [ ] Run the focused workspace, Studio and MCP tests; require the new cases to fail.
- [ ] Implement the shared action in library/Studio, 1.5 Draft support after its direct route is certified, and accurate MCP discoverability or safe exclusion.
- [ ] Run focused tests and browser smoke for workspace, library and Studio; commit only Task 3 files.

### Task 4: Image and supplier-fact verification

**Files:**
- Inspect/modify only if the canary proves a gap: `frontend/src/server/images/byteplus-seedream-execution.ts`, `frontend/src/server/images/image-output-storage.ts`, and the BytePlus media input adapter.
- Modify: `frontend/server/byteplus-accounting.ts` and matching factual price definitions after confirming the official 1080p rate; do not alter commercial policy.
- Test: `tests/byteplus-storage-copy.test.ts`, `tests/seedream-image-model.test.ts`, `tests/byteplus-poll.test.ts`, `tests/seedance-2-pricing.test.ts`.

**Interfaces:** Preserve an owned provider-original reference/provenance separately from the public media copy if required for same-account Seedream Lite → Seedance trust. Provider rate resolution distinguishes 2.5 480p/720p and 1080p and records list-versus-effective provenance.

- [ ] Add failing tests for the 1080p supplier-rate distinction and for original-image provenance surviving storage; test that Pro 4K is not offered as a provider-supported case.
- [ ] Run focused tests; require the added cases to fail.
- [ ] Correct factual adapters, run a bounded non-production trust canary within an approved budget, and keep Flash unpublished until its own capability/cost review.
- [ ] Run focused tests and canonical price baselines; document any quote delta for separate approval, then commit only Task 4 files.

### Task 5: ByteDance Fal retirement gate

**Files:**
- Modify: `frontend/src/config/fal-engines/seedance-2-byteplus.ts`, the direct route policy/env owners, and `frontend/config/model-registry.json` only if retiring the hidden duplicate requires an authored registry transition.
- Test: `tests/byteplus-provider-architecture.test.ts`, `tests/seedance-2-5-readiness.test.ts`, `tests/model-registry-parity.test.ts`.

**Interfaces:** New ByteDance jobs resolve to BytePlus without a Fal compatibility choice; historical provider IDs continue to select their original poll/read paths. Unrelated Fal models retain their existing behavior.

- [ ] Add failing tests for direct-only new ByteDance routing and old Fal-job readability; verify hidden duplicate URLs follow registry policy.
- [ ] Run the focused tests and `pnpm model:registry:check` before edits to establish the current state.
- [ ] Remove ByteDance-only Fal switches and duplicate publication paths after live direct canaries for all supported modes pass; regenerate registry projections if the authored registry changes.
- [ ] Run `pnpm model:registry:check`, focused tests, lint, TypeScript, `pnpm lint:exposure`, and `git diff --check`; commit only Task 5 files.

**Handoff:** The admin comparison plan and final marketing plan remain separate. Do not publish Draft claims until this plan's provider and creator release gates pass.
