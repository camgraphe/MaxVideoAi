import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { resolveRecentOutputMetadata } from '../frontend/server/media-library/recent-output-metadata';
const original = 'https://media.example/outputs/original.png?sig=Exact%2F123';
const output = { id: 'output', userId: 'owner', kind: 'image' as const, url: original, status: 'ready', hidden: false, size: null, mime: 'image/png' };

test('owned original metadata uses one injected configured storage HEAD and preserves exact signed identity', async () => {
  const seen: string[] = [];
  const controller = new AbortController();
  const metadata = await resolveRecentOutputMetadata('output', 'owner', controller.signal, {
    readOutput: async (id, owner) => { assert.equal(id, 'output'); assert.equal(owner, 'owner'); return output; },
    storageKey: (url) => { assert.equal(url, original); return 'outputs/original.png'; },
    head: async (key, signal) => { seen.push(key); assert.equal(signal, controller.signal); return { size: 1000, mime: 'image/png' }; },
  });
  assert.deepEqual(seen, ['outputs/original.png']);
  assert.deepEqual(metadata, { id: 'output', userId: 'owner', kind: 'image', url: original, size: 1000, mime: 'image/png' });
});

test('foreign, hidden, unready and external outputs never trigger metadata access', async () => {
  let heads = 0;
  for (const patch of [{ userId: 'other' }, { id: 'other' }, { hidden: true }, { status: 'processing' }]) {
    const result = await resolveRecentOutputMetadata('output', 'owner', new AbortController().signal, {
      readOutput: async () => ({ ...output, ...patch }), storageKey: () => 'key', head: async () => { heads++; return { size: 1, mime: 'image/png' }; },
    });
    assert.equal(result, null);
  }
  assert.equal(await resolveRecentOutputMetadata('output', 'owner', new AbortController().signal, {
    readOutput: async () => output, storageKey: () => null, head: async () => { heads++; return { size: 1, mime: 'image/png' }; },
  }), null);
  assert.equal(heads, 0);
});

test('known matching saved metadata avoids HEAD; invalid sizes and wrong MIME are not validated', async () => {
  let heads = 0;
  const dependencies = { readOutput: async () => ({ ...output, size: 500 }), storageKey: () => 'key', head: async () => { heads++; return { size: 1, mime: 'image/png' }; } };
  assert.equal((await resolveRecentOutputMetadata('output', 'owner', new AbortController().signal, dependencies))?.size, 500);
  assert.equal(heads, 0);
  for (const data of [{ size: 0, mime: 'image/png' }, { size: NaN, mime: 'image/png' }, { size: 5, mime: 'video/mp4' }]) {
    assert.equal(await resolveRecentOutputMetadata('output', 'owner', new AbortController().signal, { ...dependencies, readOutput: async () => output, head: async () => data }), null);
  }
});

test('aborted or timed-out reads cannot return metadata after selection changed', async () => {
  const controller = new AbortController();
  await assert.rejects(resolveRecentOutputMetadata('output', 'owner', controller.signal, {
    readOutput: async () => output, storageKey: () => 'key', head: async () => { controller.abort(); return { size: 1, mime: 'image/png' }; },
  }), { name: 'AbortError' });
  const server = readFileSync('frontend/server/media-library/recent-output-metadata.ts', 'utf8');
  assert.match(server, /o\.user_id = \$2 AND j\.user_id = \$2/); assert.match(server, /saved\.url = COALESCE\(o\.storage_url, o\.url\)/);
  assert.doesNotMatch(server, /ensure.*Schema|INSERT INTO|UPDATE |fetch\(/);
  const route = readFileSync('frontend/app/api/media-library/recent-outputs/metadata/route.ts', 'utf8');
  assert.match(route, /AbortSignal\.timeout\(8_000\)/); assert.match(route, /private, no-store/);
});
