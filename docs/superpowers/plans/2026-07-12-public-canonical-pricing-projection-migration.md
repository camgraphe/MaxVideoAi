# Public Canonical Pricing Projection Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one canonical pricing rule authoritative for every customer-visible price projection—pricing hub, model pages, browser estimator, price chip, JSON-LD, workspace preflight, and image estimates—without changing any displayed or returned amount, currency, discount, rounding result, route behavior, or admin pricing operation.

**Architecture:** Keep provider facts separate from commercial policy. A browser-safe public adapter builds factual costs, resolves validated versioned policy plus already-serialized optional overrides, calls `quoteCanonicalPricing()`, and projects the result without recalculating it. Server-rendered public projections use the same pure adapter with the existing server policy resolver when they currently honor database overrides. Live workspace/image estimates use the already canonical server quote used for billing so the preview and eventual charge cannot diverge. Route-local files retain only scenario selection and formatting.

**Tech Stack:** TypeScript, Next.js App Router, React client components, `@maxvideoai/pricing`, Node `node:test`, `tsx`, pnpm.

## Global Constraints

- Preserve every existing public amount at integer-cent precision, including provider-reference rounding, image quantities, audio-on/off behavior, membership discounts, per-second labels, model decision cards, and structured-data offer strings.
- Keep the committed 178-row pricing audit unchanged at 178 matches, 0 mismatches, and 4 explicit compatibility profiles. Add a separate exhaustive public-projection baseline instead of rewriting the existing audit fixture.
- Do not change commercial values in `frontend/config/pricing-policy.json`, database pricing values, seeded billing products, top-up prices, wallet rules, Stripe configuration, or any admin mutation/API behavior. A named rounding-only compatibility profile may be added only when the frozen public fixture first demonstrates the historical cent-level behavior it preserves.
- Public components may format a canonical quote but may not calculate margin, surcharge, discount, or customer total.
- Browser code must not import database, server-only, environment-secret, admin, or pricing-rule-store modules.
- Preserve current override behavior: surfaces that currently use database rules or engine-pricing overrides continue to use them; deterministic catalog-only surfaces continue to use validated versioned defaults.
- Keep `frontend/src/lib/pricing.ts` temporarily as an admin/legacy compatibility facade. Public consumers must stop importing it in this batch; deletion belongs to the later legacy-removal subproject.
- Use TDD for every production behavior change: add the failing test, run it and observe RED, implement the smallest change, then rerun GREEN.
- Use `apply_patch` for authored edits. Commit each completed task separately. Do not push.

---

## File Structure

### New files

- `frontend/src/lib/pricing-public-facts.ts` — browser-safe factual adapters for standard engine definitions, addons, Luma references, Seedance token pricing, GPT Image 2, authored schema offers, and fixed public products; contains no commercial math.
- `frontend/src/lib/pricing-public-quote.ts` — browser-safe policy/profile selection, optional serialized-rule adaptation, canonical quote invocation, and optional snapshot projection.
- `frontend/server/pricing/quote-public.ts` — server-only public quote orchestration for surfaces that already honor database policy and membership overrides.
- `frontend/scripts/pricing-public-baseline.ts` — deterministic exhaustive public-projection baseline collector with a read-only check mode and explicit `--write` mode.
- `frontend/scripts/pricing-public-baseline-collector.ts` — legacy-authoritative scenario collector loaded only after the deterministic environment bootstrap.
- `tests/fixtures/pricing-public-projections.v1.json` — frozen pre-migration values for every exact pricing-hub scenario, model-page price projection, estimator engine/tier sample, price-chip sample, JSON-LD offer, workspace preflight sample, and image estimate sample.
- `tests/pricing-public-projection.test.ts` — canonical public adapter parity, browser-safety, override precedence, and projection invariants.
- `tests/pricing-public-authority.test.ts` — static boundary guard proving all public consumers delegate commercial calculation to canonical owners.

### Existing files changed

- `package.json` — add `pricing:public-baseline` and explicit `pricing:public-baseline:generate` commands.
- `frontend/src/lib/pricing-audit/canonical-facts.ts` — delegate overlapping provider facts to the production public factual adapter so the audit is not a second provider-fact implementation.
- `frontend/config/pricing-policy.json` — add the fixture-reviewed `public-rounded-vendor-current` rounding profile; no margin, surcharge, discount, currency, or price value changes.
- `packages/pricing/src/canonical.ts` and `packages/pricing/src/index.ts` — expose canonical quote scaling so historical per-unit rounding can be preserved for image batches inside the pure kernel.
- `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts` — retain catalog filtering, scenario support, notes, links, sorting, and formatting; delegate all video/image/fixed-product totals.
- `frontend/components/marketing/PriceEstimator.tsx` and `frontend/components/marketing/PriceChip.tsx` — consume canonical public snapshots.
- `frontend/components/marketing/price-estimator/price-estimator-options.ts` — retain option/capability presentation; remove embedded margin arithmetic from displayed rates.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts` — use the server public quote owner for DB-aware model price labels and rows.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts` — continue sharing pricing-hub scenarios, now canonical through that dependency.
- `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts` — build Product Offer amounts from canonical schema quotes and remove local margin math.
- `frontend/src/server/engines.ts` and `frontend/app/api/images/estimate/route.ts` — use the canonical server quote already shared with billing for live customer previews.
- `tests/pricing-page-architecture.test.ts`, `tests/price-estimator-architecture.test.ts`, `tests/model-page-layout-architecture.test.ts`, `tests/marketing-jsonld-schema-audit.test.ts`, `tests/pricing-billing-authority.test.ts`, and `tests/pricing-foundation-architecture.test.ts` — lock the migrated boundaries.
- `docs/engineering/pricing-engine.md` and `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md` — record public authority, retained compatibility facade, verification evidence, and the remaining admin/legacy-removal boundary.

---

### Task 1: Freeze exhaustive public outputs before changing authority

**Files:**

- Create: `frontend/scripts/pricing-public-baseline.ts`
- Create: `frontend/scripts/pricing-public-baseline-collector.ts`
- Create: `tests/fixtures/pricing-public-projections.v1.json`
- Modify: `package.json`
- Create: `tests/pricing-public-projection.test.ts`

**Coverage contract:**

- Pricing hub: every exact video preset for every public video entry, representative image presets/quantities for every public image entry, all audio rows, and every fixed tool row.
- Model pages: per-second/per-image values and decision-card totals for every indexable model.
- Estimator/chip: every estimator-enabled engine at its default duration/resolution for `member`, `plus`, and `pro`, plus audio-toggle cases.
- JSON-LD: every indexable model with an Offer.
- Live previews: representative standard, Luma, Seedance, GPT Image 2, addon, and storyboard inputs.

- [x] **Step 1: Write the deterministic collector**

The default command reads current legacy owners and compares their stable JSON representation to the committed fixture. `--write` is the only mode allowed to update the fixture. Exclude timestamps, database state, localized currency glyph variance, and runtime secrets; store integer cents, normalized currency, unit, quantity, scenario ID, compatibility profile, and structured-data amount where applicable.

- [x] **Step 2: Generate and inspect the pre-migration fixture**

Run:

```bash
pnpm pricing:public-baseline:generate
pnpm pricing:public-baseline
```

Expected: the generated IDs are unique; all cent fields are non-negative integers; the read-only check exits 0.

- [x] **Step 3: Add fixture integrity tests**

Assert the fixture covers every currently eligible catalog entry and every required surface. Fail on duplicate IDs, missing catalog entries, non-integer cents, non-USD unexpected currency, or a collector/fixture difference.

- [x] **Step 4: Prove the existing 178-row audit is unchanged**

Run:

```bash
pnpm pricing:baseline
pnpm pricing:audit
```

Expected: 178 scenarios, 178 matches, 0 mismatches, 4 compatibility profiles.

- [x] **Step 5: Commit the frozen public contract**

```bash
git add package.json frontend/scripts/pricing-public-baseline.ts frontend/scripts/pricing-public-baseline-collector.ts tests/fixtures/pricing-public-projections.v1.json tests/pricing-public-projection.test.ts
git commit -m "test: freeze public pricing projections"
```

---

### Task 2: Add the browser-safe canonical public adapter

**Files:**

- Create: `frontend/src/lib/pricing-public-facts.ts`
- Create: `frontend/src/lib/pricing-public-quote.ts`
- Create: `frontend/server/pricing/quote-public.ts`
- Modify: `frontend/src/lib/pricing-audit/canonical-facts.ts`
- Modify: `tests/pricing-public-projection.test.ts`

**Interfaces:**

```ts
type PublicPricingFactsResult = {
  facts: PricingFacts;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
  compatibilityProfileId: 'standard' | 'provider-reference-current' | 'schema-current' | 'fixed-product-current';
};

quotePublicPricing(input): CanonicalPricingQuote;
projectPublicPricingSnapshot(input): PricingSnapshot;
computeCanonicalPublicSnapshot(context): Promise<PricingSnapshot>;
```

- [x] **Step 1: Write failing adapter tests**

Cover standard fractional cents, audio addon facts, Luma Ray 2, Luma Ray 3.2, Luma Agents image, Seedance 2 token facts, GPT Image 2 qualities/sizes, fixed-product pass-through, `schema-current`, all three member tiers, exact/engine/global serialized overrides, fallback to versioned policy, and canonical provenance.

Add a static browser-safety assertion that `pricing-public-facts.ts` and `pricing-public-quote.ts` do not import `@/server`, `pricing-rule-store`, `db`, `schema`, `env`, `node:`, `next/headers`, or billing/admin owners.

- [x] **Step 2: Run the tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-public-projection.test.ts
```

Expected: FAIL because the public facts/quote modules do not exist.

- [x] **Step 3: Implement factual adapters only**

Build vendor subtotal, unit, quantity, factual base/addons, and descriptive metadata. Use existing pure provider calculators. Accept explicit public Luma rate inputs where server-only environment overrides are required; use the current documented defaults in browser contexts. Do not calculate margin, discount, surcharge, total, platform fee, or vendor share.

- [x] **Step 4: Implement one canonical public quote path**

Resolve the validated versioned policy. If serialized `PricingRuleLite[]` values are supplied, adapt only the selected effective rule into a complete canonical database rule by filling omitted fields from the resolved versioned rule. Select the explicit compatibility profile from facts, then call `quoteCanonicalPricing()`. Snapshot projection must use `projectCanonicalQuoteToSnapshot()` and must not recalculate commercial fields.

- [x] **Step 5: Implement DB-aware server orchestration**

`computeCanonicalPublicSnapshot()` resolves the existing server policy, membership discount, provider facts, compatibility profile, quote, and projection. It preserves current database fallback warnings and does not introduce a second DB resolver.

- [x] **Step 6: Make the audit reuse production public facts**

Replace overlapping fact formulas in `pricing-audit/canonical-facts.ts` with calls to `pricing-public-facts.ts`. Audit-only scenario resolution stays in the audit module.

- [x] **Step 7: Run focused package, adapter, and audit tests**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-canonical-kernel.test.ts \
  tests/pricing-public-projection.test.ts \
  tests/pricing-shadow.test.ts
pnpm pricing:audit
```

Expected: PASS; audit remains 178/178 with 0 mismatches.

- [x] **Step 8: Commit**

```bash
git add frontend/src/lib/pricing-public-facts.ts frontend/src/lib/pricing-public-quote.ts frontend/server/pricing/quote-public.ts frontend/src/lib/pricing-audit/canonical-facts.ts tests/pricing-public-projection.test.ts
git commit -m "feat: add canonical public pricing adapter"
```

---

### Task 3: Migrate the pricing hub and model decision projections

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts`
- Modify: `frontend/config/pricing-policy.json`
- Modify: `packages/pricing/src/canonical.ts`
- Modify: `packages/pricing/src/index.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts`
- Modify: `tests/pricing-page-architecture.test.ts`
- Modify: `tests/model-page-decision-data.test.ts`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/pricing-public-projection.test.ts`

- [x] **Step 1: Add failing authority and exhaustive parity assertions**

Require `pricingHubData.ts` to import the public canonical adapter. Forbid `applyDisplayedPriceMarginCents`, `DISPLAY_PRICE_MARGIN_PERCENT`, direct `1 + margin` arithmetic, and local commercial rounding. Assert the complete pricing hub and model decision output equals the frozen public fixture.

- [x] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-public-projection.test.ts \
  tests/pricing-page-architecture.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/model-page-layout-architecture.test.ts
```

Expected: FAIL because the hub still owns commercial math.

- [x] **Step 3: Migrate video and image totals**

Keep duration/resolution support, closest-route notes, entry/4K preset selection, sorting, cheapest flags, links, and localized formatting in the route-local hub. Replace every standard, Luma, Seedance, GPT Image 2, and image-quantity total with a canonical public quote.

- [x] **Step 4: Migrate fixed public rows without changing seeded values**

Audio rows continue consuming their already canonical snapshot. Wrap fixed tool/product facts in `fixed-product-current`; do not query or mutate admin billing products from the static marketing page. The frozen values remain exactly 8/24, 15/30, 4/7, 24/40, 4/12, and 25/80 cents as currently displayed.

- [x] **Step 5: Keep model decisions on the shared scenario owner**

Preserve `getPresetQuote()`/`getImagePresetQuote()` reuse and existing formatting. Add no model-specific commercial formula.

- [x] **Step 6: Run parity, route architecture, and pricing audit**

Run the Step 2 suite plus:

```bash
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: all pass; frozen public outputs unchanged; 178/178 audit unchanged.

- [x] **Step 7: Commit**

```bash
git add packages/pricing/src/canonical.ts packages/pricing/src/index.ts frontend/config/pricing-policy.json 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts' tests/pricing-page-architecture.test.ts tests/model-page-decision-data.test.ts tests/model-page-layout-architecture.test.ts tests/pricing-public-projection.test.ts
git commit -m "feat: migrate public pricing hub projections"
```

---

### Task 4: Migrate browser estimator and price chip

**Files:**

- Modify: `frontend/components/marketing/PriceEstimator.tsx`
- Modify: `frontend/components/marketing/PriceChip.tsx`
- Modify: `frontend/components/marketing/price-estimator/price-estimator-options.ts`
- Modify: `frontend/scripts/pricing-public-baseline-collector.ts`
- Modify: `tests/fixtures/pricing-public-projections.v1.json`
- Modify: `tests/price-estimator-architecture.test.ts`
- Modify: `tests/pricing-public-projection.test.ts`

- [x] **Step 1: Write failing browser authority tests**

Require both client components to delegate to `pricing-public-quote.ts`. Forbid direct `computePricingSnapshot()` calls, platform fee mutation, selected-rule commercial mutation, and manual margin multiplication. Require option-building code to describe raw provider rates/capabilities only.

- [x] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-public-projection.test.ts tests/price-estimator-architecture.test.ts
```

Expected: FAIL against the legacy client kernel path.

- [x] **Step 3: Migrate estimator snapshots**

Build factual inputs from the selected engine, duration, resolution, quality, image quantity, and audio toggle. Pass optional serialized rules to the canonical public adapter. Continue rendering the existing `PricingSnapshot` presentation fields so labels, member savings, itemization, empty states, and lazy loading do not change.

- [x] **Step 4: Migrate the price chip**

Use the same adapter and preserve engine label/version, duration/resolution, discount copy, formatted total, and breakdown interaction.

- [x] **Step 5: Remove commercial rate math from options**

Per-image and per-second option rates must be raw factual display helpers only. The final selected price always comes from the canonical snapshot. Preserve option order, availability, duration constraints, and rate-unit copy.

- [x] **Step 6: Run client-focused parity and lint**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-public-projection.test.ts tests/price-estimator-architecture.test.ts
pnpm pricing:public-baseline
pnpm --prefix frontend run lint
```

Expected: PASS with no frozen output change.

- [x] **Step 7: Commit**

```bash
git add frontend/components/marketing/PriceEstimator.tsx frontend/components/marketing/PriceChip.tsx frontend/components/marketing/price-estimator/price-estimator-options.ts frontend/scripts/pricing-public-baseline-collector.ts tests/fixtures/pricing-public-projections.v1.json tests/price-estimator-architecture.test.ts tests/pricing-public-projection.test.ts
git commit -m "feat: migrate browser pricing projections"
```

---

### Task 5: Migrate model price rows and JSON-LD

**Files:**

- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts`
- Modify: `frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts`
- Modify: `frontend/src/lib/pricing-marketing.ts`
- Modify: `tests/model-page-layout-architecture.test.ts`
- Modify: `tests/marketing-jsonld-schema-audit.test.ts`
- Modify: `tests/pricing-public-projection.test.ts`

- [x] **Step 1: Add failing model/JSON-LD authority tests**

Require model pricing to use the server public owner and JSON-LD to use the public canonical adapter with `schema-current`. Forbid imports from `@/lib/pricing`, `DEFAULT_SCHEMA_MARGIN_PERCENT`, direct provider-total markup, and local commercial rounding.

- [x] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-public-projection.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
```

Expected: FAIL because model rows and schema offers remain legacy-authoritative.

- [x] **Step 3: Migrate DB-aware model pricing rows**

Use `computeCanonicalPublicSnapshot()` for per-second and per-image points. Preserve engine-pricing overrides already applied by the route, database policy fallback, membership tier, localized formatting, resolution/quality labels, and async error fallback.

- [x] **Step 4: Migrate structured-data offers**

Create factual schema offer inputs from authored `pricingHint` amounts or provider facts. Use `schema-current` exactly where the authored amount is already customer-facing; use `provider-reference-current` only for existing fallback paths that currently add the provider-reference margin. Preserve `priceCurrency`, two-decimal `price`, availability, shipping, and return policy.

- [x] **Step 5: Run exhaustive model and schema parity**

Run the Step 2 suite plus:

```bash
pnpm pricing:public-baseline
pnpm pricing:audit
```

Expected: every Offer and model price matches the frozen fixture; audit remains 178/178.

- [x] **Step 6: Commit**

```bash
git add 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts' 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts' frontend/src/lib/pricing-marketing.ts tests/model-page-layout-architecture.test.ts tests/marketing-jsonld-schema-audit.test.ts tests/pricing-public-projection.test.ts
git commit -m "feat: migrate model pricing projections"
```

---

### Task 6: Align live workspace and image estimates with billing authority

**Files:**

- Modify: `frontend/src/server/engines.ts`
- Modify: `frontend/app/api/images/estimate/route.ts`
- Modify: relevant preflight/image estimate tests
- Modify: `tests/pricing-public-authority.test.ts`
- Modify: `tests/pricing-billing-authority.test.ts`
- Modify: `tests/pricing-foundation-architecture.test.ts`

- [x] **Step 1: Write failing preview-equals-charge tests**

For representative standard, addon, Luma, Seedance, GPT Image 2, storyboard, and membership inputs, assert the live preview base quote equals the canonical billing quote before explicitly documented storyboard transformations. Assert no public route calls the pure commercial kernel directly.

- [x] **Step 2: Run focused tests and verify RED**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-public-authority.test.ts \
  tests/pricing-billing-authority.test.ts \
  tests/pricing-foundation-architecture.test.ts \
  tests/image-generation-atomic.test.ts
```

Expected: FAIL because live estimates still import the legacy facade.

- [x] **Step 3: Use the canonical server quote for live previews**

Replace `computePricingSnapshot()` in workspace preflight and image estimate routes with the same server canonical quote used before a real charge. Preserve validation, engine configuration overrides, storyboards, response contracts, itemization, errors, and status codes.

- [x] **Step 4: Lock public authority boundaries**

The architecture guard must require canonical public ownership across the pricing hub, model pages, estimator, chip, JSON-LD, workspace preflight, and image estimate. It must forbid server/database imports from browser modules and forbid direct commercial arithmetic in migrated consumers. Admin and the legacy facade remain allowed only outside these public paths.

- [x] **Step 5: Run focused route and pricing tests**

Run the Step 2 suite plus existing configured-engine, preflight, image-estimate, storyboard, Luma, Seedance, and GPT Image pricing tests.

- [x] **Step 6: Commit**

```bash
git add frontend/src/server/engines.ts frontend/app/api/images/estimate/route.ts tests/pricing-public-authority.test.ts tests/pricing-billing-authority.test.ts tests/pricing-foundation-architecture.test.ts tests
git commit -m "feat: align live estimates with canonical pricing"
```

Before committing, stage named focused test files rather than unrelated files captured by the broad illustrative `tests` path.

---

### Task 7: Verify and document public canonical authority

**Files:**

- Modify: `docs/engineering/pricing-engine.md`
- Modify: `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md`

- [ ] **Step 1: Run pricing invariants**

```bash
pnpm pricing:baseline
pnpm pricing:public-baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Expected: existing audit remains 178 scenarios, 178 matches, 0 mismatches, 4 compatibility profiles; exhaustive public fixture check reports no change; JSON output parses cleanly.

- [ ] **Step 2: Run all focused architecture and public suites**

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-public-projection.test.ts \
  tests/pricing-public-authority.test.ts \
  tests/pricing-billing-authority.test.ts \
  tests/pricing-foundation-architecture.test.ts \
  tests/pricing-page-architecture.test.ts \
  tests/price-estimator-architecture.test.ts \
  tests/model-page-layout-architecture.test.ts \
  tests/model-page-decision-data.test.ts \
  tests/marketing-jsonld-schema-audit.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run complete repository verification**

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Expected: every command exits 0 and the production build completes all localized static pages.

- [ ] **Step 4: Smoke-test public routes**

Start the production build on an available local port and verify at minimum:

- `/pricing`, `/fr/tarifs`, `/es/precios`
- one standard video model, one provider-reference model, and one image model in all three locales
- workspace preflight for a standard engine and an audio-toggle engine
- image estimate for GPT Image 2 and one Luma image route
- rendered canonical, hreflang, Product Offer JSON-LD, and client hydration without console errors

- [ ] **Step 5: Inspect scope and commercial policy diff**

```bash
git diff HEAD~7..HEAD -- frontend/config/pricing-policy.json frontend/src/lib/schema/billing-products-schema.ts frontend/app/'(core)'/admin frontend/app/api/admin
git status --short --branch
```

Expected: no policy value, seeded product price, admin UI, or admin API behavior changed; branch is `main`; worktree contains only intentional changes.

- [ ] **Step 6: Document the resulting single rule**

Record that public and billing totals now use `quoteCanonicalPricing()`, provider adapters own facts only, the server resolver is the only DB/versioned merge point, browser projections receive only safe serialized overrides, and the legacy facade remains solely for the separately planned admin/legacy-removal phase.

- [ ] **Step 7: Commit documentation**

```bash
git add docs/engineering/pricing-engine.md docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md
git commit -m "docs: record canonical public pricing authority"
```
