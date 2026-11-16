import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildBytePlusSeedreamPayload } from '../frontend/src/server/images/byteplus-seedream-payload.ts';
import { resolveBytePlusSeedreamReadiness } from '../frontend/src/server/images/byteplus-seedream-policy.ts';
import * as seedream from '../frontend/lib/image/seedream.ts';

const MODELS = [
  { id: 'seedream-5-5', modelId: 'dola-seedream-5-5-261028', format: 'png' },
  { id: 'seedream-5-0-flash', modelId: 'dola-seedream-5-0-flash-260915', format: 'jpeg' },
] as const;

for (const model of MODELS) {
  test(`${model.id} is an executable BytePlus image model with its own limits`, () => {
    const entry = listFalEngines().find(candidate => candidate.id === model.id);
    assert.ok(entry, `${model.id} must be registered`);
    assert.equal(entry.provider, 'ByteDance');
    assert.equal(entry.engine.providerMeta?.modelSlug, model.modelId);
    assert.equal(entry.engine.providerMeta?.provider, 'byteplus_modelark');
    assert.deepEqual(entry.engine.modes, ['t2i', 'i2i']);
    assert.deepEqual(entry.engine.resolutions, ['1K', '1.5K', '2K']);
    assert.equal(entry.engine.inputSchema?.optional?.find(field => field.id === 'num_images')?.max, 1);
    assert.equal(entry.engine.inputSchema?.optional?.find(field => field.id === 'image_urls')?.maxCount, 10);
    assert.deepEqual(resolveBytePlusSeedreamReadiness(entry.engine, {
      bytePlusEnabled: true, bytePlusApiKey: 'test-key',
    }), { executable: true, reason: 'available' });
    assert.equal(resolveBytePlusSeedreamReadiness(entry.engine, {
      bytePlusEnabled: true, bytePlusApiKey: undefined,
    }).reason, 'provider_credentials_missing');
  });

  test(`${model.id} maps its tiers and ratios without Lite streaming or oversized outputs`, () => {
    for (const [size, expected] of [['1K', '1424x800'], ['1.5K', '2048x1152'], ['2K', '2816x1584']]) {
      const payload = buildBytePlusSeedreamPayload({
        modelId: model.modelId, prompt: 'Product photograph', mode: 't2i',
        numImages: 1, size, aspectRatio: '16:9', responseFormat: 'url',
      });
      assert.equal(payload.size, expected);
      assert.equal(payload.stream, undefined);
      assert.equal(payload.sequential_image_generation, undefined);
    }
    for (const size of ['3K', '4K', '4096x4096', '512x512']) {
      assert.throws(() => buildBytePlusSeedreamPayload({
        modelId: model.modelId, prompt: 'Product photograph', mode: 't2i',
        numImages: 1, size, responseFormat: 'url',
      }), /size|resolution|pixels/i);
    }
    assert.throws(() => buildBytePlusSeedreamPayload({
      modelId: model.modelId, prompt: 'Variations', mode: 't2i',
      numImages: 2, size: '2K', responseFormat: 'url',
    }), /one generated image/i);
  });

  test(`${model.id} accepts ten source images and rejects an eleventh`, () => {
    const imageUrls = Array.from({length: 10}, (_, index) => `https://example.com/ref-${index}.png`);
    const params = {
      modelId: model.modelId, prompt: 'Keep each product reference', mode: 'i2i' as const,
      imageUrls, numImages: 1, size: '2K', responseFormat: 'url' as const,
    };
    assert.deepEqual(buildBytePlusSeedreamPayload(params).image, imageUrls);
    assert.throws(() => buildBytePlusSeedreamPayload({
      ...params, imageUrls: [...imageUrls, 'https://example.com/ref-extra.png'],
    }), /10 reference images/i);
  });

  test(`${model.id} preserves repeated ordered reference slots and their charged count`, () => {
    const imageUrls = ['https://example.com/source.png', 'https://example.com/source.png'];
    const params = { modelId: model.modelId, prompt: 'Use image 1 and image 2',
      mode: 'i2i' as const, numImages: 1, size: '2K', responseFormat: 'url' as const };
    assert.deepEqual(buildBytePlusSeedreamPayload({...params, imageUrls}).image, imageUrls);
    assert.throws(() => buildBytePlusSeedreamPayload({
      ...params, imageUrls: Array.from({length: 11}, () => imageUrls[0]),
    }), /10 reference images/i);
  });

  test(`${model.id} keeps constraints when a custom endpoint ID is configured`, () => {
    assert.throws(() => buildBytePlusSeedreamPayload({
      engineId: model.id, modelId: 'ep-private-endpoint', prompt: 'Variations', mode: 't2i',
      numImages: 2, size: '2K', responseFormat: 'url',
    }), /one generated image/i);
    const payload = buildBytePlusSeedreamPayload({
      engineId: model.id, modelId: 'ep-private-endpoint', prompt: 'Product', mode: 't2i',
      numImages: 1, size: '1.5K', aspectRatio: '4:3', responseFormat: 'url',
    });
    assert.equal(payload.model, 'ep-private-endpoint');
    assert.equal(payload.size, '1792x1344');
  });
}

test('Seedream 5.5 forwards native transparent PNG and rejects an incompatible file format', () => {
  const params = {
    modelId: MODELS[0].modelId, prompt: 'Isolated glass bottle', mode: 't2i' as const,
    numImages: 1, size: '2K', responseFormat: 'url' as const, background: 'transparent',
  };
  const payload = buildBytePlusSeedreamPayload({...params, outputFormat: 'png'});
  assert.equal(payload.background, 'transparent');
  assert.equal(payload.output_format, 'png');
  assert.equal(buildBytePlusSeedreamPayload(params).output_format, 'png');
  assert.equal(buildBytePlusSeedreamPayload({ ...params, background: ' TRANSPARENT ', outputFormat: ' PNG ' }).background, 'transparent');
  assert.throws(() => buildBytePlusSeedreamPayload({...params, outputFormat: 'jpeg'}), /transparent.*PNG/i);
});

test('the shared Seedream output setting guard does not alter existing engines', () => {
  assert.equal(seedream.seedreamOutputSettingsError('seedream-5-5', {
    background: ' TRANSPARENT ', outputFormat: ' JPEG ',
  }), 'transparent_requires_png');
  assert.equal(seedream.seedreamOutputSettingsError('seedream-5-5', {
    background: ' TRANSPARENT ', outputFormat: ' PNG ',
  }), null);
  assert.equal(seedream.seedreamOutputSettingsError('seedream-5-5', {
    background: 'transparent', outputFormat: 'jpeg',
  }), 'transparent_requires_png');
  assert.equal(seedream.seedreamOutputSettingsError('seedream-5-5', {
    background: 'transparent', outputFormat: null,
  }), null);
  assert.equal(seedream.seedreamOutputSettingsError('seedream', {
    background: 'transparent', outputFormat: 'jpeg',
  }), null);
});
