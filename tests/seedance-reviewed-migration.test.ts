import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { prepareReviewedSeedanceMigrationPrice } from '../frontend/server/pricing/seedance-reviewed-migration';
import { validateCurrentContinuousTariffDomain } from '../frontend/server/pricing/compile-current-continuous-tariff';

test('fresh migration uses the approved margin policy for BytePlus and retains other-route amounts', () => {
  const engine=getFalEngineById('seedance-2-5')!.engine;
  const scenario=buildManualTariffCoverageScenario({ engine:{ ...engine,providerMeta:{ ...engine.providerMeta,provider:'byteplus_modelark' } },
    mode:'v2v',durationSec:4,resolution:'480p',aspectRatio:'1:1',hasVideoInput:true,inputVideoDurationSec:2 },'reviewed');
  const prepared=prepareReviewedSeedanceMigrationPrice(scenario,35,selector=>{
    if(selector.mode==='t2v' && selector.billingInputType==='no_video_input')return 58;
    return undefined;
  },'2026-10-02T00:00:00Z');
  assert.equal(evaluateManualTariffPrice(prepared.price,{ input_video_seconds:2 }).customerTotalCents,61);
  assert.equal(evaluateManualTariffPrice(prepared.price,{ input_video_seconds:30 }).customerTotalCents,297);
  const fal={ ...scenario,context:{ ...scenario.context,engine:{ ...engine,providerMeta:{ ...engine.providerMeta,provider:'fal' } } } };
  const other=prepareReviewedSeedanceMigrationPrice(fal,999,()=>undefined,'2026-10-02T00:00:00Z');
  assert.equal(evaluateManualTariffPrice(other.price,{ input_video_seconds:30 }).customerTotalCents,999);
  assert.equal(validateCurrentContinuousTariffDomain({ context:fal.context,price:other.price }).maxInputSeconds,30);
});
