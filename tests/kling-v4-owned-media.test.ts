import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import type { StoredMediaMetadataRow } from '../frontend/app/api/generate/_lib/generation-media-constraints';
import type { MaxVideoProviderElement } from '../frontend/src/lib/video-provider-elements';
import { validateKlingV4OwnedMedia } from '../frontend/app/api/generate/_lib/kling-v4-owned-media';
import { parsePreflightRequestPayload } from '../frontend/app/api/preflight/_lib/preflight-request';

const original = (id: string) => `https://media.maxvideoai.com/user-assets/${id}.jpg`;
const row = (id: string): StoredMediaMetadataRow => ({ asset_id: id, url: original(id), origin_url: null,
  original_name: `${id}.jpg`, mime_type: 'image/jpeg', size_bytes: 1024, width: 1024, height: 1024 });
const attachment = (id: string, slotId = 'image_url') => ({ name: `${id}.jpg`, kind: 'image' as const,
  type: 'image/jpeg', size: 1, width: 9999, height: 9999, slotId, assetId: id, url: original(id) });
const imageElement = (id: string): MaxVideoProviderElement => ({ frontalAssetId: `${id}-front`, frontalImageUrl: original(`${id}-front`),
  referenceAssetIds: [`${id}-side`], referenceImageUrls: [original(`${id}-side`)] });
async function validate(input: {
  mode?: 'i2v' | 'ref2v' | 'v2v'; attachments?: ReturnType<typeof attachment>[];
  elements?: MaxVideoProviderElement[]; rows?: StoredMediaMetadataRow[];
}) {
  return validateNormalizedGenerationAttachments({ engineId: 'kling-v4', mode: input.mode ?? 'i2v',
    userId: 'owner', inputSchema: KLING_V4_ENGINE.inputSchema, attachments: input.attachments ?? [],
    elements: input.elements, mediaConstraintDeps: { queryFn: async <T>(sql: string, params?: readonly unknown[]) => {
      assert.match(sql, /user_id = \$1/); assert.equal(params?.[0], 'owner'); return (input.rows ?? []) as T[];
    } } });
}

test('Kling V4 refuses unowned frames even when the browser supplies dimensions', async () => {
  const result = await validate({ attachments: [attachment('private')] });
  assert.equal(result.ok, false);
});
test('Kling V4 requires the exact asset and original pair, never an origin URL or another owned ID', async () => {
  for (const stored of [{ ...row('wrong-id'), url: original('claimed') }, { ...row('claimed'), url: original('new'), origin_url: original('claimed') }]) {
    assert.equal((await validate({ attachments: [attachment('claimed')], rows: [stored] })).ok, false);
  }
});
test('Kling V4 verifies every subject view and blocks unowned voice bindings', async () => {
  const elements = [imageElement('actor')], rows = [row('actor-front'), row('actor-side')];
  assert.equal((await validate({ mode: 'ref2v', elements, rows: rows.slice(0, 1) })).ok, false);
  assert.equal((await validate({ mode: 'ref2v', elements: [{ ...elements[0], voiceId: 'unverified' }], rows })).ok, false);
  assert.equal((await validate({ mode: 'ref2v', elements, rows })).ok, true);
});
test('Kling V4 returns trusted dimensions, ordered views and exact source facts', async () => {
  const result = await validate({ attachments: [attachment('frame')], rows: [row('frame')] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.attachments[0].width, 1024);
  assert.equal(result.trustedMediaReferences?.[0]?.url, original('frame'));
});
test('Kling V4 preserves seven owned image subjects without silently dropping views', async () => {
  const elements = Array.from({ length: 7 }, (_, i) => imageElement(`actor${i}`));
  const rows = elements.flatMap(element => [row(element.frontalAssetId!), row(element.referenceAssetIds![0])]);
  const result = await validate({ mode: 'ref2v', elements, rows });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.trustedMediaReferences?.length, 14);
});

const videoUrl = 'https://media.maxvideoai.com/user-assets/source.mp4';
const videoRow = { ...row('source'), url: videoUrl, mime_type: 'video/mp4' };
async function validateVideos(facts: { width: number; height: number; durationSec: number; fps: number } | null, repeats = 1, mode: 'ref2v' | 'v2v' = 'ref2v') {
  let probes = 0;
  const fieldId = mode === 'v2v' ? 'video_url' : 'video_urls';
  const result = await validateKlingV4OwnedMedia({ mode, userId: 'owner',
    attachments: Array.from({ length: repeats }, () => ({ name: 'source.mp4', type: 'video/mp4', size: 1, kind: 'video', slotId: fieldId, url: videoUrl, assetId: 'source', durationSec: 1 })),
    referenceMediaItems: Array.from({ length: repeats }, () => ({ fieldId, url: videoUrl, kind: 'video' })),
    deps: { queryFn: async <T>() => [videoRow] as T[], detectVideoMetadataFn: async (url, options) => {
      assert.equal(url, videoUrl); assert.equal(options?.requireExactFrameRate, true); probes++; return facts;
    } } });
  return { result, probes };
}
test('Kling V4 validates actual cadence and dimensions without rounding or browser facts', async () => {
  const valid = { width: 1280, height: 720, durationSec: 5.01, fps: 24000 / 1001 };
  for (const facts of [null, { ...valid, fps: 23.89 }, { ...valid, fps: 60.06 }, { ...valid, width: 699 }, { ...valid, height: 5000 }, { ...valid, durationSec: 30.06 }]) {
    assert.equal((await validateVideos(facts)).result.ok, false);
  }
  const { result } = await validateVideos(valid);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.trustedMediaReferences[0].durationSec, 5.01);
    assert.equal(result.trustedMediaReferences[0].fps, 24000 / 1001);
  }
});
test('Repeated videos consume time each time but are probed only once; Edit tolerance does not raise R2V total', async () => {
  const facts = { width: 1280, height: 720, durationSec: 15.01, fps: 24 };
  const repeated = await validateVideos(facts, 2);
  assert.equal(repeated.probes, 1); assert.equal(repeated.result.ok, false);
  assert.equal((await validateVideos({ ...facts, durationSec: 15 }, 2)).result.ok, true);
  assert.equal((await validateVideos({ ...facts, durationSec: 30.02 }, 1, 'v2v')).result.ok, true);
  assert.equal((await validateVideos({ ...facts, durationSec: 30.02 })).result.ok, false);
});
test('Neither missing ownership nor unsafe URLs can initiate the video probe', async () => {
  for (const url of [videoUrl, 'http://127.0.0.1/private', 'https://untrusted.example/source.mp4']) {
    let probes = 0;
    const result = await validateKlingV4OwnedMedia({ mode: 'v2v', userId: 'owner',
      attachments: [{ name: 'v', type: 'video/mp4', size: 1, kind: 'video', slotId: 'video_url', url, assetId: 'source' }],
      referenceMediaItems: [{ fieldId: 'video_url', kind: 'video', url }], deps: { queryFn: async () => [],
        detectVideoMetadataFn: async () => { probes++; return null; } } });
    assert.equal(result.ok, false); assert.equal(probes, 0);
  }
});
test('Preflight retains seven strict owned subjects, rejects other-model/Edit video/unverified voice projections', () => {
  const request = { engine: 'kling-v4', mode: 'ref2v', durationSec: 30, elements: Array.from({ length: 7 }, (_, i) => imageElement(`actor${i}`)) };
  const parsed = parsePreflightRequestPayload(request);
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.request.elements, request.elements);
  for (const invalid of [{ ...request, engine: 'kling-v3' }, { ...request, mode: 't2v' },
    { ...request, elements: [{ ...imageElement('a'), voiceId: 'arbitrary' }] },
    { ...request, mode: 'v2v', elements: [{ videoUrl, videoAssetId: 'source' }] },
    { ...request, elements: [{ ...imageElement('a'), referenceAssetIds: [] }] }]) {
    assert.equal(parsePreflightRequestPayload(invalid).ok, false);
  }
});
test('A conflicting scalar image projection cannot hide behind an owned attachment', async () => {
  const result = await validateNormalizedGenerationAttachments({ engineId: 'kling-v4', mode: 'i2v', userId: 'owner',
    inputSchema: KLING_V4_ENGINE.inputSchema, attachments: [attachment('frame')], imageUrl: original('unowned'),
    mediaConstraintDeps: { queryFn: async <T>() => [row('frame')] as T[] } });
  assert.equal(result.ok, false);
});

test('Repeated URLs still require every submitted asset ID to be owned', async () => {
  const first = attachment('owned', 'image_urls');
  const result = await validateNormalizedGenerationAttachments({ engineId: 'kling-v4', mode: 'ref2v', userId: 'owner',
    inputSchema: KLING_V4_ENGINE.inputSchema, attachments: [first, { ...first, assetId: 'unowned' }],
    mediaConstraintDeps: { queryFn: async <T>() => [row('owned')] as T[] } });
  assert.equal(result.ok, false);
});
