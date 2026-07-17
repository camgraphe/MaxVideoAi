import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { File } from 'node:buffer';
import { NextRequest } from 'next/server';

const routePath = path.join(process.cwd(), 'frontend/app/api/uploads/image/route.ts');
const routeHandlerPath = path.join(
  process.cwd(),
  'frontend/src/server/uploads/create-image-upload-post-handler.ts'
);

async function loadRouteHandler(): Promise<any> {
  return import(pathToFileURL(routeHandlerPath).href);
}

test('image upload route authenticates before parsing multipart data or decoding images', () => {
  const source = fs.readFileSync(routeHandlerPath, 'utf8');
  const authIndex = source.indexOf('getRouteAuthContext(req)');
  const formDataIndex = source.indexOf('req.formData()');

  assert.ok(authIndex >= 0, 'route must use the canonical cookie and Bearer auth helper');
  assert.ok(formDataIndex >= 0, 'route must parse the multipart body');
  assert.ok(authIndex < formDataIndex, 'authentication must happen before multipart parsing');
});

test('image upload route delegates byte decoding and persistence to the dedicated service', () => {
  const routeSource = fs.readFileSync(routePath, 'utf8');
  const handlerSource = fs.readFileSync(routeHandlerPath, 'utf8');

  assert.match(routeSource, /createImageUploadPostHandler/);
  assert.match(handlerSource, /storeImageUpload/);
  assert.doesNotMatch(routeSource + handlerSource, /from 'sharp'/);
  assert.doesNotMatch(routeSource + handlerSource, /uploadImageToStorage|recordUserAsset|ensureReusableAsset/);
});

test('unauthorized requests stop before multipart parsing and preserve canonical auth semantics', async () => {
  const route = await loadRouteHandler();
  let parsed = false;
  let stored = false;
  const request = {
    headers: new Headers({
      authorization: 'Bearer access-token',
      cookie: 'sb-session=cookie-session',
    }),
    formData: async () => {
      parsed = true;
      return new FormData();
    },
  } as unknown as NextRequest;
  const handler = route.createImageUploadPostHandler({
    getRouteAuthContext: async (received: NextRequest) => {
      assert.equal(received, request);
      assert.equal(received.headers.get('authorization'), 'Bearer access-token');
      assert.match(received.headers.get('cookie') ?? '', /sb-session=/);
      return { userId: null };
    },
    storeImageUpload: async () => {
      stored = true;
      throw new Error('must not store');
    },
    loadStoredImageUploadRouteAsset: async () => {
      throw new Error('must not load');
    },
  });

  const response = await handler(request);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: 'UNAUTHORIZED' });
  assert.equal(parsed, false);
  assert.equal(stored, false);
});

test('oversized Content-Length stops before multipart parsing', async () => {
  const route = await loadRouteHandler();
  let parsed = false;
  let stored = false;
  const request = {
    headers: new Headers({ 'content-length': String(8 * 1024 * 1024) }),
    formData: async () => {
      parsed = true;
      return new FormData();
    },
  } as unknown as NextRequest;
  const handler = route.createImageUploadPostHandler(
    {
      getRouteAuthContext: async () => ({ userId: 'user_1' }),
      storeImageUpload: async () => {
        stored = true;
        throw new Error('must not store');
      },
      loadStoredImageUploadRouteAsset: async () => {
        throw new Error('must not load');
      },
    },
    { maxBytes: 1024, maxMB: 1 }
  );

  const response = await handler(request);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: 'FILE_TOO_LARGE', maxMB: 1 });
  assert.equal(parsed, false);
  assert.equal(stored, false);
});

test('authenticated upload preserves the existing route response projection', async () => {
  const route = await loadRouteHandler();
  const form = new FormData();
  form.set('file', new File([Buffer.from('image-bytes')], 'reference.png', { type: 'image/png' }));
  const request = new NextRequest('https://maxvideoai.com/api/uploads/image', {
    method: 'POST',
    body: form,
  });
  const handler = route.createImageUploadPostHandler({
    getRouteAuthContext: async () => ({ userId: 'user_1' }),
    storeImageUpload: async (params: any) => {
      assert.equal(params.userId, 'user_1');
      assert.equal(params.fileName, 'reference.png');
      assert.equal(params.declaredMime, 'image/png');
      assert.deepEqual(params.bytes, Buffer.from('image-bytes'));
      return {
        assetId: 'asset_123',
        width: 1280,
        height: 720,
        mimeType: 'image/webp',
        sizeBytes: 1234,
        previewUrl: 'https://cdn.example.com/reference-thumb.webp',
      };
    },
    loadStoredImageUploadRouteAsset: async (params: any) => {
      assert.deepEqual(params, { userId: 'user_1', assetId: 'asset_123' });
      return {
        assetId: 'asset_123',
        url: 'https://cdn.example.com/reference.webp',
        width: 1280,
        height: 720,
        mimeType: 'image/webp',
        sizeBytes: 1234,
        thumbUrl: 'https://cdn.example.com/reference-thumb.webp',
      };
    },
  });

  const response = await handler(request);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    asset: {
      id: 'asset_123',
      url: 'https://cdn.example.com/reference.webp',
      width: 1280,
      height: 720,
      size: 1234,
      mime: 'image/webp',
      name: 'reference.png',
      thumbUrl: 'https://cdn.example.com/reference-thumb.webp',
    },
  });
});
