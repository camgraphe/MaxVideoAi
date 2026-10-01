import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, access } from 'node:fs/promises';
import { copyProviderVideoOriginal } from '../frontend/server/provider-video-original-copy';

test('direct provider copy retains every byte and removes only its temporary file', async () => {
  const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
  let uploaded = '';
  const url = await copyProviderVideoOriginal(new Response(bytes, { headers: { 'content-length': String(bytes.length) } }), { jobId: 'job', userId: 'owner' }, {
    maxBytes: 200_000,
    upload: async params => {
      assert.equal(params.sizeBytes, bytes.length);
      assert.equal(params.userId, 'owner');
      uploaded = params.path;
      assert.deepEqual(new Uint8Array(await readFile(params.path)), bytes);
      return { url: 'https://example.test/original.mp4', key: 'renders/owner/original' };
    },
  });
  assert.equal(url, 'https://example.test/original.mp4');
  await assert.rejects(access(uploaded));
});

test('over-budget and truncated downloads cannot publish an incomplete original', async () => {
  let uploads = 0;
  const deps = { maxBytes: 100, upload: async () => { uploads++; return { url: '', key: '' }; } };
  await assert.rejects(copyProviderVideoOriginal(new Response(new Uint8Array(101)), { jobId: 'job' }, deps), /budget/);
  await assert.rejects(copyProviderVideoOriginal(new Response(new Uint8Array(10), { headers: { 'content-length': '20' } }), { jobId: 'job' }, deps), /incomplete/);
  assert.equal(uploads, 0);
});

test('captures exact measurements of bytes uploaded and failure does not invalidate copy', async () => {
  for (const fails of [false, true]) {
    let facts: { durationSec: number; original: { url: string; sizeBytes: number; sha256: string } } | null = null;
    const url = await copyProviderVideoOriginal(new Response(new Uint8Array([1, 2, 3])), {
      jobId: 'job', userId: 'owner', onVideoMediaFacts: (value) => { facts = value; },
    }, { maxBytes: 100, upload: async () => ({ url: 'https://owned.test/original.mp4', key: 'key' }),
      probe: async (file) => {
        assert.deepEqual([...await readFile(file)], [1, 2, 3]);
        if (fails) throw new Error('Probe unavailable');
        return { streams: [{ codec_type: 'video', duration: '15.001' }], format: { duration: '15.001' } };
      },
    });
    assert.equal(url, 'https://owned.test/original.mp4');
    if (fails) assert.equal(facts, null);
    else {
      assert.equal(facts!.durationSec, 15.001);
      assert.equal(facts!.original.url, url);
      assert.equal(facts!.original.sizeBytes, 3);
      assert.equal(facts!.original.sha256.length, 64);
    }
  }
});
