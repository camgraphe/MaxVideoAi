import assert from 'node:assert/strict';

export function chunkedVideoUploadFixture(beforePart?: () => Promise<void>) {
  const asset = {
    id: 'uploaded-mov',
    assetId: 'ma_'+'c'.repeat(32),
    url: 'https://media.test/original.mov',
    mime: 'video/quicktime',
    name: 'reference.mov',
    mediaFacts: {source: 'probe' as const, durationSec: 12, width: 640, height: 360, hasAudio: true},
  };
  let declaredSize = 0;
  let receivedBytes = 0;
  let completed = false;
  const request: typeof fetch = async (input, init) => {
    const url = String(input);
    if (init?.method !== 'POST') return Response.json({ok: true, assets: []});
    if (url === '/api/uploads/video') {
      const file = (init.body as FormData).get('file') as File;
      if (file.size > 4.5 * 1024 * 1024) return new Response('Request Entity Too Large', {status: 413});
      return Response.json({ok: true, asset});
    }
    if (url.endsWith('/multipart/start')) {
      const body = JSON.parse(String(init.body));
      assert.equal(body.fileName, 'reference.mov');
      assert.equal(body.mime, 'video/quicktime');
      declaredSize = body.size;
      return Response.json({ok: true, upload: {uploadId: 'upload-mov', key: 'owned/reference.mov', chunkSizeBytes: 3_670_016}});
    }
    if (url.endsWith('/multipart/part')) {
      await beforePart?.();
      init.signal?.throwIfAborted();
      const body = init.body as FormData;
      const chunk = body.get('chunk') as Blob;
      assert.ok(chunk.size > 0 && chunk.size < 4.5 * 1024 * 1024);
      receivedBytes += chunk.size;
      return Response.json({ok: true, part: {partNumber: Number(body.get('partNumber')), etag: 'etag', key: 'part', size: chunk.size}});
    }
    if (url.endsWith('/multipart/complete')) {
      assert.equal(receivedBytes, declaredSize);
      completed = true;
      return Response.json({ok: true, asset});
    }
    if (url.endsWith('/multipart/abort')) return Response.json({ok: true});
    throw new Error('Unexpected upload request: '+url);
  };
  return {request, asset, get completed() {return completed;}};
}
