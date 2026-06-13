import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLumaAgentsImagePayload } from '../frontend/src/server/images/luma-agents-payload';
import { LumaAgentsImageError } from '../frontend/src/server/images/luma-agents-error';

test('Luma Uni-1 text-to-image maps style, output format, web search, and refs', () => {
  assert.deepEqual(
    buildLumaAgentsImagePayload({
      engineId: 'luma-uni-1',
      mode: 't2i',
      prompt: 'A product poster with exact text "LAUNCH"',
      aspectRatio: '1:1',
      style: 'auto',
      outputFormat: 'png',
      webSearch: true,
      sourceImageUrl: null,
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref-a.png'],
    }),
    {
      model: 'uni-1',
      type: 'image',
      prompt: 'A product poster with exact text "LAUNCH"',
      aspect_ratio: '1:1',
      style: 'auto',
      output_format: 'png',
      web_search: true,
      image_ref: [{ url: 'https://cdn.maxvideoai.com/ref-a.png' }],
    }
  );
});

test('Luma Uni-1 Max edit maps source and edit refs', () => {
  assert.deepEqual(
    buildLumaAgentsImagePayload({
      engineId: 'luma-uni-1-max',
      mode: 'i2i',
      prompt: 'Keep the object, change the background to brushed steel',
      aspectRatio: null,
      style: 'auto',
      outputFormat: 'jpeg',
      webSearch: false,
      sourceImageUrl: 'https://cdn.maxvideoai.com/source.png',
      referenceImageUrls: ['https://cdn.maxvideoai.com/ref.png'],
    }),
    {
      model: 'uni-1-max',
      type: 'image_edit',
      prompt: 'Keep the object, change the background to brushed steel',
      style: 'auto',
      output_format: 'jpeg',
      source: { url: 'https://cdn.maxvideoai.com/source.png' },
      image_ref: [{ url: 'https://cdn.maxvideoai.com/ref.png' }],
    }
  );
});

test('Luma image payload enforces reference limits and edit source', () => {
  assert.throws(
    () =>
      buildLumaAgentsImagePayload({
        engineId: 'luma-uni-1',
        mode: 't2i',
        prompt: 'Too many references',
        aspectRatio: '1:1',
        style: 'auto',
        outputFormat: 'png',
        webSearch: false,
        sourceImageUrl: null,
        referenceImageUrls: Array.from({ length: 10 }, (_, index) => `https://cdn.maxvideoai.com/ref-${index}.png`),
      }),
    (error) =>
      error instanceof LumaAgentsImageError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_IMAGE_TOO_MANY_REFERENCES'
  );

  assert.throws(
    () =>
      buildLumaAgentsImagePayload({
        engineId: 'luma-uni-1-max',
        mode: 'i2i',
        prompt: 'Missing source',
        aspectRatio: null,
        style: 'auto',
        outputFormat: 'png',
        webSearch: false,
        sourceImageUrl: null,
        referenceImageUrls: [],
      }),
    /requires a source image/
  );
});

test('Luma manga style rejects non-portrait text-to-image aspect ratios', () => {
  assert.throws(
    () =>
      buildLumaAgentsImagePayload({
        engineId: 'luma-uni-1',
        mode: 't2i',
        prompt: 'Manga landscape poster',
        aspectRatio: '16:9',
        style: 'manga',
        outputFormat: 'png',
        webSearch: false,
        sourceImageUrl: null,
        referenceImageUrls: [],
      }),
    (error) =>
      error instanceof LumaAgentsImageError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_IMAGE_MANGA_ASPECT_UNSUPPORTED'
  );
});
