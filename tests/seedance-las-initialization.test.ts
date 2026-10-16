import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { auditReviewedCustomerTariffSeed } from '../frontend/server/pricing/customer-tariff-reviewed-seed';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';

test('initial authoring requires the separate reviewed LAS policy and retains its captured historical cents', async () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const scenario = buildManualTariffCoverageScenario({ engine, mode: 'v2v', durationSec: 4, resolution: '480p',
    aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 2 }, 'las-initial');
  const policy = { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: .3, marginFlatCents: 0,
    surchargeAudioPercent: .2, surchargeUpscalePercent: .5, currency: 'USD' }] };
  const baseline = { at: new Date().toISOString(), registryHash: 'fixture', databaseIdentity: 'fixture', gaps: [],
    databaseRulesHash: createHash('sha256').update(JSON.stringify(policy.rules)).digest('hex'), rows: [{ scenarioId: scenario.id,
      customerCents: 62, currency: 'USD', policySource: 'database', ruleId: 'default' }] };
  const input = { baseline, policy, registryHash: 'fixture', coverageGaps: [], scenarios: [scenario],
    approvedSeedanceMarginPolicy: 'preserve_positive_variant_margin' as const };
  await assert.rejects(auditReviewedCustomerTariffSeed(input), /explicit.*LAS|LAS.*approval/i);
  const approved = await auditReviewedCustomerTariffSeed({ ...input, approvedSeedanceLasPolicy: 'reviewed_2_5x_las_list' });
  assert.equal(approved.checkedScenarios, 1);
  assert.equal(approved.cells.length, 1);
  assert.equal(evaluateManualTariffPrice(approved.cells[0].price, { input_video_seconds: 2 }).customerTotalCents, 185);
  assert.equal(evaluateManualTariffPrice(approved.cells[0].price, { input_video_seconds: 30 }).customerTotalCents, 1046);
  assert.equal(approved.seedanceLasPriceChanges[0].currentCustomerCents, 62);
  assert.equal(baseline.rows[0].customerCents, 62);
});
