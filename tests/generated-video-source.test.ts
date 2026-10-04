import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOwnedGeneratedVideo } from '../frontend/server/media-library/generated-video-source';
import { measureGeneratedVideoBuffer } from '../frontend/server/media/generated-video-facts';
import { factsFromProbe } from '../frontend/lib/generated-video-media-facts';
import { createHash } from 'node:crypto';
const url = 'https://owned.test/original.mp4';
const params = { userId: 'owner', sourceOutputId: 'output', sourceJobId: 'job', url };
const row = { id: 'output', job_id: 'job', user_id: 'owner', kind: 'video', url, storage_url: null, metadata: {} };
test('requires matching owner, output, job, video kind and exact original URL', async () => {
  for (const changed of [{ user_id: 'other' }, { id: 'other' }, { job_id: 'other' }, { kind: 'image' }, { url: 'https://unowned.test/video.mp4' }]) {
    await assert.rejects(resolveOwnedGeneratedVideo(params, (async () => [{ ...row, ...changed }]) as never), /OUTPUT_NOT_FOUND/);
  }
  assert.deepEqual(await resolveOwnedGeneratedVideo(params, (async () => [row]) as never), { mediaFacts: null });
});
test('byte-identical copy rebinds provenance and avoids a second probe', async () => {
  const buffer = Buffer.from('video fixture');
  const previous = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15.001' }] }, {
    url, sha256: createHash('sha256').update(buffer).digest('hex'), sizeBytes: buffer.length,
  });
  let probes = 0;
  const copyUrl = 'https://owned.test/library-copy.mp4';
  const facts = await measureGeneratedVideoBuffer(buffer, copyUrl, previous, async () => { probes++; return null; });
  assert.equal(probes, 0);
  assert.equal(facts?.durationSec, 15.001);
  assert.equal(facts?.original.url, copyUrl);
});
test('changed bytes never inherit old measurements and failed measurement stays optional', async () => {
  let probes = 0;
  const previous = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15.001' }] }, {
    url, sha256: createHash('sha256').update('old file').digest('hex'), sizeBytes: 8,
  });
  const facts = await measureGeneratedVideoBuffer(Buffer.from('new file'), url, previous, async () => { probes++; throw new Error('Unavailable'); });
  assert.equal(facts, null);
  assert.equal(probes, 1);
});

test('already measured large originals reuse facts without exceeding the probe budget', async () => {
  const buffer = Buffer.alloc(80 * 1024 * 1024 + 1);
  const previous = factsFromProbe({ streams: [{ codec_type: 'video', duration: '15.001' }] }, {
    url, sha256: createHash('sha256').update(buffer).digest('hex'), sizeBytes: buffer.length,
  });
  const result = await measureGeneratedVideoBuffer(buffer, 'https://owned.test/copy.mp4', previous,
    async () => { throw new Error('Must not probe'); });
  assert.equal(result?.durationSec, 15.001);
});
