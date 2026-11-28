import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../frontend/app/api/mobile/video-excerpts/route';
import { prepareMobileVideoExcerpt } from '../frontend/src/server/mobile/video-excerpt';
import { readMobileModels } from '../frontend/src/server/mobile/catalog';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';

const assetId = 'ma_' + '1'.repeat(32),
  cut = 'ma_' + '2'.repeat(32);
const source = { type: 'asset' as const, assetId, kind: 'video' as const };
const ref = { ...source, assetId: cut };
const input = {
  assetId,
  mode: 'v2v' as const,
  engineId: 'luma-ray-3-2',
  fieldId: 'video_url',
  range: { startSec: 3.25, endSec: 5.75 },
};
function fixture(changed = false) {
  let checks = 0,
    preparations = 0,
    grants = 0;
  const deps: NonNullable<Parameters<typeof prepareMobileVideoExcerpt>[2]> = {
    models: (filter) =>
      readMobileModels(filter, {
        listEngines: async () => getBaseEnginesByCategory('video'),
        surfaceByEngineId: () => 'video',
      }),
    resolve: async (owner) => ({
      id: 'src',
      kind: 'video',
      ref: source,
      url: 'https://fixture.invalid/src.mp4',
      mime: 'video/mp4',
      thumbUrl: null,
      previewUrl: null,
      mediaFacts: undefined,
      originalAccess: { type: 'external' },
    }),
    evidence: async (owner, ids) => {
      assert.equal(owner, 'owner');
      assert.deepEqual(ids, [assetId]);
      checks++;
      return [{ asset: changed && checks >= 3 ? 'changed' : 'original', sources: ['source-job'] }];
    },
    prepare: async (owner, value, callbacks) => {
      assert.deepEqual(value, {
        source,
        engineId: input.engineId,
        mode: input.mode,
        fieldId: input.fieldId,
        range: input.range,
      });
      preparations++;
      await callbacks?.resolve?.(owner, source);
      await callbacks?.resolve?.(owner, source);
      return {
        original: source,
        range: input.range,
        asset: {
          id: 'legacy',
          assetId: cut,
          ref,
          url: 'https://fixture.invalid/cut.mp4',
          durationSec: 2.5,
          mediaFacts: undefined,
        },
      };
    },
    validate: async (owner) => {
      assert.equal(owner, 'owner');
      return [{ reference: ref, key: 'cut-key', sourceRevision: 'cut-rev' }];
    },
    grant: async (owner) => {
      grants++;
      return {
        readAccessOwnerId: owner,
        readAccessRef: ref,
        readAccessRevision: 'ra-rev',
        readAccessExpiresAt: new Date(Date.now() + 300000).toISOString(),
        accessUrl: 'https://fixture.invalid/signed-cut.mp4',
      };
    },
  };
  return { deps, counters: () => ({ checks, preparations, grants }) };
}
test('mobile excerpt admits only a current bearer session even when a cookie is present', async () => {
  const response = await POST(
    new NextRequest('https://maxvideoai.com/api/mobile/video-excerpts', {
      method: 'POST',
      headers: { cookie: 'fixture=session', 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, 'AUTH_REQUIRED');
});
test('explicit field and measured prepared identity survive the mobile round trip with a renewable read grant', async () => {
  const f = fixture();
  const {asset} = await prepareMobileVideoExcerpt('owner', input, f.deps);
  assert.equal(asset.libraryRef.type==='asset' && asset.libraryRef.assetId, cut);
  assert.equal(asset.durationSec,2.5);
  assert.notEqual(asset.accessUrl,asset.url);
  assert.equal(asset.readAccessRevision,'ra-rev');
  assert.deepEqual(f.counters(),{checks:3,preparations:1,grants:1});
});
test('changed, hidden, malformed and incompatible sources cannot return a prepared private asset', async () => {
  const f = fixture(true);
  await assert.rejects(prepareMobileVideoExcerpt('owner', input, f.deps), { code: 'SOURCE_CHANGED' });
  assert.equal(f.counters().grants, 0);
  for (const changes of [
    { fieldId: 'last_image_url' },
    { mode: 'extend' },
    { mode: 't2v' },
    { range: { startSec: 2, endSec: 1 } },
    { url: 'https://fixture.invalid/supplied.mp4' },
  ]) {
    const untouched = fixture();
    await assert.rejects(prepareMobileVideoExcerpt('owner', { ...input, ...changes }, untouched.deps));
    assert.equal(untouched.counters().preparations, 0);
  }
  const hidden = fixture();
  hidden.deps.validate = async () => [{ reference: ref, error: 'SOURCE_TRASHED' }];
  await assert.rejects(prepareMobileVideoExcerpt('owner', input, hidden.deps), { code: 'SOURCE_CHANGED' });
  assert.equal(hidden.counters().grants, 0);
});
