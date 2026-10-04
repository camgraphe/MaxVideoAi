import assert from 'node:assert/strict';
import test from 'node:test';
import { ManualTariffError, quoteCanonicalManualTariff, type ManualTariffCell } from '../packages/pricing/src/manual-tariff';

const price = { kind: 'unit_bands', divisor: 10000, maxUnits: 10,
  terms: [{ unit: 'output_tokens', centsPerUnit: 17.5 }, { unit: 'input_tokens', centsPerUnit: 1.5 }],
  bands: [{ minUnits: 0, customerCents: 0 }, { minUnits: 3.5, customerCents: 5 }, { minUnits: 7, customerCents: 10 }] };
const selector = { engineId: 'test', mode: 'v2v' };
function quote(output: number, input: number, candidate = price, vendor = 0) {
  return quoteCanonicalManualTariff({ selector, scenarioId: 'band', at: '2026-09-30T00:00:00Z',
    quantities: { output_tokens: output, input_tokens: input }, databaseCells: [], versionedCells: [{
      id: 'band', selector, currency: 'USD', source: 'versioned', version: 1, effectiveFrom: '2026-09-29T00:00:00Z',
      price: candidate as unknown as ManualTariffCell['price'],
    }], facts: { engineId: 'test', currency: 'USD', unit: 'sec', quantity: 1, vendorSubtotalExactCents: vendor } });
}
test('authored unit bands use literal quantities and exact inclusive boundaries without supplier-derived customer math', () => {
  assert.equal(quote(2000, 0).customerTotalCents, 5);
  assert.equal(quote(1999.999999, 0).customerTotalCents, 0);
  assert.equal(quote(1000, 35000 / 3).customerTotalCents, 5);
  assert.equal(quote(4000, 0, price, 9).customerTotalCents, 10);
  assert.equal(quote(4000, 0, price, 1).customerTotalCents, 10);
  assert.throws(() => quote(6000, 0), (error: unknown) => error instanceof ManualTariffError && error.code === 'invalid_quantity');
  assert.throws(() => quote(4000, 0, price, 11), (error: unknown) => error instanceof ManualTariffError && error.code === 'below_cost');
});
test('invalid band order, range, amounts and units fail closed', () => {
  const candidates = [
    { ...price, divisor: 0 }, { ...price, maxUnits: Infinity }, { ...price, bands: [] },
    { ...price, bands: price.bands.slice(1) }, { ...price, bands: [...price.bands].reverse() },
    { ...price, bands: [price.bands[0], price.bands[1], price.bands[1]] },
    { ...price, bands: [{ minUnits: 0, customerCents: 0.5 }] },
    { ...price, bands: [{ minUnits: 0, customerCents: 10 }, { minUnits: 1, customerCents: 5 }] },
    { ...price, terms: [price.terms[0], price.terms[0]] },
    { ...price, maxUnits: 5 },
  ];
  for (const candidate of candidates) assert.throws(() => quote(4000, 0, candidate), ManualTariffError);
});
