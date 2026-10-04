import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCustomerTariffSeed } from '../frontend/server/pricing/customer-tariff-seed.ts';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';

const coverage = collectSellableManualTariffCoverage();
const scenarios = coverage.scenarios.slice(0, 3);
const baseline = { at: '2026-09-29T12:00:00.000Z', registryHash: 'reviewed-registry', databaseIdentity: 'reviewed-database',
  gaps: [], rows: scenarios.map((scenario, index) => ({ scenarioId: scenario.id, customerCents: 95 + index,
    currency: 'USD', policySource: 'database', ruleId: 'default' })) };

test('initial explicit tariffs copy the recorded customer cents without recalculating a margin', () => {
  const gaps = [{ modelId: 'fixture-model', reason: 'unresolved trusted input duration' }];
  const seed = buildCustomerTariffSeed({ baseline, scenarios, registryHash: baseline.registryHash, coverageGaps: gaps });
  assert.deepEqual(seed.cells.map((cell) => cell.price), [95, 96, 97].map((customerCents) => ({ kind: 'fixed', customerCents })));
  assert.deepEqual(seed.cells.map((cell) => cell.selector), scenarios.map((scenario) => scenario.selector));
  assert.equal(seed.activationReady, false);
  assert.equal(seed.coverageGapCount, 1);
});

test('stale registry, missing quotes, duplicates and invalid amounts reject the entire seed', () => {
  const input = { baseline, scenarios, registryHash: baseline.registryHash, coverageGaps: [] };
  assert.throws(() => buildCustomerTariffSeed({ ...input, registryHash: 'changed' }), /registry/i);
  assert.throws(() => buildCustomerTariffSeed({ ...input, baseline: { ...baseline, rows: baseline.rows.slice(1) } }), /coverage/i);
  assert.throws(() => buildCustomerTariffSeed({ ...input, baseline: { ...baseline, rows: [...baseline.rows, baseline.rows[0]!] } }), /duplicate/i);
  assert.throws(() => buildCustomerTariffSeed({ ...input, baseline: { ...baseline, rows: baseline.rows.map((row) => ({ ...row, customerCents: -1 })) } }), /amount/i);
});
