import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { validateRuntimeRequestSettings } from '../frontend/app/api/generate/_lib/runtime-schema-options';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import { priceCanonicalGeneration, priceCanonicalGenerationWithBilling } from '../frontend/src/server/agent-api/generation-pricing';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { resolveLumaAgentsSubmissionMediaInputs } from '../frontend/app/api/generate/_lib/luma-agents-submission';

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
  ['v2v', 3.2, 10, true], ['v2v', 5, 5, true], ['v2v', 10, 10, true], ['v2v', 8, 5, true],
  ['v2v', 10, 5, true], ['v2v', 5.01, 5, true], ['v2v', 17.52, 5, true], ['v2v', 18.01, 5, false], ['v2v', null, 5, false],
  ['reframe', 8, 10, true], ['reframe', 10, 10, true], ['reframe', 11, 10, false],
] as const) {
  test(`Web Luma ${mode} measured ${measured}s / selected ${requested}s: ${ok ? 'quotes' : 'refuses before quote'}`, async () => {
    let quotes = 0;
    const result = await resolveMediaAwarePreflight({ userId: 'luma-user', request: {
      engine: engine.id, mode, durationSec: requested, resolution: '720p', aspectRatio: '16:9', fps: 24,
      inputs: [{ assetId: source.assetId, kind: 'video', slotId: 'video_url', url }],
    } }, { getConfiguredEngineFn: async () => engine,
      computeConfiguredPreflightFn: async input => { quotes++; assert.equal(input.durationSec, mode === 'v2v' ? Math.max(5, Math.ceil(measured!)) : requested); return priced; },
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
  assert.equal(resolveGenerateSourceVideoContext({ ...params, trustedSourceVideo: { url, durationSec: 8 } }).ok, true);
  assert.equal(resolveGenerateSourceVideoContext({ ...params, trustedSourceVideo: { url, durationSec: 5 } }).ok, true);
  assert.equal(resolveGenerateSourceVideoContext({ ...params,
    trustedSourceVideo: { url: 'https://example.test/different-source.mp4', durationSec: 5 } }).ok, false);
});

test('Reframe execution bills the selected 10s even with an 8s source', () => {
  const result = resolveGenerateSourceVideoContext({ engineId: engine.id, engineLabel: engine.label,
    mode: 'reframe', attachments: [], sourceInputVideoUrl: url, videoUrls: [url],
    fallbackDurationSec: 10, fallbackDurationLabel: '10s', trustedSourceVideo: { url, durationSec: 8 } });
  assert.deepEqual(result, { ok: true, durationSec: 10, durationLabel: '10s', hasVideoInput: true });
});

for (const mode of ['v2v', 'reframe'] as const) {
  test(`canonical ${mode} prices only the exact owned source before estimates and transaction billing`, async () => {
    let quotes = 0;
    const inspect = async () => { quotes++; return priced; };
    const snapshot = async () => { quotes++; return pricing as never; };
    const deps = { computeVideoPreflight: inspect, estimateImage: async () => { throw new Error('Unexpected image'); } };
    const invalid = mode === 'v2v' ? 18.01 : 11;
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

for (const mode of ['v2v', 'reframe'] as const) {
  test(`${mode} binds provider source to exactly one verified video_url attachment`, async () => {
    const owned = { name: 'source.mp4', type: 'video/mp4', size: 1000, kind: 'video' as const,
      assetId: source.assetId, slotId: 'video_url', url };
    const validate = (attachments: typeof owned[]) => validateNormalizedGenerationAttachments({
      engineId: engine.id, mode, inputSchema: engine.inputSchema, userId: 'luma-user', attachments,
      mediaConstraintDeps: { queryFn: async () => [{ asset_id: source.assetId, url, origin_url: null,
        original_name: 'source.mp4', mime_type: 'video/mp4', size_bytes: 1000,
        duration_sec: 5, width: 1280, height: 720 }] as never[] },
    });
    for (const slotId of ['', 'source_video_url', 'video_urls', 'video_url']) {
      const result = await validate([{ ...owned, assetId: 'foreign', slotId,
        url: 'https://example.test/unverified-18s.mp4' }, owned]);
      assert.equal(result.ok, false, `reject alternate source slot ${slotId || '(missing)'}`);
    }
    assert.equal((await validate([owned, owned])).ok, false, 'reject duplicate source occurrences');
    const result = await validate([owned]);
    assert.ok(result.ok);
    const trusted = result.trustedMediaReferences?.find(ref => ref.kind === 'video' && ref.url === result.references.sourceInputVideoUrl);
    assert.ok(trusted);
    const context = resolveGenerateSourceVideoContext({ engineId: engine.id, engineLabel: engine.label,
      mode, attachments: result.attachments, sourceInputVideoUrl: result.references.sourceInputVideoUrl,
      videoUrls: result.references.videoUrls, fallbackDurationSec: 5,
      trustedSourceVideo: trusted });
    assert.ok(context.ok);
    const media = resolveLumaAgentsSubmissionMediaInputs({ imageUrl: null,
      falPayload: { engineId: engine.id, mode, durationSec: context.durationSec, inputs: result.attachments } as never });
    assert.equal(media.sourceVideoUrl, trusted.url);
    assert.equal(context.durationSec, trusted.durationSec);
  });
}

for (const durationSec of [5.558333, 8.4, 17.52, 18]) {
  test(`Luma Modify binds both canonical quotes and execution to measured ${durationSec}s`, async () => {
    const measuredSource = { ...source, durationSec };
    const quotes: number[] = [];
    await priceCanonicalGeneration(request('v2v', 5), 'member', {
      computeVideoPreflight: async input => { quotes.push(input.durationSec); return priced; },
      estimateImage: async () => { throw new Error('Unexpected image'); },
    }, { resolvedReferences: [measuredSource] });
    await priceCanonicalGenerationWithBilling(request('v2v', 10), 'member', {
      resolvedEngine: engine, resolvedReferences: [measuredSource],
    }, async input => { quotes.push(input.durationSec); return pricing as never; });
    const execution = resolveGenerateSourceVideoContext({ engineId: engine.id, engineLabel: engine.label,
      mode: 'v2v', attachments: [], sourceInputVideoUrl: url, videoUrls: [url],
      fallbackDurationSec: 5, trustedSourceVideo: { url, durationSec } });
    assert.deepEqual(quotes, [Math.ceil(durationSec), Math.ceil(durationSec)]);
    assert.deepEqual(execution, { ok: true, durationSec: Math.ceil(durationSec),
      durationLabel: `${Math.ceil(durationSec)}s`, hasVideoInput: true });
  });
}


test('runtime duration presets do not reject source-timed Modify before owned media resolution', () => {
  for (const durationSec of [6, 9, 18]) {
    assert.equal(validateRuntimeRequestSettings({ engine, mode: 'v2v', durationSec }).ok, true);
  }
  assert.equal(validateRuntimeRequestSettings({ engine, mode: 't2v', durationSec: 6 }).ok, false);
});


test('canonical capability admission accepts the full Modify source domain', () => {
  const entry = listFalEngines().find(entry => entry.id === engine.id)!;
  const candidate = { engine, surface: 'video' as const, publicModes: ['v2v' as const],
    modeCaps: Object.fromEntries(entry.modes.map(mode => [mode.mode, mode.ui])) };
  for (const durationSec of [6, 9, 18]) {
    const input = request('v2v', durationSec);
    delete input.settings.aspectRatio;
    assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(input, candidate,
      { resolvedReferences: [{ ...source, durationSec: durationSec === 18 ? 17.52 : durationSec - 0.2 }] }));
  }
});
