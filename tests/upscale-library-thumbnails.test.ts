import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useUpscaleLibraryAssets } from '../frontend/src/components/tools/upscale/_hooks/useUpscaleLibraryAssets';

test('upscale library preserves available thumbnails and enriches duplicate videos without loading their previews', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const requests: string[] = [];
  const globals = {
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.startsWith('/api/user-assets?')) return Response.json({ ok: true, assets: [
        { id: 'saved', url: '/renders/saved.mp4', thumbUrl: '/renders/saved.jpg', mime: 'video/mp4', source: 'generated' },
        { id: 'duplicate', url: '/renders/shared.mp4', mime: 'video/mp4', width: 1920, source: 'generated' },
        { id: 'upload', url: '/renders/imported.mp4', mime: 'video/mp4', source: 'upload' },
        { id: 'image', url: '/renders/image.png', mime: 'image/png' },
      ] });
      if (url.startsWith('/api/jobs?')) return Response.json({ ok: true, jobs: [
        { jobId: 'same', videoUrl: '/renders/shared.mp4', thumbUrl: '/renders/shared.jpg' },
        { jobId: 'recent', readyVideoUrl: '/renders/recent.mp4', thumbUrl: '/renders/recent.jpg', previewVideoUrl: '/preview.mp4' },
        { jobId: 'frame', videoUrl: '/renders/frame.mp4', previewFrame: '/renders/frame.jpg' },
        { jobId: 'pending' },
      ] });
      throw new Error(`Unexpected request: ${url}`);
    },
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let library!: ReturnType<typeof useUpscaleLibraryAssets>;
  function Fixture() {
    library = useUpscaleLibraryAssets({ mediaType: 'video', libraryErrorCopy: 'Failed', user: 'owner' });
    return null;
  }
  const root = createRoot(dom.window.document.querySelector<HTMLElement>('#root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    await act(async () => library.fetchLibraryAssets({ kind: 'video', source: 'generated' }));
    assert.equal(library.libraryError, null);
    const assets = library.visibleLibraryAssets;
    assert.equal(assets.length, 5, 'Exclude images, unfinished jobs, and duplicate video URLs');
    assert.equal(assets.find((asset) => asset.id === 'saved')?.thumbUrl, '/renders/saved.jpg');
    const shared = assets.find((asset) => asset.url === '/renders/shared.mp4')!;
    assert.equal(shared.id, 'duplicate', 'Keep the saved asset identity when enriching from a job');
    assert.equal(shared.width, 1920);
    assert.equal(shared.thumbUrl, '/renders/shared.jpg');
    assert.equal(assets.find((asset) => asset.id === 'job:recent')?.thumbUrl, '/renders/recent.jpg');
    assert.equal(assets.find((asset) => asset.id === 'job:frame')?.thumbUrl, '/renders/frame.jpg');
    assert.equal(assets.find((asset) => asset.id === 'upload')?.thumbUrl ?? null, null, 'No invented thumbnail for an import without one');
    assert.ok(assets.every((asset) => !asset.previewUrl), 'Opening the picker must not enable video downloads');
    assert.deepEqual(requests, ['/api/user-assets?limit=80&source=generated', '/api/jobs?limit=80&type=video']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
