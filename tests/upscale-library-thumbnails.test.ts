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
      if (url.startsWith('/api/media-library/assets?')) {
        return url.includes('cursor=page-2')
          ? Response.json({
              ok: true,
              assets: [{ id: 'second-page', url: '/renders/second-page.mp4', mime: 'video/mp4', source: 'generated' }],
              hasMore: false,
              nextCursor: null,
            })
          : Response.json({ ok: true, assets: [
              { id: 'saved', url: '/renders/saved.mp4', thumbUrl: '/renders/saved.jpg', mime: 'video/mp4', source: 'saved_job_output' },
              { id: 'duplicate', url: '/renders/shared.mp4', mime: 'video/mp4', width: 1920, source: 'saved_job_output' },
              { id: 'upload', url: '/renders/imported.mp4', mime: 'video/mp4', source: 'upload' },
              { id: 'image', url: '/renders/image.png', mime: 'image/png' },
            ], hasMore: true, nextCursor: 'page-2' });
      }
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
    await act(async () => library.openLibraryModal());
    assert.equal(library.libraryError, null);
    let assets = library.visibleLibraryAssets;
    assert.equal(assets.length, 5, 'The first page excludes images, unfinished jobs, and duplicate video URLs');
    assert.equal(library.libraryHasMore, true);
    assert.deepEqual(requests, [
      '/api/media-library/assets?limit=30&kind=video&source=generated',
      '/api/jobs?limit=80&type=video',
    ]);
    await act(async () => library.loadMoreLibraryAssets());
    assets = library.visibleLibraryAssets;
    assert.equal(assets.length, 6, 'Load more appends the next saved-video page without reloading jobs');
    assert.equal(library.libraryHasMore, false);
    assert.equal(assets.find((asset) => asset.id === 'saved')?.thumbUrl, '/renders/saved.jpg');
    assert.equal(assets.find((asset) => asset.id === 'saved')?.source, 'generated');
    const shared = assets.find((asset) => asset.url === '/renders/shared.mp4')!;
    assert.equal(shared.id, 'duplicate', 'Keep the saved asset identity when enriching from a job');
    assert.equal(shared.width, 1920);
    assert.equal(shared.thumbUrl, '/renders/shared.jpg');
    assert.equal(assets.find((asset) => asset.id === 'job:recent')?.thumbUrl, '/renders/recent.jpg');
    assert.equal(assets.find((asset) => asset.id === 'job:frame')?.thumbUrl, '/renders/frame.jpg');
    assert.equal(assets.find((asset) => asset.id === 'upload')?.thumbUrl ?? null, null, 'No invented thumbnail for an import without one');
    assert.ok(assets.every((asset) => !asset.previewUrl), 'Opening the picker must not enable video downloads');
    assert.deepEqual(requests, [
      '/api/media-library/assets?limit=30&kind=video&source=generated',
      '/api/jobs?limit=80&type=video',
      '/api/media-library/assets?limit=30&kind=video&source=generated&cursor=page-2',
    ]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('upscale library isolates loaded assets and pending responses by account', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  let resolveLateAccountA!: (response: Response) => void;
  let resolveAccountB!: (response: Response) => void;
  const lateAccountA = new Promise<Response>((resolve) => { resolveLateAccountA = resolve; });
  const accountB = new Promise<Response>((resolve) => { resolveAccountB = resolve; });
  let mediaRequestCount = 0;
  const globals = {
    window: dom.window,
    document: dom.window.document,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (input: RequestInfo | URL) => {
      const url = String(input);
      assert.equal(url, '/api/media-library/assets?limit=30&kind=image');
      mediaRequestCount += 1;
      if (mediaRequestCount === 1) {
        return Response.json({
          ok: true,
          assets: [{ id: 'account-a', url: '/renders/account-a.png', mime: 'image/png' }],
          hasMore: false,
          nextCursor: null,
        });
      }
      return mediaRequestCount === 2 ? lateAccountA : accountB;
    },
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  let library!: ReturnType<typeof useUpscaleLibraryAssets>;
  function Fixture({ user }: { user: string }) {
    library = useUpscaleLibraryAssets({ mediaType: 'image', libraryErrorCopy: 'Failed', user });
    return null;
  }

  const root = createRoot(dom.window.document.querySelector<HTMLElement>('#root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture, { user: 'account-a' })));
    await act(async () => library.openLibraryModal());
    assert.deepEqual(library.visibleLibraryAssets.map((asset) => asset.id), ['account-a']);

    await act(async () => {
      void library.fetchLibraryAssets();
      await Promise.resolve();
    });
    assert.equal(mediaRequestCount, 2, 'Account A refresh is pending');

    await act(async () => root.render(React.createElement(Fixture, { user: 'account-b' })));
    assert.equal(mediaRequestCount, 3, 'Changing account starts a distinct library request');
    assert.deepEqual(library.visibleLibraryAssets, [], 'Account A assets are hidden while account B loads');

    await act(async () => {
      resolveLateAccountA(Response.json({
        ok: true,
        assets: [{ id: 'account-a-late', url: '/renders/account-a-late.png', mime: 'image/png' }],
        hasMore: false,
        nextCursor: null,
      }));
      await lateAccountA;
    });
    assert.deepEqual(library.visibleLibraryAssets, [], 'A late account A response stays invalidated');

    await act(async () => {
      resolveAccountB(Response.json({
        ok: true,
        assets: [{ id: 'account-b', url: '/renders/account-b.png', mime: 'image/png' }],
        hasMore: false,
        nextCursor: null,
      }));
      await accountB;
    });
    assert.deepEqual(library.visibleLibraryAssets.map((asset) => asset.id), ['account-b']);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
