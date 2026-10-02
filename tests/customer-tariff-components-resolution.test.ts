import assert from 'node:assert/strict';
import test from 'node:test';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { validateCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';

const engine = getFalEngineById('wan-3')!.engine;
const context = { engine, mode: 'v2v' as const, durationSec: 5, resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 3.25 };
const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector;
const cell = {
  id: 'continuous-wan', selector: { ...selector, inputVideoDurationSec: 'continuous' }, source: 'database' as const,
  version: 1, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00.000Z',
  price: { kind: 'unit_components' as const, rounding: 'nearest' as const, components: [
    { id: 'base', flatCents: 50, rounding: 'none' as const, precision: 3, terms: [
      { unit: 'input_video_seconds', centsPerUnit: 10, quantityRounding: { scale: 10, precision: 3 } },
    ] },
    { id: 'adjustment', flatCents: 15, rounding: 'up' as const, terms: [
      { unit: 'input_video_seconds', centsPerUnit: 3, quantityRounding: { scale: 10, precision: 3 } },
    ] },
  ] },
};
const deps = {
  pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) },
  loadCustomerTariffState: async () => ({ status: 'loaded' as const, active: true, revision: 19, versionedCells: [], databaseCells: [cell] }),
};

test('stored continuous units cover actual decimal source quantities on both quote surfaces', async () => {
  assert.deepEqual(validateCustomerTariffCell(cell), cell);
  for (const seconds of [Number.MIN_VALUE, 0.000016, 0.00005, 1, 3.25, 3.2501, 15]) {
    const selected = { ...context, inputVideoDurationSec: seconds };
    const current = await computeCanonicalBillingSnapshot(selected, { pricingPolicy: deps.pricingPolicy });
    const billing = await computeCanonicalBillingSnapshot(selected, deps);
    const marketing = await computeCanonicalPublicSnapshot(selected, deps);
    assert.equal(billing.totalCents, current.totalCents, String(seconds));
    assert.equal(marketing.totalCents, billing.totalCents);
    assert.equal(billing.meta?.customerTariffRevision, 19);
    assert.equal(marketing.meta?.customerTariffRevision, 19);
  }
});

test('an exact authored exception takes precedence and invalid source facts never resolve a continuous price', async () => {
  const exception = { ...cell, id: 'exact', selector, price: { kind: 'fixed' as const, customerCents: 150 } };
  const snapshot = await computeCanonicalBillingSnapshot(context, { ...deps, loadCustomerTariffState: async () => ({
    status: 'loaded', active: true, revision: 20, versionedCells: [], databaseCells: [cell, exception],
  }) });
  assert.equal(snapshot.totalCents, 150);
  for (const seconds of [0, -1, 16, Infinity, NaN]) await assert.rejects(computeCanonicalBillingSnapshot({ ...context, inputVideoDurationSec: seconds }, deps));
  await assert.rejects(computeCanonicalBillingSnapshot({ ...context, durationSec: 29, inputVideoDurationSec: 2 }, deps));
});
