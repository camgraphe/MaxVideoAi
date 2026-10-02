import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { seedanceWorkflowScenarios } from '../frontend/lib/pricing-audit/seedance-workflow-scenarios';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { providerComparisonForTariffScenario } from '../frontend/server/pricing-admin/tariff-provider-comparison';

test('admin offers independent Draft/final cells with locked resolutions under the existing model', () => {
  const normal = collectSellableManualTariffCoverage().scenarios.filter(s => s.modelId === 'seedance-2-5');
  const workflows = seedanceWorkflowScenarios(normal);
  assert.ok(workflows.length > 0);
  assert.ok(workflows.every(s => s.modelId === 'seedance-2-5' && s.context.mode === 't2v'));
  assert.equal(new Set(workflows.map(s => s.id)).size, workflows.length);
  for (const [step, resolution] of [['draft', '480p'], ['final', '1080p']] as const) {
    const { scenario, choices } = chooseCustomerTariffScenario([...normal, ...workflows], {
      workflowStep: step, mode: 't2v', resolution, durationSec: '5', aspectRatio: '16:9',
    });
    assert.equal(scenario.context.workflowStep, step);
    assert.equal(scenario.context.resolution, resolution);
    assert.deepEqual(choices.find(c => c.key === 'resolution')?.options, [resolution]);
    assert.equal(providerComparisonForTariffScenario(scenario).step, step);
  }
  assert.equal(chooseCustomerTariffScenario([...normal, ...workflows], {}).scenario.context.workflowStep, undefined);
});
