import assert from 'node:assert/strict';
import test from 'node:test';
import { KLING_V4_FLASH_ENGINE, KLING_V4_FLASH_ENDPOINTS } from '../frontend/src/config/fal-engines/kling-v4-flash';
import { buildKlingV4FlashFalRequest, getKlingV4FlashConstraintViolation } from '../frontend/src/lib/kling-v4-flash';
import { buildFalGenerationRequest } from '../frontend/src/lib/fal-request-body';
import { validateKlingV4OwnedMedia } from '../frontend/app/api/generate/_lib/kling-v4-owned-media';
import type { GeneratePayload } from '../frontend/src/lib/fal-types';

const payload: GeneratePayload = { engineId: 'kling-v4-flash', mode: 't2v', prompt: 'An original scene', durationSec: 5, resolution: '720p' };
const url = 'https://media.maxvideoai.com/user-assets/reference.mp4';

test('Flash exposes only its three exact 720p generation contracts', () => {
  assert.deepEqual(KLING_V4_FLASH_ENGINE.modes, ['t2v', 'i2v', 'ref2v']);
  assert.deepEqual(KLING_V4_FLASH_ENGINE.resolutions, ['720p']);
  assert.equal(KLING_V4_FLASH_ENGINE.maxDurationSec, 20);
  for (const durationSec of [3, 20]) assert.equal(buildKlingV4FlashFalRequest({ ...payload, durationSec }).requestBody.duration, durationSec);
  for (const durationSec of [2, 21, 3.5]) assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, durationSec }));
  for (const resolution of ['1080p', '4k']) assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, resolution }));
  assert.deepEqual(buildFalGenerationRequest(payload, 'wrong/model'), { model: KLING_V4_FLASH_ENDPOINTS.t2v, requestBody: { prompt: payload.prompt, duration: 5, resolution: '720p', aspect_ratio: '16:9' } });
});

test('Flash refuses incompatible restored controls and preserves repeated references', () => {
  for (const extra of [{ multiPrompt: [] }, { endImageUrl: url }, { videoUrl: url }, { fps: 24 }, { seed: 1 }, { cfgScale: 1 }, { audio: false }, { voiceIds: ['voice'] }, { shotType: 'customize' }, { loop: false }, { cameraFixed: false }, { numFrames: 120 }, { extraInputValues: { anything: 1 } }]) {
    assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, ...extra } as GeneratePayload), JSON.stringify(extra));
  }
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, durationOption: '4' }));
  for (const mode of ['v2v', 'extend']) assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, mode }));
  const result = buildKlingV4FlashFalRequest({ ...payload, mode: 'ref2v', inputs: [0, 1].map(() => ({ name: 'video', type: 'video/mp4', size: 1, kind: 'video', slotId: 'video_urls', url })) });
  assert.deepEqual(result.requestBody.video_urls, [url, url]);
  assert.equal(result.model, KLING_V4_FLASH_ENDPOINTS.ref2v);
});

test('Flash image mode requires a start frame, permits an empty prompt and has no ending frame or ratio control', () => {
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, mode: 'i2v' }));
  assert.deepEqual(buildKlingV4FlashFalRequest({ ...payload, mode: 'i2v', prompt: '', imageUrl: url }).requestBody, { start_image_url: url, duration: 5, resolution: '720p' });
  assert.ok(getKlingV4FlashConstraintViolation('i2v', { start_image_url: url, duration: 5, aspect_ratio: '16:9' }));
});

test('Flash reference envelope bounds flat media and subjects without voice or provider bindings', () => {
  const base = { prompt: 'Scene', duration: 5 };
  for (const extra of [{}, { image_urls: Array(11).fill(url) }, { start_image_url: url, image_urls: Array(10).fill(url) }, { video_urls: Array(6).fill(url) }, { elements: Array(4).fill({ video_url: url }) }, { elements: [{ video_url: url, voice_id: 'v' }] }, { elements: [{ frontal_image_url: url }] }]) {
    assert.ok(getKlingV4FlashConstraintViolation('ref2v', { ...base, ...extra }), JSON.stringify(extra));
  }
  const imageSubject = { frontal_image_url: url, reference_image_urls: [url] };
  assert.equal(getKlingV4FlashConstraintViolation('ref2v', { ...base, elements: Array(7).fill(imageSubject) }), null);
  // Conservative launch envelope: 15 actual originals, including subject views.
  assert.ok(getKlingV4FlashConstraintViolation('ref2v', { ...base, elements: Array(7).fill(imageSubject), image_urls: [url, url] }));
  assert.throws(() => buildKlingV4FlashFalRequest({ ...payload, mode: 'ref2v', elements: [{ videoUrl: url, providerElementId: 'unverified' }] }));
});

async function owned(durationSec: number, repeats = 1, subject = false, hasOwner = true) {
  let probes = 0;
  const result = await validateKlingV4OwnedMedia({ engineId: 'kling-v4-flash', mode: 'ref2v', userId: 'owner',
    attachments: subject ? [] : Array.from({ length: repeats }, () => ({ name: 'v', type: 'video/mp4', size: 1, kind: 'video', slotId: 'video_urls', assetId: 'source', url, durationSec: 1 })),
    referenceMediaItems: subject ? [] : Array.from({ length: repeats }, () => ({ fieldId: 'video_urls', kind: 'video', url })),
    elements: subject ? [{ videoUrl: url, videoAssetId: 'source' }] : [],
    deps: { queryFn: async <T>() => (hasOwner ? [{ asset_id: 'source', url, mime_type: 'video/mp4', size_bytes: 1024, width: 1280, height: 720 }] : []) as T[],
      detectVideoMetadataFn: async () => { probes++; return { width: 1280, height: 720, durationSec, fps: 24 }; } } });
  return { result, probes };
}

test('Flash counts each owned video occurrence with exact timing and an independent 8s subject bound', async () => {
  assert.equal((await owned(10, 2)).result.ok, true);
  const overflow = await owned(10.001, 2);
  assert.equal(overflow.result.ok, false); assert.equal(overflow.probes, 1);
  assert.equal((await owned(20.01)).result.ok, false);
  assert.equal((await owned(8.05, 1, true)).result.ok, true);
  assert.equal((await owned(8.051, 1, true)).result.ok, false);
  const privateInput = await owned(5, 1, false, false);
  assert.equal(privateInput.result.ok, false); assert.equal(privateInput.probes, 0);
});
