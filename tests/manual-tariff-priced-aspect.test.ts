import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildGenerateRequestOptions } from '../frontend/app/api/generate/_lib/request-options';
import { isSeedance2TokenPricing } from '../frontend/src/lib/seedance-2-pricing';

test('every current factual owner that omits aspect bills identical amounts for its supported orientations', () => {
  const coverage = collectSellableManualTariffCoverage();
  const visited = new Set<string>();
  for (const scenario of coverage.scenarios) {
    const entry = getFalEngineById(scenario.modelId)!;
    if (isSeedance2TokenPricing(entry.engine.pricingDetails)) continue;
    const key = JSON.stringify({ ...scenario.selector, aspectRatio: undefined });
    if (visited.has(key)) continue;
    visited.add(key);
    const modes = entry.modes.find(mode => mode.mode === scenario.context.mode)!;
    const aspects = modes.ui.aspectRatio?.length ? modes.ui.aspectRatio : entry.engine.aspectRatios;
    const original = buildBillingPricingFacts(scenario.context, entry.engine.pricingDetails, 'USD').facts;
    assert.equal(original.metadata?.manualTariffAspectRatio, null);
    for (const aspectRatio of aspects) {
      const context = { ...scenario.context, aspectRatio };
      const facts = buildBillingPricingFacts(context, entry.engine.pricingDetails, 'USD').facts;
      assert.equal(facts.vendorSubtotalExactCents, original.vendorSubtotalExactCents, `${key}/${aspectRatio}`);
      assert.deepEqual(buildManualTariffScenario(context, facts).selector, scenario.selector);
    }
  }
  assert.ok(visited.size > 1000, 'assert actual option combinations, not only representative rows');
});

test('only priced aspect dimensions create separate tariffs; auto and orientation retain their requested quote context', async () => {
  for (const [modelId, mode, resolution] of [['wan-3', 't2v', '720p'], ['nano-banana-2', 't2i', '1k'], ['seedream', 't2i', '2K']] as const) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode, resolution, durationSec: mode === 't2i' ? 1 : 5, aspectRatio: '16:9',
      ...(mode === 't2v' ? { addons: { audio: false, audio_off: true } } : {}) };
    const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector;
    assert.equal(selector.aspectRatio, undefined, `${modelId} does not bill orientation`);
    for (const aspectRatio of ['16:9', '9:16', 'auto']) {
      const selected = { ...context, aspectRatio };
      assert.deepEqual(buildManualTariffScenario(selected, buildBillingPricingFacts(selected, engine.pricingDetails, 'USD').facts).selector, selector);
      const publicScenario = resolvePublicModelScenario({ modelId, mode, resolution, durationSec: context.durationSec, aspectRatio });
      assert.ok(publicScenario, `${modelId}/${aspectRatio}`);
      assert.equal(publicScenario.context.aspectRatio, aspectRatio);
      const quote = await computeCanonicalBillingSnapshot(publicScenario.context, {
        pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
        loadCustomerTariffState: async () => ({ status: 'loaded', active: true, revision: 31, databaseCells: [], versionedCells: [{
          id: 'orientation-independent', selector, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00Z',
          price: { kind: 'fixed', customerCents: 999 },
        }] }),
      });
      assert.equal(quote.totalCents, 999);
    }
    assert.equal(resolvePublicModelScenario({ modelId, mode, resolution, durationSec: context.durationSec, aspectRatio: 'bogus' }), null);
  }
});

test('token-priced Seedance aliases use the actual billed dimensions, including inherited i2v aspect', () => {
  for (const modelId of ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'seedance-2-5']) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 't2v' as const, resolution: '720p', durationSec: 5, aspectRatio: '16:9' };
    const project = (aspectRatio: string | null) => buildManualTariffScenario({ ...context, aspectRatio },
      buildBillingPricingFacts({ ...context, aspectRatio }, engine.pricingDetails, 'USD').facts).selector;
    assert.deepEqual(project('auto'), project(null));
    assert.deepEqual(project(null), project(engine.pricingDetails!.tokenPricing!.defaultAspectRatio!));
    assert.notDeepEqual(project('1:1'), project('16:9'));
  }
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const normalized = buildGenerateRequestOptions({ engine, mode: 'i2v', isBytePlusV1a: true,
    body: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' } });
  assert.ok(normalized.ok);
  assert.equal(normalized.options.aspectRatio, null);
  const context = { engine, mode: 'i2v' as const, resolution: normalized.options.pricingResolution,
    durationSec: normalized.options.durationSec, aspectRatio: normalized.options.aspectRatio, inputImageCount: 1, hasVideoInput: false,
    addons: { audio: normalized.options.audioEnabled ?? false, ...(!normalized.options.audioEnabled ? { audio_off: true } : {}) } };
  const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector;
  assert.equal(selector.aspectRatio, '16:9');
  assert.ok(collectSellableManualTariffCoverage().scenarios.some(row => JSON.stringify(row.selector) === JSON.stringify(selector)), JSON.stringify(selector));
});

test('the collector closes auto-aspect identities through reviewed factual projections with one cell per selector', () => {
  const coverage = collectSellableManualTariffCoverage();
  assert.equal(coverage.gaps.filter(gap => gap.reason.includes('auto aspect')).length, 0);
  assert.equal(new Set(coverage.scenarios.map(s => s.id)).size, coverage.scenarios.length);
});
