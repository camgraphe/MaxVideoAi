import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareAudioExcerpt } from '../frontend/server/video-excerpts/prepare-audio';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { readMediaExcerptSource } from '../frontend/server/video-excerpts/source-access';
import type { StudioResolvedMedia } from '../frontend/src/server/studio/media-resolver';
type Dependencies = NonNullable<Parameters<typeof prepareAudioExcerpt>[2]>;
const source = { type: 'asset' as const, assetId: 'ma_11111111111111111111111111111111', kind: 'audio' as const };
const ref = { ...source, assetId: 'ma_22222222222222222222222222222222' };
const original: StudioResolvedMedia = { id: 'source', ref: source, kind: 'audio', url: 'https://media.invalid/original.wav', mime: 'audio/wav', thumbUrl: null, previewUrl: null, originalAccess: { type: 'external' } };
const facts = { kind: 'audio' as const, durationSec: 60, sampleRate: 48000, channels: 2, codec: 'pcm_s16le' };
const input = { source, engineId: 'wan-3', mode: 'ref2v', fieldId: 'reference_audio_urls', range: { startSec: 15, endSec: 20 } };
function setup(overrides: Dependencies = {}) {
  const state = { downloads: 0, stored: [] as any[] };
  const deps: Dependencies = {
    engine: async id => getBaseEngineIncludingHidden(id),
    resolve: async (_owner, selected) => JSON.stringify(selected) === JSON.stringify(ref)
      ? { ...original, id: 'prepared', ref, url: 'https://media.invalid/prepared.wav', durationSec: 5 } : original,
    readAccess: async (_owner, media) => ({ url: `${media.url}?signature=temporary`, expires: null }),
    download: async file => { state.downloads++; assert.equal(file.download_url, `${original.url}?signature=temporary`); return { bytes: Buffer.from('original'), fileName: 'original.wav', mimeType: 'audio/wav' }; },
    inspect: async () => facts,
    trim: async () => ({ bytes: Buffer.from('passage'), facts: { ...facts, durationSec: 5 } }),
    store: async value => { state.stored.push(value); return { assetId: ref.assetId, legacyAssetId: 'prepared', storageUrl: 'https://media.invalid/prepared.wav', previewUrl: null,
      width: null, height: null, durationSec: 5, mimeType: 'audio/wav', sizeBytes: 7 }; },
    ...overrides,
  };
  return { state, deps };
}
test('audio preparation stores only a distinct private copy, retains lineage and returns temporary read access', async () => {
  const { state, deps } = setup();
  const result = await prepareAudioExcerpt('owner', input, deps);
  assert.deepEqual(result.original, source);
  assert.deepEqual(result.asset.ref, ref);
  assert.equal(result.asset.url, 'https://media.invalid/prepared.wav');
  assert.equal(result.asset.previewUrl, 'https://media.invalid/prepared.wav?signature=temporary');
  assert.equal(result.asset.durationSec, 5);
  assert.equal(state.stored.length, 1);
  const write = state.stored[0];
  assert.equal(write.privateStorageScope, 'video-excerpt', 'uses the already protected excerpt namespace');
  assert.equal(write.storageAcl, null);
  assert.equal(write.storageCacheControl, 'private, no-store');
  assert.match(write.contentAddressedNamespace, /^audio-excerpt-private-v3-/);
  assert.equal(JSON.stringify(write.metadata).includes('signature='), false);
  assert.deepEqual(write.metadata.audioExcerpt.source, source);
  assert.deepEqual(write.metadata.audioExcerpt.range, input.range);
});
test('wrong owner, kind, field, mode and unavailable models fail before download', async () => {
  for (const [owner, value, overrides] of [
    ['', input, {}], ['owner', { ...input, source: { ...source, kind: 'video' } }, {}],
    ['owner', { ...input, fieldId: 'reference_video_urls' }, {}], ['owner', { ...input, fieldId: 'invented' }, {}],
    ['owner', { ...input, mode: 'reframe' }, {}], ['owner', input, { engine: async () => undefined }],
    ['other', input, { resolve: async () => { throw new Error('MEDIA_NOT_AVAILABLE'); } }],
  ] as Array<[string, unknown, Dependencies]>) {
    const { state, deps } = setup(overrides);
    await assert.rejects(prepareAudioExcerpt(owner, value, deps));
    assert.equal(state.downloads, 0); assert.equal(state.stored.length, 0);
  }
});
test('measured source/range errors and changed ownership fail without persisting', async () => {
  for (const overrides of [
    { inspect: async () => ({ ...facts, durationSec: 10 }) },
    { trim: async () => ({ bytes: Buffer.from('bad'), facts: { ...facts, durationSec: 5.1 } }) },
    { resolve: (() => { let reads = 0; return async () => ({ ...original, url: ++reads === 1 ? original.url : 'https://media.invalid/changed' }); })() },
  ] satisfies Dependencies[]) {
    const { state, deps } = setup(overrides);
    await assert.rejects(prepareAudioExcerpt('owner', input, deps));
    assert.equal(state.stored.length, 0);
  }
});
test('full audio preview requires ownership and matching kind', async () => {
  const { deps } = setup();
  const access = { resolve: deps.resolve!, readAccess: deps.readAccess! };
  assert.equal((await readMediaExcerptSource('owner', { source }, 'audio', access)).previewUrl, `${original.url}?signature=temporary`);
  await assert.rejects(readMediaExcerptSource('owner', { source }, 'video', access));
  await assert.rejects(readMediaExcerptSource('other', { source }, 'audio', { ...access, resolve: async () => { throw new Error('MEDIA_NOT_AVAILABLE'); } }));
});

test('audio excerpt optional operation rejects unknown or inapplicable intent without changing omitted legacy lineage',async()=>{
 for(const operation of [null,'unknown','kling-reference','flux-draft-enhance']){
  const {state,deps}=setup();await assert.rejects(prepareAudioExcerpt('owner',{...input,operation},deps));assert.equal(state.downloads,0);
 }
 const {state,deps}=setup();await prepareAudioExcerpt('owner',input,deps);
 assert.equal(Object.hasOwn(state.stored[0].metadata.audioExcerpt,'operation'),false);
});
