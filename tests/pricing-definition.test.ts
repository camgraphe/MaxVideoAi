import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildPricingDefinition } from '../frontend/src/lib/pricing-definition.ts';
import { computePricingSnapshot } from '../frontend/src/lib/pricing.ts';

test('LTX 2.3 Pro pricing definition uses standard generate duration caps', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'ltx-2-3')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.equal(definition?.durationSteps.min, 6);
  assert.equal(definition?.durationSteps.max, 10);
});

test('LTX 2.3 Fast pricing definition keeps 20 second standard cap', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'ltx-2-3-fast')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.equal(definition?.durationSteps.min, 6);
  assert.equal(definition?.durationSteps.max, 20);
});

test('Nano Banana 2 pricing definition includes resolution tiers and web search addon', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'nano-banana-2')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.equal(definition?.baseUnitPriceCents, 8);
  assert.equal(definition?.resolutionMultipliers['0.5k'], 0.5);
  assert.equal(definition?.resolutionMultipliers['2k'], 1.5);
  assert.equal(definition?.resolutionMultipliers['4k'], 2);
  assert.equal(definition?.addons?.enable_web_search?.flatCents, 1.5);
});

test('GPT Image 2 pricing definition exposes high-quality image size tiers', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'gpt-image-2')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.equal(definition?.baseUnitPriceCents, 15);
  assert.equal(definition?.resolutionMultipliers['landscape_4_3'], 1);
  assert.equal(definition?.resolutionMultipliers['landscape_16_9'], 16 / 15);
  assert.equal(definition?.resolutionMultipliers['square_hd'], 22 / 15);
  assert.equal(definition?.resolutionMultipliers['3840x2160'], 41 / 15);
});

test('Seedance 2 pricing definition exposes token-priced 480p and 720p tiers to the estimator', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'seedance-2-0')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.ok(typeof definition?.baseUnitPriceCents === 'number' && definition.baseUnitPriceCents > 0);
  assert.ok(typeof definition?.resolutionMultipliers['480p'] === 'number');
  assert.ok(typeof definition?.resolutionMultipliers['720p'] === 'number');
  assert.ok((definition?.resolutionMultipliers['720p'] ?? 0) > (definition?.resolutionMultipliers['480p'] ?? 0));
});

test('Kling 3 pricing definitions match current fal vendor rates', () => {
  const standard = listFalEngines().find((entry) => entry.id === 'kling-3-standard')?.engine;
  const pro = listFalEngines().find((entry) => entry.id === 'kling-3-pro')?.engine;
  assert.ok(standard);
  assert.ok(pro);

  const standardDefinition = buildPricingDefinition(standard);
  const proDefinition = buildPricingDefinition(pro);

  assert.equal(standardDefinition?.baseUnitPriceCents, 12.6);
  assert.equal(standardDefinition?.addons?.audio_off?.perSecondCents, -4.2);
  assert.equal(standardDefinition?.addons?.voice_control?.perSecondCents, 2.8);
  assert.equal(proDefinition?.baseUnitPriceCents, 16.8);
  assert.equal(proDefinition?.addons?.audio_off?.perSecondCents, -5.6);
  assert.equal(proDefinition?.addons?.voice_control?.perSecondCents, 2.8);
});

test('Kling 3 4K pricing definition exposes the native 4K rate', () => {
  const engine = listFalEngines().find((entry) => entry.id === 'kling-3-4k')?.engine;
  assert.ok(engine);

  const definition = buildPricingDefinition(engine);
  assert.ok(definition);
  assert.equal(definition.baseUnitPriceCents, 42);
  assert.equal(definition.resolutionMultipliers['4k'], 1);
  assert.equal(definition.addons?.audio_off, undefined);
  assert.equal(definition.durationSteps.min, 3);
  assert.equal(definition.durationSteps.max, 15);
});

test('Kling 3 displayed quotes include the MaxVideoAI margin', async () => {
  const standard = listFalEngines().find((entry) => entry.id === 'kling-3-standard')?.engine;
  const pro = listFalEngines().find((entry) => entry.id === 'kling-3-pro')?.engine;
  const native4k = listFalEngines().find((entry) => entry.id === 'kling-3-4k')?.engine;
  assert.ok(standard);
  assert.ok(pro);
  assert.ok(native4k);

  const standardSnapshot = await computePricingSnapshot({
    engine: standard,
    durationSec: 5,
    resolution: '1080p',
    membershipTier: 'member',
  });
  const proSnapshot = await computePricingSnapshot({
    engine: pro,
    durationSec: 5,
    resolution: '1080p',
    membershipTier: 'member',
  });
  const native4kSnapshot = await computePricingSnapshot({
    engine: native4k,
    durationSec: 5,
    resolution: '4k',
    membershipTier: 'member',
  });

  assert.equal(standardSnapshot.base.amountCents, 63);
  assert.equal(standardSnapshot.margin.amountCents, 19);
  assert.equal(standardSnapshot.totalCents, 82);
  assert.equal(proSnapshot.base.amountCents, 84);
  assert.equal(proSnapshot.margin.amountCents, 26);
  assert.equal(proSnapshot.totalCents, 110);
  assert.equal(native4kSnapshot.base.amountCents, 210);
  assert.equal(native4kSnapshot.margin.amountCents, 63);
  assert.equal(native4kSnapshot.totalCents, 273);
});
