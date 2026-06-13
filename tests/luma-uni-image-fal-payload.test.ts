import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldSendImageReferenceUrlsForMode } from '../frontend/app/(core)/(workspace)/app/image/_lib/image-workspace-generation-request';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  buildFalImageGenerationInput,
  isLumaUniEditFalModel,
  isLumaUniTextToImageFalModel,
} from '../frontend/src/server/images/image-fal-generation';

test('image workspace sends Luma Uni reference image URLs for text-to-image', () => {
  const lumaUni = listFalEngines().find((entry) => entry.id === 'luma-uni-1')?.engine;
  const seedream = listFalEngines().find((entry) => entry.id === 'seedream')?.engine;

  assert.ok(lumaUni);
  assert.ok(seedream);
  assert.equal(shouldSendImageReferenceUrlsForMode(lumaUni, 't2i'), true);
  assert.equal(shouldSendImageReferenceUrlsForMode(lumaUni, 'i2i'), true);
  assert.equal(shouldSendImageReferenceUrlsForMode(seedream, 't2i'), false);
});

test('Luma Uni text-to-image fal input maps references to reference_image_urls', () => {
  assert.equal(isLumaUniTextToImageFalModel('luma/agent/uni-1/v1/text-to-image'), true);
  assert.equal(isLumaUniTextToImageFalModel('luma/agent/uni-1/v1/max'), true);

  const input = buildFalImageGenerationInput({
    falModelId: 'luma/agent/uni-1/v1/text-to-image',
    effectivePrompt: 'Create a clean product image',
    numImages: 1,
    mode: 't2i',
    resolvedReferenceUrls: ['https://cdn.example.com/ref-a.png', 'https://cdn.example.com/ref-b.png'],
    falAspectRatio: '16:9',
    providerImageSize: null,
    resolutionEngineParam: null,
    normalizedSeed: null,
    outputFormat: 'png',
    quality: null,
    maskUrl: null,
    enableWebSearch: true,
    thinkingLevel: null,
    limitGenerations: false,
  });

  assert.deepEqual(input.reference_image_urls, [
    'https://cdn.example.com/ref-a.png',
    'https://cdn.example.com/ref-b.png',
  ]);
  assert.equal(input.image_urls, undefined);
  assert.equal(input.image_url, undefined);
  assert.equal(input.enable_web_search, true);
});

test('Luma Uni edit fal input splits source image from edit references', () => {
  assert.equal(isLumaUniEditFalModel('luma/agent/uni-1/v1/edit'), true);
  assert.equal(isLumaUniEditFalModel('luma/agent/uni-1/v1/max/edit'), true);

  const input = buildFalImageGenerationInput({
    falModelId: 'luma/agent/uni-1/v1/max/edit',
    effectivePrompt: 'Edit this source with references',
    numImages: 1,
    mode: 'i2i',
    resolvedReferenceUrls: [
      'https://cdn.example.com/source.png',
      'https://cdn.example.com/ref-a.png',
      'https://cdn.example.com/ref-b.png',
    ],
    falAspectRatio: null,
    providerImageSize: null,
    resolutionEngineParam: null,
    normalizedSeed: null,
    outputFormat: 'jpeg',
    quality: null,
    maskUrl: null,
    enableWebSearch: false,
    thinkingLevel: null,
    limitGenerations: false,
  });

  assert.equal(input.image_url, 'https://cdn.example.com/source.png');
  assert.deepEqual(input.reference_image_urls, [
    'https://cdn.example.com/ref-a.png',
    'https://cdn.example.com/ref-b.png',
  ]);
  assert.equal(input.image_urls, undefined);
});

test('non-Luma image edit fal input keeps existing image_urls behavior', () => {
  const input = buildFalImageGenerationInput({
    falModelId: 'openai/gpt-image-2/edit',
    effectivePrompt: 'Edit this source',
    numImages: 1,
    mode: 'i2i',
    resolvedReferenceUrls: ['https://cdn.example.com/source.png'],
    falAspectRatio: null,
    providerImageSize: null,
    resolutionEngineParam: null,
    normalizedSeed: null,
    outputFormat: 'png',
    quality: 'high',
    maskUrl: null,
    enableWebSearch: false,
    thinkingLevel: null,
    limitGenerations: false,
  });

  assert.deepEqual(input.image_urls, ['https://cdn.example.com/source.png']);
  assert.equal(input.image_url, undefined);
  assert.equal(input.reference_image_urls, undefined);
});
