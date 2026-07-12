# Billing Consumer Canonical Pricing Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make canonical pricing quotes authoritative for wallet/direct generation, image, audio, and tool billing without changing any amount, currency, wallet debit, receipt financial field, provider settlement field, or current public pricing consumer.

**Architecture:** Keep the existing `PricingSnapshot` contract at billing boundaries, but build its financial fields from `CanonicalPricingQuote`. Provider adapters produce factual costs and legacy-compatible descriptive metadata; the server resolver supplies commercial policy and provenance; one pure projector maps the canonical quote into the existing receipt/job snapshot. Existing wallet and receipt persistence keep consuming the same integer-cent fields and are protected by acceptance tests.

**Tech Stack:** TypeScript, Next.js App Router, `@maxvideoai/pricing`, Node `node:test`, `tsx`, Neon/Postgres through the existing rule store, pnpm.

## Global Constraints

- Preserve every current billed amount at integer-cent precision. Do not change rates, margins, surcharges, membership discounts, currencies, duration normalization, resolution behavior, rounding, wallet debits, direct-payment validation, receipt amounts, application fees, or vendor shares.
- Preserve the existing `PricingSnapshot` financial contract consumed by jobs, receipts, refunds, admin audit, polling, and Stripe metadata.
- Do not modify public pricing pages, model pages, estimators, price chips, JSON-LD, `/admin/pricing`, admin mutation APIs, top-up tiers, wallet top-up behavior, or Stripe product configuration.
- Provider adapters may calculate provider facts and descriptive metadata only. Commercial margin, surcharge, discount, total, platform fee, and vendor share must come from `quoteCanonicalPricing()`.
- Keep database fallback behavior explicit. Versioned defaults remain safe when pricing-rule overrides cannot be loaded.
- Keep current production imports stable: `computePricingSnapshot()`, `buildAudioPricingSnapshot()`, and `computeBillingProductSnapshot()` remain callable while their financial authority changes internally.
- Do not delete the frozen audit baseline or compatibility profiles. No new compatibility profile may be added without an explicit fixture review.
- Use TDD for every production behavior change: failing test, observed failure, minimal implementation, passing focused test.
- Use `apply_patch` for authored edits. Run focused tests after every task and the complete verification gate at the end.

---

## File Structure

### New files

- `packages/pricing/src/projection.ts` — pure mapping from `CanonicalPricingQuote` plus provider presentation facts to the existing `PricingSnapshot` contract.
- `frontend/src/lib/pricing-billing-facts.ts` — provider-fact and legacy-compatible metadata adapters for standard, Luma, Seedance, GPT Image, audio, and fixed-product scenarios; contains no commercial math.
- `frontend/server/pricing/quote-billing.ts` — server-only orchestration of policy resolution, compatibility profile selection, canonical video/image/audio quote calculation, vendor-account routing, and snapshot projection.
- `tests/pricing-billing-projection.test.ts` — canonical-to-snapshot projection and financial invariant tests.
- `tests/pricing-billing-migration.test.ts` — representative standard/specialized/audio/fixed-product parity and provenance tests.
- `tests/pricing-billing-authority.test.ts` — architecture guard proving billing consumers use the canonical path while public and admin consumers remain unchanged.

### Existing files changed

- `packages/pricing/src/canonical.ts` — expose the exact subtotal used for discount and total projection.
- `packages/pricing/src/index.ts` — export the pure snapshot projector.
- `frontend/server/pricing/resolve-pricing-policy.ts` — expose a billing resolution result containing canonical policy plus the separately selected vendor account, without putting settlement routing into commercial policy.
- `frontend/src/lib/pricing-rule-store.ts` — provide the rule metadata required by the server billing resolver from one load; retain current admin exports.
- `frontend/src/lib/pricing.ts` — remain the stable public facade and delegate financial authority to the canonical server billing quote.
- `frontend/src/lib/pricing-specialized-snapshots.ts` — retain provider-fact builders and metadata compatibility, remove commercial arithmetic from migrated builders.
- `frontend/src/lib/audio-generation.ts` — use the canonical quote/projector with `audio-current`; retain the current synchronous public function by passing validated versioned policy explicitly.
- `frontend/src/lib/billing-products.ts` — use the canonical fixed-product profile after loading the product and membership discount.
- `frontend/app/api/generate/_lib/billing-preflight.ts` — assert canonical pricing provenance before wallet/direct persistence and preserve receipt fields.
- `frontend/src/server/images/execute-image-generation.ts` — keep storyboard transformations after the canonical base quote and preserve charged totals.
- `frontend/src/server/tools/angle.ts`, `frontend/src/server/tools/background-removal-pricing-context.ts`, and `frontend/src/server/tools/upscale-pricing-context.ts` — consume canonical fixed-product snapshots; dynamic tool facts remain provider facts.
- `tests/pricing-foundation-architecture.test.ts` and `tests/pricing-architecture.test.ts` — replace the shadow-only billing guard with canonical billing authority boundaries.
- `docs/engineering/pricing-engine.md` and `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md` — record billing migration status and exact verification evidence.

---

### Task 1: Add the canonical snapshot projection contract

**Files:**

- Create: `packages/pricing/src/projection.ts`
- Create: `tests/pricing-billing-projection.test.ts`
- Modify: `packages/pricing/src/canonical.ts`
- Modify: `packages/pricing/src/index.ts`

**Interfaces:**

- Consumes: `CanonicalPricingQuote`, `PricingSnapshot`, factual `base`, `addons`, `meta`, and optional vendor account.
- Produces: `projectCanonicalQuoteToSnapshot(input): PricingSnapshot` and `CanonicalPricingQuote.subtotalBeforeDiscountCents`.

- [ ] **Step 1: Write the failing projection tests**

Create tests that quote a fractional standard provider subtotal and assert the projected snapshot keeps the current financial contract:

```ts
const quote = quoteCanonicalPricing({
  facts: { engineId: 'demo', currency: 'USD', vendorSubtotalExactCents: 42.5, unit: 'sec', quantity: 5 },
  scenario: { id: 'demo', engineId: 'demo', membershipTier: 'plus', discountPercent: 0.05 },
  policy: resolvedPolicy,
  compatibilityProfile: standardProfile,
});
const snapshot = projectCanonicalQuoteToSnapshot({
  quote,
  base: { seconds: 5, rate: 0.085, unit: 'sec', amountCents: 42.5 },
  addons: [],
  vendorAccountId: 'acct_demo',
  meta: { provider: 'demo' },
});
assert.equal(snapshot.totalCents, quote.customerTotalCents);
assert.equal(snapshot.subtotalBeforeDiscountCents, quote.subtotalBeforeDiscountCents);
assert.equal(snapshot.platformFeeCents, quote.platformFeeCents);
assert.equal(snapshot.vendorShareCents, quote.vendorShareCents);
assert.equal(snapshot.margin.ruleId, quote.policyProvenance.sourceRuleId);
```

Also assert rejection when base plus addons does not equal the provider subtotal within 0.001 cents.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-billing-projection.test.ts
```

Expected: FAIL because `projection.ts` and the exact subtotal field do not exist.

- [ ] **Step 3: Expose the exact commercial subtotal**

Add `subtotalBeforeDiscountCents` to `CanonicalPricingQuote`, using the same value already used for discount and total rounding. Normalize it to three decimal places so standard fractional provider facts remain compatible with the existing kernel.

- [ ] **Step 4: Implement the pure projector**

The projector must copy base/addon/meta facts, source every financial result from the quote, include policy provenance under `meta.pricingPolicy`, and never recalculate margin, discount, total, platform fee, or vendor share.

- [ ] **Step 5: Run focused pricing package tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-canonical-kernel.test.ts tests/pricing-billing-projection.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/pricing/src/canonical.ts packages/pricing/src/projection.ts packages/pricing/src/index.ts tests/pricing-billing-projection.test.ts
git commit -m "feat: project canonical billing snapshots"
```

---

### Task 2: Migrate video and image pricing orchestration

**Files:**

- Create: `frontend/src/lib/pricing-billing-facts.ts`
- Create: `frontend/server/pricing/quote-billing.ts`
- Create: `tests/pricing-billing-migration.test.ts`
- Modify: `frontend/server/pricing/resolve-pricing-policy.ts`
- Modify: `frontend/src/lib/pricing-rule-store.ts`
- Modify: `frontend/src/lib/pricing.ts`
- Modify: `frontend/src/lib/pricing-specialized-snapshots.ts`

**Interfaces:**

- Consumes: the existing `PricingContext`, configured engine facts, membership discounts, canonical policy, compatibility profiles, and vendor-account routing metadata.
- Produces: `quoteCanonicalBillingSnapshot(context): Promise<PricingSnapshot>`; `computePricingSnapshot(context)` delegates to it.

- [ ] **Step 1: Write failing parity tests for representative billing families**

Cover standard fractional pricing with addons, Luma Agents image, Luma Ray 3.2, Luma Ray 2 generate/edit, Seedance 2 token pricing, and GPT Image 2. For each fixture assert exact equality of:

```ts
for (const field of ['currency', 'totalCents', 'subtotalBeforeDiscountCents', 'base', 'addons', 'margin', 'discount', 'membershipTier', 'platformFeeCents', 'vendorShareCents']) {
  assert.deepEqual(actual[field], expected[field], `${scenario.id}.${field}`);
}
```

Assert `actual.meta.pricingPolicy` identifies source, match, rule, and compatibility profile while all existing provider metadata keys remain present.

- [ ] **Step 2: Run the migration tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-billing-migration.test.ts
```

Expected: FAIL because the canonical server billing orchestrator does not exist and `computePricingSnapshot()` remains legacy-authoritative.

- [ ] **Step 3: Build factual adapters**

Implement one adapter per pricing family. Each returns:

```ts
type BillingPricingFacts = {
  facts: PricingFacts;
  base: PricingSnapshot['base'];
  addons: PricingSnapshot['addons'];
  meta: Record<string, unknown>;
  compatibilityProfileId: string;
};
```

Move provider reference calls, token estimates, image tiers, duration normalization, resolution multipliers, addon factual amounts, and current descriptive metadata into these adapters. Do not calculate commercial margin, discount, customer total, platform fee, or vendor share.

- [ ] **Step 4: Resolve policy and vendor routing once**

Extend the server resolver so one rule-store load yields canonical policy plus the current vendor-account selection. The commercial policy type remains free of `vendorAccountId`; vendor routing is returned beside it.

- [ ] **Step 5: Implement canonical billing orchestration**

`quoteCanonicalBillingSnapshot()` must resolve membership discount, provider facts, policy/profile, canonical quote, and projection in that order. `computePricingSnapshot()` becomes a compatibility facade that delegates to this function and retains its current exports.

- [ ] **Step 6: Prove existing video/image and pricing tests pass**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-billing-migration.test.ts \
  tests/pricing-definition.test.ts \
  tests/luma-agents-pricing.test.ts \
  tests/luma-ray2-pricing.test.ts \
  tests/seedance-2-pricing.test.ts \
  tests/gpt-image-2-pricing.test.ts \
  tests/generate-billing-preflight.test.ts \
  tests/image-generation-atomic.test.ts
```

Expected: PASS with unchanged expected cents.

- [ ] **Step 7: Run the deterministic audit**

Run:

```bash
pnpm pricing:baseline
pnpm pricing:audit
```

Expected: 178 current rows, 178 matches, 0 mismatches, 4 compatibility profiles.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/pricing-billing-facts.ts frontend/server/pricing/quote-billing.ts frontend/server/pricing/resolve-pricing-policy.ts frontend/src/lib/pricing-rule-store.ts frontend/src/lib/pricing.ts frontend/src/lib/pricing-specialized-snapshots.ts tests/pricing-billing-migration.test.ts
git commit -m "feat: migrate generation pricing to canonical quotes"
```

---

### Task 3: Migrate audio and fixed-product/tool billing

**Files:**

- Modify: `frontend/src/lib/audio-generation.ts`
- Modify: `frontend/src/lib/billing-products.ts`
- Modify: `frontend/src/server/audio/generate-audio.ts`
- Modify: `frontend/src/server/tools/angle.ts`
- Modify: `frontend/src/server/tools/background-removal-pricing-context.ts`
- Modify: `frontend/src/server/tools/upscale-pricing-context.ts`
- Modify: `tests/pricing-billing-migration.test.ts`
- Modify: `tests/audio-generation-config.test.ts`

**Interfaces:**

- Consumes: `buildAudioVendorCostFacts()`, billing-product rows, dynamic tool facts, membership tier, `audio-current`, and `fixed-product-current`.
- Produces: canonical audio and fixed-product `PricingSnapshot` values with unchanged public function signatures; production audio uses the async server resolver while the synchronous helper remains a deterministic versioned-policy projection for non-production callers.

- [ ] **Step 1: Add failing audio and tool financial parity tests**

Cover all four audio packs, fractional audio margin rounding, long voice scripts, fixed run products, quantity products, membership discounts, background-removal dynamic totals, image upscale, and video upscale. Assert exact total, base, margin, discount, platform fee, vendor share, and currency.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-billing-migration.test.ts tests/audio-generation-config.test.ts tests/background-removal-pricing.test.ts tests/upscale-pricing-preview.test.ts
```

Expected: FAIL because audio and fixed-product snapshots do not carry canonical provenance and still calculate financial results locally.

- [ ] **Step 3: Migrate audio**

Keep `buildAudioVendorCostFacts()` as the factual source. Make `buildAudioPricingSnapshot()` resolve the validated versioned `audio-generation` policy and `audio-current` profile synchronously for deterministic non-production callers. Add an async audio entry point to `frontend/server/pricing/quote-billing.ts` that resolves database overrides through the server resolver, then make `generateAudioRun()` use that server entry point. Both paths quote canonically and project the exact current audio metadata; the production path continues to persist the returned total and financial fields unchanged.

- [ ] **Step 4: Migrate billing products and tools**

After loading the current product and dynamic factual total, quote through `fixed-product-current`. Tool modules keep their current job, receipt, refund, credit-display, and provider execution flow; only the snapshot financial authority changes.

- [ ] **Step 5: Run focused audio/tool tests**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test \
  tests/pricing-billing-migration.test.ts \
  tests/audio-generation-config.test.ts \
  tests/audio-generate-server-architecture.test.ts \
  tests/background-removal-pricing.test.ts \
  tests/background-removal-tool-contract.test.ts \
  tests/upscale-pricing-preview.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/audio-generation.ts frontend/src/lib/billing-products.ts frontend/src/server/audio/generate-audio.ts frontend/src/server/tools/angle.ts frontend/src/server/tools/background-removal-pricing-context.ts frontend/src/server/tools/upscale-pricing-context.ts tests/pricing-billing-migration.test.ts tests/audio-generation-config.test.ts
git commit -m "feat: migrate audio and tool billing quotes"
```

---

### Task 4: Lock wallet, receipt, and consumer authority boundaries

**Files:**

- Create: `tests/pricing-billing-authority.test.ts`
- Modify: `frontend/app/api/generate/_lib/billing-preflight.ts`
- Modify: `tests/generate-billing-preflight.test.ts`
- Modify: `tests/pricing-foundation-architecture.test.ts`
- Modify: `tests/pricing-architecture.test.ts`

**Interfaces:**

- Consumes: canonical `PricingSnapshot` at existing billing boundaries.
- Produces: unchanged wallet/direct debit and receipt persistence plus architecture guards against parallel billing formulas.

- [ ] **Step 1: Write failing receipt/debit acceptance tests**

Assert that wallet and direct preflight persist the same `totalCents`, currency, application fee, vendor share, receipt snapshot, and payment-intent comparison value. Assert refunds still read the persisted amount rather than recomputing a quote.

- [ ] **Step 2: Write failing architecture guards**

The guard must require canonical authority in generic billing, audio, and billing products; forbid `quoteCanonicalPricing()` calls directly in API routes and tools; allow public/admin legacy paths until their later subprojects; and reject commercial arithmetic patterns in migrated billing adapters.

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --tsconfig frontend/tsconfig.json --test tests/pricing-billing-authority.test.ts tests/generate-billing-preflight.test.ts tests/pricing-foundation-architecture.test.ts tests/pricing-architecture.test.ts
```

Expected: FAIL against the previous shadow-only authority contract.

- [ ] **Step 4: Add provenance assertion at the persistence boundary**

Reject a billing snapshot missing canonical provenance before creating a new charge, while leaving dependency-injected unit-test snapshots explicitly markable as trusted test fixtures. Do not recompute in the route.

- [ ] **Step 5: Update architecture contracts**

Replace “all production consumers remain legacy-authoritative” with the narrower rule: billing is canonical-authoritative; public projections and admin remain unmigrated. Keep the pure-package and one-server-resolver guards.

- [ ] **Step 6: Run the focused authority suite**

Run the command from Step 3.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/pricing-billing-authority.test.ts frontend/app/api/generate/_lib/billing-preflight.ts tests/generate-billing-preflight.test.ts tests/pricing-foundation-architecture.test.ts tests/pricing-architecture.test.ts
git commit -m "test: lock canonical billing authority"
```

---

### Task 5: Verify and document the billing migration

**Files:**

- Modify: `docs/engineering/pricing-engine.md`
- Modify: `docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md`

- [ ] **Step 1: Run the pricing invariants**

```bash
pnpm pricing:baseline
pnpm pricing:audit
pnpm --silent pricing:audit -- --json
```

Expected: 178 rows, 178 matches, 0 mismatches, 4 compatibility profiles; JSON stdout parses without a pnpm banner.

- [ ] **Step 2: Run complete repository verification**

```bash
pnpm test:validate
pnpm --prefix frontend run lint
pnpm lint:exposure
pnpm --prefix frontend exec tsc --noEmit --pretty false
pnpm --prefix frontend run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 3: Verify scope from git**

```bash
git diff origin/main...HEAD -- frontend/app/'(localized)' frontend/components/marketing frontend/app/'(core)'/admin frontend/app/api/admin
git status --short --branch
```

Expected: no public pricing, marketing estimator/chip, or admin pricing behavior changed; branch is `main`; only intentional documentation changes may appear under the pricing design/guide paths.

- [ ] **Step 4: Document evidence and next boundary**

Record billing migration completion, unchanged audit counts, authoritative billing modules, and the fact that public projection migration remains a separate future plan.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/engineering/pricing-engine.md docs/superpowers/specs/2026-07-12-canonical-pricing-engine-design.md
git commit -m "docs: record canonical billing migration"
```
