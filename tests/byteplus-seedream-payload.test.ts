import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBytePlusSeedreamPayload } from '../frontend/src/server/images/byteplus-seedream-payload.ts';

test('builds a BytePlus Seedream text-to-image payload', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Clean product reference image',
    mode: 't2i',
    numImages: 1,
    outputFormat: 'png',
    size: '2K',
    responseFormat: 'url',
    watermark: true,
  });

  assert.deepEqual(payload, {
    model: 'seedream-5-0-260128',
    prompt: 'Clean product reference image',
    size: '2K',
    output_format: 'png',
    response_format: 'url',
    watermark: true,
  });
});

test('maps Seedream base resolution and ratio to BytePlus recommended size', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Wide cinematic product reference image',
    mode: 't2i',
    numImages: 1,
    size: '2K',
    aspectRatio: '16:9',
    responseFormat: 'url',
  });

  assert.equal(payload.size, '2848x1600');
});

test('keeps Seedream base resolution when ratio is auto', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Auto framed reference image',
    mode: 't2i',
    numImages: 1,
    size: '3K',
    aspectRatio: 'auto',
    responseFormat: 'url',
  });

  assert.equal(payload.size, '3K');
});

test('keeps explicit Seedream pixel sizes as the provider size', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Explicit pixel size reference image',
    mode: 't2i',
    numImages: 1,
    size: '6240x2656',
    aspectRatio: '1:1',
    responseFormat: 'url',
  });

  assert.equal(payload.size, '6240x2656');
});

test('builds a BytePlus Seedream image-to-image payload with image input', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Clean the product background',
    mode: 'i2i',
    imageUrls: ['https://cdn.example.com/source.png'],
    numImages: 1,
    size: '2K',
    responseFormat: 'url',
  });

  assert.equal(payload.model, 'seedream-5-0-260128');
  assert.equal(payload.prompt, 'Clean the product background');
  assert.equal(payload.size, '2K');
  assert.equal(payload.response_format, 'url');
  assert.equal(payload.watermark, false);
  assert.equal(payload.image, 'https://cdn.example.com/source.png');
});

test('rejects Seedream edit mode without reference images', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-260128',
        prompt: 'Edit this image',
        mode: 'i2i',
        imageUrls: [],
        numImages: 1,
        size: '2K',
        responseFormat: 'url',
      }),
    /reference image/i
  );
});

test('rejects Seedream requests above one image because the provider does not support n', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-260128',
        prompt: 'Create options',
        mode: 't2i',
        numImages: 2,
        size: '2K',
        responseFormat: 'url',
      }),
    /one image/i
  );
});
