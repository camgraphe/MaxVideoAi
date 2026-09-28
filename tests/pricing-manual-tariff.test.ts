import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditManualTariffParity,
  ManualTariffError,
  quoteCanonicalManualTariff,
  resolveManualTariffCell,
  type ManualTariffCell,
} from '../packages/pricing/src/manual-tariff';

const selector = { engineId: 'seedance-2-5', mode: 't2v', resolution: '720p', inputClass: 'no_video', step: 'normal' };
const versioned: ManualTariffCell = {
  id: 'seedance25-720-t2v', selector, source: 'versioned', version: 1,
  currency: 'USD', effectiveFrom: '2026-09-28T00:00:00Z',
  price: { kind: 'unit_terms', rounding: 'up', terms: [{ unit: '1000_tokens', centsPerUnit: 2 }] },
};

test('an exact manual tariff overrides neither supplier facts nor a percentage rule', () => {
  const quote = quoteCanonicalManualTariff({
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    scenarioId: 'seedance25-720-5s', selector,
    quantities: { '1000_tokens': 100 },
    at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [],
  });
  assert.equal(quote.customerTotalCents, 200);
  assert.equal(quote.vendorSubtotalCents, 81);
  assert.equal(quote.platformFeeCents, 119);
  assert.equal(quote.breakdown.vendorSubtotalExactCents, 80.4);
  assert.equal(quote.pricingMode, 'manual_tariff');
  assert.equal(quote.policyProvenance.sourceRuleId, versioned.id);
  assert.deepEqual(quote.manualTariff, { cellId: versioned.id, kind: 'unit_terms', exactCustomerCents: 200,
    units: [{ unit: '1000_tokens', quantity: 100, centsPerUnit: 2 }] });
});

test('image output and paid references are independent authored customer units', () => {
  const imageSelector = { engineId: 'seedream-5-0-pro', mode: 'i2i', pixelTier: 'above_2610000' };
  const cell: ManualTariffCell = { ...versioned, id: 'seedream-pro-large', selector: imageSelector,
    price: { kind: 'unit_terms', rounding: 'up', terms: [
      { unit: 'successful_output', centsPerUnit: 18 },
      { unit: 'additional_reference', centsPerUnit: 1.5 },
    ] } };
  const quote = quoteCanonicalManualTariff({
    facts: { engineId: imageSelector.engineId, currency: 'USD', vendorSubtotalExactCents: 9.6, unit: 'image', quantity: 1 },
    scenarioId: 'seedream-pro-i2i-large', selector: imageSelector,
    quantities: { successful_output: 1, additional_reference: 2 },
    at: '2026-09-29T12:00:00Z', versionedCells: [cell], databaseCells: [],
  });
  assert.equal(quote.customerTotalCents, 21);
  assert.equal(quote.vendorSubtotalCents, 10);
  assert.equal(quote.platformFeeCents, 11);
  assert.equal(quote.manualTariff.exactCustomerCents, 21);
});

test('a precise database cell takes precedence without changing the supplier cost', () => {
  const database: ManualTariffCell = { ...versioned, id: 'override', source: 'database', version: 2,
    price: { kind: 'fixed', customerCents: 250 } };
  const quote = quoteCanonicalManualTariff({
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    scenarioId: 'seedance25-720-5s', selector, quantities: {},
    at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [database],
  });
  assert.equal(quote.customerTotalCents, 250);
  assert.equal(quote.policyProvenance.source, 'database');
});

test('missing, expired, ambiguous and incomplete cells fail closed', () => {
  const resolve = (cells: ManualTariffCell[], at = '2026-09-29T12:00:00Z') =>
    resolveManualTariffCell({ selector, at, versionedCells: cells, databaseCells: [] });
  assert.throws(() => resolve([]), (error: unknown) => error instanceof ManualTariffError && error.code === 'missing_cell');
  assert.throws(() => resolve([{ ...versioned, effectiveUntil: '2026-09-29T12:00:00Z' }]),
    (error: unknown) => error instanceof ManualTariffError && error.code === 'missing_cell');
  assert.throws(() => resolve([versioned], '2026-09-27T23:59:59Z'),
    (error: unknown) => error instanceof ManualTariffError && error.code === 'missing_cell');
  assert.equal(resolve([versioned], '2026-09-28T00:00:00Z').id, versioned.id);
  assert.throws(() => resolve([versioned, { ...versioned, id: 'duplicate' }]),
    (error: unknown) => error instanceof ManualTariffError && error.code === 'ambiguous_cell');
  assert.throws(() => resolve([{ ...versioned, selector: { engineId: 'seedance-2-5' } }]),
    (error: unknown) => error instanceof ManualTariffError && error.code === 'missing_cell');
  assert.throws(() => quoteCanonicalManualTariff({
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    scenarioId: 'seedance25-720-5s', selector, quantities: {},
    at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [],
  }), (error: unknown) => error instanceof ManualTariffError && error.code === 'invalid_quantity');
  assert.throws(() => quoteCanonicalManualTariff({
    facts: { engineId: 'seedance-2-5', currency: 'EUR', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    scenarioId: 'seedance25-720-5s', selector, quantities: { '1000_tokens': 100 },
    at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [],
  }), (error: unknown) => error instanceof ManualTariffError && error.code === 'invalid_cell');
});

test('below-cost customer tariffs require a separate policy before activation', () => {
  const lossLeader: ManualTariffCell = { ...versioned, price: { kind: 'fixed', customerCents: 70 } };
  assert.throws(() => quoteCanonicalManualTariff({
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    scenarioId: 'seedance25-720-5s', selector, quantities: {},
    at: '2026-09-29T12:00:00Z', versionedCells: [lossLeader], databaseCells: [],
  }), (error: unknown) => error instanceof ManualTariffError && error.code === 'below_cost');
});

test('manual tariff parity audit blocks missing cells and changed customer totals', () => {
  assert.equal(typeof auditManualTariffParity, 'function');
  const base = {
    scenarioId: 'seedance25-720-5s', selector,
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    quantities: { '1000_tokens': 100 }, currentCustomerCents: 200,
  };
  const report = auditManualTariffParity({
    scenarios: [base, { ...base, scenarioId: 'another-mode', selector: { ...selector, mode: 'i2v' } },
      { ...base, scenarioId: 'different-total', currentCustomerCents: 201 }],
    at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [],
  });
  assert.equal(report.ready, false);
  assert.equal(report.checkedScenarios, 3);
  assert.deepEqual(report.issues.map((issue) => [issue.scenarioId, issue.code]), [
    ['another-mode', 'missing_cell'], ['different-total', 'customer_price_mismatch'],
  ]);
  assert.equal(report.issues[1]?.currentCustomerCents, 201);
  assert.equal(report.issues[1]?.manualCustomerCents, 200);
});

test('manual tariff parity audit refuses an empty or duplicate scenario matrix', () => {
  const base = {
    scenarioId: 'same-id', selector,
    facts: { engineId: 'seedance-2-5', currency: 'USD', vendorSubtotalExactCents: 80.4, unit: 'sec', quantity: 5 },
    quantities: { '1000_tokens': 100 }, currentCustomerCents: 200,
  };
  const input = { at: '2026-09-29T12:00:00Z', versionedCells: [versioned], databaseCells: [] };
  const empty = auditManualTariffParity({ ...input, scenarios: [] });
  assert.equal(empty.ready, false);
  assert.deepEqual(empty.issues.map((issue) => issue.code), ['empty_matrix']);
  const duplicate = auditManualTariffParity({ ...input, scenarios: [base, base] });
  assert.equal(duplicate.ready, false);
  assert.deepEqual(duplicate.issues.map((issue) => issue.code), ['duplicate_scenario']);
});
