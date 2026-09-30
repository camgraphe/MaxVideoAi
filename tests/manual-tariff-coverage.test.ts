import assert from 'node:assert/strict';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime.ts';
import {
  collectSellableManualTariffCoverage,
  collectEffectiveCustomerTariffBaseline,
} from '../frontend/lib/pricing-audit/manual-tariff-coverage.ts';
import type { PricingSnapshot } from '@maxvideoai/pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

function assertChargingCell(context: PricingContext) {
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  const expected = buildManualTariffScenario(context, facts);
  const matches = collectSellableManualTariffCoverage().scenarios.filter(row =>
    JSON.stringify(row.selector) === JSON.stringify(expected.selector));
  assert.equal(matches.length, 1, `charging selector must have exactly one cell: ${JSON.stringify(expected.selector)}`);
  assert.deepEqual(matches[0]!.quantities, expected.quantities);
}

test('bounded reference cells match video generation with both submitted image counts', () => {
  for (const [modelId, count] of [['veo-3-1', 2], ['gemini-omni-flash', 10], ['minimax-h3', 9]] as const) {
    const engine = getFalEngineById(modelId)!.engine;
    assertChargingCell({ engine, mode: 'ref2v', durationSec: modelId === 'veo-3-1' ? 8 : 5,
      resolution: modelId === 'minimax-h3' ? '768P' : '720p', aspectRatio: '16:9',
      referenceImageCount: count, inputImageCount: count, hasVideoInput: false,
      ...(modelId !== 'minimax-h3' ? { addons: { audio: false, audio_off: true } } : {}) });
  }
});

test('fixed GPT dimensions match image generation with normalized pixel size', () => {
  for (const modelId of ['gpt-image-2', 'gpt-image-2-5-flare', 'gpt-image-2-5-sunburst']) {
    const engine = getFalEngineById(modelId)!.engine;
    assertChargingCell({ engine, mode: 'i2i', durationSec: 4, resolution: '1024x1024', aspectRatio: '1:1',
      customImageSize: { width: 1024, height: 1024 }, quality: 'medium', hasVideoInput: false,
      ...(modelId === 'gpt-image-2' ? {} : { referenceImageCount: 16 }) });
  }
});

test('coverage captures priced image references, image batches and the exact billing selector', () => {
  const { scenarios } = collectSellableManualTariffCoverage();
  for (const [modelId, mode, references, outputs] of [
    ['gpt-image-2-5-flare', 'i2i', 16, 4],
    ['gpt-image-2-5-sunburst', 'i2i', 1, 1],
    ['luma-uni-1', 't2i', 9, 1],
    ['luma-uni-1', 'i2i', 0, 1],
    ['luma-uni-1-max', 'i2i', 8, 1],
  ] as const) {
    const scenario = scenarios.find(row => row.modelId === modelId && row.context.mode === mode
      && row.context.referenceImageCount === references && row.context.durationSec === outputs);
    assert.ok(scenario, `${modelId}/${mode}: refs ${references}, outputs ${outputs}`);
    assert.equal(scenario.selector.referenceImageCount, String(references));
    assert.equal(scenario.selector.durationSec, String(outputs));
    const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
    assert.deepEqual(scenario.selector, buildManualTariffScenario(scenario.context, facts).selector);
  }
  assert.ok(scenarios.some(row => row.modelId === 'nano-banana' && row.context.durationSec === 8));
  assert.ok(scenarios.some(row => row.modelId === 'seedream' && row.context.durationSec === 15));
  assert.ok(!scenarios.some(row => row.modelId === 'luma-uni-1' && row.context.durationSec !== 1));
  assert.ok(!scenarios.some(row => row.modelId === 'gpt-image-2-5-flare' && (row.context.referenceImageCount ?? 0) > 16));
});

test('image-only reference modes use reviewed schema bounds while mixed media remain unresolved', () => {
  const coverage = collectSellableManualTariffCoverage();
  for (const [modelId, max] of [['gemini-omni-flash', 10], ['happy-horse-1-0', 9],
    ['veo-3-1', 3], ['grok-imagine-video-1-5', 7]] as const) {
    const rows = coverage.scenarios.filter(row => row.modelId === modelId && row.context.mode === 'ref2v');
    assert.deepEqual([...new Set(rows.map(row => row.context.referenceImageCount))].sort((a, b) => a! - b!),
      Array.from({ length: max }, (_, i) => i + 1));
    assert.ok(!coverage.gaps.some(gap => gap.modelId === modelId && gap.reason.startsWith('ref2v: reference')));
  }
  assert.ok(coverage.gaps.some(gap => gap.modelId === 'seedance-2-5' && gap.reason.startsWith('ref2v: reference')));
  assert.ok(coverage.gaps.some(gap => gap.modelId === 'minimax-h3' && gap.reason.startsWith('ref2v: reference')));
});

test('legacy Luma loop selectors are covered without inventing loop for edit modes', () => {
  const { scenarios } = collectSellableManualTariffCoverage();
  for (const modelId of ['lumaRay2', 'lumaRay2_flash']) {
    assert.ok(scenarios.some(row => row.modelId === modelId && row.context.mode === 't2v'
      && row.selector.loop === 'true' && row.context.loop === true));
    assert.ok(scenarios.some(row => row.modelId === modelId && row.context.mode === 't2v' && !row.selector.loop));
    assert.ok(!scenarios.some(row => row.modelId === modelId && ['v2v', 'reframe'].includes(row.context.mode!) && row.selector.loop));
  }
});

test('coverage follows all 48 app-published models in 15 families, including pricing-hidden legacy variants', () => {
  const coverage = collectSellableManualTariffCoverage();
  const published = listRuntimeModels().filter((model) => model.publication.app.published);
  assert.equal(published.length, 48);
  assert.equal(new Set(published.map((model) => model.family)).size, 15);
  assert.deepEqual(new Set(coverage.scenarios.map((scenario) => scenario.modelId)), new Set(published.map((model) => model.id)));
  assert.ok(coverage.scenarios.some((scenario) => scenario.modelId === 'lumaRay2'));
  assert.ok(coverage.scenarios.some((scenario) => scenario.modelId === 'lumaRay2_flash'));
  assert.equal(new Set(coverage.scenarios.map((scenario) => scenario.id)).size, coverage.scenarios.length);
});

test('finite price-changing duration, resolution and audio boundaries are distinct; unsupported custom options are gaps', () => {
  const coverage = collectSellableManualTariffCoverage();
  const seedance = coverage.scenarios.filter((row) => row.modelId === 'seedance-2-5' && row.selector.mode === 't2v');
  assert.ok(seedance.some((row) => row.selector.durationSec === '4' && row.selector.resolution === '480p'));
  assert.ok(seedance.some((row) => row.selector.durationSec === '30' && row.selector.resolution === '1080p'));
  assert.ok(!coverage.scenarios.some((row) => row.modelId === 'seedance-2-0-mini' && row.selector.resolution === '1080p'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'gpt-image-2' && gap.reason.includes('custom')));
  assert.ok(!coverage.scenarios.some((row) => row.selector.aspectRatio === 'auto'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'wan-3' && gap.reason.includes('auto aspect')));
  const wanVideo = coverage.scenarios.filter((row) => row.modelId === 'wan-3' && row.selector.mode === 'v2v');
  assert.ok(wanVideo.some((row) => row.selector.inputVideoDurationSec === '1'));
  assert.ok(wanVideo.some((row) => row.selector.inputVideoDurationSec === '15'));
  assert.ok(wanVideo.every((row) => Number(row.selector.durationSec) + Number(row.selector.inputVideoDurationSec) <= 30));
  const omni = coverage.scenarios.filter((row) => row.modelId === 'gemini-omni-flash' && row.selector.mode === 'v2v');
  assert.ok(omni.some((row) => row.selector.inputVideoDurationSec === '3' && row.selector.inheritedDurationSec === '3'));
  assert.ok(coverage.scenarios.filter((row) => row.modelId === 'gemini-omni-flash' && row.selector.mode === 'fl2v')
    .every((row) => row.context.inputImageCount === 2 && row.selector.inputImageCount === '2'));
  const h3 = coverage.scenarios.filter((row) => row.modelId === 'minimax-h3-max' && row.selector.mode === 'ref2v');
  assert.ok(h3.some((row) => row.selector.referenceTokenBudget === '4096'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'minimax-h3-max' && gap.reason.includes('reference token')));
  const ltx = coverage.scenarios.filter((row) => row.modelId === 'ltx-2-5-fast' && row.selector.mode === 'a2v');
  assert.ok(ltx.some((row) => row.selector.inputAudioDurationSec === '9'));
  assert.ok(coverage.gaps.some((gap) => gap.modelId === 'ltx-2-5-fast' && gap.reason.includes('input audio')));
});

test('effective baseline collector records quote provenance and missing cells without inventing cents', async () => {
  const coverage = collectSellableManualTariffCoverage();
  const selected = coverage.scenarios.slice(0, 2);
  const baseline = await collectEffectiveCustomerTariffBaseline({
    at: '2026-09-29T00:00:00.000Z', registryHash: 'registry-test', databaseIdentity: 'production-matched',
    scenarios: selected,
    quote: async (scenario) => scenario === selected[0]
      ? { totalCents: 123, currency: 'USD', meta: { pricingPolicy: { source: 'database', sourceRuleId: 'db-rule' } } } as PricingSnapshot
      : Promise.reject(new Error('unavailable')),
  });
  assert.equal(baseline.rows.length, 1);
  assert.deepEqual(baseline.rows[0], { scenarioId: selected[0]?.id, customerCents: 123, currency: 'USD', policySource: 'database', ruleId: 'db-rule' });
  assert.deepEqual(baseline.gaps, [selected[1]?.id]);
});
