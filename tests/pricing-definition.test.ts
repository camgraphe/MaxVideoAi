import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildPricingDefinition } from '../frontend/src/lib/pricing-definition.ts';

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
