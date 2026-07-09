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

test('enables Seedream sequential image generation for batch requests', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-260128',
    prompt: 'Create four coherent storyboard frames',
    mode: 't2i',
    numImages: 4,
    size: '2K',
    responseFormat: 'url',
  });

  assert.equal(payload.sequential_image_generation, 'auto');
  assert.deepEqual(payload.sequential_image_generation_options, { max_images: 4 });
  assert.equal(payload.stream, true);
});

test('keeps Seedream Pro single-image requests off streaming and sequential generation', () => {
  const payload = buildBytePlusSeedreamPayload({
    modelId: 'seedream-5-0-pro-260628',
    prompt: 'Create a professional high-density event infographic',
    mode: 't2i',
    numImages: 1,
    size: '4K',
    aspectRatio: '16:9',
    responseFormat: 'url',
  });

  assert.equal(payload.model, 'seedream-5-0-pro-260628');
  assert.equal(payload.size, '5504x3040');
  assert.equal(payload.stream, undefined);
  assert.equal(payload.sequential_image_generation, undefined);
  assert.equal(payload.sequential_image_generation_options, undefined);
});

test('rejects Seedream Pro batch requests because Pro does not support sequential generation', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-pro-260628',
        prompt: 'Create multiple professional finals',
        mode: 't2i',
        numImages: 2,
        size: '2K',
        responseFormat: 'url',
      }),
    /Seedream 5\.0 Pro supports one generated image/i
  );
});

test('rejects Seedream batch requests above the provider image-set limit', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-260128',
        prompt: 'Create too many frames',
        mode: 't2i',
        numImages: 16,
        size: '2K',
        responseFormat: 'url',
      }),
    /up to 15/i
  );
});

test('rejects Seedream image sets when references plus requested outputs exceed 15', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-260128',
        prompt: 'Create storyboard variations',
        mode: 'i2i',
        imageUrls: [
          'https://cdn.example.com/ref-1.png',
          'https://cdn.example.com/ref-2.png',
          'https://cdn.example.com/ref-3.png',
        ],
        numImages: 13,
        size: '2K',
        responseFormat: 'url',
      }),
    /reference images plus generated images/i
  );
});

test('rejects Seedream requests above the provider reference image limit', () => {
  assert.throws(
    () =>
      buildBytePlusSeedreamPayload({
        modelId: 'seedream-5-0-260128',
        prompt: 'Fuse too many references',
        mode: 'i2i',
        imageUrls: Array.from({ length: 11 }, (_, index) => `https://cdn.example.com/ref-${index + 1}.png`),
        numImages: 1,
        size: '2K',
        responseFormat: 'url',
      }),
    /up to 10 reference images/i
  );
});
