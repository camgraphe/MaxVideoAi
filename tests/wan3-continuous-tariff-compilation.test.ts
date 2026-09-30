import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePricingPolicy, quoteCanonicalManualTariff } from '@maxvideoai/pricing';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { getVersionedPricingPolicy } from '../frontend/src/lib/pricing-policy-defaults';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { continuousWan3TariffSelector, buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { compileWan3ContinuousTariffPrice } from '../frontend/server/pricing/wan3-continuous-tariff';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import { adjacentNonnegativeDouble } from '../frontend/server/pricing/pricing-number-boundaries';

const document = getVersionedPricingPolicy();
const profile = document.compatibilityProfiles.find(p => p.id === 'standard')!;

test('offline compilation freezes current absolute unit terms with cent parity across source boundaries and effective overrides', async () => {
  for (const modelId of ['wan-3', 'wan-3-prime']) for (const mode of ['v2v', 'extend'] as const)
    for (const resolution of ['480p', '720p', '1080p']) for (const durationSec of [2, 5, 29]) for (const margin of [0, 0.17, 0.3, 2.49]) {
      const engine = getFalEngineById(modelId)!.engine;
      const context = { engine, mode, resolution, durationSec, aspectRatio: '16:9', inputVideoDurationSec: 0.75 };
      const rule = { ...document.rules[0], id: 'effective-override', engineId: modelId, mode, resolution, marginPercent: margin, marginFlatCents: 3 };
      const policy = resolvePricingPolicy({ scenario: { engineId: modelId, mode, resolution }, databaseRules: [rule], versionedRules: document.rules });
      const price = compileWan3ContinuousTariffPrice({ context, policy, compatibilityProfile: profile });
      const selector = continuousWan3TariffSelector(buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector)!;
      assert.equal(price.kind, 'unit_bands');
      assert.ok(!JSON.stringify(price).includes('marginPercent'));
      const max = Math.min(15, 30 - durationSec);
      for (const seconds of [Number.MIN_VALUE, 0.000016, 0.00005, 0.333333, 0.75, max - 0.00001, max]) {
        const selected = { ...context, inputVideoDurationSec: seconds };
        const facts = buildBillingPricingFacts(selected, engine.pricingDetails, 'USD').facts;
        const current = await computeCanonicalBillingSnapshot(selected, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [rule] }) } });
        const next = quoteCanonicalManualTariff({ facts, selector, quantities: { input_video_seconds: seconds },
          scenarioId: 'continuous', at: '2026-09-30T12:00:00Z', databaseCells: [], versionedCells: [{
            id: 'frozen', selector, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00Z', price,
          }] });
        assert.equal(next.customerTotalCents, current.totalCents, `${modelId}/${mode}/${resolution}/${durationSec}/${margin}/${seconds}`);
      }
    }
});

test('offline compiler refuses an unreviewed compatibility profile or unsupported model instead of approximating', () => {
  const context = { engine: getFalEngineById('wan-3')!.engine, mode: 'v2v' as const, durationSec: 5, resolution: '720p', inputVideoDurationSec: 3.25 };
  const policy = resolvePricingPolicy({ scenario: { engineId: context.engine.id, mode: context.mode, resolution: context.resolution }, databaseRules: [], versionedRules: document.rules });
  for (const compatibilityProfile of [{ ...profile, subtotalRounding: 'up' as const }, { ...profile, vendorSubtotalRounding: 'up' as const }, { ...profile, discountPercentOverride: 0.2 }]) {
    assert.throws(() => compileWan3ContinuousTariffPrice({ context, policy, compatibilityProfile }), /unsupported|reviewed/i);
  }
  assert.throws(() => compileWan3ContinuousTariffPrice({ context: { ...context, engine: getFalEngineById('pika-text-to-video')!.engine }, policy, compatibilityProfile: profile }), /unsupported|Wan/i);
});

test('preservation retains actual Wan source rounding at adjacent decimal boundaries', async () => {
  const engine = getFalEngineById('wan-3')!.engine;
  const context = { engine, mode: 'ref2v' as const, resolution: '480p', durationSec: 5, inputVideoDurationSec: 3.4999 };
  const rule = { ...document.rules[0], id: 'effective', marginPercent: 0.3 };
  const policy = resolvePricingPolicy({ scenario: { engineId: engine.id, mode: 'ref2v', resolution: '480p' }, databaseRules: [rule], versionedRules: document.rules });
  const price = compileWan3ContinuousTariffPrice({ context, policy, compatibilityProfile: profile });
  assert.equal(price.kind, 'unit_bands');
  if (price.kind !== 'unit_bands') throw new Error('Expected frozen source-second bands');
  const at = '2026-09-30T00:00:00Z';
  for (const seconds of [0.8998999999999999, 3.4999, 5.0001]) {
    const selected = { ...context, inputVideoDurationSec: seconds };
    const facts = buildBillingPricingFacts(selected, engine.pricingDetails, 'USD').facts;
    const selector = continuousWan3TariffSelector(buildManualTariffScenario(selected, facts).selector)!;
    const frozen = quoteCanonicalManualTariff({ facts, selector, scenarioId: 'boundary', quantities: { input_video_seconds: seconds }, at,
      databaseCells: [], versionedCells: [{ id: 'frozen', selector, price, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: at }] });
    const current = await computeCanonicalBillingSnapshot(selected, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [rule] }) } });
    assert.equal(frozen.customerTotalCents, current.totalCents, `source=${seconds}`);
  }
  for (const band of price.bands.slice(1)) for (const seconds of [adjacentNonnegativeDouble(band.minUnits, 'previous'), band.minUnits]) {
    const current = await computeCanonicalBillingSnapshot({ ...context, inputVideoDurationSec: seconds },
      { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [rule] }) } });
    assert.equal(evaluateManualTariffPrice(price, { input_video_seconds: seconds }).customerTotalCents, current.totalCents);
  }
});
