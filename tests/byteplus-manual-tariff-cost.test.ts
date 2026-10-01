import assert from 'node:assert/strict';
import test from 'node:test';
import { ManualTariffError } from '@maxvideoai/pricing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { resolveCustomerTariffQuote } from '../frontend/server/pricing/resolve-customer-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

const at = '2026-10-01T12:00:00Z';
function context(modelId = 'seedance-2-0-mini', extra: Partial<PricingContext> = {}): PricingContext {
  const entry = getFalEngineById(modelId)!.engine;
  return { engine: { ...entry, providerMeta: { ...entry.providerMeta, provider: 'byteplus_modelark' } }, mode: 't2v', durationSec: 5,
    resolution: '720p', aspectRatio: '16:9', hasVideoInput: false, ...extra };
}
function selected(selected: PricingContext, customerCents: number, active = true) {
  const billing = buildBillingPricingFacts(selected, selected.engine.pricingDetails, 'USD');
  const selector = buildManualTariffScenario(selected, billing.facts).selector;
  return { billing, state: { status: 'loaded' as const, revision: 4, active, databaseCells: [],
    versionedCells: [{ id: 'reviewed-retail', source: 'versioned' as const, version: 1, currency: 'USD',
      effectiveFrom: '2026-09-28T00:00:00Z', selector, price: { kind: 'fixed' as const, customerCents } }] } };
}

test('profitable Mini manual price uses signed cost and retains the below-cost guard', () => {
  const ctx = context();
  const { billing, state } = selected(ctx, 31);
  const quote = resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state, at })!.quote;
  assert.equal(quote.customerTotalCents, 31);
  assert.equal(quote.breakdown.vendorSubtotalExactCents, 15.12);
  assert.equal(quote.vendorShareCents, 16);
  assert.equal(quote.marginCents, 15);
  const below = selected(ctx, 15);
  assert.throws(() => resolveCustomerTariffQuote({ context: ctx, facts: below.billing.facts, state: below.state, at }),
    error => error instanceof ManualTariffError && error.code === 'below_cost');
  assert.ok(billing.facts.vendorSubtotalExactCents > 72, 'the legacy retail basis must stay intact');
});

test('contract cost does not reprice current customer cents and expires back to LIST', () => {
  const ctx = context();
  const { billing, state } = selected(ctx, 95);
  const current = resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state, at })!.quote;
  assert.equal(current.customerTotalCents, 95);
  assert.equal(current.vendorShareCents, 16);
  const expired = resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state, at: '2027-08-26T16:00:00Z' })!.quote;
  assert.equal(expired.customerTotalCents, 95);
  assert.equal(expired.vendorShareCents, 38);
  assert.equal(expired.breakdown.vendorSubtotalExactCents, 37.8);
  assert.equal(resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state: { ...state, active: false }, at }), null);
});

test('Fast, video-input and Seedream quantities use their own factual supplier costs', () => {
  for (const [ctx, customerCents, costCents] of [
    [context('seedance-2-0-fast'), 61, 30.24],
    [context('seedance-2-0-mini', { mode: 'v2v', hasVideoInput: true, inputVideoDurationSec: 3 }), 19, 9.072],
    [context('seedream', { mode: 't2i', resolution: '2K', durationSec: 2 }), 8, 6.3],
    [context('seedream-5-0-pro', { mode: 'i2i', resolution: '2K', durationSec: 2,
      inputImageCount: 1, referenceImageCount: 2 }), 20, 16.74],
  ] as const) {
    const { billing, state } = selected(ctx, customerCents);
    const quote = resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state, at })!.quote;
    assert.equal(quote.customerTotalCents, customerCents, ctx.engine.id);
    assert.equal(quote.breakdown.vendorSubtotalExactCents, costCents, ctx.engine.id);
  }
});

test('manual billing snapshot presents the factual cost and contract provenance consistently', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(at) });
  const ctx = context();
  const { state } = selected(ctx, 31);
  const snapshot = await computeCanonicalBillingSnapshot(ctx, {
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    loadCustomerTariffState: async () => state,
  });
  assert.equal(snapshot.totalCents, 31);
  assert.equal(snapshot.vendorShareCents, 16);
  assert.equal(snapshot.base.amountCents, 15.12);
  assert.equal(snapshot.base.rate, 0.03024);
  assert.equal(snapshot.addons.length, 0);
  assert.equal(snapshot.meta?.providerCostKind, 'signed_contract_estimate');
  assert.equal((snapshot.meta?.providerCostContract as { id: string }).id, 'CT20260925128931');
  assert.equal(snapshot.meta?.providerCostListUsd, 0.378);
  assert.equal(snapshot.meta?.customerTariffRevision, 4);
});

test('a Fal route retains its own factual subtotal and cannot inherit the BytePlus contract', () => {
  const ctx = context('seedance-2-0-fast', { engine: getFalEngineById('seedance-2-0-fast')!.engine });
  const { billing, state } = selected(ctx, 999);
  const resolved = resolveCustomerTariffQuote({ context: ctx, facts: billing.facts, state, at })!;
  assert.equal(resolved.supplierCost, null);
  assert.equal(resolved.quote.breakdown.vendorSubtotalExactCents, billing.facts.vendorSubtotalExactCents);
});
