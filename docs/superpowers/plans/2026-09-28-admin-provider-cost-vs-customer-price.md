# Admin Provider Cost vs Customer Price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/pricing` a clear, provider-grouped comparison of factual supplier costs and editable, explicit MaxVideoAI customer tariff cells, starting with ByteDance/BytePlus and expanding to other providers family by family.

**Architecture:** Extend the existing pricing cockpit's server inventory and route-local table/inspector. Project costs from verified supplier adapters, never from the historical padded Seedance quote basis; project customer totals from the canonical manual tariff engine defined in `2026-09-28-family-manual-pricing-grid.md`. Display distinct source/status and reuse the current `preview → confirm → history/rollback` mutation service. Keep supplier tariff maintenance separate from commercial policy.

**Tech Stack:** TypeScript, Next.js App Router, React, SWR, PostgreSQL/Neon, `@maxvideoai/pricing`, Node tests with `tsx`, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-28-bytedance-direct-pricing-and-marketing-design.md`
**Dependency:** `docs/superpowers/plans/2026-09-28-family-manual-pricing-grid.md` Tasks 1–3. The comparison can be built read-only earlier, but the editor must use canonical manual tariff cells when ByteDance activates.

## Global Constraints

- Preserve the currently configured prices and existing DB overrides; this plan changes comparison and editing clarity, not values.
- Display the effective customer amount quoted today beside the verified provider cost. Reconstruct it unchanged to the cent when moving ByteDance to the manual grid; do not apply a newly verified provider rate to recalculate customer prices. Any increase or decrease requires Adrien's separate decision.
- `quoteCanonicalPricing()` remains the only customer-total formula. Never make a browser-side price calculator or a direct-save price route.
- Do not apply the global 30% rule to ByteDance after manual-tariff activation. Other families retain their existing rules until their own cutover.
- The existing admin `vendorSubtotalCents` for Seedance 2.x can contain the `2.5/1.3` padded commercial basis; never label or reuse it as actual supplier cost. A new verified cost source is mandatory for that column.
- Supplier list price, effective contracted price, observed actual cost and customer quote are distinct fields with provenance; missing cost is `unknown`, not zero.
- Existing admin authorization, server preview/fingerprint, explicit confirmation, transaction, immutable history and rollback remain required for edits.
- Begin by reconciling the repository's `/admin/pricing` route with the production redirect to `/admin/settings` observed on 2026-09-28; do not assume this route is live.
- Read `docs/engineering/pricing-engine.md`, `admin-routes.md`, and `tests/admin-pricing-architecture.test.ts` before implementation.

## Review Focus

- Unconfirmed BytePlus discount: displayed as pending, never as effective cost (Task 1 test).
- Missing provider bill or rate: visible unknown state and no fabricated margin (Task 1 test).
- One selector affects several modes/surfaces: preview lists every affected quote before confirmation (Task 3 test).
- Concurrent policy change between preview and click: stale fingerprint rejects the apply (Task 3 test).
- Narrow viewport and long model names: provider, scenario, costs, total and edit action remain legible (Task 2 browser test).

---

### Task 1: Server-owned provider cost comparison rows

**Files:**
- Create: `frontend/server/pricing-admin/provider-cost-comparison.ts` for `buildProviderCostComparisonRows()`.
- Modify: `frontend/server/pricing-admin/policy-read-model.ts`, `policy-contract.ts` and the browser-safe `frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts`.
- Test: `tests/admin-pricing-provider-comparison.test.ts`, `tests/admin-pricing-policy-service.test.ts`.

**Interfaces:** `buildProviderCostComparisonRows(input)` receives canonical representative scenarios, current routing/provider facts, **verified independent supplier rates**, and canonical quotes. It returns rows keyed by scenario ID with `brandId`, `executionProvider`, model/mode/resolution/duration/audio/input class, `supplierList`, `supplierEffective`, `supplierActual`, `customerTariff`, `customerQuote`, `grossDifference`, `sourceStatus`, and quote/policy provenance. Unavailable values are `null` with a reason, never zero.

- [ ] Write failing tests for ByteDance video and image rows, 2.5 Draft/final as separate rows, 1080p rate selection, Fal/BytePlus transitional routes, pending contract, missing actual bills, and quote provenance.
- [ ] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/admin-pricing-provider-comparison.test.ts`; require failures on the new cases.
- [ ] Implement the read model using the independent supplier tariff adapter from the family-pricing plan and `quoteCanonicalAdminScenarios()` for customer totals; never source supplier cost from a padded `vendorSubtotalCents`. Use a server-supplied source/status record rather than parsing display copy.
- [ ] Run focused tests and `tests/admin-pricing-architecture.test.ts`; commit only Task 1 files.

### Task 2: Clean comparison interface in the existing cockpit

**Files:**
- Modify: `frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx`, `PricingPolicyTable.tsx`, `PricingPolicyInspector.tsx`.
- Create: `frontend/app/(core)/admin/pricing/_components/ProviderPriceComparisonTable.tsx` if a focused table keeps the policy table readable.
- Modify: `frontend/app/(core)/admin/pricing/_lib/pricing-cockpit-view-model.ts` for pure filtering/formatting only.
- Test: `tests/admin-pricing-architecture.test.ts`, `tests/admin-pricing-provider-comparison.test.ts`, `tests/e2e/admin-smoke.spec.ts`.

**Interfaces:** One selectable comparison row groups by brand and execution provider, names its exact scenario, and places supplier values on the left and customer tariff/quote/gross gap on the right. `Modifier` selects the corresponding tariff inspector for migrated families or the legacy policy inspector elsewhere; it does not save. Source badges must read `list`, `contract pending`, `effective`, `observed`, `estimated`, or `unavailable` as appropriate.

**Screen hierarchy:** Family selector → Video/Image → model → sellable scenario. The table keeps `Model / mode / options`, `Supplier list / contract / observed`, `MaxVideoAI tariff / customer total`, `Gross gap`, `Source / date`, and `Edit` visually separate. Opening a row shows the exact tariff cell and every variant it covers. The editor names the unit in ordinary language and shows the current amount, proposed amount, quote preview, and effective date before the final confirmation. Empty or unverified supplier values display an explanation rather than a green margin figure.

- [ ] Add failing DOM/view-model tests for provider filtering, exact scenario labels, missing-rate state, Draft/final combined summary, and selected-row/edit behavior.
- [ ] Run the focused tests; require the new cases to fail.
- [ ] Implement the grouped table and inspector summary with plain units and explanatory labels; use horizontal containment or stacked cards at narrow widths, not hidden price columns.
- [ ] Run tests and authenticated desktop/mobile browser smoke; confirm a real user can identify model, provider, supplier basis, customer total, and edit scope without opening another page; commit only Task 2 files.

### Task 3: Safe editable manual customer-tariff flow

**Files:**
- Modify: the `/admin/pricing` route-local tariff inspector and `_hooks/useAdminPricingCockpitController.ts`, plus `frontend/components/admin-system/pricing/AdminPricingChangePreviewDialog.tsx` as required for exact scenario deltas.
- Extend: `frontend/server/pricing-admin/` preview/confirm/event owners for customer-tariff cells, preserving their existing transaction and fingerprint boundaries.
- Test: `tests/admin-pricing-preview.test.ts`, `tests/admin-pricing-policy-service.test.ts`, `tests/admin-pricing-architecture.test.ts`.

**Interfaces:** For ByteDance and later migrated families, right-side edits propose an explicit customer tariff rate/unit/rounding or fixed exception plus exact selector, never a supplier-cost edit or an implicit percent margin. The server computes authoritative totals. The preview shows current/proposed customer total, supplier cost/source, gross difference, affected scenarios/surfaces, and actor-visible history after apply. Legacy margin controls remain available only for non-migrated families. A below-cost target requires a reviewed risk/settlement design and explicit approval; it must not be simulated with a false provider cost or negative margin.

- [ ] Add failing tests that editing cannot bypass preview/confirm, stale previews reject, selector spillover is shown, missing tariff coverage rejects activation, and no supplier-cost field is submitted as a commercial rule.
- [ ] Run focused admin tests; require the new cases to fail.
- [ ] Wire comparison selection to the manual-tariff inspector and canonical preview for migrated families, making change scope and before/after values explicit; preserve rollback and no-database failure behavior.
- [ ] Run focused tests, `pnpm pricing:baseline`, `pnpm pricing:public-baseline`, `pnpm pricing:audit`, and `git diff --check`; require no current-price changes and commit only Task 3 files.

### Task 4: Deployment reconciliation and provider expansion

**Files:**
- Modify: `frontend/lib/admin/navigation.ts` and the relevant admin routing/deployment owner only after finding why production redirects `/admin/pricing` to `/admin/settings`.
- Modify: `frontend/server/pricing-admin/provider-cost-comparison.ts` to add representative scenarios for other active providers after the ByteDance pilot is accepted.
- Update: `docs/engineering/pricing-engine.md`, `docs/engineering/admin-routes.md`.
- Test: `tests/admin-pricing-architecture.test.ts`, `tests/e2e/admin-smoke.spec.ts`, `tests/pricing-public-projection.test.ts`.

**Interfaces:** Authenticated admins reach one pricing cockpit from the navigation. Provider groups share the same units/status/quote semantics; unsupported cost shapes remain clearly unavailable until an authoritative adapter exists.

- [ ] Reproduce and explain the production redirect in a deployment/version check; add a route smoke assertion for the intended admin destination.
- [ ] Expand the read model provider by provider using verified factual adapters, not a guessed universal rate table.
- [ ] Run focused tests, lint, TypeScript, exposure lint, the pricing audits and desktop/mobile smoke; require existing customer prices and public projections unchanged.
- [ ] Commit only Task 4 files and retain screenshots of the final table and preview for the human review gate.

**Handoff:** Supplier-tariff editing, an intentional below-cost offer, and any actual customer-price change each require their own explicit proposal. This plan provides visibility and safe manual commercial controls without silently exercising them.
