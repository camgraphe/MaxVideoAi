import assert from 'node:assert/strict';
import test from 'node:test';

import {
  importReferenceFiles,
  parseReferenceImportArguments,
} from '../plugins/maxvideoai/scripts/import-reference-files.mjs';

const firstToken = `mru_${'A'.repeat(43)}`;
const secondToken = `mru_${'B'.repeat(43)}`;

function handoff(token: string): string {
  return `https://maxvideoai.com/mcp/reference-upload/${token}`;
}

test('local helper accepts up to eight explicit private handoff/file pairs and rejects token exfiltration', () => {
  assert.deepEqual(parseReferenceImportArguments([
    '--upload', handoff(firstToken), '/private/actor.png',
    '--upload', handoff(secondToken), '/private/style.jpg',
  ]), [
    { handoffUrl: handoff(firstToken), filePath: '/private/actor.png' },
    { handoffUrl: handoff(secondToken), filePath: '/private/style.jpg' },
  ]);

  for (const unsafe of [
    `https://evil.example/mcp/reference-upload/${firstToken}`,
    `${handoff(firstToken)}?forward=evil`,
    `${handoff(firstToken)}#copied`,
    `https://user:password@maxvideoai.com/mcp/reference-upload/${firstToken}`,
  ]) {
    assert.throws(
      () => parseReferenceImportArguments(['--upload', unsafe, '/private/actor.png']),
      /trusted MaxVideoAI upload link/iu,
    );
  }

  assert.throws(
    () => parseReferenceImportArguments(Array.from({ length: 9 }, (_, index) => [
      '--upload', handoff(firstToken), `/private/${index}.png`,
    ]).flat()),
    /no more than 8/iu,
  );
});

test('local helper streams private files through one-use capabilities and prints only returned asset IDs', async () => {
  const requests: Array<{ url: string; init: RequestInit; bodyText: string }> = [];
  const files = new Map<string, Buffer>([
    ['/private/actor.png', Buffer.from('abcd')],
    ['/private/style.jpg', Buffer.from('efgh')],
  ]);
  let completed = 0;
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = String(input);
    const bodyText = typeof init.body === 'string' ? init.body : '';
    requests.push({ url, init, bodyText });
    if (url.endsWith('/start')) {
      return Response.json({ ok: true, uploadId: `00000000-0000-4000-8000-00000000000${requests.length}`, chunkBytes: 2, totalParts: 2 });
    }
    if (url.endsWith('/part')) return Response.json({ ok: true });
    if (url.endsWith('/complete')) {
      completed += 1;
      return Response.json({ ok: true, assetId: `ma_${String(completed).repeat(32)}`, mediaKind: 'image' });
    }
    if (url.endsWith('/abort')) return Response.json({ ok: true });
    return Response.json({ ok: false }, { status: 404 });
  };

  const result = await importReferenceFiles([
    { handoffUrl: handoff(firstToken), filePath: '/private/actor.png' },
    { handoffUrl: handoff(secondToken), filePath: '/private/style.jpg' },
  ], {
    fetchImpl,
    readFile: async (path: string) => files.get(path) ?? Buffer.alloc(0),
    statFile: async (path: string) => ({
      size: files.get(path)?.length ?? 0,
      isFile: () => files.has(path),
    }),
  });

  assert.deepEqual(result, {
    assets: [
      { index: 0, fileName: 'actor.png', assetId: `ma_${'1'.repeat(32)}`, mediaKind: 'image' },
      { index: 1, fileName: 'style.jpg', assetId: `ma_${'2'.repeat(32)}`, mediaKind: 'image' },
    ],
    failures: [],
  });
  assert.equal(requests.filter(({ url }) => url.endsWith('/start')).length, 2);
  assert.equal(requests.filter(({ url }) => url.endsWith('/part')).length, 4);
  assert.equal(requests.filter(({ url }) => url.endsWith('/complete')).length, 2);
  assert.ok(requests.every(({ init }, index) => {
    const expected = index < 4 ? firstToken : secondToken;
    return new Headers(init.headers).get('authorization') === `Bearer ${expected}`;
  }));
  assert.ok(requests.every(({ bodyText }) => !bodyText.includes('/private/')));
  assert.match(requests[0].bodyText, /"fileName":"actor\.png"/u);
  assert.match(requests[0].bodyText, /"declaredMime":"image\/png"/u);
});

test('local helper preserves completed asset IDs and reports only a safe per-file code after a partial failure', async () => {
  const files = new Map<string, Buffer>([
    ['/private/ready.png', Buffer.from('abcd')],
    ['/private/fails.png', Buffer.from('efgh')],
  ]);
  let activeToken = '';
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    activeToken = url.includes(firstToken) ? firstToken : secondToken;
    if (url.endsWith('/start')) {
      return Response.json({ ok: true, uploadId: '00000000-0000-4000-8000-000000000009', chunkBytes: 4, totalParts: 1 });
    }
    if (url.endsWith('/part') && activeToken === secondToken) {
      throw new Error(`network failed at ${url}`);
    }
    if (url.endsWith('/part') || url.endsWith('/abort')) return Response.json({ ok: true });
    if (url.endsWith('/complete')) {
      return Response.json({ ok: true, assetId: `ma_${'a'.repeat(32)}`, mediaKind: 'image' });
    }
    return Response.json({ ok: false }, { status: 404 });
  };

  const result = await importReferenceFiles([
    { handoffUrl: handoff(firstToken), filePath: '/private/ready.png' },
    { handoffUrl: handoff(secondToken), filePath: '/private/fails.png' },
  ], {
    fetchImpl,
    readFile: async (path: string) => files.get(path) ?? Buffer.alloc(0),
    statFile: async (path: string) => ({
      size: files.get(path)?.length ?? 0,
      isFile: () => files.has(path),
    }),
  });

  assert.deepEqual(result, {
    assets: [{
      index: 0,
      fileName: 'ready.png',
      assetId: `ma_${'a'.repeat(32)}`,
      mediaKind: 'image',
    }],
    failures: [{ index: 1, fileName: 'fails.png', code: 'UPLOAD_FAILED' }],
  });
  assert.doesNotMatch(JSON.stringify(result), /private|mru_|https?:/iu);
});

test('local helper rejects an oversized private file before allocating its contents', async () => {
  let reads = 0;
  let requests = 0;
  const result = await importReferenceFiles([
    { handoffUrl: handoff(firstToken), filePath: '/private/too-large.png' },
  ], {
    fetchImpl: async () => {
      requests += 1;
      return Response.json({ ok: false }, { status: 500 });
    },
    statFile: async () => ({
      size: 25 * 1024 * 1024 + 1,
      isFile: () => true,
    }),
    readFile: async () => {
      reads += 1;
      return Buffer.alloc(0);
    },
  });

  assert.deepEqual(result, {
    assets: [],
    failures: [{ index: 0, fileName: 'too-large.png', code: 'FILE_TOO_LARGE' }],
  });
  assert.equal(reads, 0);
  assert.equal(requests, 0);
});
