import assert from 'node:assert/strict';
import test from 'node:test';
import { studioMediaByteResponse } from './helpers/studio-media-byte-fixture';

const bytes = Buffer.from('0123456789');

test('local media byte fixture serves full GET and bodyless HEAD', () => {
  const get = studioMediaByteResponse(bytes, { method: 'GET' });
  assert.equal(get.status, 200);
  assert.equal(get.body.toString(), '0123456789');
  assert.equal(get.headers['content-length'], '10');
  assert.equal(get.headers['content-type'], 'video/mp4');
  assert.equal(get.headers['accept-ranges'], 'bytes');
  assert.equal(get.headers['cache-control'], 'private, no-store');
  const head = studioMediaByteResponse(bytes, { method: 'HEAD', range: 'bytes=1-3' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['content-length'], '10');
  assert.equal(head.headers['content-range'], undefined);
});

test('local media byte fixture handles bounded, open and suffix ranges exactly', () => {
  for (const [range, content, contentRange] of [
    ['bytes=1-3', '123', 'bytes 1-3/10'], ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10'],
    ['bytes=-99', '0123456789', 'bytes 0-9/10'], ['bytes=0-0', '0', 'bytes 0-0/10'],
  ]) {
    const response = studioMediaByteResponse(bytes, { method: 'GET', range });
    assert.equal(response.status, 206, range);
    assert.equal(response.body.toString(), content, range);
    assert.equal(response.headers['content-range'], contentRange, range);
    assert.equal(response.headers['content-length'], String(content.length), range);
  }
});

test('local media byte fixture rejects unsatisfiable ranges and never mutates content', () => {
  for (const range of ['bytes=10-', 'bytes=8-2', 'bytes=-0', 'bytes=999999999999999999999999-']) {
    const response = studioMediaByteResponse(bytes, { method: 'GET', range });
    assert.equal(response.status, 416, range);
    assert.equal(response.body.length, 0);
    assert.equal(response.headers['content-range'], 'bytes */10');
  }
  assert.equal(bytes.toString(), '0123456789');
  // This small fixture intentionally ignores unsupported/multiple range forms.
  for (const range of ['items=1-2', 'bytes=0-1,4-5', 'garbled']) {
    assert.equal(studioMediaByteResponse(bytes, { method: 'GET', range }).status, 200);
  }
  assert.equal(studioMediaByteResponse(Buffer.alloc(0), { method: 'GET', range: 'bytes=0-' }).status, 200);
  assert.equal(studioMediaByteResponse(bytes, { method: 'POST' }).status, 405);
});
