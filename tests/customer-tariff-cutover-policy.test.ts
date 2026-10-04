import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { compileCurrentContinuousTariffPrice,validateCurrentContinuousTariffDomain } from '../frontend/server/pricing/compile-current-continuous-tariff';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { assertReviewedCustomerTariffCutoverPolicy } from '../frontend/server/pricing/customer-tariff-cutover-policy';
import type { CustomerTariffCutoverRelease } from '../frontend/server/pricing/customer-tariff-cutover-evidence';
import { ENV } from '../frontend/src/lib/env';
import { prepareReviewedSeedanceMigrationPrice } from '../frontend/server/pricing/seedance-reviewed-migration';

const policy = { status: 'loaded' as const,rules: [{ id: 'default',marginPercent: .3,marginFlatCents: 0,
  surchargeAudioPercent: 0,surchargeUpscalePercent: 0,currency: 'USD' }] };
const inactive = { status: 'loaded' as const,active: false,revision: 0,databaseCells: [],versionedCells: [] };
const partial = (cells: CustomerTariffCutoverRelease['cells'],checkpoints: CustomerTariffCutoverRelease['checkpoints']) => ({
  cells,checkpoints,capturedAt: new Date().toISOString(),approvedChanges: [],
} as unknown as CustomerTariffCutoverRelease);

test('a cost-safe unapproved Wan fractional band change is refused despite unchanged integer checkpoint cents', async () => {
  const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('wan-3')!.engine,mode: 'ref2v',
    resolution: '480p',durationSec: 5,aspectRatio: '16:9',inputVideoDurationSec: 0 },'review-regression');
  const price = await compileCurrentContinuousTariffPrice(scenario,policy);
  assert.equal(price.kind,'unit_bands');
  if (price.kind !== 'unit_bands') throw new Error('Expected bounded bands');
  const changed = structuredClone(price);
  changed.bands[1].minUnits = 0.04995;
  assert.equal(evaluateManualTariffPrice(price,{ input_video_seconds: 0.04995 }).customerTotalCents,33);
  assert.equal(evaluateManualTariffPrice(changed,{ input_video_seconds: 0.04995 }).customerTotalCents,34);
  for (let seconds=0;seconds<=15;seconds++) assert.equal(
    evaluateManualTariffPrice(price,{ input_video_seconds: seconds }).customerTotalCents,
    evaluateManualTariffPrice(changed,{ input_video_seconds: seconds }).customerTotalCents);
  assert.ok(validateCurrentContinuousTariffDomain({ context: scenario.context,price: changed }).minimumGrossCents >= 0);
  const before = (await computeCanonicalBillingSnapshot(scenario.context,{ pricingPolicy: { loadOverrides: async () => policy },
    loadCustomerTariffState: async () => inactive })).totalCents;
  const release = partial([{ id: 'changed',selector: continuousInputTariffSelector(scenario.selector)!,price: changed,currency: 'USD' }],
    [{ key: `ordinary:${scenario.id}`,beforeCents: before,customerCents: before,currency: 'USD' }]);
  await assert.rejects(assertReviewedCustomerTariffCutoverPolicy({ scenarios: [scenario],release,policy }), /continuous.*reviewed|curve.*changed/i);
  release.cells[0].price = price;
  await assertReviewedCustomerTariffCutoverPolicy({ scenarios: [scenario],release,policy });
});

test('an inflated proportional Seedance rate cannot exceed the captured positive variant margin policy', async () => {
  const beforeRoute = ENV.SEEDANCE_2_PROVIDER;
  ENV.SEEDANCE_2_PROVIDER = 'byteplus_modelark';
  try {
    const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('seedance-2-0')!.engine,mode: 'ref2v',
      resolution: '480p',durationSec: 4,aspectRatio: '16:9',inputVideoDurationSec: 2,hasVideoInput: true },'review-regression');
    assert.notEqual(scenario.context.engine.providerMeta?.provider,'fal');
    const price = prepareReviewedSeedanceMigrationPrice(scenario,68,() => undefined,new Date().toISOString()).price;
    assert.equal(price.kind,'unit_components');
    if (price.kind !== 'unit_components') throw new Error('Expected proportional components');
    const inflated = structuredClone(price);
    inflated.components[0].flatCents *= 2;
    inflated.components[0].terms[0].centsPerUnit *= 2;
    const release = partial([{ id: 'inflated',selector: continuousInputTariffSelector(scenario.selector)!,price: inflated,currency: 'USD' }],
      [{ key: `ordinary:${scenario.id}`,beforeCents: 68,customerCents: 136,currency: 'USD' }]);
    await assert.rejects(assertReviewedCustomerTariffCutoverPolicy({ scenarios: [scenario],release,policy }), /margin policy|curve.*changed/i);
    release.cells[0].price = price;
    release.checkpoints[0].customerCents = 68;
    await assertReviewedCustomerTariffCutoverPolicy({ scenarios: [scenario],release,policy });
  } finally { ENV.SEEDANCE_2_PROVIDER = beforeRoute; }
});

test('an additional eligible GPT +1 cent is refused when the original amount already equals the reference ceiling', async () => {
  const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('gpt-image-2-5-flare')!.engine,
    mode: 'i2i',resolution: '1024x768',durationSec: 1,quality: 'low',referenceImageCount: 1,
    customImageSize: { width: 1024,height: 768 } },'review-regression');
  const before = (await computeCanonicalBillingSnapshot(scenario.context,{ pricingPolicy: { loadOverrides: async () => policy },
    loadCustomerTariffState: async () => inactive })).totalCents;
  assert.equal(before,2);
  const release = partial([{ id: 'extra-floor',selector: scenario.selector,price: { kind: 'fixed',customerCents: before + 1 },currency: 'USD' }],
    [{ key: `ordinary:${scenario.id}`,beforeCents: before,customerCents: before + 1,currency: 'USD' }]);
  await assert.rejects(assertReviewedCustomerTariffCutoverPolicy({ scenarios: [scenario],release,policy }), /reference.*ceiling|approved.*floor/i);
});
