# Family-by-Family Supplier Facts and Manual Customer Tariff Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ByteDance's padded supplier facts plus automatic 30% rule with verified BytePlus costs and an explicit, independently editable MaxVideoAI customer tariff. Establish the same workflow for later model families without changing current customer totals during the first cutover.

**Architecture:** Supplier tariffs and observed bills are a factual server-owned domain. Customer tariffs are a separate versioned and DB-overridable commercial domain. The canonical `@maxvideoai/pricing` package owns the quote for both legacy margin rules and new manual tariff rules. The ByteDance family switches atomically only when every active scenario has a tariff cell; no active ByteDance quote may fall through to the global 30% rule after activation. Admin edits use the existing preview/confirm/event/rollback protocol.

**Tech Stack:** TypeScript, Next.js, PostgreSQL/Neon, `@maxvideoai/pricing`, Node/tsx tests, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md`
**Evidence:** `docs/engineering/bytedance-pricing-path-audit-2026-09-28.md`

## Global constraints

- Before editing, read root and nested `AGENTS.md`, `docs/engineering/pricing-engine.md`, `admin-routes.md`, `model-registry.md`, and relevant architecture tests; check the branch/worktree and preserve all unrelated changes.
- Do not replace a retail pricing basis with a supplier fact in isolation. That would accidentally lower or raise live customer prices. Establish a frozen, read-only production quote baseline first, then make the complete no-change migration and review intentional price deltas separately.
- In the admin table, the right-hand baseline is the effective customer quote charged today, not a recalculation from the corrected supplier cost or merely the versioned policy. Match each existing customer amount to the cent at cutover. Only Adrien's later, explicit per-price decisions may raise or lower those amounts.
- Preserve historical receipts, quotes, refunds and job pricing snapshots. Do not rewrite stored “vendor” numbers as though they were actual supplier bills; label historical estimates by provenance.
- Keep actual list cost, confirmed effective contract cost, observed invoice cost, proposed customer tariff, and current customer quote as separate values and source statuses. Contract `To be confirmed` and temporary public promotions are not automatically effective account rates.
- Model family is a catalog grouping. Execution provider is an independent dimension: ByteDance routes may temporarily execute on BytePlus or Fal. Supplier cost is chosen by actual route; the customer tariff is chosen by the sellable model/scenario.
- Draft and final are two separate paid scenarios. For 1.5, include the dated 2026-11-11 provider shutdown guard.
- No new pricing formula belongs in the browser, public page, admin component, billing adapter, Studio or MCP. All live consumers use canonical quotes and the same customer-tariff resolution.

## Tariff cell contract to prove before schema choice

Build a coverage matrix of all **sellable** ByteDance scenarios from the model registry and provider capabilities. A row identifies model ID, mode, output resolution, aspect ratio or provider token dimensions, duration/input-video duration, audio option, Draft/final step, and for images output size/pixel tier, image count and paid reference count. Distinguish dimensions that change the cost or retail amount from display-only dimensions. For each product choose a transparent explicit retail unit: e.g. USD per billable token block for Seedance 2.x, a separately authored rate for 1.5 audio/silent and Draft, and per successful image/pixel tier plus explicit input-image adders for Seedream. A fixed scenario amount may be an explicit exception. These are customer rates, **not** formulas based on supplier cost. Store currency, effective period, author, source/version, rounding and exact selector coverage. The preview must show representative exact totals and all affected permutations; it must not pretend one sample covers every duration or ratio.

Do not implement a single fixed amount keyed only by `engineId/mode/resolution`: existing 1.5 and Seedream options and 2.5 video-input/Draft pricing need finer coverage. Conversely, avoid hand-entering a total for every duration/ratio when an explicit, reviewed retail unit and deterministic canonical scale covers them. Exact selector precedence and overlap validation must make ambiguous cells impossible.

## Review focus

- ByteDance quote after activation resolves `manual_tariff`, never `default +30%`, including public, preflight, billing, Studio, MCP, price chip, model page and JSON-LD (Task 3).
- Every previously sellable scenario either retains its exact current customer quote or appears in a separately approved delta list; missing or ambiguous tariff cells block quote and charge (Tasks 1 and 3).
- Admin supplier cost for Seedance 2.x comes from the verified BytePlus rate table, not the historical `2.5/1.3` normalized public rate (Tasks 2 and 4).
- Provider 1080p/input-video rate, temporary discount expiry, Seedream Pro pixel tier and reference-image charges all have explicit provenance and tests (Task 2).
- Preview staleness and concurrent edits are rejected, and a tariff change can be rolled back without changing supplier facts (Task 4).

---

### Task 1: Capture the real quote and dependency baseline

**Files:** Create a dated fixture/report under `tests/fixtures/` and a read-only collector under `frontend/scripts/` only if existing `pricing:baseline`, `pricing:public-baseline` and `pricing:audit` do not cover the required ByteDance scenarios. Inspect `tests/seedance-2-pricing.test.ts`, `tests/pricing-architecture.test.ts`, `tests/admin-pricing-preview.test.ts`, `tests/pricing-public-projection.test.ts`.

- [ ] Read effective production DB overrides and quote provenance through authorized read-only admin/API access; record unavailable access explicitly rather than assuming the versioned 30% rule is effective in production.
- [ ] Inventory actual ByteDance scenarios and usage by mode, audio, video input, resolution, ratio, duration, image size/reference count, Draft and final, including the current live provider for each.
- [ ] Freeze current customer totals and canonical breakdowns for every representative and edge scenario across billing/public/MCP/Studio. Record historical receipts separately.
- [ ] Run existing read-only baselines before any code change and save their outputs; no fixture rewrite merely to hide a future delta.

### Task 2: Rebuild factual BytePlus cost adapters

**Files:** Split or revise `frontend/server/byteplus-accounting.ts`, `frontend/src/lib/seedance-2-pricing.ts`, `frontend/src/lib/pricing-billing-facts.ts`, `frontend/src/lib/pricing-public-facts.ts`, the Seedream factual adapter and a dated server-side tariff source. Test in `tests/seedance-2-pricing.test.ts`, `tests/byteplus-poll.test.ts`, `tests/seedream-image-model.test.ts` and a new supplier-tariff contract test.

- [ ] Add failing tests from the official BytePlus tariff and this account's verified contract for 2.0/2.5 rate-by-resolution/input type, 1.5 audio/silent and Draft, Seedream Lite/Pro output and input-image prices, and effective-date boundaries.
- [ ] Name the old padded value `legacyRetailBasis` during migration. Remove `vendorCostUsd` / `provider_cost_usd_estimated` labels from any value derived from the padded 2.5/1.3 rate; true provider cost comes from the tariff and provider usage.
- [ ] Correct 2.5 1080p factual rates and list/effective/observed status in the poller without touching customer-price math. Unknown contract cost stays unknown. Compare billed tokens/invoice lines to estimates.
- [ ] Keep the current retail quote unchanged while the factual source is separated. Run supplier tests and the customer baselines; investigate every changed total before continuing.

### Task 3: Canonical manual customer tariff and atomic ByteDance cutover

**Files:** Extend `packages/pricing/src/canonical.ts` and its policy types/resolver; add a versioned ByteDance customer tariff source and a migration under `neon/migrations/` after checking the latest migration number. Update `frontend/server/pricing/quote-billing.ts`, `quote-public.ts`, `frontend/src/lib/pricing-public-quote.ts`, relevant image/Studio/MCP callers, and scenario collectors as needed. Test `tests/pricing-canonical-kernel.test.ts`, `tests/pricing-public-projection.test.ts`, `tests/preflight-media-pricing.test.ts`, `tests/mcp-confirm-generation.test.ts`, image contracts, and a new tariff-coverage test.

- [ ] Write failing tests that manual tariff quotes use the authored customer rate while retaining **true** provider subtotal; assert gross difference independently of any old `marginPercent` field. Reject ambiguous, expired, missing or unsupported tariff cells before payment.
- [ ] Implement one canonical `manual_tariff` mode with explicit rate/unit/rounding or fixed exception; maintain the existing margin-policy mode for families not yet migrated. Versioned tariff and DB override precedence, activation flag and exact selector semantics must be documented and validated.
- [ ] Seed complete ByteDance retail cells from the frozen customer baseline, verify cents-level parity for every unchanged scenario, and expose intended deviations as an approval list. Do not infer tariff cells from current supplier cost or use a `2.5/1.3` constant to populate future prices.
- [ ] Activate ByteDance only after completeness checks pass. Once active, global 30% is not a fallback for any sellable ByteDance scenario. If an optional feature lacks a tariff, keep that feature unavailable rather than charge an improvised amount.
- [ ] Run canonical architecture, billing/public baselines, image, workspace, Studio and MCP quote tests. Review settlement/platform-share invariants for manual totals and establish a separate explicit policy for any below-cost offer before enabling one.

### Task 4: Admin editor for manual customer cells and supplier comparison

**Files:** Follow `docs/superpowers/plans/2026-09-28-admin-provider-cost-vs-customer-price.md`; extend `frontend/server/pricing-admin/` read, preview, confirm and event owners and the existing `/admin/pricing` cockpit. Test `tests/admin-pricing-architecture.test.ts`, `tests/admin-pricing-preview.test.ts`, `tests/admin-pricing-policy-service.test.ts`, `tests/e2e/admin-smoke.spec.ts`.

- [ ] Show provider list/effective/observed cost and source/date on the left, manual customer tariff and exact quoted total on the right. Show gross difference as a comparison, not a misleading 30% margin label.
- [ ] Let admins edit the customer unit or fixed exception for a specific selector; the server previews all affected quote cells, public/billing surfaces, gross difference and any missing coverage.
- [ ] Reuse authorization, fingerprint, explicit confirmation, transaction, immutable event and rollback. Never let a customer-tariff edit mutate provider rates or a source-status record.
- [ ] Reconcile why the deployed `/admin/pricing` currently redirects to `/admin/settings`, then smoke-test the actual deployed admin path on desktop and mobile.

### Task 5: Remove superseded ByteDance-only compatibility, then repeat by family

**Files:** Only proven-unused ByteDance-specific constants/paths in `launch-config.ts`, Fal route selection and pricing adapters; architecture tests and `docs/engineering/pricing-engine.md`.

- [ ] Remove the padded `2.5/1.3` Seedance rate and the ByteDance application of the global 30% rule only after Task 3 parity and Task 4 admin provenance pass. Preserve global 30% for families still using it.
- [ ] Trace every Seedream `pricingDetails`/`pricing`/`pricingHint` consumer and every `falModelId`/hidden Fast alias before deleting a field or route. Keep historical reads and registry tombstones.
- [ ] For each next family, repeat factual tariff evidence, scenario coverage, no-change baseline, explicit retail grid, preview and approved cutover. Do not turn the ByteDance-specific rate shapes into an inaccurate universal provider formula.
- [ ] Run focused architecture tests, `pnpm model:registry:check` if registry policy changes, pricing baselines/audit, lint, TypeScript, `pnpm lint:exposure` and `git diff --check`; update the pricing guide with the final owner map.

**Human commercial gate:** The first technical cutover must preserve current customer amounts. Any new customer tariff, discount, loss leader or published price change is a separately reviewable proposal with exact before/after amounts; no prices are applied from this plan alone.
