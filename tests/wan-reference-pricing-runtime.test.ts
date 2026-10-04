import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';
import type { PreflightRequest } from '../frontend/types/engines';

const source = 'https://cdn.maxvideoai.com/private/source.mp4';
for (const id of ['wan-3', 'wan-3-prime']) {
  for (const mode of ['ref2v', 'v2v', 'extend'] as const) {
    test(`${id}/${mode}: quote includes the owned input video duration and commercial margin`, async () => {
      const engine = listFalEngines().find((entry) => entry.id === id)!.engine;
      const request: PreflightRequest = {
        engine: id, mode, durationSec: 5, resolution: '720p', aspectRatio: '16:9', fps: 24,
        hasVideoInput: false,
        inputs: [{ assetId: 'owned-source', slotId: mode === 'ref2v' ? 'reference_video_urls' : 'video_url', kind: 'video', url: source }],
      };
      const dependencies = {
        getConfiguredEngineFn: async () => engine,
        mediaConstraintDeps: { queryFn: async <T>() => [{
          asset_id: 'owned-source', url: source, origin_url: null, original_name: 'source.mp4',
          mime_type: 'video/mp4', size_bytes: 1_000, duration_sec: 10, width: 1280, height: 720,
        }] as T[] },
      };
      const quote = await resolveMediaAwarePreflight({ request, userId: 'owner' }, dependencies);
      assert.equal(quote.ok, true, JSON.stringify(quote.error));
      assert.equal(quote.total, id === 'wan-3' ? 195 : 273);
      assert.equal(quote.pricing?.meta?.input_video_duration_sec, 10);
      const missing = await resolveMediaAwarePreflight({ request, userId: 'owner' }, {
        ...dependencies, mediaConstraintDeps: { queryFn: async () => [] },
      });
      assert.equal(missing.ok, false);
      const forged = await resolveMediaAwarePreflight({ request: {
        ...request, extraInputValues: { inputVideoDurationSec: 0 },
      }, userId: 'owner' }, dependencies);
      assert.equal(forged.error?.code, 'PRICING_MEDIA_FACTS_UNTRUSTED');
      const overLimit = await resolveMediaAwarePreflight({ request: { ...request, durationSec: 25 }, userId: 'owner' }, dependencies);
      assert.equal(overLimit.ok, false, 'input plus output cannot exceed 30 seconds');
    });
  }
}

test('preflight accepts the full Wan reference count of ten images, five videos and five audio clips', () => {
  const inputs: NonNullable<PreflightRequest['inputs']> = [];
  for (const [kind, count, extension] of [['image', 10, 'png'], ['video', 5, 'mp4'], ['audio', 5, 'wav']] as const) {
    for (let index = 0; index < count; index++) inputs.push({
      assetId: `${kind}-${index}`, kind, slotId: `reference_${kind}_urls`, url: `https://example.com/${kind}-${index}.${extension}`,
    });
  }
  assert.equal(parsePreflightRequestPayload({ engine: 'wan-3', mode: 'ref2v', durationSec: 5, resolution: '720p', fps: 24, inputs }).ok, true);
});

import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
test('Wan mixed reference generation rejects over thirty total seconds before billing', () => {
  const options = {
    mode: 'ref2v' as const, attachments: [], videoUrls: [source], engineLabel: 'Wan 3',
    maxSourcePlusOutputDurationSec: 30, inputVideoDurationSec: 15,
  };
  assert.equal(resolveGenerateSourceVideoContext({ ...options, fallbackDurationSec: 15 }).ok, true);
  const rejected = resolveGenerateSourceVideoContext({ ...options, fallbackDurationSec: 16 });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.status, 422);
});

import { requireCurrentWebPricingPolicy } from '../frontend/server/pricing/web-pricing-policy';
import { LIVE_PRICING_POLICY_REVISION } from '../frontend/src/lib/membership-policy';
test('old web tabs must refresh an output-only quote before the corrected reference price can be charged', async () => {
  const stale = requireCurrentWebPricingPolicy({ headers: { get: () => 'standard-2026-09-07' } }, 'video');
  assert.equal(stale?.status, 409);
  assert.match((await stale!.json()).message, /review the current price/);
  assert.equal(requireCurrentWebPricingPolicy({ headers: { get: () => LIVE_PRICING_POLICY_REVISION } }, 'video'), null);
});
