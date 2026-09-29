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

async function mount(destinations: PlaylistDestination[], initialItems: PlaylistItemRecord[] = [], options: { playlists?: PlaylistSummary[]; enableCuration?: boolean } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/playlists' });
  Object.defineProperty(dom.window, 'innerWidth', { configurable: true, value: 688 });
  (dom.window.HTMLElement.prototype as unknown as { attachEvent: () => void; detachEvent: () => void }).attachEvent = () => {};
  (dom.window.HTMLElement.prototype as unknown as { attachEvent: () => void; detachEvent: () => void }).detachEvent = () => {};
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; init?: RequestInit; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React, IS_REACT_ACT_ENVIRONMENT: true, fetch: (url: string, init?: RequestInit) => new Promise<Response>(resolve => requests.push({ url, init, resolve })) })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const { PlaylistsManager } = await import('../frontend/components/admin/PlaylistsManager');
  await act(async () => root.render(React.createElement(PlaylistsManager, { initialDestinations: destinations,
    initialPlaylists: options.playlists ?? destinations.filter(d => d.playlistId).map(d => playlist(d.playlistId!)),
    initialPlaylistId: null, initialItems, enableCuration: options.enableCuration })));
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
    const picker = document.querySelector('[data-destination-picker]')!;
    assert.match(editor.textContent!, /examples/);
    assert.ok(picker.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the compact destination picker precedes the editor in narrow document order');
    const maintenance = document.querySelector('#playlist-maintenance')!;
    assert.ok(editor.compareDocumentPosition(maintenance) & Node.DOCUMENT_POSITION_FOLLOWING,
      'collection maintenance follows the gallery work area');
    assert.equal(document.querySelectorAll('[data-destination-picker]').length, 1);
    assert.equal(document.querySelector('[data-long-inventory]'), null);
    assert.equal(document.querySelector('[data-current-destination-header]'), null);
    assert.match(picker.textContent!, /examples/i);
    assert.equal(document.querySelector('[data-destination-id="examples"]'), null,
      'the destination list opens on demand instead of occupying the first viewport');
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
    await act(async () => (view.dom.window.document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    await act(async () => (view.dom.window.document.querySelector('[data-destination-id="family:wan"]') as HTMLButtonElement).click());
    assert.equal(view.requests.length, 0);
    assert.match(view.dom.window.document.querySelector('[data-destination-picker] button[aria-haspopup]')!.textContent!, /examples/i);
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
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    assert.equal(document.querySelector('[data-destination-id="family:wan"]')?.getAttribute('aria-current'), 'true');
    const ids = [...document.querySelectorAll('[data-destination-group="families"] [data-destination-id]')].map(el => el.getAttribute('data-destination-id'));
    assert.deepEqual(ids, ['family:wan', 'model:wan-3', 'model:wan-4']);
    const search = document.querySelector('[data-destination-picker] input[type="search"]') as HTMLInputElement;
    await act(async () => Simulate.change(search, { target: { value: '/models/wan-4' } }));
    assert.ok(document.querySelector('[data-destination-id="model:wan-4"]'));
    assert.equal(Boolean(document.querySelector('[data-destination-picker] [data-destination-id="model:wan-3"]')), false);
    assert.equal(view.requests.length, 0);
  } finally { await view.close(); }
});

test('shared playlist IDs keep the selected logical destination after a successful fetch', async () => {
  const examples = destination('examples', 'examples', 'shared');
  examples.label = 'Examples'; examples.path = '/examples';
  const starter = destination('starter', 'starter', 'shared');
  starter.label = 'Starter video'; starter.path = '/app?tab=starter';
  const maintenance = destination('playlist:orphan', 'maintenance', 'orphan');
  maintenance.label = 'Orphan'; maintenance.path = null; maintenance.status = 'unconnected';
  const view = await mount([examples, starter, maintenance], [], { playlists: [playlist('shared'), playlist('orphan')] });
  try {
    const { document } = view.dom.window;
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    await act(async () => (document.querySelector('[data-destination-id="starter"]') as HTMLButtonElement).click());
    assert.match(document.querySelector('[data-destination-picker]')!.textContent!, /Examples/);
    assert.equal(view.requests[0].url, '/api/admin/playlists/shared');
    await act(async () => view.requests[0].resolve(Response.json({ ok: true, playlist: playlist('shared'), items: [] })));
    assert.match(document.querySelector('[data-destination-picker] button[aria-haspopup]')!.textContent!, /Starter video/);
    assert.match(document.querySelector('[data-destination-picker]')!.textContent!, /Starter video/);
    assert.equal(document.querySelector('[data-destination-picker] a[data-live-page]')?.getAttribute('href'), '/app?tab=starter');
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    await act(async () => (document.querySelector('[data-destination-id="playlist:orphan"]') as HTMLButtonElement).click());
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, playlist: playlist('orphan'), items: [] })));
    assert.match(document.querySelector('[data-destination-picker] button[aria-haspopup]')!.textContent!, /Orphan/);
    assert.match(document.querySelector('[data-destination-picker]')!.textContent!, /Orphan/);
  } finally { await view.close(); }
});

test('missing starter and historical rows are diagnostics with a maintenance action', async () => {
  const missing = destination('starter', 'starter', null);
  missing.slug = 'live-starter'; missing.warning = 'Runtime expects live-starter';
  const old = destination('playlist:old', 'maintenance', 'old');
  old.status = 'historical'; old.editable = false; old.warning = 'Historical slug mismatch';
  const view = await mount([destination('examples', 'examples', 'examples'), missing, old]);
  try {
    const { document } = view.dom.window;
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    assert.match(document.body.textContent!, /Runtime expects live-starter/);
    assert.equal(document.querySelector('[data-missing-destination="starter"] button'), null);
    const maintenanceLink = document.querySelector('[data-missing-destination="starter"] a[href="#playlist-maintenance"]') as HTMLAnchorElement;
    assert.ok(maintenanceLink);
    await act(async () => maintenanceLink.click());
    assert.equal((document.querySelector('#playlist-maintenance') as HTMLDetailsElement).open, true);
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    assert.ok(document.querySelector('[data-destination-diagnostics] [data-destination-id="playlist:old"]'));
    assert.equal(document.querySelector('[data-destination-diagnostics] [data-destination-id="playlist:old"] button'), null);
  } finally { await view.close(); }
});

test('missing model collections offer one explicit creation action without writing on open', async () => {
  const examples = destination('examples', 'examples', 'examples');
  const first = destination('model:dreamina-seedance-2-0-mini', 'model', null, 'seedance');
  const second = destination('model:happy-horse-1-1', 'model', null, 'happy-horse');
  const view = await mount([examples, first, second]);
  try {
    const { document } = view.dom.window;
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    const create = document.querySelector('[data-create-missing-model-collections]') as HTMLButtonElement;
    assert.ok(create);
    assert.match(create.textContent ?? '', /create 2 empty model collections/i);
    assert.equal(view.requests.length, 0, 'opening the selector remains read-only');
    await act(async () => create.click());
    assert.equal(view.requests.length, 1);
    assert.equal(view.requests[0].url, '/api/admin/playlists/helpers');
    assert.equal(view.requests[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(view.requests[0].init?.body)), { action: 'create-missing-model-playlists' });
    await act(async () => view.requests[0].resolve(Response.json({ ok: true, playlists: [] })));
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, playlists: [playlist('examples')], destinations: [examples] })));
    await act(async () => view.requests[2].resolve(Response.json({ ok: true, playlist: playlist('examples'), items: [] })));
    await act(async () => (document.querySelector('[data-destination-picker] button[aria-haspopup]') as HTMLButtonElement).click());
    assert.equal(document.querySelector('[data-create-missing-model-collections]'), null);
  } finally { await view.close(); }
});

test('legacy order save refreshes destination counts and source chain', async () => {
  const examples = destination('examples', 'examples', 'examples');
  const items: PlaylistItemRecord[] = ['one', 'two'].map((videoId, orderIndex) => ({ playlistId: 'examples', videoId,
    orderIndex, pinned: false, createdAt: '', visibility: 'public', indexable: true, isPublishedOnSite: true }));
  const view = await mount([examples], items);
  try {
    const { document } = view.dom.window;
    await act(async () => (document.querySelector('[aria-label="Move item 2 up"]') as HTMLButtonElement).click());
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save order')!.click());
    assert.equal(view.requests[0].init?.method, 'PUT');
    await act(async () => view.requests[0].resolve(Response.json({ ok: true })));
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, playlist: playlist('examples'), items })));
    assert.equal(view.requests[2].url, '/api/admin/playlists');
    await act(async () => view.requests[2].resolve(Response.json({ ok: true, playlists: [playlist('examples')],
      destinations: [{ ...examples, publicCount: 1, sourceSlugs: ['new-source'] }] })));
    assert.match(document.querySelector('[data-destination-picker]')!.textContent!, /1 public media/);
    const details = document.querySelector('[data-source-chain]') as HTMLDetailsElement;
    assert.ok(details);
    assert.ok(document.querySelector('[data-destination-editor]')!.compareDocumentPosition(details) & document.defaultView!.Node.DOCUMENT_POSITION_FOLLOWING,
      'source diagnostics follow the working area');
    details.open = true;
    assert.match(details.textContent!, /new-source/);
  } finally { await view.close(); }
});

test('curation save refreshes the destination projection', async () => {
  const examples = destination('examples', 'examples', 'examples');
  const managed = { ...playlist('examples'), surfaceRole: 'examplesHub' as const };
  const view = await mount([examples], [], { playlists: [managed], enableCuration: true });
  try {
    const { document } = view.dom.window;
    assert.equal(view.requests[0].url, '/api/admin/playlists/examples/curation');
    const snapshot = { available: true, openingAvailable: false, supported: true, slug: 'examples',
      isPublic: true, revision: 'r1', config: null };
    const candidate = { id: 'one', prompt: 'One', engineId: 'wan-3', engineLabel: 'Wan 3', videoUrl: '/one.mp4', thumbUrl: null, createdAt: '' };
    await act(async () => view.requests[0].resolve(Response.json({ ok: true, snapshot, selectedItems: [candidate], selectedTotal: 1, initialIds: ['one'] })));
    assert.match(document.querySelector('[data-opening-unavailable]')?.textContent ?? '', /until gallery storage is enabled/i);
    assert.ok(document.querySelector('[data-opening-board]')?.contains(document.querySelector('[data-opening-unavailable]')),
      'the storage note stays inside the opening board instead of adding another row before the videos');
    assert.equal(document.querySelectorAll('[data-opening-board] [data-opening-slot]').length, 4,
      'the current first four remain visible as the page-order gallery preview without opening storage');
    assert.match((document.querySelector('[data-opening-slot="1"] button') as HTMLButtonElement).getAttribute('aria-label') ?? '', /choose opening slot 1/i);
    assert.equal(view.requests.length, 1, 'candidate inventory stays deferred until the explorer opens');
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Preview changes')!.click());
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, preview: { items: [candidate], token: 't1', revision: 'r1' } })));
    await act(async () => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save changes')!.click());
    await act(async () => view.requests[2].resolve(Response.json({ ok: true, snapshot: { ...snapshot, revision: 'r2' } })));
    assert.equal(view.requests[3].url, '/api/admin/playlists');
    await act(async () => view.requests[3].resolve(Response.json({ ok: true, playlists: [managed],
      destinations: [{ ...examples, publicCount: 1, sourceSlugs: ['manual-only'] }] })));
    assert.match(document.querySelector('[data-destination-picker]')!.textContent!, /1 public media/);
    assert.match(document.querySelector('[data-source-chain]')!.textContent!, /manual-only/);
  } finally { await view.close(); }
});

test('fallback opening keeps its first four videos separate from the manual tail', async () => {
  const examples = destination('examples', 'examples', 'examples');
  const view = await mount([examples], [], { enableCuration: true });
  try {
    const candidates = ['lead', 'portrait', 'side-a', 'side-b', 'tail-a', 'tail-b'].map((id, index) => ({
      id, prompt: id, engineId: 'wan-3', engineLabel: 'Wan 3', videoUrl: `/${id}.mp4`, thumbUrl: null,
      createdAt: '', outputWidth: index === 1 ? 720 : 1280, outputHeight: index === 1 ? 1280 : 720,
    }));
    const ids = candidates.map(item => item.id);
    await act(async () => view.requests[0].resolve(Response.json({ ok: true, snapshot: {
      available: true, openingAvailable: false, supported: true, slug: 'examples', isPublic: true,
      revision: 'r1', config: { mode: 'manual', openingIds: null, orderedIds: ids, excludedIds: [] },
    }, selectedItems: candidates, selectedTotal: 6, initialIds: ids })));
    const { document } = view.dom.window;
    assert.deepEqual([...document.querySelectorAll('[data-opening-slot]')].map(slot => slot.getAttribute('data-opening-id')), ids.slice(0, 4));
    assert.deepEqual([...document.querySelectorAll('[data-selected-grid] [data-curation-item]')].map(item => item.getAttribute('data-curation-item')), ids.slice(4));
    assert.match((document.querySelector('[data-opening-slot="1"] button') as HTMLButtonElement).getAttribute('aria-label') ?? '', /choose opening slot 1/i);
    await act(async () => (document.querySelector('[data-opening-slot="1"] button') as HTMLButtonElement).click());
    assert.match(view.requests[1].url, /\/curation\/candidates\?/);
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, items: candidates, total: 6, nextCursor: null })));
    await act(async () => (document.querySelector('[aria-label="Eligible media"] [data-media-id="tail-a"] button') as HTMLButtonElement).click());
    assert.deepEqual([...document.querySelectorAll('[data-opening-slot]')].map(slot => slot.getAttribute('data-opening-id')),
      ['tail-a', 'portrait', 'side-a', 'side-b']);
    assert.deepEqual([...document.querySelectorAll('[data-selected-grid] [data-curation-item]')].map(item => item.getAttribute('data-curation-item')),
      ['lead', 'tail-b'], 'the replaced lead remains selected after an unsaved slot swap');
  } finally { await view.close(); }
});

test('legacy remove refreshes the destination projection', async () => {
  const examples = destination('examples', 'examples', 'examples');
  const item: PlaylistItemRecord = { playlistId: 'examples', videoId: 'one', orderIndex: 0, pinned: false,
    createdAt: '', visibility: 'public', indexable: true, isPublishedOnSite: true };
  const view = await mount([examples], [item]);
  try {
    view.dom.window.confirm = () => true;
    await act(async () => (view.dom.window.document.querySelector('[aria-label="Remove item 1 from collection"]') as HTMLButtonElement).click());
    assert.equal(view.requests[0].init?.method, 'DELETE');
    await act(async () => view.requests[0].resolve(Response.json({ ok: true })));
    await act(async () => view.requests[1].resolve(Response.json({ ok: true, playlist: playlist('examples'), items: [] })));
    assert.equal(view.requests[2].url, '/api/admin/playlists');
    await act(async () => view.requests[2].resolve(Response.json({ ok: true, playlists: [playlist('examples')],
      destinations: [{ ...examples, publicCount: 0 }] })));
    assert.match(view.dom.window.document.querySelector('[data-destination-picker]')!.textContent!, /0 public media/);
  } finally { await view.close(); }
});
