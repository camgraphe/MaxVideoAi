# All-Model Manual Customer Tariffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit, admin-editable customer tariffs the single live price authority for all 48 sellable models, preserving today's effective customer totals at initial cutover.

**Architecture:** The registry determines sellable inventory. A complete, versioned set of exact-selector retail cells plus transactional database overrides feeds the existing canonical manual-tariff kernel. The server resolves one tariff revision for billing and read-only public quotes; admin edits use preview/confirm/history/rollback. Activation is gated by exhaustive supported-scenario coverage and cent-level parity against effective production quotes. The current-public-example-prices plan consumes this resolver without a separate formula.

**Tech Stack:** TypeScript, Next.js App Router, PostgreSQL/Neon migrations, `@maxvideoai/pricing`, node:test/tsx, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-29-unified-model-tariffs-and-current-example-prices-design.md`

## Global Constraints

- Derive sellable inventory from `frontend/config/model-registry.json` `publication.app.published`: 48 models on 2026-09-29, including 10 executable legacy; respect independent public Pricing publication.
- Initial customer cents must match effective production quotes, including database overrides, at every supported price-changing boundary. Do not rewrite immutable pricing fixtures to hide differences.
- Keep supplier list, account-effective, observed and historical padded retail basis distinct; unknown actual cost is never zero or a verified gross margin.
- Preserve stored receipts, settled quote snapshots, refunds, historical jobs, routes and localized publication. Do not activate Seedance Draft or 1.5 direct generation.
- An active manual-priced model cannot fall through to the generic 30% rule. Missing or ambiguous tariff, stale revision or unavailable effective database state blocks a new charge.
- Do not send messages to support, change external commercial prices or deploy from this plan.

## Review Focus

- A legacy model sold in the app but hidden from public Pricing, especially `lumaRay2`, has admin tariff coverage without a new marketing listing (Tasks 1, 4, 5).
- A tariff change during an open web/MCP/Studio confirmation yields a refresh/reconfirmation response before debit (Tasks 3, 5).
- A database outage after an admin override cannot make billing or public pages show the older versioned amount as current (Tasks 2, 3, 5).
- Seedance's padded retail basis cannot masquerade as real supplier cost or trigger a misleading below-cost decision (Tasks 1, 3, 4).
- Multiple reference images, input-video duration, 4K/image size, audio and Draft/final choices cannot accidentally resolve a cheaper neighboring cell (Tasks 1, 3).

---

### Task 1: Complete sellable matrix and effective quote baseline

**Files:**
- Create: `frontend/lib/pricing-audit/manual-tariff-coverage.ts`, `frontend/scripts/collect-effective-customer-tariffs.ts`
- Create: `tests/manual-tariff-coverage.test.ts`, a dated read-only report under `docs/engineering/`
- Inspect: `frontend/config/model-registry.json`, `frontend/src/lib/pricing-billing-facts.ts`, `frontend/src/lib/pricing-public-facts.ts`, `frontend/src/lib/pricing-audit/scenarios.ts`, `tests/fixtures/pricing-parity.v1.json`

**Interfaces:**
- `type ManualTariffCoverageScenario = { id: string; modelId: string; selector: ManualTariffSelector; quantities: Record<string, number>; context: PricingContext; capabilityKey: string }`.
- `collectSellableManualTariffScenarios(): ManualTariffCoverageScenario[]`.
- `type EffectiveCustomerTariffBaseline = { at: string; registryHash: string; databaseIdentity: string | null; rows: Array<{ scenarioId: string; customerCents: number; currency: string; policySource: string; ruleId: string }>; gaps: string[] }`.
- `collectEffectiveCustomerTariffBaseline({ at, quote }: { at: string; quote: (scenario: ManualTariffCoverageScenario) => Promise<PricingSnapshot> }): Promise<EffectiveCustomerTariffBaseline>` performs no writes.

- [ ] Write failing tests that registry app publication yields all 48 IDs/15 families, including the 10 legacy models and two pricing-hidden Luma variants; assert unsupported combinations are excluded and price-changing option boundaries are represented.
- [ ] Run `pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/manual-tariff-coverage.test.ts`; expect missing collector failure.
- [ ] Implement exhaustive capability-driven scenario collection and a read-only effective quote collector. Confirm the database/deployment identity before calling any result a production baseline; record any unavailable access explicitly.
- [ ] Run `pnpm pricing:baseline`, `pnpm pricing:public-baseline`, `pnpm pricing:audit -- --json` and the focused test. Record unchanged customer cents and provenance without rewriting frozen fixtures.
- [ ] Commit the collector, tests and dated evidence report. Do not activate tariffs if effective production overrides or supported coverage remain unknown.

### Task 2: Versioned and database tariff store with revision ownership

**Files:**
- Create: `frontend/config/customer-tariffs.json`, `frontend/server/pricing/customer-tariff-store.ts`, `neon/migrations/54_customer_tariff_cells.sql`
- Modify: `frontend/lib/admin/pricing-change-contract.ts`, `frontend/server/pricing-admin/event-store.ts`
- Create: `tests/customer-tariff-store.test.ts`, `tests/customer-tariff-store-postgres.test.ts`

**Interfaces:**
- `loadEffectiveCustomerTariffState(executor?: QueryExecutor): Promise<{ status: 'loaded'; revision: number; active: boolean; versionedCells: ManualTariffCell[]; databaseCells: ManualTariffCell[] } | { status: 'unavailable' }>`.
- `upsertCustomerTariffCell(executor: QueryExecutor, cell: ManualTariffCell, actorId: string): Promise<ManualTariffCell>` and `activateCustomerTariffs(executor: QueryExecutor, expectedRevision: number): Promise<number>` run only inside a transaction and increment one monotonic revision.
- Migration extends the existing immutable event domain with `customer_tariff`, stores exact selector key/JSON, effective interval, price JSON, currency, author and revision, and rejects overlapping active database intervals per selector under a transaction lock.

- [ ] Write failing tests for exact DB-over-versioned precedence, nonoverlapping effective times, invalid/ambiguous cells, atomic revision increments, unavailable DB status and immutable event round-trip.
- [ ] Run focused unit and isolated-PostgreSQL tests; expect missing store/schema failures.
- [ ] Implement the migration and store. Generate reviewed versioned cells only from Task 1's effective baseline; keep the database activation state false until the cutover gate. Do not encode a percentage-derived runtime fallback as a cell.
- [ ] Re-run focused tests and `git diff --check`; verify the migration applies on a disposable current-schema database.
- [ ] Commit store, migration and tests.

### Task 3: Canonical manual quote resolution and safe activation

**Files:**
- Modify: `packages/pricing/src/manual-tariff.ts`, `frontend/server/pricing/quote-billing.ts`, `frontend/server/pricing/quote-public.ts`, `frontend/src/lib/pricing-public-quote.ts`
- Create: `frontend/src/lib/pricing-manual-scenario.ts`, `frontend/server/pricing/resolve-customer-tariff.ts`
- Test: `tests/pricing-manual-tariff.test.ts`, `tests/pricing-canonical-kernel.test.ts`, `tests/pricing-public-projection.test.ts`, `tests/preflight-media-pricing.test.ts`, `tests/mcp-confirm-generation.test.ts`, Studio/image pricing contracts

**Interfaces:**
- `buildManualTariffScenario(context: PricingContext, facts: PricingFacts): { selector: ManualTariffSelector; quantities: Record<string, number> }` is the one option-to-selector projection shared by server billing and public scenario builders.
- `resolveCustomerTariffQuote({ context, facts, at, state }): ManualTariffQuote | null` returns null only while manual tariffs are inactive for the model; after activation it throws typed unavailable/missing/ambiguous errors, never the legacy quote.
- Canonical manual total is independent of supplier cost. Settlement estimates and actual supplier evidence have separate provenance; the below-cost guard uses an explicit reviewed policy instead of treating a padded/unknown estimate as verified cost.

- [ ] Add failing tests for cents parity across Task 1's matrix, exact selector dimensions, DB overrides, outage, no 30% fallback, provider-cost provenance, stale web/MCP/Studio revision and historical snapshot stability.
- [ ] Run the focused tests; expect failures only at new manual integration points.
- [ ] Integrate the manual branch into `computeCanonicalBillingSnapshot` and the public quote owner, preserving the legacy path while inactive. Wire revision into existing refresh/reconfirmation protocols. Keep activation off until Task 6.
- [ ] Run billing/public baselines and focused video, image, Studio, MCP and preflight tests. Compare every changed cent to the approved delta list; initial cutover requires zero deltas.
- [ ] Commit the inactive canonical integration and parity evidence. If production baseline access is unavailable, record the exact remaining gate.

### Task 4: All-family admin inventory, editor and audit trail

**Files:**
- Modify: `frontend/server/pricing-admin/policy-read-model.ts`, `provider-cost-comparison.ts`, `revalidation.ts`
- Create: `frontend/server/pricing-admin/customer-tariff-service.ts`, `frontend/server/pricing-admin/customer-tariff-contract.ts`
- Create: `frontend/app/api/admin/pricing/tariffs/inventory/route.ts`, `preview/route.ts`, `confirm/route.ts`, `history/route.ts`
- Modify: `frontend/app/(core)/admin/pricing/_components/AdminPricingCockpit.tsx`, `ProviderPriceComparisonTable.tsx`, its controller/view-model; create a focused tariff editor component
- Test: `tests/admin-pricing-architecture.test.ts`, `tests/admin-pricing-provider-comparison.test.ts`, `tests/admin-pricing-preview.test.ts`, `tests/admin-pricing-policy-service.test.ts`, `tests/e2e/admin-smoke.spec.ts`

**Interfaces:**
- `loadCustomerTariffInventory(): Promise<CustomerTariffInventory>` returns every app-published model grouped by registry family, selectable price-changing scenarios, supplier evidence statuses and effective canonical customer quote/revision.
- `previewCustomerTariffChange(proposal: CustomerTariffChangeProposal): Promise<CustomerTariffChangePreview>` returns current/proposed cells, affected scenario quotes/surfaces, coverage failures and a server fingerprint.
- `confirmCustomerTariffChange(proposal: CustomerTariffChangeProposal, fingerprint: string, actorId: string): Promise<CustomerTariffChangeConfirmation>` recomputes the preview in a transaction, persists the cell and revision, writes an immutable `customer_tariff` event, invalidates caches and returns operational warnings. Define these three contract types in `customer-tariff-contract.ts`; the proposal has `create | update | delete | rollback` variants matching existing admin conventions.

- [ ] Add failing tests for all 48 models, family/search filters, unknown supplier values, distinct list/effective/observed provenance, exact scenario editor, stale preview, rollback and authorization.
- [ ] Run the focused tests; expect new assertions to fail.
- [ ] Build the admin service and routes with existing `requireAdmin`, transaction/event and preview patterns. Show real current quote and explicit tariff unit; make the old 30% model rule editor historical/read-only after activation. Keep supplier facts/routing out of tariff mutations.
- [ ] Run tests, lint, TypeScript and localhost admin smoke on desktop/mobile. Check that the model count follows registry changes without hand-edited projections.
- [ ] Commit the admin vertical slice.

### Task 5: Public Pricing, model, browser and cross-product quote parity

**Files:**
- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx`, `_lib/pricingHubData.ts`, model page pricing/decision/schema builders, `frontend/components/marketing/PriceEstimator.tsx`, `PriceChip.tsx`
- Create: `frontend/app/api/pricing/quote/route.ts` for validated public scenarios that need a live browser quote
- Modify: `frontend/server/pricing-admin/revalidation.ts`, affected homepage pricing builder and MCP marketing budget projection
- Test: `tests/pricing-consumer-inventory.test.ts`, `tests/pricing-public-authority.test.ts`, `tests/product-schema-customer-price.test.ts`, `tests/home-price-demo.test.ts`, `tests/mcp-confirm-generation.test.ts`, Studio quote tests

**Interfaces:**
- `type PublicModelQuoteInput = { modelId: string; mode: string; durationSec: number; resolution: string; audio?: boolean; quality?: string; quantity?: number; referenceImageCount?: number }`.
- `quotePublicModelScenario(input: PublicModelQuoteInput): Promise<{ status: 'exact'; amountCents: number; currency: string; revision: string; scenarioLabel: string } | { status: 'unavailable' }>` on the server returns an exact supported quote or no amount; the read-only route accepts only validated published model scenarios and no private reference URLs.
- Server pages await this quote; client estimators/chips display it and re-request it when inputs/revision change. Complex owned-media pricing keeps its existing authenticated preflight.

- [ ] Add failing parity tests for one video, one image, a pricing-hidden legacy app model, public Pricing/model/JSON-LD consistency, browser refresh after edit, and MCP/Studio equality at one revision.
- [ ] Run focused tests; expect new consumer assertions to fail.
- [ ] Replace versioned-only/public hint amounts with effective server quotes, provide the validated browser read endpoint, and extend revalidation to Pricing, model, home, example and watch paths. Ensure a failed quote omits a numeric offer rather than displaying a stale hint.
- [ ] Run public baseline/audit, registry check, localized SEO and architecture checks, lint, TypeScript, `pnpm --prefix frontend run build`, `git diff --check`, and browser smoke of EN/FR/ES routes. Record intentional public projection changes without mutating frozen historical fixtures.
- [ ] Commit the final tariff consumer integration and update `docs/engineering/pricing-engine.md` with the active ownership and price-change runbook.

### Task 6: Atomic no-change cutover and end-to-end acceptance

**Files:**
- Modify: `frontend/server/pricing/resolve-customer-tariff.ts`, `docs/engineering/pricing-engine.md`
- Test: `tests/manual-tariff-coverage.test.ts`, `tests/pricing-public-authority.test.ts`, billing/public/MCP/Studio contracts and `tests/e2e/admin-smoke.spec.ts`

**Interfaces:**
- `activateCustomerTariffs(executor, expectedRevision)` is called only after a server-generated complete coverage/parity report tied to the exact effective database revision and current registry publication hash.

- [ ] Write a failing cutover gate test that rejects a missing cell, a one-cent difference, changed DB revision, changed registry publication, outdated browser confirmation and any post-activation model quote using `legacy_margin_rule`.
- [ ] Run the cutover test; expect failure at the absent activation gate.
- [ ] Compare the effective production quote baseline to all proposed retail cells and publish the exact zero-delta report. Exercise atomic activation for all sellable models in an isolated configured local database only if the evidence is complete; otherwise keep activation off and record the blocking evidence without guessing prices. Production activation is a separate reviewed operation.
- [ ] Re-run baseline/audit, admin preview/confirm/rollback, billing, MCP, Studio, public Pricing/model/JSON-LD and current-example-price tests. Confirm no model quote uses the global 30% rule and historical stored values are unchanged.
- [ ] Commit the activation code and local acceptance record only after every gate passes; do not commit a switch that silently activates an unverified production environment.

## Execution order

Task 1 establishes actual effective cents before any activation. Tasks 2–5 can be built and tested while activation remains off. The separate `2026-09-29-current-public-example-prices.md` plan can start immediately against the existing DB-aware `computeCanonicalPublicSnapshot`; Task 3 then changes the resolver beneath it. Task 6 follows both plans and is the only activation step. The whole release is ready only when all 48 model scenarios pass parity, admin edits change the same quote used by every consumer, and public examples pass their exact/reference/unavailable cases.

## Local continuation progress — 2026-09-29

The [local acceptance record](../../engineering/2026-09-29-pricing-local-acceptance.md) is the current evidence owner. Task checkboxes above describe complete gates; partial implementation does not mark an entire gate complete.

| Task | Implemented locally | Remaining gate |
| --- | --- | --- |
| 1 | 48 models/15 families; 66,549 effective baseline quotes; zero sampled missing cells or cent differences | 122 unresolved capability boundaries; exhaustive supported coverage |
| 2 | Inactive DB seed; transactional state; migration 55 immutable closed versions; active update/rollback and first fixed versioned-only override/rollback tests | Complete reviewed versioned seed and temporal quote acceptance for that initial override |
| 3 | Inactive canonical resolver; displayed revision propagation; atomic new-wallet charge guard; immutable paid recovery; MCP stale protocol | Actual supplier settlement provenance; legacy unbound direct PaymentIntent reconciliation (new immutable quote contract accepted locally on 2026-09-30) |
| 4 | All-family inventory; exact-selector customer and supplier scenarios; dated LIST/catalogue evidence; preview/confirm/history/rollback; local API cycle and preview-race protection | Desktop/mobile visual acceptance, real account/invoice evidence and globally active legacy-rule retirement |
| 5 | Current server quotes across public matrix/model offers/examples/home and browser consumers; Studio/Storyboard snapshot propagation and refresh | Remaining consumer/bundle inventory, localized/browser acceptance |
| 6 | Global switch remains off; local parity evidence recorded | Complete activation implementation and isolated local acceptance after every preceding gate |

No production write, deployment or support message is part of this continuation. The 30% legacy rule remains live until a complete approved cutover.
