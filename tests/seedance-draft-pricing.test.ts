import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

function context(resolution: string, step?: 'draft' | 'final'): PricingContext {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  return { engine: { ...engine, providerMeta: { ...engine.providerMeta, provider: 'byteplus_modelark' } }, mode: 't2v',
    durationSec: 5, resolution, aspectRatio: '16:9', hasVideoInput: false, addons: { audio: false },
    ...(step ? { workflowStep: step } : {}) } as PricingContext;
}
function selector(ctx: PricingContext) {
  return buildManualTariffScenario(ctx, buildBillingPricingFacts(ctx, ctx.engine.pricingDetails, 'USD').facts).selector;
}
test('Draft/final prices never alias a normal 480p/1080p customer tariff', async () => {
  const normal = context('480p');
  const draft = context('480p', 'draft');
  assert.notDeepEqual(selector(draft), selector(normal));
  const state = { status: 'loaded' as const, revision: 4, active: true, databaseCells: [], versionedCells: [{
    id: 'normal', source: 'versioned' as const, version: 1, currency: 'USD', effectiveFrom: '2026-09-28T00:00:00Z',
    selector: selector(normal), price: { kind: 'fixed' as const, customerCents: 129 },
  }] };
  const deps = { loadCustomerTariffState: async () => state,
    pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) } };
  await assert.rejects(computeCanonicalBillingSnapshot(draft, deps), /tariff/i);
  // 854×480×5×24/1024 at $0.0107/k; 1920×1080×5×24/1024 at $0.0117/k.
  for (const [step, resolution, cents, supplierCents] of [['draft', '480p', 129, 51.4001], ['final', '1080p', 711, 284.31]] as const) {
    const ctx = context(resolution, step);
    const quote = await computeCanonicalBillingSnapshot(ctx, { ...deps, loadCustomerTariffState: async () => ({ ...state,
      versionedCells: [{ ...state.versionedCells[0], id: step, selector: selector(ctx), price: { kind: 'fixed', customerCents: cents } }] }) });
    assert.equal(quote.totalCents, cents);
    assert.equal(quote.meta?.workflowStep, step);
    assert.equal(quote.base.amountCents, supplierCents);
    assert.equal(quote.meta?.providerCostKind, 'published_list_estimate');
    assert.equal(quote.meta?.providerCostContract, undefined);
  }
  await assert.rejects(computeCanonicalBillingSnapshot(draft, { ...deps,
    loadCustomerTariffState: async () => ({ ...state, active: false }) }), /tariff/i);
});

test('unsupported Draft pricing settings are refused before a quote', () => {
  for (const invalid of [context('720p', 'draft'), context('480p', 'final'),
    { ...context('480p', 'draft'), mode: 'i2v' }, { ...context('480p', 'draft'), engine: getFalEngineById('seedance-2-0')!.engine }]) {
    assert.throws(() => selector(invalid as PricingContext), /Draft|workflow/i);
  }
});
