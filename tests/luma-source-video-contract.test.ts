import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import { priceCanonicalGeneration, priceCanonicalGenerationWithBilling } from '../frontend/src/server/agent-api/generation-pricing';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const engine = listFalEngines().find(entry => entry.id === 'luma-ray-3-2')!.engine;
const url = 'https://media.maxvideoai.com/user-assets/luma-user/source.mp4';
const source: ResolvedReference = { assetId: 'ma_' + 'a'.repeat(32), role: 'source', mediaKind: 'video',
  storageUrl: url, mimeType: 'video/mp4', sizeBytes: 1000, width: 1280, height: 720, durationSec: 5 };
const pricing = { totalCents: 150, currency: 'USD', membershipTier: 'member' } as const;
const priced = { ok: true, total: 150, currency: 'USD', pricing } as never;
function request(mode: 'v2v' | 'reframe', durationSec = 5): CanonicalGenerationRequest {
  return { schemaVersion: 1, surface: 'video', engineId: engine.id, mode, prompt: 'Change the room.',
    settings: { durationSec, resolution: '720p', aspectRatio: '16:9' }, outputCount: 1,
    references: [{ kind: 'asset', assetId: source.assetId, role: 'source' }] };
}

for (const [mode, measured, requested, ok] of [
  ['v2v', 5, 5, true], ['v2v', 10, 10, true], ['v2v', 8, 5, false],
  ['v2v', 10, 5, false], ['v2v', 5.01, 5, false], ['v2v', 18.01, 5, false], ['v2v', null, 5, false],
  ['reframe', 8, 10, true], ['reframe', 10, 10, true], ['reframe', 11, 10, false],
] as const) {
  test(`Web Luma ${mode} measured ${measured}s / selected ${requested}s: ${ok ? 'quotes' : 'refuses before quote'}`, async () => {
    let quotes = 0;
    const result = await resolveMediaAwarePreflight({ userId: 'luma-user', request: {
      engine: engine.id, mode, durationSec: requested, resolution: '720p', aspectRatio: '16:9', fps: 24,
      inputs: [{ assetId: source.assetId, kind: 'video', slotId: 'video_url', url }],
    } }, { getConfiguredEngineFn: async () => engine,
      computeConfiguredPreflightFn: async input => { quotes++; assert.equal(input.durationSec, requested); return priced; },
      mediaConstraintDeps: { queryFn: async () => [{ asset_id: source.assetId, url, origin_url: null,
        original_name: 'source.mp4', mime_type: 'video/mp4', size_bytes: 1000,
        duration_sec: measured, width: 1280, height: 720 }] as never[] },
    });
    assert.equal(result.ok, ok);
    assert.equal(quotes, ok ? 1 : 0);
  });
}

test('execution never trusts a caller attachment duration for Luma Modify', () => {
  const params = { engineId: engine.id, engineLabel: engine.label, mode: 'v2v' as const,
    attachments: [{ name: 'source.mp4', type: 'video/mp4', size: 1000, kind: 'video' as const,
      slotId: 'video_url', url, durationSec: 5 }], sourceInputVideoUrl: url, videoUrls: [url],
    fallbackDurationSec: 5, fallbackDurationLabel: '5s', maxDurationSec: 18 };
  assert.equal(resolveGenerateSourceVideoContext(params).ok, false);
  assert.equal(resolveGenerateSourceVideoContext({ ...params, trustedSourceDurationSec: 8 }).ok, false);
  assert.equal(resolveGenerateSourceVideoContext({ ...params, trustedSourceDurationSec: 5 }).ok, true);
});

test('Reframe execution bills the selected 10s even with an 8s source', () => {
  const result = resolveGenerateSourceVideoContext({ engineId: engine.id, engineLabel: engine.label,
    mode: 'reframe', attachments: [], sourceInputVideoUrl: url, videoUrls: [url],
    fallbackDurationSec: 10, fallbackDurationLabel: '10s', trustedSourceDurationSec: 8 });
  assert.deepEqual(result, { ok: true, durationSec: 10, durationLabel: '10s', hasVideoInput: true });
});

for (const mode of ['v2v', 'reframe'] as const) {
  test(`canonical ${mode} prices only the exact owned source before estimates and transaction billing`, async () => {
    let quotes = 0;
    const inspect = async () => { quotes++; return priced; };
    const snapshot = async () => { quotes++; return pricing as never; };
    const deps = { computeVideoPreflight: inspect, estimateImage: async () => { throw new Error('Unexpected image'); } };
    const invalid = mode === 'v2v' ? 8 : 11;
    for (const refs of [undefined, [], [{ ...source, assetId: 'other' }], [{ ...source, durationSec: null }], [{ ...source, durationSec: invalid }]]) {
      await assert.rejects(priceCanonicalGeneration(request(mode), 'member', deps, { resolvedReferences: refs }));
      await assert.rejects(priceCanonicalGenerationWithBilling(request(mode), 'member',
        { resolvedEngine: engine, resolvedReferences: refs }, snapshot));
    }
    assert.equal(quotes, 0);
    await priceCanonicalGeneration(request(mode), 'member', deps, { resolvedReferences: [source] });
    await priceCanonicalGenerationWithBilling(request(mode), 'member', { resolvedEngine: engine, resolvedReferences: [source] }, snapshot);
    assert.equal(quotes, 2);
  });
}

test('Web Luma quote refuses a missing source and never borrows an original URL duration', async () => {
  for (const inputs of [[], [{ assetId: source.assetId, kind: 'video' as const, slotId: 'video_url', url }]]) {
    let quotes = 0;
    const result = await resolveMediaAwarePreflight({ userId: 'luma-user', request: {
      engine: engine.id, mode: 'v2v', durationSec: 5, resolution: '720p', fps: 24, inputs,
    } }, { getConfiguredEngineFn: async () => engine,
      computeConfiguredPreflightFn: async () => { quotes++; return priced; },
      mediaConstraintDeps: { queryFn: async () => [{ asset_id: source.assetId,
        url: 'https://media.maxvideoai.com/user-assets/luma-user/different.mp4', origin_url: url,
        original_name: 'source.mp4', mime_type: 'video/mp4', size_bytes: 1000,
        duration_sec: 5, width: 1280, height: 720 }] as never[] },
    });
    assert.equal(result.ok, false);
    assert.equal(quotes, 0);
  }
});
