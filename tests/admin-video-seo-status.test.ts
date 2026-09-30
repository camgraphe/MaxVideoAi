import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminAuthError } from '../frontend/src/server/admin';
import { handleVideoSeoStatusGet } from '../frontend/app/api/admin/video-seo/[videoId]/status/_lib/status-read';

const request = new NextRequest('http://localhost/api/admin/video-seo/video-1/status');
const props = { params: Promise.resolve({ videoId: 'video-1' }) };

test('Video SEO status rejects unauthenticated reads before querying', async () => {
  let queried = false;
  const response = await handleVideoSeoStatusGet(request, props, {
    authorize: async () => { throw new AdminAuthError('Unauthorized', 401); },
    getRow: async () => { queried = true; return null; },
  });
  assert.equal(response.status, 401);
  assert.equal(queried, false);
});

for (const [name, seoStatus, eligible, expectedSitemap] of [
  ['approved watch entry', 'approved', true, true],
  ['draft watch entry', 'draft', false, false],
] as const) {
  test(`Video SEO status returns ${name} without editorial fields`, async () => {
    const response = await handleVideoSeoStatusGet(request, props, {
      authorize: async () => 'admin',
      getRow: async id => {
        assert.equal(id, 'video-1');
        return { editorial: { seoStatus }, isEligible: eligible };
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, status: seoStatus, inVideoSitemap: expectedSitemap });
  });
}

test('a gallery video outside Video SEO is not selected', async () => {
  const response = await handleVideoSeoStatusGet(request, props, {
    authorize: async () => 'admin', getRow: async () => null,
  });
  assert.deepEqual(await response.json(), { ok: true, status: 'not_selected', inVideoSitemap: false });
});

test('a failed SEO read reports unavailable without leaking details', async () => {
  const response = await handleVideoSeoStatusGet(request, props, {
    authorize: async () => 'admin', getRow: async () => { throw new Error('secret database detail'); },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'Video SEO status unavailable' });
});

test('inspector reads SEO status on open and loads video only after Play', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/playlists' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; init?: RequestInit; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) => new Promise<Response>(resolve => requests.push({ url, init, resolve })) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  let closed = false;
  try {
    const { PlacementMediaInspector } = await import('../frontend/components/admin/playlists/PlacementMediaInspector');
    const item = { id: 'video/a & b', engineId: 'wan-3', engineLabel: 'Wan 3', prompt: 'A visual story',
      videoUrl: '/original.mp4', thumbUrl: '/poster.jpg', createdAt: '', outputWidth: 720, outputHeight: 1280 };
    await act(async () => root.render(React.createElement(PlacementMediaInspector, {
      item, onClose: () => { closed = true; }, onRemove() {}, onExclude() {},
    })));
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, '/api/admin/video-seo/video%2Fa%20%26%20b/status');
    assert.equal(requests[0].init?.method, undefined);
    assert.equal(dom.window.document.querySelector('video'), null);
    assert.equal(dom.window.document.querySelector('a[href="/admin/video-seo?video=video%2Fa%20%26%20b"]')?.textContent?.trim(), 'Open Video SEO');
    await act(async () => requests[0].resolve(Response.json({ ok: true, status: 'not_selected', inVideoSitemap: false })));
    assert.match(dom.window.document.body.textContent!, /Not selected for Video SEO/);
    assert.match(dom.window.document.body.textContent!, /In this gallery draft/);
    await act(async () => ([...dom.window.document.querySelectorAll('button')].find(el => el.textContent === 'Play video') as HTMLButtonElement).click());
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('preload'), 'none');
    assert.equal(requests.length, 1, 'playing the original does not request an admin mutation');
    await act(async () => ([...dom.window.document.querySelectorAll('button')].find(el => el.textContent === 'Close details') as HTMLButtonElement).click());
    assert.equal(closed, true);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
