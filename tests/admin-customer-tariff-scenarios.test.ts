import assert from 'node:assert/strict';
import test from 'node:test';

import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service.ts';

test('tariff scenario controls resolve exact options without shipping the full price matrix to the browser', () => {
  const scenarios = collectSellableManualTariffCoverage().scenarios.filter((row) => row.modelId === 'seedance-2-0-mini');
  const initial = chooseCustomerTariffScenario(scenarios, {
    mode: 't2v', resolution: '720p', durationSec: '5', aspectRatio: '16:9', audio: 'false',
  });
  assert.equal(initial.scenario.selector.mode, 't2v');
  assert.equal(initial.scenario.selector.durationSec, '5');
  assert.ok(initial.choices.find((choice) => choice.key === 'mode')?.options.includes('i2v'));
  const changed = chooseCustomerTariffScenario(scenarios, { ...initial.scenario.selector, mode: 'i2v' });
  assert.equal(changed.scenario.selector.mode, 'i2v');
  assert.notEqual(changed.scenario.id, initial.scenario.id);
});
