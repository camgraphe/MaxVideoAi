import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlaylistSummary, PlaylistItemRecord } from '../frontend/components/admin/playlists/playlist-types';

const playlists = ['a', 'b'].map(
  (id): PlaylistSummary => ({
    id,
    name: `Destination ${id}`,
    slug: id,
    description: null,
    isPublic: true,
    createdAt: '',
    updatedAt: '',
    itemCount: 2,
    siteVisibleCount: 2,
    withVideoAssetCount: 2,
    lastAddedAt: null,
    kind: 'core',
    isLocked: true,
    usageTargets: [],
    surfaceRole: 'family',
    surfaceStatus: 'ready',
    familyId: 'wan',
    modelSlug: null,
    helperText: null,
    drivesRoute: '/examples',
    fallbackModelSlugs: [],
  }),
);
const items = ['one', 'two'].map(
  (id, index): PlaylistItemRecord => ({
    playlistId: 'a',
    videoId: id,
    orderIndex: index,
    pinned: false,
    createdAt: '',
    prompt: `Original ${id}`,
    visibility: 'public',
    indexable: true,
    isPublishedOnSite: true,
  }),
);

test('failed destination load retains selection and dirty order; pending requests prevent a second switch', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/admin/playlists',
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{
    url: string;
    init?: RequestInit;
    resolve: (response: Response) => void;
  }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => requests.push({ url, init, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  dom.window.confirm = () => true;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent?.includes(name))!;
  try {
    const { PlaylistsManager } = await import('../frontend/components/admin/PlaylistsManager');
    await act(async () =>
      root.render(
        React.createElement(PlaylistsManager, {
          initialPlaylists: playlists,
          initialPlaylistId: 'a',
          initialItems: items,
        }),
      ),
    );
    const beforeDrag = [...dom.window.document.querySelectorAll('article[draggable]')].map((row) => row.textContent);
    const dragRows = dom.window.document.querySelectorAll('article[draggable]');
    const transfer = {
      setData() {},
      setDragImage() {},
      effectAllowed: '',
      dropEffect: '',
    };
    for (const [type, target] of [
      ['dragstart', dragRows[0]],
      ['dragover', dragRows[1]],
      ['drop', dragRows[1]],
      ['dragend', dragRows[0]],
    ] as const) {
      const event = new dom.window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientY: 1,
      });
      Object.defineProperty(event, 'dataTransfer', { value: transfer });
      await act(async () => target.dispatchEvent(event));
    }
    assert.notDeepEqual(
      [...dom.window.document.querySelectorAll('article[draggable]')].map((row) => row.textContent),
      beforeDrag,
    );
    await act(async () => button('Cancel').click());
    assert.deepEqual(
      [...dom.window.document.querySelectorAll('article[draggable]')].map((row) => row.textContent),
      beforeDrag,
    );
    await act(async () =>
      (dom.window.document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click(),
    );
    assert.equal(button('Seed from current order').disabled, true, 'maintenance must not discard an unsaved order');
    await act(async () => button('Destination b').click());
    assert.equal(requests.length, 1);
    assert.equal(
      button('Destination a').getAttribute('aria-pressed'),
      'true',
      'selection must stay on the loaded destination while fetching',
    );
    await act(async () => button('Destination a').click());
    assert.equal(requests.length, 1, 'no parallel request while a destination is loading');
    await act(async () => requests[0].resolve(new Response('{}', { status: 503 })));
    assert.equal(button('Destination a').getAttribute('aria-pressed'), 'true');
    assert.match(dom.window.document.body.textContent!, /Unsaved order/);
    await act(async () => button('Save order').click());
    assert.equal(requests[1].url, '/api/admin/playlists/a/items', 'old items must never be saved to destination b');
    assert.equal(requests[1].init?.method, 'PUT');
    await act(async () => requests[1].resolve(new Response('{}', { status: 503 })));
    await act(async () => button('Save order').click());
    await act(async () => requests[2].resolve(Response.json({ ok: true })));
    await act(async () => requests[3].resolve(new Response('{}', { status: 503 })));
    assert.doesNotMatch(dom.window.document.body.textContent!, /Unsaved order/);
    assert.equal(button('Cancel').disabled, true, 'confirmed save must not offer rollback to an obsolete local order');

    await act(async () => button('Destination b').click());
    await act(async () => requests[4].resolve(Response.json({ ok: true, playlist: playlists[1], items: [] })));
    assert.equal(button('Destination b').getAttribute('aria-pressed'), 'true');
    assert.doesNotMatch(dom.window.document.body.textContent!, /Original one|Original two/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('curation destination switches guard staged changes and pending preview', async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/admin/playlists',
  });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{
    url: string;
    init?: RequestInit;
    resolve: (response: Response) => void;
  }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string, init?: RequestInit) =>
      new Promise<Response>((resolve) => requests.push({ url, init, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  dom.window.confirm = () => true;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const button = (name: string) =>
    [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent?.includes(name))!;
  try {
    const { PlaylistsManager } = await import('../frontend/components/admin/PlaylistsManager');
    await act(async () =>
      root.render(
        React.createElement(PlaylistsManager, {
          initialPlaylists: playlists,
          initialPlaylistId: 'a',
          initialItems: items,
          enableCuration: true,
        }),
      ),
    );
    assert.equal(requests[0].url, '/api/admin/playlists/a/curation');
    assert.equal(button('Destination b').disabled, true);
    const candidates = ['one', 'two'].map((id) => ({
      id,
      prompt: id,
      engineId: 'wan-3',
      engineLabel: 'Wan 3',
      videoUrl: '/v.mp4',
      thumbUrl: null,
      createdAt: '',
    }));
    await act(async () =>
      requests[0].resolve(
        Response.json({
          ok: true,
          snapshot: {
            available: true,
            supported: true,
            slug: 'family-wan',
            isPublic: true,
            revision: 'r1',
            config: null,
          },
          candidates,
          initialIds: ['one', 'two'],
        }),
      ),
    );
    await act(async () =>
      (dom.window.document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click(),
    );
    dom.window.confirm = () => false;
    await act(async () => button('Destination b').click());
    assert.equal(requests.length, 1, 'declining discard keeps the draft');
    await act(async () => button('Preview changes').click());
    assert.equal(button('Destination b').disabled, true, 'pending preview locks destination');
    await act(async () =>
      requests[1].resolve(Response.json({ ok: false, error: 'Preview unavailable' }, { status: 503 })),
    );
    assert.match(dom.window.document.body.textContent!, /Preview unavailable/);
    assert.equal(button('Cancel').disabled, false, 'failed preview preserves draft');
    dom.window.confirm = () => true;
    await act(async () => button('Destination b').click());
    await act(async () => requests[2].resolve(Response.json({ ok: true, playlist: playlists[1], items: [] })));
    assert.equal(requests[3].url, '/api/admin/playlists/b/curation');
    await act(async () =>
      requests[3].resolve(
        Response.json({
          ok: true,
          snapshot: {
            available: true,
            supported: true,
            slug: 'family-wan',
            isPublic: true,
            revision: 'r2',
            config: null,
          },
          candidates: [],
          initialIds: [],
        }),
      ),
    );
    assert.equal(button('Destination b').getAttribute('aria-pressed'), 'true');
    assert.equal(button('Cancel').disabled, true, 'destination starts with a clean draft');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
