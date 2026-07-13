# MaxVideoAI MCP Seedance Mini Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an eligible verified user one wallet-independent Dreamina Seedance 2.0 Mini text-to-video trial, with a server-forced preset, atomic reservation, failure restoration, abuse controls, and acquisition measurement.

**Architecture:** A dedicated entitlement table owns the `available → reserved → consumed` or `released` state machine. Quote preparation decides whether the exact canonical request qualifies. Confirmation locks both quote and entitlement, creates an included trial job without touching wallet balance, and submits through the paid plan's shared video execution boundary. Provider outcomes finalize or restore the entitlement idempotently.

**Tech Stack:** TypeScript, Neon/Postgres transactions, existing account restriction and video generation services, MCP facade/tools, HMAC-based privacy-preserving risk signals, Node test runner.

## Global Constraints

- Complete the foundation and paid-generation facade plans first.
- The trial remains independently disabled behind `FEATURES.mcp.trial` and a server-side environment kill switch.
- The server forces engine `seedance-2-0-mini`, mode `t2v`, duration `5`, resolution `480p`, one output, and ratio in `16:9 | 9:16 | 1:1`.
- Audio may be true or false because the current trial price is unchanged; the server must re-check that assumption against the live catalog before eligibility.
- Trial execution never credits, debits, reserves, or refunds wallet money.
- One Auth user owns at most one entitlement row. A released reservation may be retried; a consumed entitlement never may.
- No raw IP, email, prompt, access token, user agent, or reference URL is stored in trial analytics or risk tables.
- Do not silently fall back to wallet funding. If trial qualification changes, return a fresh paid quote option and require a new confirmation.

---

## Task 1: Encode the immutable trial preset

**Files:**

- Create: `frontend/src/server/agent-api/trial-preset.ts`
- Create: `tests/mcp-trial-preset.test.ts`

- [ ] Write failing tests for the exact engine ID, mode, duration, resolution, allowed ratios, audio on/off, one output, absence of references, and rejection of extra settings.

- [ ] Implement one source of truth:

```ts
export const MCP_TRIAL_PRESET = {
  engineId: 'seedance-2-0-mini',
  surface: 'video',
  mode: 't2v',
  durationSec: 5,
  resolution: '480p',
  aspectRatios: ['16:9', '9:16', '1:1'],
  outputCount: 1,
} as const;
```

- [ ] Implement `normalizeTrialCandidate()` so only prompt, allowed ratio, and boolean audio remain variable. Reject image/source/reference inputs, negative output counts, provider settings, and paid-only add-ons.

- [ ] Add `assertTrialPresetSupported(engine)` that fails closed if the public engine catalog no longer supports any forced field or if audio changes the quoted total.

- [ ] Run and commit:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test tests/mcp-trial-preset.test.ts
git add frontend/src/server/agent-api/trial-preset.ts tests/mcp-trial-preset.test.ts
git commit -m "feat: define MCP Seedance Mini trial preset"
```

## Task 2: Add entitlement and risk persistence

**Files:**

- Create: `neon/migrations/31_mcp_trial_entitlements.sql`
- Modify: `frontend/src/lib/schema/mcp-schema.ts`
- Create: `frontend/src/server/agent-api/trial-entitlement-repository.ts`
- Create: `frontend/src/server/agent-api/trial-risk-repository.ts`
- Create: `tests/mcp-trial-migration.test.ts`
- Create: `tests/mcp-trial-entitlement-repository.test.ts`

- [ ] Write migration contracts for:

```text
mcp_trial_entitlements
  user_id TEXT PRIMARY KEY
  status TEXT CHECK ('available','reserved','consumed','released')
  reserved_quote_id UUID UNIQUE
  job_id TEXT UNIQUE
  reserved_at, consumed_at, released_at, created_at, updated_at
  last_reason_code TEXT

mcp_trial_risk_events
  id BIGSERIAL PRIMARY KEY
  user_id TEXT
  oauth_client_id TEXT
  risk_fingerprint_hash TEXT
  outcome TEXT
  reason_code TEXT
  created_at
```

- [ ] Add a foreign key from `reserved_quote_id` to `mcp_generation_quotes` where migration ordering permits. Add status/time indexes and a cleanup index for risk retention.

- [ ] Implement executor-aware repository functions: `ensureEntitlement`, `getTrialStatus`, `lockReservableEntitlement`, `reserveEntitlement`, `consumeEntitlement`, and `releaseEntitlement`.

- [ ] Make all transitions compare current state and expected quote/job IDs. Repeated consume/release callbacks must be idempotent; a late failure cannot release an already consumed trial.

- [ ] Test unique-user behavior and concurrent reservation against a disposable Neon branch. Apply the migration only after `npm run neon:branches:check`; commit.

## Task 3: Implement verified-email and account eligibility

**Files:**

- Create: `frontend/src/server/agent-api/trial-eligibility.ts`
- Modify: `frontend/src/server/agent-api/account-status.ts`
- Create: `tests/mcp-trial-eligibility.test.ts`

- [ ] Write failing tests for verified password accounts, confirmed Google accounts, unverified accounts, consumed/released/reserved entitlements, restricted accounts, disabled feature, and unsupported live preset.

- [ ] Return a non-sensitive state:

```ts
type TrialStatus =
  | { status: 'disabled' }
  | { status: 'verification_required' }
  | { status: 'available'; preset: TrialPresetSummary }
  | { status: 'reserved'; jobId: string | null }
  | { status: 'consumed'; jobId: string | null }
  | { status: 'temporarily_unavailable'; reason: string };
```

- [ ] Re-run `getActiveAccountRestriction(userId)` during eligibility and again during confirmation. Do not reveal restriction internals.

- [ ] Require `principal.emailVerified === true`; provide a MaxVideoAI verification URL in `nextAction` for unverified email.

- [ ] Update `get_account_status` to report the real trial state only when the trial flag is enabled. Commit after foundation account tests still pass.

## Task 4: Add privacy-preserving risk and rate controls

**Files:**

- Create: `frontend/src/server/agent-api/trial-risk.ts`
- Modify: `frontend/src/lib/env.ts`
- Create: `tests/mcp-trial-risk.test.ts`

- [ ] Write failing tests for secret absence, stable HMAC output, raw-data exclusion, per-user limits, per-client limits, coarse fingerprint velocity, global daily cost cap, and safe reason codes.

- [ ] Derive the risk fingerprint in memory from a coarse IP prefix and normalized user-agent family using `HMAC-SHA256(MCP_TRIAL_RISK_SECRET, value)`. Persist only the HMAC, rotate the secret through deployment configuration, and retain risk events for no more than the documented fraud-prevention period.

- [ ] Reuse existing account restriction and rate-limit infrastructure where compatible. Keep thresholds server-side; do not return exact fraud thresholds or fingerprint hashes.

- [ ] Add hard controls for per-user, per-OAuth-client, per-fingerprint, and global accepted-trial volume. Return `TRIAL_NOT_ELIGIBLE` or `RATE_LIMITED` with a coarse next action.

- [ ] Ensure prompts, URLs, tokens, and emails cannot be passed to the risk logger's allowlisted DTO. Commit.

## Task 5: Make quote preparation select trial funding safely

**Files:**

- Modify: `frontend/src/server/agent-api/prepare-generation.ts`
- Modify: `frontend/src/server/agent-api/generation-types.ts`
- Modify: `frontend/src/server/agent-api/quote-repository.ts`
- Create: `tests/mcp-trial-quote.test.ts`

- [ ] Extend internal funding mode to `'wallet' | 'trial'`; update the database constraint through a small additive statement in `31_mcp_trial_entitlements.sql` before applying it.

- [ ] Write failing tests proving a qualifying request gets `fundingMode: 'trial'`, `price.amountCents: 0` for the user-facing charge, and a separate internal provider-cost snapshot; no wallet balance projection is reduced.

- [ ] Require the canonical request to match `MCP_TRIAL_PRESET` exactly and pass eligibility/risk checks. Store the original normal provider pricing snapshot for cost accounting, but label it `included_trial` and never turn it into wallet credit.

- [ ] If the user explicitly asks for another model/setting, or has consumed the trial, produce a normal wallet quote. If an already-prepared trial quote becomes ineligible, confirmation fails and recommends preparing a new paid quote.

- [ ] Audit `trial_quote_prepared` with engine, ratio, audio boolean, client ID, and outcome only. Commit.

## Task 6: Reserve entitlement and create the included job atomically

**Files:**

- Modify: `frontend/src/server/agent-api/confirm-generation.ts`
- Modify: `frontend/src/server/agent-api/paid-generation-execution.ts`
- Modify: `frontend/app/api/generate/_lib/initial-video-job.ts`
- Create: `tests/mcp-trial-confirmation.test.ts`
- Create: `tests/mcp-trial-confirmation-concurrency.test.ts`

- [ ] Write failing concurrency tests where two confirmations target one trial quote and where two different trial quotes target the same user. Exactly one trial reservation and one job may result.

- [ ] Extend the internal initial-job funding contract:

```ts
type GenerationFunding =
  | { kind: 'wallet'; reservation: 'reserve' | 'already_reserved' }
  | { kind: 'mcp_trial'; entitlementUserId: string; quoteId: string };
```

- [ ] For trial funding, set `payment_status = 'included_mcp_trial'`, preserve internal cost data, create no wallet transaction and no paid receipt, and reject any external request body attempting this funding kind.

- [ ] In one transaction: lock quote, revalidate trial/preset/risk/account, lock entitlement, reserve it with quote/job IDs, create initial job, mark quote claimed, commit. Submit the provider afterward.

- [ ] A repeat confirmation returns the same job. A concurrent confirmation of another quote returns `TRIAL_NOT_ELIGIBLE` without wallet fallback or a second job.

- [ ] Run paid and trial confirmation suites together; commit.

## Task 7: Finalize, consume, or release the entitlement from job outcomes

**Files:**

- Create: `frontend/src/server/agent-api/trial-outcomes.ts`
- Modify: shared video acceptance/failure persistence modules identified in the paid plan
- Modify: webhook/poll completion modules only through the new outcome function
- Create: `tests/mcp-trial-outcomes.test.ts`

- [ ] Write failing tests for provider accepted, synchronous completed, pre-acceptance rejection, terminal failed, timeout/unknown, canceled, duplicate callback, late success after release, and late failure after consume.

- [ ] Define explicit transitions:

  - provider acceptance keeps entitlement `reserved`;
  - completed output changes `reserved → consumed`;
  - definitive pre-output failure changes `reserved → released`;
  - ambiguous/unknown status remains `reserved` for reconciliation;
  - manual support override records an audit reason.

- [ ] Call one `applyTrialJobOutcome(jobId, normalizedOutcome)` from all relevant provider/webhook/poll paths. Do not duplicate provider-specific state logic in the entitlement repository.

- [ ] Update status results to show `included_trial`, `reserved`, `consumed`, or `released`, without exposing anti-abuse reasons.

- [ ] Run provider failure/refund tests to prove wallet refunds are untouched. Commit.

## Task 8: Add stale-reservation reconciliation and operations controls

**Files:**

- Create: `frontend/app/api/cron/mcp-trial-reconcile/route.ts`
- Create: `frontend/src/server/agent-api/reconcile-trial-entitlements.ts`
- Modify: `vercel.json`
- Create: `frontend/app/(core)/admin/mcp/_components/McpTrialControls.tsx`
- Create: `tests/mcp-trial-reconciliation.test.ts`
- Create: `docs/operations/mcp-trial-runbook.md`

- [ ] Write tests for stale reservation inspection, completed job consumption, definitive failed job release, active job retention, missing job quarantine, and authenticated cron access.

- [ ] Reuse `authorizeCronRequest`; process a bounded batch and record only counts plus coarse reason codes.

- [ ] Add admin controls for flag state, accepted/completed/released counts, provider cost, suspicious velocity, and manual user-level inspection. Manual release requires an admin audit entry and cannot override a consumed entitlement.

- [ ] Document kill switch, incident checks, reconciliation, support responses, privacy retention, and safe manual correction. Commit.

## Task 9: Verify the full acquisition trial

**Files:**

- Create: `tests/integration/mcp-seedance-mini-trial.test.ts`
- Modify: `docs/operations/mcp-host-compatibility-matrix.md`

- [ ] Verify Google signup and email signup through OAuth, account verification, trial quote, visible exact preset, explicit confirmation, accepted job, polling, completed video, and unchanged wallet before/after.

- [ ] Verify audio on/off, all three ratios, one-user concurrency, provider rejection/release/retry, global kill switch, and consumed-trial paid fallback.

- [ ] Compare the internal cost snapshot with the live Seedance Mini pricing and alert if the trial's expected cost exceeds the configured safety ceiling.

- [ ] Run the release gate:

```bash
./frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json --test \
  tests/mcp-trial-*.test.ts \
  tests/mcp-confirm-generation*.test.ts \
  tests/generate-final-receipts.test.ts \
  tests/wallet-*.test.ts
pnpm --prefix frontend exec tsc --noEmit --pretty false
npm --prefix frontend run lint
npm run lint:exposure
git diff --check
npm --prefix frontend run build
```

- [ ] Enable the trial for controlled accounts, inspect provider cost and abuse metrics, then separately enable broad acquisition only after the operations gate is green.

## Completion Criteria

- One verified eligible user can complete one fixed Seedance Mini trial without any wallet mutation.
- The preset cannot be widened by tool input, stale quote, concurrency, or direct internal-field injection.
- Failures release the entitlement only when safe; successful output consumes it permanently.
- Risk controls, global cost cap, kill switch, reconciliation, audit redaction, and support controls are operational.
- Trial state is visible to the agent and user without disclosing fraud signals.
