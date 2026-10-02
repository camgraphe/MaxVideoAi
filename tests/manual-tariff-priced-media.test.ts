import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { supportsSeedanceInputTariff } from '../frontend/lib/seedance-input-tariff';
import { resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario';
import { buildEngineAddonInput, applyEngineVariantPricing } from '../frontend/src/lib/pricing-addons';

const project = (context: Parameters<typeof buildBillingPricingFacts>[0]) => {
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  return { facts, ...buildManualTariffScenario(context, facts) };
};

test('real generation zero media counts and unused source metadata resolve the collected tariff', () => {
  for (const scenario of collectSellableManualTariffCoverage().scenarios) {
    const context = { ...scenario.context, referenceImageCount: scenario.context.referenceImageCount ?? 0,
      inputImageCount: scenario.context.inputImageCount ?? 0, inputVideoDurationSec: scenario.context.inputVideoDurationSec ?? 0 };
    assert.deepEqual(project(context).selector, scenario.selector, scenario.id);
    if (!['gemini-omni-flash', 'wan-3', 'wan-3-prime'].includes(scenario.modelId)
      && !supportsSeedanceInputTariff(scenario.modelId,scenario.selector.mode,scenario.selector.billingInputType)) {
      const extra = { ...context, inputVideoDurationSec: 3.25 };
      assert.equal(project(extra).facts.vendorSubtotalExactCents, project(context).facts.vendorSubtotalExactCents);
      assert.deepEqual(project(extra).selector, scenario.selector, `${scenario.id}/unused source metadata`);
    }
  }
});

test('generation addon flags and explicit comparison audio choices resolve identical prices and tariff identities', () => {
  for (const scenario of collectSellableManualTariffCoverage().scenarios) {
    const audio = scenario.context.addons?.audio;
    if (typeof audio !== 'boolean') continue;
    const generation = { ...scenario.context, addons: buildEngineAddonInput(scenario.context.engine,
      { audioEnabled: audio, voiceControl: Boolean(scenario.context.addons?.voice_control) }) };
    const current = project(generation);
    assert.equal(current.facts.vendorSubtotalExactCents, project(scenario.context).facts.vendorSubtotalExactCents, scenario.id);
    assert.deepEqual(current.selector, scenario.selector, scenario.id);
  }
});

test('the collector factual basis matches the mode-specific engine that generation actually bills', () => {
  for (const [modelId, mode] of [['happy-horse-1-0', 'v2v'], ['kling-o3-standard', 'v2v'], ['kling-o3-pro', 'v2v'], ['kling-2-5-turbo', 'i2i']] as const) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode, durationSec: 5, resolution: '1080p' };
    const generation = { ...context, engine: applyEngineVariantPricing(engine, mode) };
    assert.equal(project(context).facts.vendorSubtotalExactCents, project(generation).facts.vendorSubtotalExactCents, `${modelId}/${mode}`);
  }
});

test('Seedance mixed-reference image counts share their billed input tier; video input remains separately priced', () => {
  for (const modelId of ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'seedance-2-5']) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 'ref2v' as const, resolution: '720p', durationSec: 5, aspectRatio: '16:9', hasVideoInput: false,
      addons: { audio: false, audio_off: true } };
    const image = project(context);
    assert.equal(image.selector.billingInputType, 'no_video_input');
    for (const referenceImageCount of [0, 1, 3, 9]) {
      const quoted = project({ ...context, referenceImageCount, inputImageCount: referenceImageCount });
      assert.deepEqual(quoted.selector, image.selector);
      assert.equal(quoted.facts.vendorSubtotalExactCents, image.facts.vendorSubtotalExactCents);
    }
    const video = project({ ...context, hasVideoInput: true, inputVideoDurationSec: 3.25 });
    assert.equal(video.selector.billingInputType, 'video_input');
    assert.notDeepEqual(video.selector, image.selector);
    const coverage = collectSellableManualTariffCoverage().scenarios;
    assert.ok(coverage.some(s => JSON.stringify(s.selector) === JSON.stringify(image.selector)));
    assert.ok(coverage.some(s => JSON.stringify(continuousInputTariffSelector(s.selector))
      === JSON.stringify(continuousInputTariffSelector(video.selector))),JSON.stringify(video.selector));
  }
});

test('public reference quotes retain media counts and select the same Seedance video-input tier as generation', () => {
  const input = { modelId: 'seedance-2-0-mini', mode: 'ref2v', resolution: '720p', durationSec: 5, aspectRatio: '16:9', audio: false };
  for (const hasVideoInput of [false, true]) {
    for (const referenceImageCount of [1, 3, 9]) {
      const publicScenario = resolvePublicModelScenario({ ...input, hasVideoInput, referenceImageCount,
        ...(hasVideoInput ? { inputVideoDurationSec:3.25 } : {}) });
      assert.ok(publicScenario);
      assert.equal(publicScenario.context.hasVideoInput, hasVideoInput);
      assert.equal(publicScenario.context.referenceImageCount, referenceImageCount);
      assert.deepEqual(project(publicScenario.context).selector, publicScenario.selector);
      assert.equal(publicScenario.selector.billingInputType, hasVideoInput ? 'video_input' : 'no_video_input');
    }
  }
  assert.equal(resolvePublicModelScenario({ ...input, referenceImageCount: 10 }), null);
  assert.equal(resolvePublicModelScenario({ ...input, mode: 't2v', hasVideoInput: true }), null);
});

test('priced media quantities remain distinct for Wan, Omni, H3 and image surcharges', () => {
  const wan = { engine: getFalEngineById('wan-3')!.engine, mode: 'ref2v' as const, durationSec: 5, resolution: '720p' };
  assert.equal(project({ ...wan, inputVideoDurationSec: 0, hasVideoInput: false }).selector.inputVideoDurationSec, undefined);
  assert.equal(project({ ...wan, inputVideoDurationSec: 3.25, hasVideoInput: true }).selector.inputVideoDurationSec, '3.25');
  const omni = { engine: getFalEngineById('gemini-omni-flash')!.engine, mode: 't2v' as const, durationSec: 5, resolution: '720p' };
  assert.notDeepEqual(project({ ...omni, inputImageCount: 0 }).selector, project({ ...omni, inputImageCount: 1 }).selector);
  const h3 = { engine: getFalEngineById('minimax-h3')!.engine, mode: 'ref2v' as const, durationSec: 5, resolution: '2K' };
  assert.notDeepEqual(project({ ...h3, referenceImageCount: 5 }).selector, project({ ...h3, referenceImageCount: 6 }).selector);
  const image = { engine: getFalEngineById('gpt-image-2-5-flare')!.engine, mode: 'i2i' as const, durationSec: 1, resolution: '1024x1024' };
  assert.notDeepEqual(project({ ...image, referenceImageCount: 1 }).selector, project({ ...image, referenceImageCount: 2 }).selector);
  const grok = { engine: getFalEngineById('grok-imagine-video-1-5')!.engine, mode: 'ref2v' as const, durationSec: 5, resolution: '720p' };
  assert.notDeepEqual(project({ ...grok, referenceImageCount: 1 }).selector, project({ ...grok, referenceImageCount: 2 }).selector);
});

test('a rate override that retains the factual reference surcharge cannot erase its priced count', () => {
  const engine = getFalEngineById('grok-imagine-video-1-5')!.engine;
  const override = { currency: 'USD', perSecondCents: { default: 1 } };
  const selected = [1, 2].map(referenceImageCount => {
    const context = { engine, mode: 'ref2v' as const, resolution: '720p', durationSec: 5, referenceImageCount };
    const facts = buildBillingPricingFacts(context, override, 'USD').facts;
    return { facts, selector: buildManualTariffScenario(context, facts).selector };
  });
  assert.ok(selected[1].facts.vendorSubtotalExactCents > selected[0].facts.vendorSubtotalExactCents);
  assert.notDeepEqual(selected[0].selector, selected[1].selector);
});

test('Kling voice control is a separately priced authored extra and coverage includes its actual audio-on variant', () => {
  for (const modelId of ['kling-3-standard', 'kling-3-pro']) {
    const engine = getFalEngineById(modelId)!.engine;
    const context = { engine, mode: 't2v' as const, resolution: '1080p', durationSec: 5,
      addons: buildEngineAddonInput(engine, { audioEnabled: true }) };
    const voice = { ...context, addons: buildEngineAddonInput(engine, { audioEnabled: true, voiceControl: true }) };
    assert.equal(project(voice).selector.voiceControl, 'true');
    assert.notDeepEqual(project(voice).selector, project(context).selector);
    assert.ok(project(voice).facts.vendorSubtotalExactCents > project(context).facts.vendorSubtotalExactCents);
    assert.ok(collectSellableManualTariffCoverage().scenarios.some(s => JSON.stringify(s.selector) === JSON.stringify(project(voice).selector)));
    const publicScenario = resolvePublicModelScenario({ modelId, mode: 't2v', resolution: '1080p', durationSec: 5, audio: false, voiceControl: true });
    assert.ok(publicScenario);
    assert.equal(publicScenario.selector.voiceControl, 'true');
    assert.equal(publicScenario.selector.audio, 'true', 'generation forces audio on for voices');
    assert.deepEqual(project(publicScenario.context).selector, project(voice).selector);
  }
});
