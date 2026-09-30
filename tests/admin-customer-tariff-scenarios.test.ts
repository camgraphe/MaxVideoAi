import assert from 'node:assert/strict';
import test from 'node:test';

import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service.ts';
import { expandAdminTariffReferenceOptions } from '../frontend/server/pricing-admin/customer-tariff-options.ts';
import { catalogSupplierReference } from '../frontend/server/pricing-admin/catalog-supplier-reference.ts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario.ts';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts.ts';

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

test('bounded priced references retain model-specific counts and exact provider facts', () => {
  const coverage = collectSellableManualTariffCoverage().scenarios;
  for (const [modelId, mode, firstCount, nextCount, expectedExtra] of [
    ['gpt-image-2-5-flare', 'i2i', '1', '2', 0.008],
    ['luma-uni-1', 'i2i', '0', '1', 0.003],
    ['luma-uni-1-max', 't2i', '0', '1', 0.003],
    ['minimax-h3', 'ref2v', '5', '6', 0.08],
  ] as const) {
    const base = coverage.filter(row => row.modelId === modelId);
    const captured = JSON.stringify(base);
    const expanded = expandAdminTariffReferenceOptions(base);
    const initial = chooseCustomerTariffScenario(expanded, { mode, referenceImageCount: firstCount });
    const changed = chooseCustomerTariffScenario(expanded, { ...initial.scenario.selector, referenceImageCount: nextCount });
    assert.equal(changed.scenario.selector.referenceImageCount, nextCount);
    assert.equal(changed.scenario.context.referenceImageCount, Number(nextCount));
    const facts = buildBillingPricingFacts(changed.scenario.context, changed.scenario.context.engine.pricingDetails, 'USD').facts;
    assert.deepEqual(changed.scenario.selector, buildManualTariffScenario(changed.scenario.context, facts).selector,
      'admin-authored tariff cells must use the same identity as billing');
    assert.notEqual(changed.scenario.id, initial.scenario.id);
    assert.ok(Math.abs(catalogSupplierReference(changed.scenario.context)!.amountUsd
      - catalogSupplierReference(initial.scenario.context)!.amountUsd - expectedExtra) < 1e-9);
    const max = modelId.startsWith('gpt-') ? '16' : modelId.startsWith('luma-') && mode === 'i2i' ? '8' : '9';
    assert.equal(initial.choices.find(choice => choice.key === 'referenceImageCount')?.options.at(-1), max);
    assert.equal(JSON.stringify(base), captured, 'the captured baseline is not mutated');
  }
});
