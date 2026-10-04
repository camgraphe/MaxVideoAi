import assert from 'node:assert/strict';
import test from 'node:test';

import { ManualTariffError, quoteCanonicalManualTariff, type ManualTariffCell } from '../packages/pricing/src/manual-tariff';

const selector = { engineId: 'wan-3', mode: 'v2v', resolution: '720p', durationSec: '5' };
const price = {
  kind: 'unit_components', rounding: 'nearest', components: [
    { id: 'base', flatCents: 50, precision: 3, rounding: 'none', terms: [
      { unit: 'input_video_seconds', centsPerUnit: 10, quantityRounding: { scale: 10, precision: 3 } },
    ] },
    { id: 'rounding-adjustment', flatCents: 15, rounding: 'up', terms: [
      { unit: 'input_video_seconds', centsPerUnit: 3, quantityRounding: { scale: 10, precision: 3 } },
    ] },
  ],
} as const;
const cell: ManualTariffCell = {
  id: 'wan-continuous', selector, source: 'versioned', version: 1, currency: 'USD',
  effectiveFrom: '2026-09-30T00:00:00Z', price,
};

function quote(seconds: number, candidate: unknown = price, vendorCents = Math.round((50 + Math.round(seconds * 10_000) / 1000) * 1000) / 1000) {
  return quoteCanonicalManualTariff({
    facts: { engineId: selector.engineId, currency: 'USD', vendorSubtotalExactCents: vendorCents, unit: 'sec', quantity: 5 },
    selector, scenarioId: 'wan-continuous', quantities: { input_video_seconds: seconds },
    at: '2026-09-30T12:00:00Z', versionedCells: [{ ...cell, price: candidate as ManualTariffCell['price'] }], databaseCells: [],
  });
}

test('authored rounded components preserve separate cent boundaries for continuous quantities', () => {
  assert.equal(quote(3.25).customerTotalCents, 108);
  assert.equal(quote(3.25).manualTariff.exactCustomerCents, 107.5);
  for (const seconds of [Number.MIN_VALUE, 0.000016, 0.000049, 0.00005, 0.09999, 1, 3.25, 4.99999, 15]) {
    const basis = Math.round((50 + Math.round(seconds * 10_000) / 1000) * 1000) / 1000;
    assert.equal(quote(seconds).customerTotalCents, Math.round(basis + Math.ceil(basis * 0.3)), String(seconds));
  }
});

test('customer components and their frozen quantity precision do not read changing supplier prices', () => {
  assert.equal(quote(3.25, price, 40).customerTotalCents, 108);
  assert.equal(quote(3.25, price, 90).customerTotalCents, 108);
  assert.equal(quote(0.000016).customerTotalCents, 65);
  assert.equal(quote(0.00005).customerTotalCents, 66);
});

test('malformed rounded component tariffs fail closed', () => {
  const malformed = [
    { ...price, rounding: 'down' },
    { ...price, components: [] },
    { ...price, components: [price.components[0], price.components[0]] },
    { ...price, components: [{ ...price.components[0], precision: -1 }] },
    { ...price, components: [{ ...price.components[0], flatCents: NaN }] },
    { ...price, components: [{ ...price.components[0], terms: [{ ...price.components[0].terms[0], centsPerUnit: -1 }] }] },
    { ...price, components: [{ ...price.components[0], terms: [{ ...price.components[0].terms[0], quantityRounding: { scale: 0, precision: 3 } }] }] },
    { ...price, components: [{ ...price.components[0], terms: [{ ...price.components[0].terms[0], quantityRounding: { scale: 10, precision: 7 } }] }] },
    { ...price, components: [{ ...price.components[0], terms: [price.components[0].terms[0], price.components[0].terms[0]] }] },
  ];
  for (const candidate of malformed) assert.throws(() => quote(3.25, candidate), ManualTariffError);
  assert.throws(() => quote(-1), ManualTariffError);
  assert.throws(() => quote(Infinity), ManualTariffError);
  assert.throws(() => quote(3.25, price, 200), (error: unknown) => error instanceof ManualTariffError && error.code === 'below_cost');
});
