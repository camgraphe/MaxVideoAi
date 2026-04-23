import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  clampRequestedImageCount,
  getImageInputField,
  getReferenceConstraints,
  normalizeFalImageResolution,
  resolveRequestedAspectRatio,
  resolveRequestedResolution,
} from '../frontend/lib/image/inputSchema.ts';
import { validateGptImage2CustomImageSize } from '../frontend/lib/image/gptImage2.ts';

function getNanoBanana2Engine() {
  const engine = listFalEngines().find((entry) => entry.id === 'nano-banana-2')?.engine;
  assert.ok(engine);
  return engine;
}

function getGptImage2Engine() {
  const engine = listFalEngines().find((entry) => entry.id === 'gpt-image-2')?.engine;
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

test('GPT Image 2 resolves Fal image_size presets and edit auto sizing', () => {
  const engine = getGptImage2Engine();

  const textSize = resolveRequestedResolution(engine, 't2i', 'LANDSCAPE_16_9');
  const editSize = resolveRequestedResolution(engine, 'i2i', 'AUTO');
  const canonicalSize = resolveRequestedResolution(engine, 't2i', '3840x2160');
  const customSize = resolveRequestedResolution(engine, 't2i', 'CUSTOM');

  assert.equal(textSize.ok, true);
  assert.equal(textSize.ok && textSize.resolution, 'landscape_16_9');
  assert.equal(normalizeFalImageResolution('landscape_16_9'), 'landscape_16_9');
  assert.equal(editSize.ok, true);
  assert.equal(editSize.ok && editSize.resolution, 'auto');
  assert.equal(canonicalSize.ok, true);
  assert.equal(canonicalSize.ok && canonicalSize.resolution, '3840x2160');
  assert.equal(customSize.ok, true);
  assert.equal(customSize.ok && customSize.resolution, 'custom');
});

test('GPT Image 2 exposes Fal custom image_size constraints', () => {
  const engine = getGptImage2Engine();
  const widthField = getImageInputField(engine, 'image_width', 't2i');
  const heightField = getImageInputField(engine, 'image_height', 't2i');
  const valid = validateGptImage2CustomImageSize({ width: 3840, height: 2160 });
  const invalid = validateGptImage2CustomImageSize({ width: 1000, height: 1000 });

  assert.equal(widthField?.engineParam, 'image_size.width');
  assert.equal(heightField?.engineParam, 'image_size.height');
  assert.equal(widthField?.step, 16);
  assert.equal(valid.ok, true);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok ? '' : invalid.code, 'image_size_multiple');
});

test('GPT Image 2 keeps mask URL scoped to edit mode and clamps references', () => {
  const engine = getGptImage2Engine();

  const textRefs = getReferenceConstraints(engine, 't2i');
  const editRefs = getReferenceConstraints(engine, 'i2i');

  assert.equal(textRefs.requires, false);
  assert.equal(editRefs.min, 1);
  assert.equal(editRefs.max, 4);
  assert.equal(editRefs.requires, true);
});
