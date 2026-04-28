import assert from 'node:assert/strict';
import test from 'node:test';

import {
  UPSCALE_OUTPUT_IMAGE_FETCH_TIMEOUT_MS,
  buildUpscalePricingPreview,
  resolveUpscaleOutputFetchTimeoutMs,
} from '../frontend/src/lib/tools-upscale';
import { resolveFalModelId } from '../frontend/src/lib/fal-catalog';

test('upscale price preview uses the billing product price for image runs', () => {
  const preview = buildUpscalePricingPreview({
    mediaType: 'image',
    engineId: 'topaz-image',
    unitPriceCents: 15,
    currency: 'USD',
    imageWidth: 1200,
    imageHeight: 900,
    upscaleFactor: 2,
  });

  assert.deepEqual(preview, {
    totalCents: 15,
    currency: 'USD',
    estimate: null,
    ready: true,
  });
});

test('upscale price preview computes dynamic video pricing before generation', () => {
  const preview = buildUpscalePricingPreview({
    mediaType: 'video',
    engineId: 'topaz-video',
    unitPriceCents: 25,
    currency: 'USD',
    videoMetadata: {
      width: 1280,
      height: 720,
      durationSec: 5,
      fps: 30,
    },
    targetResolution: '1080p',
    upscaleFactor: 2,
  });

  assert.equal(preview.totalCents, 40);
  assert.equal(preview.currency, 'USD');
  assert.equal(preview.ready, true);
  assert.deepEqual(preview.estimate, {
    megapixels: 311.04,
    frames: 150,
    durationSec: 5,
  });
});

test('upscale video pricing follows the full detected duration instead of a global 20 second cap', () => {
  const preview = buildUpscalePricingPreview({
    mediaType: 'video',
    engineId: 'topaz-video',
    unitPriceCents: 25,
    currency: 'USD',
    videoMetadata: {
      width: 1280,
      height: 720,
      durationSec: 45,
      fps: 30,
    },
    targetResolution: '1080p',
    upscaleFactor: 2,
  });

  assert.equal(preview.totalCents, 360);
  assert.equal(preview.estimate?.durationSec, 45);
  assert.equal(preview.estimate?.frames, 1350);
});

test('upscale output fetch timeout scales beyond the old 20 second video threshold', () => {
  assert.equal(
    resolveUpscaleOutputFetchTimeoutMs({ mediaType: 'image' }),
    UPSCALE_OUTPUT_IMAGE_FETCH_TIMEOUT_MS
  );
  assert.equal(resolveUpscaleOutputFetchTimeoutMs({ mediaType: 'video', durationSec: 45 }), 180_000);
});

test('upscale polling resolves the dedicated Fal model ids', async () => {
  const previousTopazVideo = process.env.FAL_MODEL_TOPAZ_VIDEO;
  const previousSeedvrImage = process.env.FAL_MODEL_SEEDVR_IMAGE;
  delete process.env.FAL_MODEL_TOPAZ_VIDEO;
  delete process.env.FAL_MODEL_SEEDVR_IMAGE;
  try {
    assert.equal(await resolveFalModelId('topaz-video'), 'fal-ai/topaz/upscale/video');
    assert.equal(await resolveFalModelId('seedvr-image'), 'fal-ai/seedvr/upscale/image');
  } finally {
    if (previousTopazVideo === undefined) {
      delete process.env.FAL_MODEL_TOPAZ_VIDEO;
    } else {
      process.env.FAL_MODEL_TOPAZ_VIDEO = previousTopazVideo;
    }
    if (previousSeedvrImage === undefined) {
      delete process.env.FAL_MODEL_SEEDVR_IMAGE;
    } else {
      process.env.FAL_MODEL_SEEDVR_IMAGE = previousSeedvrImage;
    }
  }
});
