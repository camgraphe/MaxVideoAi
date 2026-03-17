import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  clampRequestedImageCount,
  getReferenceConstraints,
  normalizeFalImageResolution,
  resolveRequestedAspectRatio,
  resolveRequestedResolution,
} from '../frontend/lib/image/inputSchema.ts';

function getNanoBanana2Engine() {
  const engine = listFalEngines().find((entry) => entry.id === 'nano-banana-2')?.engine;
  assert.ok(engine);
  return engine;
}

test('Nano Banana 2 resolves generic aspect ratios including auto and 4:1', () => {
  const engine = getNanoBanana2Engine();

  const auto = resolveRequestedAspectRatio(engine, 't2i', 'AUTO');
  const ultraWide = resolveRequestedAspectRatio(engine, 't2i', '4:1');

  assert.equal(auto.ok, true);
  assert.equal(auto.ok && auto.value, 'auto');
  assert.equal(ultraWide.ok, true);
  assert.equal(ultraWide.ok && ultraWide.value, '4:1');
});

test('Nano Banana 2 resolves 0.5K requests and normalizes Fal resolution casing', () => {
  const engine = getNanoBanana2Engine();

  const resolution = resolveRequestedResolution(engine, 't2i', '0.5K');

  assert.equal(resolution.ok, true);
  assert.equal(resolution.ok && resolution.resolution, '0.5k');
  assert.equal(normalizeFalImageResolution('0.5k'), '0.5K');
});

test('Nano Banana 2 clamps image and reference counts from schema', () => {
  const engine = getNanoBanana2Engine();

  assert.equal(clampRequestedImageCount(engine, 't2i', 6), 4);
  assert.equal(clampRequestedImageCount(engine, 't2i', 0), 1);

  const refs = getReferenceConstraints(engine, 'i2i');
  assert.equal(refs.min, 1);
  assert.equal(refs.max, 14);
  assert.equal(refs.requires, true);
});
