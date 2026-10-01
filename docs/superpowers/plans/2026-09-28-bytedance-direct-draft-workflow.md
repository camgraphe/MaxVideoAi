# ByteDance Direct and Draft Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete direct BytePlus execution for the supported current ByteDance models and add a priced, durable Seedance 2.5 Draft → final workflow without changing customer prices or historical jobs.

**Architecture:** Keep each public model identity in the authored model registry. Add BytePlus provider profiles and Draft task handling beside the existing direct adapters; persist Draft/final lineage server-side and reuse canonical preflight, quote, charge, poll and refund paths. Promote supported routes only after canaries, then remove ByteDance-specific new-job Fal compatibility choices while preserving historical readers.

**Tech Stack:** TypeScript, Next.js App Router, React, PostgreSQL/Neon, `@maxvideoai/pricing`, Node tests with `tsx`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md`

**2026-09-29 decision update:** The requested 1.5 direct bridge was implemented behind a disabled gate, but the account canary still returned `InvalidEndpointOrModel.NotFound` after console activation. The user has prioritized planning its withdrawal. Task 1 below is now an audit/closure gate, not authorization to launch 1.5 direct execution. Task 3 covers 2.5 Draft only. The separate marketing plan owns Mini/Fast positioning and the archive-versus-redirect review. Do not contact BytePlus support without the user's permission.

## Global Constraints

- Continue on the current `codex/bytedance-pricing-grid` worktree, preserve all user work, and stage only this plan's files.
- Keep customer prices, existing credits and historical receipts unchanged. Draft and final are two distinct quotes, jobs and charges.
- Keep the existing public Seedance identities and URLs; Draft is not an extra model in `model-registry.json`.
- BytePlus announces Seedance 1.5 shutdown on 2026-11-11. Keep new direct 1.5 requests disabled, verify the dated shutdown guard, and preserve historical 1.5 reads. Reconsider the bridge only after a separate product decision and a successful account canary.
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

### Task 1: Audit and close the disabled Seedance 1.5 bridge

**Files:**
- Inspect the existing 1.5 disabled gate, shutdown guard and provider-recorded historical reads in `frontend/src/server/video-providers/byteplus-modelark-profiles.ts`, `frontend/src/config/fal-engines/seedance-1-5.ts`, and the submission/poll owners.
- Test: `tests/byteplus-seedance-profiles.test.ts`, `tests/generate-byteplus-submission.test.ts`, `tests/byteplus-provider-architecture.test.ts`, plus the affected historical job/refund contracts.

**Interfaces:** New 1.5 execution stays unavailable; existing jobs resolve their recorded provider and keep status, playback, receipts and refunds. A disabled provider profile is not a published or billable capability.

- [ ] Verify and record that the disabled gate rejects every new 1.5 direct request before charge; record the 404 canary as failed evidence, without reopening provider activation work.
- [ ] Verify the 2026-11-11 shutdown guard and historical Fal/BytePlus job status, playback, receipt and refund paths. Add focused regression tests only for uncovered risk.
- [ ] Remove unused new-job 1.5 bridge code only after historical path ownership is proven; do not delete a profile or provider mapping needed by old jobs.
- [ ] Run the focused provider and historical-reader tests, lint and `git diff --check`; commit only any needed closure changes.

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

### Task 3: Seedance 2.5 creator controls

**Files:**
- Modify: `frontend/components/library/MediaActionPanel.client.tsx` and the route-local workspace/Studio action owner chosen after reading their nested `AGENTS.md` files.
- Modify: `frontend/src/server/mcp/tools/prepare-generation.ts` and `confirm-generation.ts` only if their existing contracts can represent Draft/final safely; otherwise keep the mode undiscoverable in MCP until a separately tested tool is implemented.
- Test: `tests/seedance-2-5-workspace-contract.test.ts`, `tests/mcp-generation-capabilities.test.ts`, `tests/byteplus-seedance-draft.test.ts`, the relevant Studio contract test.

**Interfaces:** A completed Draft exposes a user-facing `Finaliser en 1080p` action that requests a fresh canonical final quote. The UI receives only an owned MaxVideoAI Draft job ID and server-projected eligibility/expiry, never an editable BytePlus task ID.

- [ ] Add failing UI and API tests for Draft quote display, final-price confirmation, expiry state, loading/errors, and the original Draft remaining accessible after finalization.
- [ ] Run the focused workspace, Studio and MCP tests; require the new cases to fail.
- [ ] Implement the shared 2.5 action in library/Studio and accurate MCP discoverability or safe exclusion. Keep 1.5 Draft unavailable.
- [ ] Run focused tests and browser smoke for workspace, library and Studio; commit only Task 3 files.

### Task 4: Image and supplier-fact verification

**2026-10-01 checkpoint:** The explicitly approved minimum-cost provider pair
(4s, square, silent T2V) completed both Draft and final for $2.7133325 at LIST.
It exposed and corrected the 2.5 supplier raster estimate in accounting, manual
supplier facts and admin comparisons, preserving customer cents. All 205 focused
BytePlus/Seedance tests and both existing price baselines pass. This closes only
the provider happy path and its dimension correction; Seedream face trust,
app-owned storage, cancellation/failure/refund and authenticated creator browser
gates remain open. See the [dated evidence](../../engineering/2026-10-01-seedance-draft-lifecycle.md#minimum-cost-provider-canary).

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

**Interfaces:** New jobs for supported, published ByteDance models resolve to BytePlus without a Fal compatibility choice; 1.5 is closed through its separate lifecycle gate. Historical provider IDs continue to select their original poll/read paths. Unrelated Fal models retain their existing behavior.

- [ ] Add failing tests for direct-only new ByteDance routing and old Fal-job readability; verify hidden duplicate URLs follow registry policy.
- [ ] Run the focused tests and `pnpm model:registry:check` before edits to establish the current state.
- [ ] Remove ByteDance-only new-job Fal switches and duplicate publication paths after live direct canaries for all remaining supported modes pass; do not wait for a 1.5 canary or remove historical readers. Regenerate registry projections if the authored registry changes.
- [ ] Run `pnpm model:registry:check`, focused tests, lint, TypeScript, `pnpm lint:exposure`, and `git diff --check`; commit only Task 5 files.

**Handoff:** The admin comparison plan and final marketing plan remain separate. Do not publish Draft claims until this plan's provider and creator release gates pass.
