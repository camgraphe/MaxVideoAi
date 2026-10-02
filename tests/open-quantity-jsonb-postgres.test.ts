import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { compileCurrentContinuousTariffPrice, validateCurrentContinuousTariffDomain } from '../frontend/server/pricing/compile-current-continuous-tariff';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { startDisposablePostgres } from './helpers/disposable-postgres';

test('open quantity guards accept PostgreSQL JSONB normalization without changing rates or ordered steps', async () => {
  const database = await startDisposablePostgres('open-jsonb');
  const policy = { status: 'loaded' as const, rules: [{ id: 'default', currency: 'USD', marginPercent: .3,
    marginFlatCents: 0, surchargeAudioPercent: .2, surchargeUpscalePercent: .5 }] };
  try {
    for (const modelId of ['lumaRay2', 'lumaRay2_flash', 'minimax-h3-max']) {
      const tokens = modelId === 'minimax-h3-max';
      const context = { engine: getFalEngineById(modelId)!.engine, mode: tokens ? 'ref2v' as const : 'v2v' as const,
        durationSec: 5, resolution: tokens ? '768P' : '720p', ...(tokens ? { referenceTokenBudget: 9096 } : {}) };
      const scenario = buildManualTariffCoverageScenario(context, 'jsonb');
      const authored = await compileCurrentContinuousTariffPrice(scenario, policy);
      const stored = (await database.pool.query('SELECT $1::jsonb AS price', [JSON.stringify(authored)])).rows[0].price;
      assert.notEqual(JSON.stringify(stored), JSON.stringify(authored), 'PostgreSQL changes object key order');
      assert.deepEqual(stored, authored);
      assert.equal(validateCurrentContinuousTariffDomain({ context, price: stored }).unbounded, true);
      for (const quantity of tokens ? [0, 4096, 4097, 9096, 2251799813685250] : [1, 7, 131, 1000, 562949953421263]) {
        const units = { [tokens ? 'reference_tokens' : 'output_seconds']: quantity };
        assert.deepEqual(evaluateManualTariffPrice(stored, units), evaluateManualTariffPrice(authored, units));
      }
      for (const alteration of ['denominator', 'step_order', 'step_value', 'unknown_field']) {
        const altered = structuredClone(stored);
        const normalization = altered.components[0].terms[0].quantityNormalization;
        if (alteration === 'denominator') normalization.denominator *= 2;
        if (alteration === 'step_order') normalization.steps.reverse();
        if (alteration === 'step_value') normalization.steps[0].amount *= 2;
        if (alteration === 'unknown_field') normalization.unreviewed = true;
        assert.throws(() => validateCurrentContinuousTariffDomain({ context, price: altered }), /rounding/i,
          `${modelId}/${alteration} remains outside the native normalization`);
      }
    }
  } finally { await database.cleanup(); }
});
