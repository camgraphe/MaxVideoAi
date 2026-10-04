import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';

test('tariff duration and output units use the factual billed duration, retaining requested timing', () => {
  for (const modelId of ['flux-3', 'flux-3-draft', 'ltx-2-5-fast', 'ltx-2-5-pro']) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 't2v' as const, durationSec: 4, durationOption: 'auto', resolution: engine.resolutions[0]! };
    const facts = buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts;
    const scenario = buildManualTariffScenario(context, facts);
    assert.equal(scenario.selector.durationSec, String(facts.quantity), modelId);
    assert.equal(scenario.quantities.output_seconds, facts.quantity);
    assert.equal(context.durationSec, 4);
    assert.equal(context.durationOption, 'auto');
  }
  const engine = getFalEngineById('gemini-omni-flash')!.engine;
  const context = { engine, mode: 'v2v' as const, durationSec: 10, resolution: '720p', inputVideoDurationSec: 3.25, inheritedDurationSec: 3.25 };
  const facts = buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts;
  assert.equal(buildManualTariffScenario(context, facts).selector.durationSec, '3.25');
});

test('automatic timing covers every normalized integer price class without changing explicit public duration support', () => {
  const coverage = collectSellableManualTariffCoverage();
  const keys = new Set(coverage.scenarios.map(row => row.id));
  for (const modelId of ['flux-3', 'flux-3-draft', 'ltx-2-5-fast', 'ltx-2-5-pro', 'seedance-2-0', 'seedance-2-0-fast']) {
    const entry = getFalEngineById(modelId)!;
    for (const mode of entry.modes.filter(mode => mode.ui.duration && 'options' in mode.ui.duration && mode.ui.duration.options.includes('auto'))) {
      const base = coverage.scenarios.find(row => row.modelId === modelId && row.context.mode === mode.mode)!;
      for (let durationSec = 1; durationSec <= entry.engine.maxDurationSec; durationSec++) {
        // Seedance's request owner rejects numeric durations outside its published range, even with auto.
        if (modelId.startsWith('seedance') && durationSec < 4) continue;
        const context = { ...base.context, durationSec, durationOption: 'auto' };
        const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
        const selector = buildManualTariffScenario(context, facts).selector;
        const key = Object.entries(selector).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('|');
        assert.ok(keys.has(key), key);
      }
      assert.ok(!coverage.gaps.some(gap => gap.modelId === modelId && gap.reason.startsWith(`${mode.mode}: nonnumeric`)));
    }
  }
  const input = { modelId: 'ltx-2-5-fast', mode: 't2v', durationSec: 7, resolution: '1080p' };
  assert.equal(resolvePublicModelScenario(input), null, '7s is priced only for auto, not an explicit provider duration');
  assert.ok(resolvePublicModelScenario({ ...input, durationOption: 'auto' }));
});

test('source-timed finite modes cover their actual normalized billing bounds', () => {
  const coverage = collectSellableManualTariffCoverage();
  for (const [modelId, mode, max] of [['happy-horse-1-0', 'v2v', 15], ['ltx-2-3', 'a2v', 20],
    ['luma-ray-3-2', 'reframe', 30], ['lumaRay2', 'reframe', 9],
    ['lumaRay2_flash', 'reframe', 9]] as const) {
    const rows = coverage.scenarios.filter(row => row.modelId === modelId && row.context.mode === mode);
    const engine = getFalEngineById(modelId)!.engine;
    const base = rows[0]!;
    assert.ok(base, `${modelId}/${mode}`);
    for (let durationSec = 1; durationSec <= max; durationSec++) {
      const context = { ...base.context, durationSec };
      const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, engine.pricingDetails, 'USD').facts).selector;
      assert.ok(rows.some(row => JSON.stringify(row.selector) === JSON.stringify(selector)), JSON.stringify(selector));
    }
    assert.ok(!coverage.gaps.some(gap => gap.modelId === modelId && gap.reason.startsWith(`${mode}: nonnumeric`)));
  }
  for (const modelId of ['ltx-2-5-fast', 'ltx-2-5-pro']) {
    assert.ok(!coverage.gaps.some(gap => gap.modelId === modelId && gap.reason.startsWith('a2v: nonnumeric')));
    assert.ok(coverage.gaps.some(gap => gap.modelId === modelId && gap.reason.includes('continuous unit')));
  }
});
