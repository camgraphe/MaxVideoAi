# Functional audit fixes implementation plan

**Goal:** Correct the five reproduced audit defects without changing generation prices, provider submissions or public routes.

**Architecture:** Keep account isolation in Character Builder's persistence/runtime owners; make stale audio expiration transactional; guard image hydration against stale requests; retain one focus resync owner; advance polling fairness even when provider retrieval fails. Preserve existing server authorization, provider claim locks and architecture boundaries.

**Baseline:** `20f485f307c4063fb1e0ba9570ec0d8a95343398` (`origin/main`). Isolated branch `codex/functional-audit-fixes`.

**Spec:** User-approved five findings in the 17 October functional audit. Original report and deterministic probes remain in the Desktop checkout under `output/audits/2026-10-17-functional-audit/`.

## Constraints and review focus

- No production data, paid provider requests, merge or deployment in this implementation.
- Read closest AGENTS and existing contracts; do not replace data libraries or alter prices.
- Add failing behavioral tests first; use disposable PostgreSQL 17 for ledger transitions.
- Account A → B while mounted and delayed old-account responses must not restore private data.
- Audio completion/update before expiration, concurrent expiration and transaction failures must preserve state and ledger consistency.
- Out-of-order image responses, unmount and intervening edits must not overwrite current input.
- Hidden/auth routes and focus/visibility/pageshow bursts must preserve refresh behavior without duplicate fetches.
- A full failing provider batch must not starve a newer job; retain claims, timeout policy and individual job reads.

## Tasks

### 1. Character Builder account isolation (first priority)

Owners: `frontend/src/components/tools/character-builder/_hooks/useCharacterBuilderPersistence.ts`, its helper/type modules and related asynchronous hooks only where required for identity fencing.

- [x] Add failing DOM tests for ownerless legacy state, A → B, unresolved auth, same-account reload and delayed previous-account results.
- [x] Scope storage by confirmed account, stop persistence during unresolved/changed identity, reset private/transient state and fence late work. Never adopt ownerless private legacy state into a new account.
- [x] Run the new behavioral tests and existing Character Builder contracts; document persistence ownership.

### 2. Atomic stale audio expiration (first priority)

Owners: `frontend/app/api/jobs/_lib/jobs-stale-audio.ts`, canonical audio job/ledger owner if reusable, `frontend/app/api/jobs/route.ts` only for return contract.

- [x] Add failing PostgreSQL tests exercising stale snapshot → completed/updated row, simultaneous expiration, successful expiration and rollback.
- [x] Lock and revalidate actual ownership/status/age before atomically updating job and refund receipt. Return whether an expiration actually occurred.
- [x] Run audio reconciliation/integration and read-route architecture tests; update audio lifecycle documentation.

### 3. Image selection request ordering

Owners: `frontend/app/(core)/(workspace)/app/image/_hooks/useImageGallerySelection.ts` and immediate wiring for user-edit/account invalidation.

- [x] Add failing tests for A → B with response A last, unmount and manual edit while awaiting a snapshot.
- [x] Guard the latest request and selected identity; cancel superseded work while preserving selection defaults on a failed or missing snapshot.
- [x] Run image hydration and image workspace contracts.

### 4. Fair provider polling

Owners: `frontend/server/{luma-agents,kling-direct,alibaba-model-studio,google-vertex-veo}-poll.ts`; reuse an existing scheduling primitive where safe.

- [x] Add failing behavior tests with eleven jobs and repeated retrieve failures on the oldest ten.
- [x] Advance scheduling after failed retrieval while preserving conditional active-state transitions, provider locks and bounded timeout/manual-review policy.
- [x] Run all affected provider polling tests and shared claim PostgreSQL tests; document the scheduling distinction.

### 5. Single focus revalidation owner

Owners: `frontend/components/auth/SessionWatchdog.tsx`, `frontend/components/swr/SWRFocusResync.tsx`, `frontend/components/swr/SWRProvider.tsx`, `frontend/app/_components/AppRuntime.tsx` as needed.

- [x] Add a real SWR/React test proving one fetch for a focus event and preserving wallet invalidation and key exclusions.
- [x] Consolidate revalidation policy in one owner and prevent competition with native SWR focus behavior. Preserve auth-route/visibility gates.
- [x] Run focus/session, layout and read-path contracts.

## Integration and completion

- [x] Review all five fixes together independently; resolve actionable findings.
- [x] Run focused suites, TypeScript, lint, exposure and diff checks.
- [x] Run `pnpm test:validate` (required for persistence/polling changes) and the applicable browser smoke checks; record failures honestly and separate pre-existing environment failures.
- [x] Build if feasible without production credentials and smoke affected UI locally.
- [x] Commit verified changes on the isolated branch, preserve source checkout/audit artifacts, report exact checks and any limits. Do not merge or deploy without authorization.

The application changes are committed as `c746163ca`. Detailed verification results,
retry explanations and the remaining admin-fixture coverage limitation are recorded in
[`docs/audits/functional-fixes-2026-10-17.md`](../../audits/functional-fixes-2026-10-17.md).
The financial suite completed successfully with that commit frozen (2 tests,
26,818 canonical checkpoints). The final follow-up commit contains only the
Storyboard contract expectation and verification documentation. No application
code changed after the passing browser, financial and build checks.

The admin follow-up corrects the existing gallery-workbench test to open the
Families accordion before selecting an entry, preserving all assertions. The
complete admin browser suite now passes with 26 tests and one existing service-role
skip; 23 related gallery tests, frontend lint, exposure and diff checks also pass.
This follow-up changes only the test and verification documentation.
