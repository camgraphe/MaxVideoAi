import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousWan3TariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { compileWan3ContinuousTariffPrice } from '../frontend/server/pricing/wan3-continuous-tariff';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { resolvePricingPolicy } from '@maxvideoai/pricing';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { validateWan3ContinuousTariffDomain } from '../frontend/server/pricing/wan3-continuous-tariff-domain';

test('Wan mixed references share an authored source curve including no-video input, with exact overrides still separate', async () => {
  const document = getVersionedPricingPolicy();
  for (const modelId of ['wan-3', 'wan-3-prime']) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 'ref2v' as const, durationSec: 5, resolution: '720p', referenceImageCount: 1, hasVideoInput: false,
      addons: { audio: false, audio_off: true }, inputVideoDurationSec: 0 };
    const project = (seconds: number) => {
      const c = { ...context, inputVideoDurationSec: seconds, hasVideoInput: seconds > 0 };
      return { context: c, ...buildManualTariffScenario(c, buildBillingPricingFacts(c, engine.pricingDetails, 'USD').facts) };
    };
    const selector = continuousWan3TariffSelector(project(0).selector);
    assert.ok(selector);
    assert.deepEqual(selector, continuousWan3TariffSelector(project(3.25).selector));
    assert.equal(project(0).quantities.input_video_seconds, 0);
    const policy = resolvePricingPolicy({ scenario: { engineId: modelId, mode: context.mode, resolution: context.resolution },
      versionedRules: document.rules, databaseRules: [] });
    const price = compileWan3ContinuousTariffPrice({ context, policy, compatibilityProfile: document.compatibilityProfiles.find(p => p.id === 'standard')! });
    assert.ok(validateWan3ContinuousTariffDomain({ context, price }).checkedBoundaries > 2);
    for (const seconds of [0, Number.MIN_VALUE, 0.00005, 3.25, 15]) {
      const selected = project(seconds);
      const current = await computeCanonicalBillingSnapshot(selected.context, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) } });
      assert.equal(evaluateManualTariffPrice(price, selected.quantities).customerTotalCents, current.totalCents);
      const publicScenario = resolvePublicModelScenario({ modelId, mode: 'ref2v', resolution: '720p', durationSec: 5,
        referenceImageCount: 1, audio: false, inputVideoDurationSec: seconds });
      assert.ok(publicScenario);
      assert.deepEqual(publicScenario.selector, selected.selector);
    }
    const rows = collectSellableManualTariffCoverage().scenarios.filter(row => row.modelId === modelId);
    const detail = chooseCustomerTariffScenario(rows, { mode: 'ref2v', durationSec: '5', resolution: '720p', audio: 'false', inputVideoDurationSec: '3.25' });
    assert.equal(detail.scenario.selector.inputVideoDurationSec, '3.25');
    assert.equal(detail.choices.find(choice => choice.key === 'inputVideoDurationSec')?.range?.minInclusive, 0);
    assert.equal(chooseCustomerTariffScenario(rows, { mode: 'ref2v', durationSec: '5', resolution: '720p', audio: 'false' }).scenario.context.inputVideoDurationSec, 0);
    assert.ok(resolvePublicModelScenario({ modelId, mode: 'ref2v', resolution: '720p', durationSec: 5, referenceImageCount: 1, audio: false }));
    // IEEE addition also admits a subnormal source at the 30-second output boundary.
    const boundaryContext = { ...context, durationSec: 30, inputVideoDurationSec: Number.MIN_VALUE, hasVideoInput: true };
    assert.ok(continuousWan3TariffSelector(buildManualTariffScenario(boundaryContext,
      buildBillingPricingFacts(boundaryContext, engine.pricingDetails, 'USD').facts).selector));
    const boundaryPrice = compileWan3ContinuousTariffPrice({ context: boundaryContext, policy,
      compatibilityProfile: document.compatibilityProfiles.find(p => p.id === 'standard')! });
    assert.equal(validateWan3ContinuousTariffDomain({ context: boundaryContext, price: boundaryPrice }).minimumGrossCents >= 0, true);
  }
});
