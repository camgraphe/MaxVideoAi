import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGoogleGeminiImagePayload,
  normalizeGoogleGeminiImageSize,
} from '../frontend/src/server/images/google-gemini-image-payload.ts';
import { extractGoogleGeminiImages } from '../frontend/src/server/images/google-gemini-image-response.ts';

test('normalizes MaxVideoAI resolution values to Gemini API image_size values', () => {
  assert.equal(normalizeGoogleGeminiImageSize('0.5k'), '0.5K');
  assert.equal(normalizeGoogleGeminiImageSize('1k'), '1K');
  assert.equal(normalizeGoogleGeminiImageSize('2K'), '2K');
  assert.equal(normalizeGoogleGeminiImageSize(null), null);
});

test('builds a Google Gemini image payload with references and Flash search grounding', () => {
  const payload = buildGoogleGeminiImagePayload({
    modelId: 'gemini-3.1-flash-image',
    prompt: 'Create a cinematic campaign frame',
    referenceImages: [
      { data: 'base64-a', mimeType: 'image/png' },
      { data: 'base64-b', mimeType: 'image/jpeg' },
    ],
    aspectRatio: '16:9',
    imageSize: '2k',
    outputFormat: 'png',
    enableWebSearch: true,
    thinkingLevel: 'high',
  });

  assert.deepEqual(payload.input, [
    { type: 'text', text: 'Create a cinematic campaign frame' },
    { type: 'image', mime_type: 'image/png', data: 'base64-a' },
    { type: 'image', mime_type: 'image/jpeg', data: 'base64-b' },
  ]);
  assert.deepEqual(payload.response_format, {
    type: 'image',
    mime_type: 'image/png',
    aspect_ratio: '16:9',
    image_size: '2K',
  });
  assert.deepEqual(payload.tools, [{ type: 'google_search', search_types: ['web_search', 'image_search'] }]);
  assert.deepEqual(payload.generation_config, { thinking_level: 'high' });
});

test('extracts only final Google Gemini model output images', () => {
  const images = extractGoogleGeminiImages({
    steps: [
      {
        type: 'thought',
        summary: [{ type: 'image', mime_type: 'image/png', data: Buffer.from('thought').toString('base64') }],
      },
      {
        type: 'model_output',
        content: [{ type: 'image', mime_type: 'image/jpeg', data: Buffer.from('final').toString('base64') }],
      },
    ],
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.mimeType, 'image/jpeg');
  assert.equal(images[0]?.data.toString(), 'final');
});
