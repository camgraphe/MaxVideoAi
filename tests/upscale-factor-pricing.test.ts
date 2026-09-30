import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUpscalePricingPreview, resolveUpscaleMode } from '../frontend/src/lib/tools-upscale';
import { getUpscaleToolEngine } from '../frontend/src/config/tools-upscale-engines';
import { buildUpscaleFalInput } from '../frontend/src/server/tools/upscale-request-utils';

const metadata = { width: 1280, height: 720, durationSec: 10, fps: 30 };

test('factor-mode estimates use the actual provider factor instead of an unused target resolution', () => {
  for (const [engineId, factor, wantedCents, megapixels] of [
    ['flashvsr-video', 2, 222, 1105.92], ['flashvsr-video', 4, 885, 4423.68],
    ['seedvr-video', 2, 443, 1105.92], ['seedvr-video', 4, 1770, 4423.68],
  ] as const) {
    assert.equal(resolveUpscaleMode(getUpscaleToolEngine(engineId, 'video'), 'factor'), 'factor');
    const preview = buildUpscalePricingPreview({ mediaType: 'video', engineId, unitPriceCents: 80,
      currency: 'USD', videoMetadata: metadata, targetResolution: '1080p', mode: 'factor', upscaleFactor: factor });
    assert.equal(preview.totalCents, wantedCents, `${engineId} ${factor}×`);
    assert.equal(preview.estimate?.megapixels, megapixels);
    const payload = buildUpscaleFalInput({ engine: getUpscaleToolEngine(engineId, 'video'), mediaUrl: 'https://example.com/source.mp4',
      mode: 'factor', upscaleFactor: factor, targetResolution: '1080p', outputFormat: 'mp4', metadata });
    assert.equal(payload.upscale_factor, factor);
    if (engineId === 'flashvsr-video') assert.equal('target_resolution' in payload, false);
    else assert.equal(payload.upscale_mode, 'factor');
  }
});

test('supported target quotes, minima and malformed unsupported factor selection retain provider-normalized behavior', () => {
  for (const [engineId, mode, wantedCents] of [
    ['seedvr-video', 'target', 249], ['topaz-video', 'target', 80], ['topaz-video', 'factor', 80],
  ] as const) {
    const preview = buildUpscalePricingPreview({ mediaType: 'video', engineId, unitPriceCents: 80,
      currency: 'USD', videoMetadata: metadata, targetResolution: '1080p', mode, upscaleFactor: 2 });
    assert.equal(preview.totalCents, wantedCents);
  }
  const defaultFactor = buildUpscalePricingPreview({ mediaType: 'video', engineId: 'flashvsr-video', unitPriceCents: 80,
    videoMetadata: metadata, targetResolution: '2160p', upscaleFactor: 3 });
  assert.equal(defaultFactor.totalCents, 222, 'unsupported factor normalizes to the same default as provider submission');
  const minimum = buildUpscalePricingPreview({ mediaType: 'video', engineId: 'flashvsr-video', unitPriceCents: 300,
    videoMetadata: metadata, targetResolution: '1080p', upscaleFactor: 2 });
  assert.equal(minimum.totalCents, 300);
});
