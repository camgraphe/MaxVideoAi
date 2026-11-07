import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_FLASH_ENGINE } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { buildKlingV4FlashFalRequest, getKlingV4FlashControlViolation, getKlingV4FlashConstraintViolation } from '../frontend/src/lib/kling-v4-flash';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';
import { validateCanonicalGenerationCapabilities } from '../frontend/src/server/agent-api/generation-capability-validation';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import { validateKlingV4OwnedMedia } from '../frontend/app/api/generate/_lib/kling-v4-owned-media';
import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import { buildGenerationSettingsSnapshot } from '../frontend/app/api/generate/_lib/settings-snapshot';
import { buildVideoSettingsFormState, resolveVideoSettingsSnapshot } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-settings';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import type { ResolvedReference } from '../frontend/src/server/agent-api/reference-types';

const sourceUrl = 'https://media.maxvideoai.com/user-assets/source.mp4';
const refUrl = 'https://media.maxvideoai.com/user-assets/reference.mp4';
const imageUrl = 'https://media.maxvideoai.com/user-assets/reference.png';
const payload: GeneratePayload = { engineId: 'kling-v4-flash', mode: 'v2v', prompt: 'Edit @Video1 using @Image1 and @Video2', resolution: '720p', videoUrl: sourceUrl };
const attachment = (slotId: string, url: string, assetId: string, kind: 'video' | 'image' = 'video') => ({ slotId, url, assetId, kind, name: assetId, type: `${kind}/${kind === 'image' ? 'png' : 'mp4'}`, size: 1024 });
const source: ResolvedReference = { assetId: 'source', role: 'source', mediaKind: 'video', storageUrl: sourceUrl, mimeType: 'video/mp4', width: 1280, height: 720, durationSec: 6.25, fps: 24, sizeBytes: 1024 };
const video: ResolvedReference = { ...source, assetId: 'ref-video', role: 'reference', slot: 0, storageUrl: refUrl, durationSec: 3.5 };
const image: ResolvedReference = { ...source, assetId: 'ref-image', role: 'reference', slot: 1, mediaKind: 'image', storageUrl: imageUrl, mimeType: 'image/png', durationSec: null };
const candidate = { engine: KLING_V4_FLASH_ENGINE, surface: 'video' as const, publicModes: KLING_V4_FLASH_ENGINE.modes, modeCaps: KLING_V4_FLASH_ENGINE.modeCaps! };

test('Flash Modify selects its exact edit endpoint and inherits timing/framing by omitting controls', () => {
  assert.ok(KLING_V4_FLASH_ENGINE.modes.includes('v2v'));
  assert.deepEqual(buildFalGenerationRequest(payload, 'wrong/model'), { model: 'kling/v4/flash/video-to-video', requestBody: { prompt: payload.prompt, video_url: sourceUrl, resolution: '720p' } });
  for (const durationSec of [3, 20]) assert.equal(buildKlingV4FlashFalRequest({ ...payload, durationSec }).requestBody.duration, durationSec);
  assert.equal(getKlingV4FlashControlViolation('v2v', { videoUrl: sourceUrl }), null);
  for (const patch of [{ durationSec: 3.5 }, { durationSec: 21 }, { aspectRatio: '16:9' }, { imageUrl }, { fps: 24 }, { audio: false }, { endImageUrl: imageUrl }]) {
    assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, ...patch }), JSON.stringify(patch));
  }
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, videoUrl: undefined }));
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, prompt: '' }));
});

test('Flash Modify keeps source, repeated references and subject videos in their own slots', () => {
  const result = buildKlingV4FlashFalRequest({ ...payload, inputs: [attachment('video_url', sourceUrl, 'source'), attachment('video_urls', refUrl, 'ref'), attachment('video_urls', refUrl, 'ref'), attachment('image_urls', imageUrl, 'image', 'image')], elements: [{ videoUrl: refUrl, videoAssetId: 'subject' }] });
  assert.equal(result.requestBody.video_url, sourceUrl);
  assert.deepEqual(result.requestBody.video_urls, [refUrl, refUrl]);
  assert.deepEqual(result.requestBody.image_urls, [imageUrl]);
  assert.deepEqual(result.requestBody.elements, [{ video_url: refUrl }]);
  const input = { prompt: 'Edit', video_url: sourceUrl };
  assert.equal(getKlingV4FlashConstraintViolation('v2v', { ...input, image_urls: Array(10).fill(imageUrl), video_urls: Array(4).fill(refUrl) }), null);
  for (const patch of [{ video_urls: Array(5).fill(refUrl) }, { image_urls: Array(11).fill(imageUrl) }, { elements: Array(4).fill({ video_url: refUrl }) }, { elements: Array(7).fill({ frontal_image_url: imageUrl, reference_image_urls: [imageUrl] }), image_urls: [imageUrl] }]) {
    assert.ok(getKlingV4FlashConstraintViolation('v2v', { ...input, ...patch }), JSON.stringify(patch));
  }
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, inputs: [attachment('video_url', refUrl, 'other')] }), /source|conflict/i);
});

test('web execution uses trusted exact source timing only when output duration is omitted', () => {
  const base = { engineId: 'kling-v4-flash', mode: 'v2v' as const, engineLabel: 'Flash', attachments: [], sourceInputVideoUrl: sourceUrl, videoUrls: [refUrl], fallbackDurationSec: 5, maxDurationSec: 20,
    trustedSourceVideo: { url: sourceUrl, durationSec: 6.25, width: 1280, height: 720 } };
  assert.deepEqual(resolveGenerateSourceVideoContext({ ...base, inheritSourceDuration: true }), { ok: true, durationSec: 6.25, durationLabel: '6.25s', hasVideoInput: true });
  assert.equal(resolveGenerateSourceVideoContext({ ...base, inheritSourceDuration: false }).ok, true);
  const explicit = resolveGenerateSourceVideoContext({ ...base, inheritSourceDuration: false, fallbackDurationSec: 3 });
  assert.equal(explicit.ok && explicit.durationSec, 3);
  assert.equal(resolveGenerateSourceVideoContext({ ...base, trustedSourceVideo: { ...base.trustedSourceVideo, url: refUrl } }).ok, false);
  assert.equal(resolveGenerateSourceVideoContext({ ...base, trustedSourceVideo: { ...base.trustedSourceVideo, durationSec: 30 } }).ok, false);
});

test('native Flash Modify snapshots preserve inherited intent across fractional and whole-source replay', () => {
  for (const [durationSec, inherited] of [[6.25, true], [6, true], [3, false]] as const) {
    const snapshot = buildGenerationSettingsSnapshot({ engineId: 'kling-v4-flash', engineLabel: 'Flash', mode: 'v2v', prompt: 'Edit',
      negativePrompt: null, membershipTier: 'member', durationSec, durationOption: inherited ? null : 3, inheritSourceDuration: inherited,
      numFrames: null, aspectRatio: null, resolution: '720p', clampedFps: undefined, rawFps: undefined, iterationCount: 1,
      audioEnabled: undefined, cfgScale: undefined, isLumaRay2: false, loop: false, shotType: null, seed: null, cameraFixed: null, safetyChecker: null,
      voiceIds: [], voiceControl: false, multiPrompt: null, extraInputValues: {}, initialImageUrl: undefined, resolvedFirstFrameUrl: undefined,
      resolvedAudioUrl: undefined, normalizedReferenceImages: [], videoUrls: [sourceUrl], lastFrameUrl: undefined, endImageUrl: null, elements: null,
      falInputs: [{ ...attachment('video_url', sourceUrl, 'source'), width: 1280, height: 720, durationSec: 6.25 }],
    } as Parameters<typeof buildGenerationSettingsSnapshot>[0]);
    const restored = resolveVideoSettingsSnapshot(snapshot, { engines: [KLING_V4_FLASH_ENGINE], engineMap: new Map([['kling-v4-flash', KLING_V4_FLASH_ENGINE]]),
      createLocalId: id => id, createFallbackScene: () => ({ id: 'scene', prompt: '', duration: 5 }),
      createFallbackKlingElement: () => ({ id: 'subject', frontal: null, references: [null, null, null], video: null }) });
    const form = coerceFormState(KLING_V4_FLASH_ENGINE, 'v2v', buildVideoSettingsFormState(restored));
    assert.equal(form.durationOption, inherited ? 'auto' : 3);
    assert.equal(form.durationSec, durationSec);
  }
});

test('canonical Flash Modify retains owned source and optional media through the paid adapter projection', () => {
  for (const durationSec of [undefined, 3, 20]) {
    const resolvedReferences = [source, video, image];
    const request = normalizeGenerationRequest({ surface: 'video', engineId: 'kling-v4-flash', mode: 'v2v', prompt: payload.prompt,
      settings: { resolution: '720p', ...(durationSec === undefined ? {} : { durationSec }) },
      references: resolvedReferences.map(ref => ({ kind: 'asset', assetId: ref.assetId, role: ref.role, ...(ref.slot === undefined ? {} : { slot: ref.slot }) })) });
    validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences });
    const body = buildPaidVideoRequestBody({ request, resolvedReferences, engine: candidate.engine, quoteId: 'offline', canonicalPricing: { membershipTier: 'member' } });
    const provider = buildKlingV4FlashFalRequest(body as GeneratePayload);
    assert.equal(provider.requestBody.video_url, sourceUrl);
    assert.deepEqual(provider.requestBody.video_urls, [refUrl]);
    assert.deepEqual(provider.requestBody.image_urls, [imageUrl]);
    assert.equal(provider.requestBody.duration, durationSec);
    assert.equal(provider.requestBody.aspect_ratio, undefined);
    assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [source, { ...video, durationSec: 14 }, image] }));
  }
});

test('canonical Flash Modify supports video subjects and enforces their independent timing limit', () => {
  const request = normalizeGenerationRequest({ surface: 'video', engineId: 'kling-v4-flash', mode: 'v2v', prompt: 'Edit @Video1 with @Element1', settings: { resolution: '720p' },
    references: [{ kind: 'asset', assetId: source.assetId, role: 'source' }, { kind: 'asset', assetId: video.assetId, role: 'reference', slot: 0 }], subjects: [{ kind: 'video', referenceSlot: 0 }] });
  validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [source, video] });
  const body = buildPaidVideoRequestBody({ request, resolvedReferences: [source, video], engine: candidate.engine, quoteId: 'offline', canonicalPricing: { membershipTier: 'member' } });
  const projected = buildKlingV4FlashFalRequest(body as GeneratePayload);
  assert.deepEqual(projected.requestBody.elements, [{ video_url: refUrl }]);
  assert.equal(projected.requestBody.video_urls, undefined);
  assert.throws(() => validateCanonicalGenerationCapabilities(request, candidate, { resolvedReferences: [source, { ...video, durationSec: 8.051 }] }));
});

test('web Flash Modify validates exact owned originals and the source plus all repeated reference seconds', async () => {
  async function validate(sourceSeconds: number, refSeconds: number, owner = true, subject = false) {
    let probes = 0;
    const refs = [attachment('video_url', sourceUrl, 'source'), ...(!subject ? [attachment('video_urls', refUrl, 'ref'), attachment('video_urls', refUrl, 'ref')] : [])];
    const result = await validateKlingV4OwnedMedia({ engineId: 'kling-v4-flash', mode: 'v2v', userId: 'owner', attachments: refs,
      referenceMediaItems: refs.map(ref => ({ fieldId: ref.slotId, kind: ref.kind, url: ref.url })), elements: subject ? [{ videoUrl: refUrl, videoAssetId: 'ref' }] : [],
      deps: { queryFn: async <T>() => (owner ? [{ asset_id: 'source', url: sourceUrl }, { asset_id: 'ref', url: refUrl }].map(row => ({ ...row, mime_type: 'video/mp4', size_bytes: 1024, width: 1280, height: 720 })) : []) as T[],
        detectVideoMetadataFn: async url => { probes++; return { width: 1280, height: 720, durationSec: url === sourceUrl ? sourceSeconds : refSeconds, fps: 24 }; } } });
    return { result, probes };
  }
  assert.equal((await validate(10, 5)).result.ok, true);
  const overflow = await validate(10.001, 5);
  assert.equal(overflow.result.ok, false); assert.equal(overflow.probes, 2);
  assert.equal((await validate(10, 8.05, true, true)).result.ok, true);
  assert.equal((await validate(10, 8.051, true, true)).result.ok, false);
  const denied = await validate(5, 5, false);
  assert.equal(denied.result.ok, false); assert.equal(denied.probes, 0);
});
