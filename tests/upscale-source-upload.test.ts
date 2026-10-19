import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { uploadSourceFile } from '../frontend/src/components/tools/upscale/_lib/upscale-workspace-helpers';
import { useUpscaleSourceMedia } from '../frontend/src/components/tools/upscale/_hooks/useUpscaleSourceMedia';
import type { UploadedAsset, PreviewMode } from '../frontend/src/components/tools/upscale/_lib/upscale-workspace-types';
import { VERCEL_FUNCTION_BODY_LIMIT_BYTES } from '../frontend/lib/client-video-upload';

type RequestFn = typeof fetch;

async function withFetch(request: RequestFn, run: () => Promise<void>) {
  const previous = globalThis.fetch;
  globalThis.fetch = request;
  try { await run(); } finally { globalThis.fetch = previous; }
}

function multipartReceiver(file: File) {
  const requests: Array<{ path: string; bodyBytes: number }> = [];
  const chunks: Buffer[] = [];
  const asset = { id: 'uploaded-video', url: '/original.mp4', mime: file.type, name: file.name, width: 1920, height: 1080 };
  const request: RequestFn = async (input, init) => {
    const path = String(input);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'include', 'Every step retains authenticated cookie delivery');
    const bodyBytes = (await new Request(`https://upload.test${path}`, init).arrayBuffer()).byteLength;
    requests.push({ path, bodyBytes });
    if (bodyBytes > VERCEL_FUNCTION_BODY_LIMIT_BYTES) {
      return new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 });
    }
    if (path.endsWith('/multipart/start')) {
      assert.deepEqual(JSON.parse(String(init?.body)), { fileName: file.name, mime: file.type, size: file.size });
      return Response.json({ ok: true, upload: { uploadId: 'upload-1', key: 'original.mp4', chunkSizeBytes: 3_670_016 } });
    }
    if (path.endsWith('/multipart/part')) {
      assert.ok(init?.body instanceof FormData);
      assert.equal(init.body.get('uploadId'), 'upload-1');
      assert.equal(init.body.get('key'), 'original.mp4');
      const partNumber = Number(init.body.get('partNumber'));
      assert.equal(partNumber, chunks.length + 1);
      const chunk = init.body.get('chunk');
      assert.ok(chunk instanceof Blob);
      chunks.push(Buffer.from(await chunk.arrayBuffer()));
      return Response.json({ ok: true, part: { partNumber, etag: `part-${partNumber}`, key: `part-${partNumber}`, size: chunk.size } });
    }
    if (path.endsWith('/multipart/complete')) {
      const payload = JSON.parse(String(init?.body));
      assert.equal(payload.size, file.size);
      assert.equal(payload.parts.length, chunks.length);
      assert.deepEqual(Buffer.concat(chunks), Buffer.from(await file.arrayBuffer()), 'Reassembly preserves the exact original video bytes');
      return Response.json({ ok: true, asset });
    }
    throw new Error(`Unexpected request: ${path}`);
  };
  return { request, requests, asset };
}

for (const sizeMB of [4.6, 8, 20, 50]) {
  test(`upscaler uploads a ${sizeMB} MiB video without exceeding the function body limit`, async () => {
    const bytes = new Uint8Array(Math.ceil(sizeMB * 1024 * 1024));
    for (let offset = 0; offset < bytes.length; offset += 1024) bytes[offset] = (offset / 1024) % 251;
    const file = new File([bytes], 'source.mp4', { type: 'video/mp4' });
    const receiver = multipartReceiver(file);
    await withFetch(receiver.request, async () => {
      const asset = await uploadSourceFile(file, 'video');
      assert.equal(asset.id, receiver.asset.id);
      assert.equal(asset.url, receiver.asset.url);
      assert.equal(asset.width, 1920);
    });
    assert.ok(receiver.requests.every((request) => request.bodyBytes < VERCEL_FUNCTION_BODY_LIMIT_BYTES));
    assert.equal(receiver.requests[0].path, '/api/uploads/video/multipart/start');
    assert.equal(receiver.requests.at(-1)?.path, '/api/uploads/video/multipart/complete');
    assert.ok(receiver.requests.every((request) => request.path !== '/api/uploads/video'));
  });
}

test('upscaler retains the ordinary upload path for small videos and images', async () => {
  for (const kind of ['video', 'image'] as const) {
    const file = new File([new Uint8Array(1024)], `source.${kind === 'video' ? 'mp4' : 'png'}`, { type: `${kind}/${kind === 'video' ? 'mp4' : 'png'}` });
    await withFetch(async (input, init) => {
      assert.equal(String(input), `/api/uploads/${kind}`);
      assert.ok(init?.body instanceof FormData);
      assert.equal((init.body.get('file') as File).size, file.size);
      return Response.json({ ok: true, asset: { id: 'small-asset', url: '/original', mime: file.type } });
    }, async () => {
      assert.equal((await uploadSourceFile(file, kind)).id, 'small-asset');
    });
  }
});

async function exerciseSourceHook(request: RequestFn, locale: string, file: File) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const globals = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: request };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let handleUpload!: ReturnType<typeof useUpscaleSourceMedia>['handleUpload'];
  let state!: { error: string | null; source: UploadedAsset | null; uploading: boolean; mediaUrl: string; previewMode: PreviewMode };
  function Fixture() {
    const [error, setError] = useState<string | null>(null);
    const [source, setSource] = useState<UploadedAsset | null>(null);
    const [uploading, setUploading] = useState(false);
    const [mediaUrl, setMediaUrl] = useState('');
    const [previewMode, setPreviewMode] = useState<PreviewMode>('result');
    state = { error, source, uploading, mediaUrl, previewMode };
    ({ handleUpload } = useUpscaleSourceMedia({
      onSourceChange: () => {},
      changeMediaType: () => undefined, copy: { library: 'Media' }, locale,
      mediaType: 'video', mediaUrl, source, setError, setSource, setUploading, setMediaUrl, setPreviewMode,
      setMessage: () => undefined, setResult: () => undefined, setLibraryModalOpen: () => undefined,
    }));
    return React.createElement('div', { role: 'alert' }, error);
  }
  const root = createRoot(dom.window.document.querySelector<HTMLElement>('#root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => handleUpload({ target: { files: [file], value: 'source.mp4' } } as unknown as ChangeEvent<HTMLInputElement>));
    assert.equal(dom.window.document.querySelector('[role=alert]')?.textContent, state.error ?? '');
    return { ...state };
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('upscaler accepts the completed large-video source and resets its upload state', async () => {
  const file = new File([new Uint8Array(8 * 1024 * 1024)], 'source.mp4', { type: 'video/mp4' });
  const receiver = multipartReceiver(file);
  const state = await exerciseSourceHook(receiver.request, 'en', file);
  assert.equal(state.error, null);
  assert.equal(state.uploading, false);
  assert.equal(state.source?.id, 'uploaded-video');
  assert.equal(state.mediaUrl, '/original.mp4');
  assert.equal(state.previewMode, 'source');
});

for (const [locale, expected] of [['en', /too large.*50 MB/i], ['fr', /trop volumineux.*50 Mo/i], ['es', /demasiado grande.*50 MB/i]] as const) {
  test(`upscaler shows the server's file size limit in ${locale} without sending video chunks`, async () => {
    const paths: string[] = [];
    const file = new File([new Uint8Array(51 * 1024 * 1024)], 'source.mp4', { type: 'video/mp4' });
    const state = await exerciseSourceHook(async (input) => {
      paths.push(String(input));
      return Response.json({ ok: false, error: 'FILE_TOO_LARGE', maxMB: 50 }, { status: 413 });
    }, locale, file);
    assert.match(state.error ?? '', expected);
    assert.doesNotMatch(state.error ?? '', /FILE_TOO_LARGE|HTTP|413/);
    assert.deepEqual(paths, ['/api/uploads/video/multipart/start']);
    assert.equal(state.uploading, false);
    assert.equal(state.source, null);
  });
}

test('upscaler explains a non-JSON 413 response and leaves the source unset', async () => {
  for (const kind of ['video', 'image'] as const) {
    const state = await exerciseSourceHook(async () => new Response('FUNCTION_PAYLOAD_TOO_LARGE', { status: 413 }), 'en', new File(['source'], 'source', { type: `${kind}/${kind === 'video' ? 'mp4' : 'png'}` }));
    assert.match(state.error ?? '', /too large.*smaller/i);
    assert.doesNotMatch(state.error ?? '', /FUNCTION_PAYLOAD|413/);
    assert.equal(state.uploading, false);
    assert.equal(state.source, null);
  }
});

test('upscaler explains expired sessions and network failures', async () => {
  const file = new File(['video'], 'source.mp4', { type: 'video/mp4' });
  const unauthorized = await exerciseSourceHook(async () => Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }), 'en', file);
  assert.match(unauthorized.error ?? '', /sign in again/i);
  const disconnected = await exerciseSourceHook(async () => { throw new TypeError('Failed to fetch'); }, 'en', file);
  assert.match(disconnected.error ?? '', /connection.*try again/i);
  assert.equal(disconnected.uploading, false);
});

test('upscaler aborts a partially uploaded video instead of accepting an incomplete source', async () => {
  const file = new File([new Uint8Array(8 * 1024 * 1024)], 'source.mp4', { type: 'video/mp4' });
  const receiver = multipartReceiver(file);
  const paths: string[] = [];
  let partCount = 0;
  const state = await exerciseSourceHook(async (input, init) => {
    const path = String(input);
    paths.push(path);
    if (path.endsWith('/multipart/part') && ++partCount === 2) {
      return Response.json({ ok: false, error: 'UPLOAD_FAILED' }, { status: 500 });
    }
    if (path.endsWith('/multipart/abort')) return Response.json({ ok: true });
    return receiver.request(input, init);
  }, 'en', file);
  assert.match(state.error ?? '', /could not be saved.*try again/i);
  assert.equal(state.uploading, false);
  assert.equal(state.source, null);
  assert.ok(paths.includes('/api/uploads/video/multipart/abort'));
  assert.ok(!paths.includes('/api/uploads/video/multipart/complete'));
});
