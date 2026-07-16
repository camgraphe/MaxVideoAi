import assert from 'node:assert/strict';
import test from 'node:test';

import { POST as estimateImagePricing } from '../frontend/app/api/images/estimate/route.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  ImageEstimateError,
  estimateImageGeneration,
} from '../frontend/src/server/images/estimate-image-generation.ts';

type EstimatePayload = {
  ok?: boolean;
  error?: string;
  allowed?: string[];
  pricing?: {
    currency: string;
    totalCents: number;
    base: { amountCents: number; seconds: number };
    margin: { amountCents: number; percentApplied?: number };
    platformFeeCents?: number;
    vendorShareCents?: number;
    meta?: Record<string, unknown>;
  };
};

async function postEstimate(body: unknown) {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  return { response, payload: (await response.json()) as EstimatePayload };
}

test('existing route estimates GPT Image 2 in integer USD cents', async () => {
  const { response, payload } = await postEstimate({
    engineId: 'gpt-image-2',
    mode: 't2i',
    numImages: 1,
    resolution: '1024x768',
    quality: 'high',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    {
      currency: payload.pricing?.currency,
      totalCents: payload.pricing?.totalCents,
      baseCents: payload.pricing?.base.amountCents,
      marginCents: payload.pricing?.margin.amountCents,
      platformFeeCents: payload.pricing?.platformFeeCents,
      vendorShareCents: payload.pricing?.vendorShareCents,
      billedImageSize: payload.pricing?.meta?.billed_image_size,
      quality: payload.pricing?.meta?.quality,
    },
    {
      currency: 'USD',
      totalCents: 20,
      baseCents: 15,
      marginCents: 5,
      platformFeeCents: 5,
      vendorShareCents: 15,
      billedImageSize: '1024x768',
      quality: 'high',
    }
  );
});

test('existing route clamps and prices an ordinary text-to-image request', async () => {
  const { response, payload } = await postEstimate({
    engineId: 'nano-banana-lite',
    mode: 't2i',
    numImages: 99,
    resolution: '1k',
    aspectRatio: '16:9',
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    {
      currency: payload.pricing?.currency,
      totalCents: payload.pricing?.totalCents,
      baseCents: payload.pricing?.base.amountCents,
      seconds: payload.pricing?.base.seconds,
      marginCents: payload.pricing?.margin.amountCents,
    },
    { currency: 'USD', totalCents: 16, baseCents: 12, seconds: 4, marginCents: 4 }
  );
});

test('existing route preserves image-to-image reference count pricing', async () => {
  const { response, payload } = await postEstimate({
    engineId: 'luma-uni-1-max',
    mode: 'i2i',
    numImages: 1,
    resolution: '2K',
    referenceImageSizes: [
      { width: 1024, height: 1024 },
      { width: 1024, height: 1024 },
      { width: 1024, height: 1024 },
    ],
  });

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(
    {
      totalCents: payload.pricing?.totalCents,
      baseCents: payload.pricing?.base.amountCents,
      referenceCount: payload.pricing?.meta?.source_or_reference_image_count,
    },
    { totalCents: 15, baseCents: 12, referenceCount: 3 }
  );
});

test('existing route returns the exact invalid-resolution adapter error', async () => {
  const { response, payload } = await postEstimate({
    engineId: 'nano-banana-lite',
    mode: 't2i',
    resolution: '4k',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(payload, { ok: false, error: 'resolution_invalid', allowed: ['1k'] });
});

test('existing route returns the exact unsupported-mode adapter error', async () => {
  const engineEntry = listFalEngines().find((entry) => entry.id === 'nano-banana-lite');
  assert.ok(engineEntry);
  const originalModes = engineEntry.modes;
  engineEntry.modes = originalModes.filter((entry) => entry.mode !== 'i2i');
  try {
    const { response, payload } = await postEstimate({
      engineId: 'nano-banana-lite',
      mode: 'i2i',
      resolution: '1k',
    });

    assert.equal(response.status, 400);
    assert.deepEqual(payload, { ok: false, error: 'mode_unsupported' });
  } finally {
    engineEntry.modes = originalModes;
  }
});

test('transport-neutral estimate returns canonical GPT Image 2 pricing and normalized dimensions', async () => {
  const result = await estimateImageGeneration({
    engineId: 'gpt-image-2',
    mode: 't2i',
    numImages: 1,
    resolution: '1024x768',
    quality: 'high',
  });

  assert.deepEqual(result.normalized, {
    engineId: 'gpt-image-2',
    mode: 't2i',
    numImages: 1,
    resolution: '1024x768',
    quality: 'high',
    aspectRatio: null,
    customImageSize: { width: 1024, height: 768 },
    referenceImageCount: 0,
    referenceImageSizes: [],
  });
  assert.deepEqual(
    {
      currency: result.pricing.currency,
      totalCents: result.pricing.totalCents,
      baseCents: result.pricing.base.amountCents,
      marginCents: result.pricing.margin.amountCents,
    },
    { currency: 'USD', totalCents: 20, baseCents: 15, marginCents: 5 }
  );
});

test('transport-neutral estimate clamps ordinary text-to-image output count', async () => {
  const result = await estimateImageGeneration({
    engineId: 'nano-banana-lite',
    mode: 't2i',
    numImages: 99,
    resolution: '1k',
    aspectRatio: '16:9',
  });

  assert.equal(result.normalized.numImages, 4);
  assert.equal(result.normalized.aspectRatio, '16:9');
  assert.equal(result.pricing.currency, 'USD');
  assert.equal(result.pricing.totalCents, 16);
});

test('transport-neutral estimate preserves image-to-image reference count and auto-size behavior', async () => {
  const referenceImageSizes = [
    { width: 1024, height: 1024 },
    { width: 3840, height: 2160 },
    { width: 512, height: 512 },
  ];
  const luma = await estimateImageGeneration({
    engineId: 'luma-uni-1-max',
    mode: 'i2i',
    numImages: 1,
    resolution: '2K',
    referenceImageCount: 3,
    referenceImageSizes,
  });
  const gpt = await estimateImageGeneration({
    engineId: 'gpt-image-2',
    mode: 'i2i',
    numImages: 1,
    resolution: 'auto',
    quality: 'low',
    referenceImageCount: 3,
    referenceImageSizes,
  });

  assert.equal(luma.pricing.totalCents, 15);
  assert.equal(luma.pricing.meta?.source_or_reference_image_count, 3);
  assert.equal(gpt.pricing.totalCents, 3);
  assert.equal(gpt.pricing.meta?.billed_image_size, '3840x2160');
  assert.deepEqual(gpt.normalized.customImageSize, { width: 3840, height: 2160 });
  assert.notEqual(gpt.normalized.referenceImageSizes, referenceImageSizes);
});

test('transport-neutral estimate exposes stable validation errors', async () => {
  await assert.rejects(
    estimateImageGeneration({
      engineId: 'nano-banana-lite',
      mode: 't2i',
      resolution: '4k',
    }),
    (error: unknown) =>
      error instanceof ImageEstimateError &&
      error.code === 'resolution_invalid' &&
      error.status === 400 &&
      assert.deepEqual(error.allowed, ['1k']) === undefined
  );
});

test('transport-neutral estimate never applies web-only storyboard pricing', async () => {
  const result = await estimateImageGeneration({
    engineId: 'gpt-image-2',
    mode: 't2i',
    numImages: 1,
    resolution: '1024x768',
    quality: 'medium',
    source: 'storyboard',
  } as Parameters<typeof estimateImageGeneration>[0] & { source: 'storyboard' });

  assert.equal(result.pricing.totalCents, 6);
  assert.notEqual(result.pricing.meta?.pricing_model, 'storyboarder_x3');
});
