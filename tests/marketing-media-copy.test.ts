import assert from 'node:assert/strict';
import test from 'node:test';
import { copyMarketingMediaFile } from '../frontend/server/marketing-media/storage';

test('marketing storage preserves original bytes and rejects oversized or truncated bodies before upload', async () => {
  const bytes = Buffer.from('exact fixture bytes');
  let uploaded: Buffer | undefined;
  const dependencies = {
    readUrl: async () => 'https://signed.example/object',
    open: async () => ({
      statusCode: 200,
      headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) },
      body: (async function* () {
        yield bytes;
      })(),
    }),
    put: async (p: any) => {
      uploaded = p.data;
      return { key: p.key, url: 'https://media.example/' + p.key };
    },
    verify: async () => true,
  };
  const file = { sourceUrl: 'https://media.example/original.mp4', role: 'original', kind: 'video' as const };
  const result = await copyMarketingMediaFile(
    file,
    {
      copyId: '11111111-1111-4111-8111-111111111111',
      ownerId: 'owner',
      remainingBytes: 1000,
      signal: new AbortController().signal,
    },
    dependencies,
  );
  assert.deepEqual(uploaded, bytes);
  assert.equal(result.sizeBytes, bytes.length);
  assert.match(result.key, /^marketing-media\/11111111-1111-4111-8111-111111111111\/[a-f0-9]{64}\.mp4$/);
  assert.doesNotMatch(result.url, /owner|signed/);
  uploaded = undefined;
  await assert.rejects(
    copyMarketingMediaFile(
      file,
      { copyId: 'copy', ownerId: 'owner', remainingBytes: 2, signal: new AbortController().signal },
      dependencies,
    ),
    /size|large/i,
  );
  assert.equal(uploaded, undefined);
  await assert.rejects(
    copyMarketingMediaFile(
      file,
      { copyId: 'copy', ownerId: 'owner', remainingBytes: 1000, signal: new AbortController().signal },
      {
        ...dependencies,
        open: async () => ({
          ...(await dependencies.open()),
          headers: { 'content-type': 'video/mp4', 'content-length': '100' },
        }),
      },
    ),
    /incomplete/i,
  );
  assert.equal(uploaded, undefined);
  await assert.rejects(
    copyMarketingMediaFile(
      file,
      { copyId: 'copy', ownerId: 'owner', remainingBytes: 1000, signal: new AbortController().signal },
      { ...dependencies, verify: async () => false },
    ),
    /readable/i,
  );
});

test('a successful HEAD cannot publish a copy whose actual bytes or seeking are unavailable', async (t) => {
  const bytes = Buffer.from('0123456789abcdef'.repeat(8));
  const file = { sourceUrl: 'https://media.example/original.mp4', role: 'original', kind: 'video' as const };
  const context = { copyId: 'copy', ownerId: null, remainingBytes: 1000, signal: new AbortController().signal };
  const transport = {
    readUrl: async () => file.sourceUrl,
    open: async () => ({ statusCode: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) }, body: (async function* () { yield bytes; })() }),
    put: async (p: any) => ({ key: p.key, url: 'https://media.example/' + p.key }),
  };
  const head = () => new Response(null, { headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) } });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    if (init.method === 'HEAD') return head();
    return new Response('unavailable', { status: 503 });
  });
  await assert.rejects(copyMarketingMediaFile(file, context, transport), /readable|Range/i);

  t.mock.restoreAll();
  const requested: string[] = [];
  let corruptTail = false;
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    if (init.method === 'HEAD') return head();
    const range = new Headers(init.headers).get('range')!;
    requested.push(range);
    const [, start, end] = range.match(/^bytes=(\d+)-(\d+)$/)!;
    const data = Buffer.from(bytes.subarray(Number(start), Number(end) + 1));
    if (corruptTail && Number(start) > 0) data[0] ^= 1;
    return new Response(data, { status: 206, headers: {
      'content-type': 'video/mp4', 'content-length': String(data.length),
      'content-range': `bytes ${start}-${end}/${bytes.length}`,
    } });
  });
  assert.equal((await copyMarketingMediaFile(file, context, transport)).sizeBytes, bytes.length);
  assert.deepEqual(requested, ['bytes=0-31', 'bytes=96-127']);
  corruptTail = true;
  await assert.rejects(copyMarketingMediaFile(file, context, transport), /readable|bytes/i);
});
