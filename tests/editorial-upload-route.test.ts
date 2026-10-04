import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createEditorialImageUploadHandler } from '../frontend/src/server/editorial/media-upload-handler';

const hash = 'a'.repeat(64);
test('editorial upload authenticates before reading bytes and cannot fall back to user uploads', async () => {
  let read = false;
  const request = { headers: new Headers(), body: { getReader() { read = true; throw Error('read'); } } } as unknown as NextRequest;
  const handler = createEditorialImageUploadHandler({ token: () => 'secret', privateStorage: () => true, store: async () => { throw Error('store'); } });
  assert.equal((await handler(request)).status, 401);
  assert.equal(read, false);
});

test('editorial upload bounds the streamed bytes and returns only the stored manifest', async () => {
  let calls = 0;
  const handler = createEditorialImageUploadHandler({ token: () => 'secret', privateStorage: () => true, maxBytes: 4,
    store: async (data, mime, digest) => { calls++; assert.equal(data.toString(), 'test'); assert.equal(mime, 'image/webp'); assert.equal(digest, hash); return { storageKey: `editorial/drafts/${hash}.webp`, sha256: hash, bytes: 4, mime, width: 1000, height: 600 }; },
  });
  const request = (body: string) => new NextRequest('https://maxvideoai.com/api/uploads/image', { method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'image/webp', 'x-content-sha256': hash, 'x-upload-purpose': 'editorial-draft' }, body });
  assert.equal((await handler(request('large'))).status, 413);
  assert.equal(calls, 0);
  const response = await handler(request('test'));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).asset.storageKey, `editorial/drafts/${hash}.webp`);
  assert.equal(calls, 1);
});
