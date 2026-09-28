import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import type { PlaylistDestination } from '../frontend/server/playlists/types';
import type { PlaylistSummary, PlaylistItemRecord } from '../frontend/components/admin/playlists/playlist-types';

function destination(id: string, kind: PlaylistDestination['kind'], playlistId: string | null, familyId: string | null = null): PlaylistDestination {
  return { id, kind, slug: id, playlistId, label: id, path: `/${id}`, familyId, modelSlug: kind === 'model' ? id.slice(6) : null,
    itemCount: 2, publicCount: 2, sourceSlugs: [id], status: playlistId ? 'connected' : 'missing', editable: !!playlistId,
    warning: playlistId ? null : `Missing ${id}` };
}
function playlist(id: string): PlaylistSummary {
  return { id, slug: id, name: id, description: null, isPublic: true, createdAt: '', updatedAt: '', itemCount: 2,
    siteVisibleCount: 2, withVideoAssetCount: 2, lastAddedAt: null, kind: 'core', isLocked: true, usageTargets: [],
    surfaceRole: 'other', surfaceStatus: 'ready', familyId: null, modelSlug: null, helperText: null, drivesRoute: `/${id}`,
    fallbackModelSlugs: [] };
}

async function mount(destinations: PlaylistDestination[], initialItems: PlaylistItemRecord[] = []) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/playlists' });
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 688 });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    React, IS_REACT_ACT_ENVIRONMENT: true, fetch: (url: string) => new Promise<Response>(resolve => requests.push({ url, resolve })) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const { PlaylistsManager } = await import('../frontend/components/admin/PlaylistsManager');
  await act(async () => root.render(React.createElement(PlaylistsManager, { initialDestinations: destinations,
    initialPlaylists: destinations.filter(d => d.playlistId).map(d => playlist(d.playlistId!)), initialPlaylistId: null, initialItems })));
  return { dom, requests, async close() { await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  } };
}

test('opens_connected_hub_before_inventory', async () => {
  const destinations = [destination('examples', 'examples', 'examples'), destination('starter', 'starter', 'starter'),
    destination('family:wan', 'family', 'family:wan', 'wan'), destination('model:wan-3', 'model', 'model:wan-3', 'wan')];
  const view = await mount(destinations);
  try {
    const { document, Node } = view.dom.window;
    const editor = document.querySelector('[data-destination-editor]')!;
    const longInventory = document.querySelector('[data-long-inventory]')!;
    assert.match(editor.textContent!, /examples/);
    assert.ok(editor.compareDocumentPosition(longInventory) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the long inventory follows the editor in narrow document order');
    const focusOrder = [...document.querySelectorAll('button:not([disabled]), a[href], input')];
    assert.ok(focusOrder.indexOf(editor.querySelector('a[href]')!) < focusOrder.indexOf(longInventory.querySelector('input')!),
      'keyboard traversal reaches the destination editor before the inventory search');
    assert.equal(document.querySelector('[data-destination-id="examples"]')?.getAttribute('aria-pressed'), 'true');
    assert.match(document.body.textContent!, /Starter video/);
  } finally { await view.close(); }
});

test('dirty draft blocks destination selection without confirmation', async () => {
  const destinations = [destination('examples', 'examples', 'examples'), destination('family:wan', 'family', 'wan', 'wan')];
  const items: PlaylistItemRecord[] = ['one', 'two'].map((videoId, orderIndex) => ({ playlistId: 'examples', videoId,
    orderIndex, pinned: false, createdAt: '', visibility: 'public', indexable: true, isPublishedOnSite: true }));
  const view = await mount(destinations, items);
  try {
    await act(async () => (view.dom.window.document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click());
    view.dom.window.confirm = () => false;
    await act(async () => (view.dom.window.document.querySelector('[data-destination-id="family:wan"]') as HTMLButtonElement).click());
    assert.equal(view.requests.length, 0);
    assert.equal(view.dom.window.document.querySelector('[data-destination-id="examples"]')?.getAttribute('aria-pressed'), 'true');
  } finally { await view.close(); }
});

test('groups_models_by_family', async () => {
  const destinations = [destination('examples', 'examples', null), destination('starter', 'starter', 'starter'),
    destination('family:wan', 'family', 'family:wan', 'wan'), destination('model:wan-3', 'model', 'model:wan-3', 'wan'),
    destination('model:wan-4', 'model', 'model:wan-4', 'wan')];
  destinations[3].path = '/models/wan-3'; destinations[4].path = '/models/wan-4';
  const view = await mount(destinations);
  try {
    const { document } = view.dom.window;
    assert.match(document.body.textContent!, /Missing examples/);
    assert.equal(document.querySelector('[data-destination-id="family:wan"]')?.getAttribute('aria-pressed'), 'true');
    const ids = [...document.querySelectorAll('[data-long-inventory] [data-destination-id]')].map(el => el.getAttribute('data-destination-id'));
    assert.deepEqual(ids, ['family:wan', 'model:wan-3', 'model:wan-4']);
    const search = document.querySelector('input[type="search"]') as HTMLInputElement;
    await act(async () => Simulate.change(search, { target: { value: '/models/wan-4' } }));
    assert.ok(document.querySelector('[data-destination-id="model:wan-4"]'));
    assert.equal(Boolean(document.querySelector('[data-long-inventory] [data-destination-id="model:wan-3"]')), false);
    assert.equal(view.requests.length, 0);
  } finally { await view.close(); }
});
