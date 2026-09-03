import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry';
import { getModelRegistryEntryById } from '../frontend/config/model-registry';
import {
  validateCanonicalGenerationCapabilities,
} from '../frontend/src/server/agent-api/generation-capability-validation';
import {
  hashCanonicalGenerationRequest,
  normalizeGenerationRequest,
} from '../frontend/src/server/agent-api/generation-normalization';
import {
  CANONICAL_GENERATION_MODES,
  CANONICAL_VIDEO_GENERATION_MODES,
  type CanonicalGenerationRequest,
} from '../frontend/src/server/agent-api/generation-types';
import {
  listAgentModels,
  type AgentModelCatalogDeps,
  type AgentPublicGenerationEngine,
} from '../frontend/src/server/agent-api/model-catalog';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { isPaidVideoContinuationMode } from '../frontend/src/server/generations/paid-provider-execution';
import { prepareGenerationInputSchema } from '../frontend/src/server/mcp/tools/prepare-generation';
import { toCanonicalGenerationMode } from '../frontend/src/server/agent-api/generation-mode-aliases';

function registryCapability(engineId: string): AgentPublicGenerationEngine {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing registry engine ${engineId}`);
  const surface = entry.category === 'image' ? 'image' : 'video';
  const publicModes = entry.modes.flatMap(({ mode }) => {
    const canonical = toCanonicalGenerationMode(entry.id, surface, mode);
    return canonical ? [canonical] : [];
  });
  return {
    engine: entry.engine,
    surface,
    publicModes,
    modeCaps: Object.fromEntries(entry.modes.flatMap(({ mode, ui }) => {
      const canonical = toCanonicalGenerationMode(entry.id, surface, mode);
      return canonical ? [[canonical, ui]] : [];
    })),
  };
}

function realRegistryDeps(): AgentModelCatalogDeps {
  const entries = listFalEngines();
  return {
    async listEngines() {
      return entries.map(({ engine }) => engine);
    },
    surfaceByEngineId(engineId) {
      const entry = entries.find((candidate) => candidate.id === engineId);
      return entry?.category === 'image' ? 'image' : entry ? 'video' : null;
    },
    isEngineExecutable: () => true,
    isModeExecutable: () => true,
  };
}

function request(input: Record<string, unknown>): CanonicalGenerationRequest {
  return normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    prompt: 'Create one controlled cinematic transition.',
    outputCount: 1,
    ...input,
  });
}

test('MCP discovery exposes the executable first/last-frame and reference-video workflows', async () => {
  const deps = realRegistryDeps();
  const [veo] = await listAgentModels({ id: 'veo-3-1' }, deps);
  const [wan] = await listAgentModels({ id: 'wan-2-6' }, deps);

  assert.ok(veo);
  assert.ok(wan);
  assert.ok(veo.modes.includes('fl2v' as never));
  assert.ok(wan.modes.includes('r2v' as never));
});

test('MCP mode parity audit identifies every remaining specialized public workflow', async () => {
  const supported = new Set<string>(CANONICAL_GENERATION_MODES);
  const videoModes = new Set(CANONICAL_VIDEO_GENERATION_MODES);
  const imageModes = new Set(['t2i', 'i2i']);
  const publicEntries = listFalEngines().filter((entry) =>
    getModelRegistryEntryById(entry.id)?.publication.app.published === true
  );
  const remaining = publicEntries.flatMap((entry) =>
    entry.modes.flatMap(({ mode }) => {
      const surface = entry.category === 'image' ? 'image' : 'video';
      const surfaceModes = surface === 'image' ? imageModes : videoModes;
      const canonical = toCanonicalGenerationMode(entry.id, surface, mode);
      return canonical && supported.has(canonical) && surfaceModes.has(canonical)
        ? []
        : [`${entry.id}:${mode}`];
    })
  ).sort();

  assert.deepEqual(remaining, [
    'gemini-omni-flash:retake',
  ]);

  const deps = realRegistryDeps();
  for (const entry of publicEntries) {
    const [model] = await listAgentModels({ id: entry.id }, deps);
    assert.ok(model, `${entry.id} is published in the app but absent from MCP discovery`);
    const surface = entry.category === 'image' ? 'image' : 'video';
    const expectedModes = entry.modes.flatMap(({ mode }) => {
      const canonical = toCanonicalGenerationMode(entry.id, surface, mode);
      return canonical ? [canonical] : [];
    });
    assert.deepEqual(model.modes, expectedModes, entry.id);
  }
});

test('the specialized-mode audit records unpublished P1 media modes that remain intentionally closed', () => {
  const h3Max = UNPUBLISHED_FAL_ENGINE_REGISTRY.find((entry) => entry.id === 'minimax-h3-max');
  assert.ok(h3Max);

  const closed = h3Max.engine.modes
    .filter((mode) => mode !== 't2v')
    .map((mode) => `${h3Max.id}:${mode}`)
    .sort();

  assert.deepEqual(closed, [
    'minimax-h3-max:i2v',
    'minimax-h3-max:ref2v',
  ]);
});

test('MCP normalization and tool schema accept every transport-safe video workflow', () => {
  for (const mode of ['fl2v', 'r2v', 'a2v', 'retake', 'reframe']) {
    const input = {
      engineId: mode === 'fl2v'
        ? 'veo-3-1'
        : mode === 'r2v'
          ? 'wan-2-6'
          : mode === 'reframe'
            ? 'luma-ray-3-2'
            : 'ltx-2-3',
      mode,
      settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9' },
      references: [],
    };
    assert.equal(request(input).mode, mode);
    assert.equal(prepareGenerationInputSchema.safeParse({
      schemaVersion: 1,
      surface: 'video',
      prompt: 'Create one controlled cinematic transition.',
      outputCount: 1,
      ...input,
    }).success, true);
  }
});

test('the paid MCP continuation accepts every canonical public video mode', () => {
  assert.deepEqual(CANONICAL_VIDEO_GENERATION_MODES, [
    't2v', 'i2v', 'i2v_standard', 'ref2v', 'fl2v', 'v2v', 'r2v', 'extend', 'a2v', 'retake', 'reframe',
  ]);
  for (const mode of CANONICAL_VIDEO_GENERATION_MODES) {
    assert.equal(isPaidVideoContinuationMode(mode), true, mode);
  }

  for (const mode of ['i2i', undefined]) {
    assert.equal(isPaidVideoContinuationMode(mode), false, String(mode));
  }
});

test('Kling 2.5 Standard is a clear video alias while the site keeps its legacy i2i route', async () => {
  const [model] = await listAgentModels({ id: 'kling-2-5-turbo' }, realRegistryDeps());
  assert.ok(model?.modes.includes('i2v_standard'));
  assert.equal(model?.modes.includes('i2i'), false);

  const sourceUrl = 'https://cdn.example.com/kling-standard.png';
  const standard = request({
    engineId: 'kling-2-5-turbo',
    mode: 'i2v_standard',
    settings: {
      durationSec: 5,
      resolution: '1080p',
      aspectRatio: '16:9',
      cfgScale: 0.5,
    },
    references: [{
      kind: 'https', url: sourceUrl, role: 'source', mediaKind: 'image',
    }],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    standard, registryCapability('kling-2-5-turbo'),
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-kling-standard', request: standard,
    engine: registryCapability('kling-2-5-turbo').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(body.mode, 'i2i');
  assert.equal(body.imageUrl, sourceUrl);
});

test('LTX audio-to-video and retake project verified source media and canonical controls', () => {
  const audioAssetId = 'ma_audioaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const audioUrl = 'https://cdn.example.com/performance.wav';
  const a2v = request({
    engineId: 'ltx-2-3',
    mode: 'a2v',
    settings: { durationSec: 12, resolution: '1080p', guidanceScale: 7 },
    references: [{ kind: 'asset', assetId: audioAssetId, role: 'source' }],
  });
  const resolvedAudio = [{
    assetId: audioAssetId,
    role: 'source' as const,
    mediaKind: 'audio' as const,
    storageUrl: audioUrl,
    width: null,
    height: null,
    durationSec: 11.7,
    mimeType: 'audio/wav',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    a2v,
    registryCapability('ltx-2-3'),
    { resolvedReferences: resolvedAudio },
  ));
  const a2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-ltx-a2v', request: a2v, resolvedReferences: resolvedAudio,
    engine: registryCapability('ltx-2-3').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(a2vBody.audioUrl, audioUrl);
  assert.deepEqual(a2vBody.extraInputValues, { guidance_scale: 7 });

  const videoUrl = 'https://cdn.example.com/source.mp4';
  const videoAssetId = 'ma_retakeaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const retake = request({
    engineId: 'ltx-2-3',
    mode: 'retake',
    settings: {
      durationSec: 5,
      resolution: '1080p',
      startTimeSec: 3,
      retakeMode: 'replace_audio_and_video',
    },
    references: [{ kind: 'asset', assetId: videoAssetId, role: 'source' }],
  });
  const resolvedVideo = [{
    assetId: videoAssetId, role: 'source' as const, mediaKind: 'video' as const,
    storageUrl: videoUrl, width: 1920, height: 1080, durationSec: 12,
    mimeType: 'video/mp4',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    retake, registryCapability('ltx-2-3'), { resolvedReferences: resolvedVideo },
  ));
  const retakeBody = buildPaidVideoRequestBody({
    quoteId: 'quote-ltx-retake', request: retake, resolvedReferences: resolvedVideo,
    engine: registryCapability('ltx-2-3').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(retakeBody.videoUrl, videoUrl);
  assert.deepEqual(retakeBody.extraInputValues, {
    start_time: 3,
    retake_mode: 'replace_audio_and_video',
  });
});

test('Luma reframe uses source duration, fixed execution resolution, and canonical crop controls', () => {
  const sourceAssetId = 'ma_reframeaaaaaaaaaaaaaaaaaaaaaaaaa';
  const sourceUrl = 'https://cdn.example.com/reframe.mp4';
  const reframe = request({
    engineId: 'luma-ray-3-2',
    mode: 'reframe',
    settings: {
      durationSec: 8,
      resolution: '720p',
      aspectRatio: '9:16',
      sourcePositionX: 0.1,
      sourcePositionY: -0.2,
      sourcePositionWidth: 0.8,
      sourcePositionHeight: 1,
    },
    references: [{ kind: 'asset', assetId: sourceAssetId, role: 'source' }],
  });
  const resolved = [{
    assetId: sourceAssetId, role: 'source' as const, mediaKind: 'video' as const,
    storageUrl: sourceUrl, width: 1920, height: 1080, durationSec: 7.2, mimeType: 'video/mp4',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    reframe, registryCapability('luma-ray-3-2'), { resolvedReferences: resolved },
  ));
  assert.throws(() => validateCanonicalGenerationCapabilities(
    { ...reframe, settings: { ...reframe.settings, durationSec: 7 } },
    registryCapability('luma-ray-3-2'),
    { resolvedReferences: resolved },
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-luma-reframe', request: reframe, resolvedReferences: resolved,
    engine: registryCapability('luma-ray-3-2').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(body.videoUrl, sourceUrl);
  assert.deepEqual(body.extraInputValues, {
    source_position_x_norm: 0.1,
    source_position_y_norm: -0.2,
    source_position_w_norm: 0.8,
    source_position_h_norm: 1,
  });
});

test('trusted source duration constraints reject out-of-range audio before generation', () => {
  const candidate = registryCapability('ltx-2-3');
  const assetId = 'ma_shortaudioaaaaaaaaaaaaaaaaaaaaaaaa';
  const requestFor = (durationSec: number): CanonicalGenerationRequest => request({
    engineId: 'ltx-2-3',
    mode: 'a2v',
    settings: { durationSec: Math.ceil(durationSec), resolution: '1080p' },
    references: [{ kind: 'asset', assetId, role: 'source' }],
  });
  const resolvedFor = (durationSec: number) => [{
    assetId,
    role: 'source' as const,
    mediaKind: 'audio' as const,
    storageUrl: 'https://cdn.example.com/source.wav',
    width: null,
    height: null,
    durationSec,
    mimeType: 'audio/wav',
  }];

  assert.throws(() => validateCanonicalGenerationCapabilities(
    requestFor(1.5), candidate, { resolvedReferences: resolvedFor(1.5) },
  ));
  assert.throws(() => validateCanonicalGenerationCapabilities(
    requestFor(20.1), candidate, { resolvedReferences: resolvedFor(20.1) },
  ));
});

test('real capability validation enforces the reference contract for fl2v and r2v', () => {
  const fl2v = request({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/first.png', role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: 'https://cdn.example.com/last.png', role: 'last_frame', mediaKind: 'image' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(fl2v, registryCapability('veo-3-1')));

  const r2v = request({
    engineId: 'wan-2-6',
    mode: 'r2v',
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
    references: [
      { kind: 'https', url: 'https://cdn.example.com/a.mp4', role: 'reference', mediaKind: 'video' },
      { kind: 'https', url: 'https://cdn.example.com/b.mp4', role: 'reference', mediaKind: 'video' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(r2v, registryCapability('wan-2-6')));
});

test('schema-specific reference fields stay executable for Veo extend and Gemini Omni ref2v', () => {
  const sourceUrl = 'https://cdn.example.com/source.mp4';
  const veoExtend = request({
    engineId: 'veo-3-1',
    mode: 'extend',
    settings: { durationSec: 7, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [{
      kind: 'https',
      url: sourceUrl,
      role: 'source',
      mediaKind: 'video',
    }],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    veoExtend,
    registryCapability('veo-3-1'),
  ));
  const veoBody = buildPaidVideoRequestBody({
    quoteId: 'quote-veo-extend',
    request: veoExtend,
    engine: registryCapability('veo-3-1').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(veoBody.videoUrl, sourceUrl);
  assert.deepEqual(veoBody.inputs, [{ kind: 'video', slotId: 'video_url', url: sourceUrl }]);

  const referenceUrls = [
    'https://cdn.example.com/omni-a.png',
    'https://cdn.example.com/omni-b.png',
  ];
  const omniRef2v = request({
    engineId: 'gemini-omni-flash',
    mode: 'ref2v',
    settings: { durationSec: 8, resolution: '720p', aspectRatio: '16:9', audio: true },
    references: referenceUrls.map((url) => ({
      kind: 'https' as const,
      url,
      role: 'reference' as const,
      mediaKind: 'image' as const,
    })),
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    omniRef2v,
    registryCapability('gemini-omni-flash'),
  ));
  const omniBody = buildPaidVideoRequestBody({
    quoteId: 'quote-omni-ref2v',
    request: omniRef2v,
    engine: registryCapability('gemini-omni-flash').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(omniBody.referenceImages, referenceUrls);
});

test('Luma Ray 3.2 v2v preserves its optional guide image through the site request contract', () => {
  const sourceAssetId = 'ma_lumaray32guideaaaaaaaaaaaaaaaaaaa';
  const sourceUrl = 'https://cdn.example.com/luma-source.mp4';
  const guideUrl = 'https://cdn.example.com/luma-guide.png';
  const lumaV2v = request({
    engineId: 'luma-ray-3-2',
    mode: 'v2v',
    settings: { durationSec: 5, resolution: '720p' },
    references: [
      { kind: 'asset', assetId: sourceAssetId, role: 'source' },
      { kind: 'https', url: guideUrl, role: 'first_frame', mediaKind: 'image' },
    ],
  });
  const resolvedReferences = [{
    assetId: sourceAssetId,
    role: 'source' as const,
    mediaKind: 'video' as const,
    storageUrl: sourceUrl,
    width: 1920,
    height: 1080,
    durationSec: 5,
    mimeType: 'video/mp4',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    lumaV2v,
    registryCapability('luma-ray-3-2'),
  ));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    lumaV2v,
    registryCapability('luma-ray-3-2'),
    { resolvedReferences },
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-luma-v2v-guide',
    request: lumaV2v,
    resolvedReferences,
    engine: registryCapability('luma-ray-3-2').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(body.videoUrl, sourceUrl);
  assert.equal(body.imageUrl, guideUrl);
  assert.deepEqual(body.inputs, [
    {
      assetId: sourceAssetId,
      kind: 'video', slotId: 'video_url', url: sourceUrl,
      width: 1920, height: 1080, durationSec: 5, type: 'video/mp4',
    },
    { kind: 'image', slotId: 'start_image_url', url: guideUrl },
  ]);
});

test('Luma Ray 3.2 v2v sends ordered canonical reference images as edit keyframes', () => {
  const sourceAssetId = 'ma_lumaray32keyframesaaaaaaaaaaaaaaaa';
  const sourceUrl = 'https://cdn.example.com/luma-keyframe-source.mp4';
  const keyframes = [
    'https://cdn.example.com/luma-keyframe-0.png',
    'https://cdn.example.com/luma-keyframe-48.png',
  ];
  const requestWithKeyframes = request({
    engineId: 'luma-ray-3-2',
    mode: 'v2v',
    settings: {
      durationSec: 5,
      resolution: '720p',
      editKeyframeIndexes: '0,48',
    },
    references: [
      { kind: 'asset', assetId: sourceAssetId, role: 'source' },
      ...keyframes.map((url, slot) => ({
        kind: 'https' as const,
        url,
        role: 'reference' as const,
        mediaKind: 'image' as const,
        slot,
      })),
    ],
  });
  const candidate = registryCapability('luma-ray-3-2');
  const resolvedReferences = [{
    assetId: sourceAssetId,
    role: 'source' as const,
    mediaKind: 'video' as const,
    storageUrl: sourceUrl,
    width: 1920,
    height: 1080,
    durationSec: 5,
    mimeType: 'video/mp4',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    requestWithKeyframes,
    candidate,
  ));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    requestWithKeyframes,
    candidate,
    { resolvedReferences },
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-luma-v2v-keyframes',
    request: requestWithKeyframes,
    resolvedReferences,
    engine: candidate.engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(body.referenceImages, keyframes);
  assert.deepEqual(body.inputs, [
    {
      assetId: sourceAssetId,
      kind: 'video', slotId: 'video_url', url: sourceUrl,
      width: 1920, height: 1080, durationSec: 5, type: 'video/mp4',
    },
    { kind: 'image', slotId: 'edit_keyframe_urls', url: keyframes[0] },
    { kind: 'image', slotId: 'edit_keyframe_urls', url: keyframes[1] },
  ]);
});

test('Luma Ray 2 v2v uses verified owned-source duration and its fixed pricing resolution', () => {
  const assetId = 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const sourceUrl = 'https://cdn.example.com/luma-ray2-source.mp4';
  const guideUrl = 'https://cdn.example.com/luma-ray2-guide.png';
  const lumaV2v = request({
    engineId: 'lumaRay2',
    mode: 'v2v',
    settings: { durationSec: 9, resolution: '540p' },
    references: [
      { kind: 'asset', assetId, role: 'source' },
      { kind: 'https', url: guideUrl, role: 'reference', mediaKind: 'image' },
    ],
  });
  const resolvedReferences = [{
    assetId,
    role: 'source' as const,
    mediaKind: 'video' as const,
    storageUrl: sourceUrl,
    width: 1920,
    height: 1080,
    durationSec: 8.7,
    mimeType: 'video/mp4',
  }];
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    lumaV2v,
    registryCapability('lumaRay2'),
  ));
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    lumaV2v,
    registryCapability('lumaRay2'),
    { resolvedReferences },
  ));
  assert.throws(() => validateCanonicalGenerationCapabilities(
    { ...lumaV2v, settings: { ...lumaV2v.settings, durationSec: 8 } },
    registryCapability('lumaRay2'),
    { resolvedReferences },
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-luma-ray2-v2v',
    request: lumaV2v,
    resolvedReferences,
    engine: registryCapability('lumaRay2').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(body.videoUrl, sourceUrl);
  assert.equal(body.imageUrl, guideUrl);
  assert.deepEqual(body.inputs, [
    {
      assetId,
      kind: 'video',
      slotId: 'video_url',
      url: sourceUrl,
      width: 1920,
      height: 1080,
      durationSec: 8.7,
      type: 'video/mp4',
    },
    { kind: 'image', slotId: 'image_url', url: guideUrl },
  ]);
});

test('Kling O3 ref2v preserves optional start and end framing alongside reference images', () => {
  const startUrl = 'https://cdn.example.com/kling-start.png';
  const endUrl = 'https://cdn.example.com/kling-end.png';
  const referenceUrl = 'https://cdn.example.com/kling-reference.png';
  const klingRef2v = request({
    engineId: 'kling-o3-standard',
    mode: 'ref2v',
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [
      { kind: 'https', url: startUrl, role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: endUrl, role: 'last_frame', mediaKind: 'image' },
      { kind: 'https', url: referenceUrl, role: 'reference', mediaKind: 'image' },
    ],
  });
  assert.doesNotThrow(() => validateCanonicalGenerationCapabilities(
    klingRef2v,
    registryCapability('kling-o3-standard'),
  ));
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-kling-o3-framed-ref2v',
    request: klingRef2v,
    engine: registryCapability('kling-o3-standard').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(body.imageUrl, startUrl);
  assert.equal(body.endImageUrl, endUrl);
  assert.deepEqual(body.referenceImages, [referenceUrl]);
  assert.deepEqual(body.inputs, [
    { kind: 'image', slotId: 'start_image_url', url: startUrl },
    { kind: 'image', slotId: 'end_image_url', url: endUrl },
  ]);
});

test('paid video projection preserves first/last-frame and ordered reference-video slots', () => {
  const firstUrl = 'https://cdn.example.com/first.png';
  const lastUrl = 'https://cdn.example.com/last.png';
  const fl2v = request({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    settings: { durationSec: 8, resolution: '1080p', aspectRatio: '16:9' },
    references: [
      { kind: 'https', url: firstUrl, role: 'first_frame', mediaKind: 'image' },
      { kind: 'https', url: lastUrl, role: 'last_frame', mediaKind: 'image' },
    ],
  });
  const fl2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-fl2v',
    request: fl2v,
    engine: registryCapability('veo-3-1').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.equal(fl2vBody.imageUrl, firstUrl);
  assert.equal(fl2vBody.endImageUrl, lastUrl);
  assert.deepEqual(fl2vBody.inputs, [
    { kind: 'image', slotId: 'first_frame_url', url: firstUrl },
    { kind: 'image', slotId: 'last_frame_url', url: lastUrl },
  ]);

  const referenceUrls = ['https://cdn.example.com/z-first.mp4', 'https://cdn.example.com/a-second.mp4'];
  const r2v = request({
    engineId: 'wan-2-6',
    mode: 'r2v',
    settings: { durationSec: 5, resolution: '1080p', aspectRatio: '16:9' },
    references: referenceUrls.map((url) => ({
      kind: 'https', url, role: 'reference', mediaKind: 'video',
    })),
  });
  assert.doesNotThrow(() => hashCanonicalGenerationRequest(r2v));
  const r2vBody = buildPaidVideoRequestBody({
    quoteId: 'quote-r2v',
    request: r2v,
    engine: registryCapability('wan-2-6').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(r2vBody.referenceVideos, referenceUrls);
  assert.deepEqual(r2vBody.inputs, referenceUrls.map((url) => ({
    kind: 'video', slotId: 'video_urls', url,
  })));
});

test('paid video projection preserves verified source duration for the existing site pipeline', () => {
  const assetId = 'ma_0123456789abcdef0123456789abcdef';
  const sourceUrl = 'https://cdn.example.com/owned-source.mp4';
  const extend = request({
    engineId: 'veo-3-1',
    mode: 'extend',
    settings: { durationSec: 7, resolution: '1080p', aspectRatio: '16:9', audio: true },
    references: [{ kind: 'asset', assetId, role: 'source' }],
  });
  const body = buildPaidVideoRequestBody({
    quoteId: 'quote-owned-source-duration',
    request: extend,
    resolvedReferences: [{
      assetId,
      role: 'source',
      slot: 0,
      mediaKind: 'video',
      storageUrl: sourceUrl,
      width: 1920,
      height: 1080,
      durationSec: 12.4,
      mimeType: 'video/mp4',
    }],
    engine: registryCapability('veo-3-1').engine,
    canonicalPricing: { membershipTier: 'member' },
  });
  assert.deepEqual(body.inputs, [{
    assetId,
    kind: 'video',
    slotId: 'video_url',
    url: sourceUrl,
    width: 1920,
    height: 1080,
    durationSec: 12.4,
    type: 'video/mp4',
  }]);
});
