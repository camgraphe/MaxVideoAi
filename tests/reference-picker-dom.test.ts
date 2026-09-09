import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act, useState } from 'react';
import { SWRConfig } from 'swr';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AssetLibraryBrowser, type AssetLibraryBrowserProps, type AssetBrowserAsset } from '../frontend/components/library/AssetLibraryBrowser';
import { useAccessibleModal } from '../frontend/components/ui/useAccessibleModal';
import { WorkspaceReferenceInventory } from '../frontend/components/composer/WorkspaceReferenceInventory.client';
import type { AssetFieldConfig } from '../frontend/components/AssetDropzone';
import { AudioGeneratedVideoPickerModal } from '../frontend/app/(core)/(workspace)/app/audio/_components/audio-generated-video-picker';
import type { AudioWorkspaceCopy } from '../frontend/app/(core)/(workspace)/app/audio/copy';

async function harness() {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const doc = dom.window.document;
  return { dom, doc, render: async (element: React.ReactElement) => act(async () => root.render(element)),
    click: async (selector: string) => act(async () => doc.querySelector<HTMLButtonElement>(selector)!.click()),
    close: async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}
const asset: AssetBrowserAsset = { id: 'original', url: 'https://private.example/original.png?sig=Exact', thumbUrl: 'https://private.example/thumb.png?sig=Thumb', kind: 'image', width: 1024, height: 768, sourceOutputId: 'output-7' };
const props: AssetLibraryBrowserProps = { title: 'Reference', assetType: 'image', assets: [asset], isLoading: false, source: 'all', availableSources: ['all', 'upload'], sourceLabels: { all: 'All', upload: 'Uploaded' }, onSourceChange() {}, searchPlaceholder: 'Search', sourcesTitle: 'Source', emptyLabel: 'Empty', emptySearchLabel: 'No match', renderAssetActions: () => null };

test('staged selection confirms exact original once, keeps rejection in panel, and cancels without insertion', async () => {
  const h = await harness();
  let calls = 0; let closed = 0; let resolve!: (value: string | void) => void;
  const view = () => React.createElement(AssetLibraryBrowser, { ...props, onClose: () => closed++, selection: { scope: 'account/target/0', onConfirm: async selected => { calls++; assert.equal(selected, asset); return new Promise<string | void>(done => { resolve = done; }); } } });
  try {
    await h.render(view());
    assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true);
    await h.click('.app-picker-card'); assert.equal(calls, 0);
    assert.equal(h.doc.querySelector('img')!.getAttribute('src'), asset.thumbUrl);
    await h.click('.app-picker-use'); await h.click('.app-picker-use');
    assert.equal(calls, 1); assert.equal(h.doc.querySelector('fieldset')!.disabled, true);
    await act(async () => resolve('Maximum references reached'));
    assert.match(h.doc.querySelector('[role="alert"]')!.textContent!, /Maximum/);
    assert.equal(closed, 0); assert.equal(h.doc.querySelector('.app-picker-card')!.getAttribute('aria-pressed'), 'true');
    await h.click('.app-picker-selection button');
    assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true);
    await h.click('.app-picker-footer-actions button'); assert.equal(closed, 1); assert.equal(calls, 1);
  } finally { await h.close(); }
});

test('accepted owner closes; busy focus stays inside and blocks Escape', async () => {
  const h = await harness();
  let resolve!: (value: string | void) => void;
  function Frame() {
    const [open, setOpen] = useState(true); const [busy, setBusy] = useState(false);
    const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose: () => { if (!busy) setOpen(false); }, closeDisabled: busy });
    return open ? React.createElement('div', { ref: dialogRef, role: 'dialog', tabIndex: -1, onKeyDown: onDialogKeyDown }, React.createElement(AssetLibraryBrowser, { ...props, onClose: () => setOpen(false), selection: { scope: 'target', busy, onBusyChange: setBusy, onConfirm: async () => { const result = await new Promise<string | void>(done => { resolve = done; }); if (!result) setOpen(false); return result; } } })) : null;
  }
  try {
    await h.render(React.createElement(Frame));
    await h.click('.app-picker-card');
    h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.focus();
    await h.click('.app-picker-use');
    assert.equal(h.doc.activeElement?.getAttribute('role'), 'dialog', 'all controls disabled should recover focus to dialog');
    await act(async () => h.doc.activeElement!.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.ok(h.doc.querySelector('[role="dialog"]'));
    await act(async () => resolve());
    assert.equal(h.doc.querySelector('[role="dialog"]'), null);
  } finally { await h.close(); }
});

test('source, destination and account scope changes reset choice; changed or removed originals cannot confirm', async () => {
  const h = await harness();
  let calls = 0;
  const view = (scope: string, source: 'all' | 'upload' = 'all', assets = [asset]) => React.createElement(AssetLibraryBrowser, { ...props, source, assets, selection: { scope, onConfirm: () => { calls++; } } });
  try {
    await h.render(view('owner-a:slot0')); await h.click('.app-picker-card');
    for (const [scope, source] of [['owner-a:slot0', 'upload'], ['owner-a:slot1', 'all'], ['owner-b:slot1', 'all']] as const) {
      await h.render(view(scope, source)); assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true); await h.click('.app-picker-card');
    }
    await h.render(view('owner-b:slot1', 'all', [{ ...asset, url: asset.url + 'changed' }]));
    assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true);
    await h.render(view('owner-b:slot1')); assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true, 'restored old records must not revive an invalidated choice');
    await h.render(view('owner-b:slot1', 'all', [])); assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true); assert.equal(calls, 0);
  } finally { await h.close(); }
});

test('character mode keeps immediate toggles and capacity, with no staged Use or destructive actions', async () => {
  const h = await harness(); let toggled: string[] = [];
  const other = { ...asset, id: 'other' };
  const view = (selectedIds: Set<string>) => React.createElement(AssetLibraryBrowser, { ...props, assets: [asset, other], selection: { scope: 'character', selectedIds, onToggle: chosen => { toggled.push(chosen.id); }, isDisabled: chosen => selectedIds.size >= 1 && !selectedIds.has(chosen.id) } });
  try {
    await h.render(view(new Set())); await h.click('.app-picker-card'); assert.deepEqual(toggled, ['original']);
    await h.render(view(new Set(['original'])));
    const cards = h.doc.querySelectorAll<HTMLButtonElement>('.app-picker-card'); assert.equal(cards[0].disabled, false); assert.equal(cards[1].disabled, true);
    await h.click('.app-picker-card'); assert.deepEqual(toggled, ['original', 'original']); assert.equal(h.doc.querySelector('.app-picker-use'), null);
  } finally { await h.close(); }
});

test('audio source picker mounts no native video, preserves payload and portal focus/Escape', async () => {
  const h = await harness();
  const video = { jobId: 'job1', url: 'https://private.example/original.mp4?sig=Exact', thumbUrl: 'https://private.example/poster.jpg?sig=Thumb', label: 'Clip', createdAt: new Date().toISOString(), hasAudio: true, durationSec: 5, aspectRatio: '16:9' };
  const copy = { picker: { title: 'Video source', description: 'Choose a video', close: 'Close', empty: 'Empty', audioBadge: 'Audio' }, source: { durationPending: 'Pending' } } as AudioWorkspaceCopy;
  let selected: unknown; let closed = 0;
  try {
    h.doc.getElementById('opener')!.focus();
    await h.render(React.createElement(AudioGeneratedVideoPickerModal, { open: true, videos: [video], isLoading: false, error: null, locale: 'en', copy, onClose: () => closed++, onSelect: value => { selected = value; } }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(h.doc.querySelector('#root [role="dialog"]'), null); assert.ok(h.doc.querySelector('body > .app-library-picker-layer [role="dialog"]'));
    assert.equal(h.doc.querySelector('video'), null); assert.equal(h.doc.querySelector('img')!.getAttribute('loading'), 'lazy');
    await h.click('.app-picker-card'); assert.equal(selected, video);
    await act(async () => h.doc.querySelector('[role="dialog"]')!.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); assert.equal(closed, 1);
    await h.render(React.createElement(AudioGeneratedVideoPickerModal, { open: false, videos: [], isLoading: false, error: null, locale: 'en', copy, onClose() {}, onSelect() {} }));
    assert.equal(h.doc.activeElement?.id, 'opener'); assert.equal(h.doc.body.style.overflow, '');
  } finally { await h.close(); }
});


test('reference role navigation defaults to compatible images and preserves actual field/index callbacks', async () => {
  const h = await harness();
  const fields: AssetFieldConfig[] = [
    { field: { id: 'video_url', label: 'Source video', type: 'video', maxCount: 1 }, required: false },
    { field: { id: 'image_urls', label: 'Images', type: 'image', maxCount: 30 }, required: false },
    { field: { id: 'video_urls', label: 'Video refs', type: 'video', maxCount: 3 }, required: false },
    { field: { id: 'audio_urls', label: 'Audio refs', type: 'audio', maxCount: 3 }, required: true, disabled: true, disabledReason: 'Model does not allow audio with this source' },
  ];
  const calls: string[] = [];
  const assets = { image_urls: [null, null, { kind: 'image' as const, name: 'Existing', size: 1, type: 'image/png', previewUrl: 'blob:existing' }] };
  const snapshot = JSON.stringify(assets);
  try {
    await h.render(React.createElement(WorkspaceReferenceInventory, { fields, assets, locale: 'en', renderField: entry => React.createElement('div', { 'data-rendered-field': entry.field.id }, entry.disabledReason, React.createElement('button', { 'data-library': true, onClick: () => calls.push(`${entry.field.id}:2`) }, 'Library')) }));
    assert.equal(h.doc.querySelector('[data-rendered-field]')!.getAttribute('data-rendered-field'), 'image_urls');
    assert.match(h.doc.querySelector('[data-reference-role="image_urls"]')!.textContent!, /1\/30/);
    assert.equal(h.doc.querySelectorAll('[data-reference-role]').length, 4);
    await h.click('[data-reference-role="audio_urls"]');
    assert.match(h.doc.body.textContent!, /Model does not allow audio/);
    assert.equal(h.doc.querySelectorAll('[data-rendered-field]').length, 1);
    await h.click('[data-reference-role="image_urls"]'); await h.click('[data-library]');
    assert.deepEqual(calls, ['image_urls:2']); assert.equal(JSON.stringify(assets), snapshot);
  } finally { await h.close(); }
});

test('video library owner hides prior account immediately, reopens empty and rejects late account/source responses', async () => {
  const { useWorkspaceAssetLibrary } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary');
  const h = await harness(); const oldFetch = globalThis.fetch;
  const requests: { url: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async input => new Promise(resolve => requests.push({ url: String(input), resolve }));
  let library!: ReturnType<typeof useWorkspaceAssetLibrary>;
  const target = { kind: 'field' as const, field: { id: 'image_urls', label: 'References', type: 'image' as const, maxCount: 10 } };
  function Owner({ userId }: { userId: string | null }) {
    library = useWorkspaceAssetLibrary({ userId, showNotice() {}, setInputAssets() {} });
    return React.createElement('output', {}, JSON.stringify({ assets: library.visibleAssetLibrary, open: Boolean(library.assetPickerTarget) }));
  }
  try {
    await h.render(React.createElement(Owner, { userId: 'A' }));
    await act(async () => library.setAssetPickerTarget(target)); assert.equal(requests.length, 1);
    await act(async () => requests[0].resolve(Response.json({ ok: true, assets: [asset] })));
    assert.equal(library.visibleAssetLibrary[0].url, asset.url);
    const oldScopeWrite = library.setAssetLibrary;
    await act(async () => { void library.fetchAssetLibrary(); }); assert.equal(requests.length, 2);
    await h.render(React.createElement(Owner, { userId: 'B' }));
    assert.deepEqual(library.visibleAssetLibrary, []); assert.equal(library.assetPickerTarget, null);
    await act(async () => library.setAssetPickerTarget(target)); assert.equal(requests.length, 3); assert.deepEqual(library.visibleAssetLibrary, []);
    await act(async () => requests[2].resolve(Response.json({ ok: true, assets: [{ ...asset, id: 'B-only', url: asset.url + '-B' }] })));
    await act(async () => requests[1].resolve(Response.json({ ok: true, assets: [asset] })));
    await act(async () => oldScopeWrite([asset]));
    assert.deepEqual(library.visibleAssetLibrary.map(item => item.id), ['B-only']);
    await act(async () => { void library.fetchAssetLibrary(); });
    await act(async () => library.handleAssetLibrarySourceChange('upload'));
    assert.deepEqual(library.visibleAssetLibrary, []); assert.equal(requests.length, 5);
    await act(async () => requests[3].resolve(Response.json({ ok: true, assets: [asset] })));
    assert.deepEqual(library.visibleAssetLibrary, []);
    await act(async () => requests[4].resolve(Response.json({ ok: true, assets: [{ ...asset, id: 'B-upload' }] })));
    assert.deepEqual(library.visibleAssetLibrary.map(item => item.id), ['B-upload']);
    await h.render(React.createElement(Owner, { userId: null })); assert.deepEqual(library.visibleAssetLibrary, []); assert.equal(library.assetPickerTarget, null);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('video reference Media picker appends cursor pages without replacing the first page', async () => {
  const { useWorkspaceAssetLibrary } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary');
  const h = await harness();
  const oldFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input);
    requests.push(url);
    return url.includes('cursor=page-2')
      ? Response.json({ ok: true, assets: [{ ...asset, id: 'page-2', url: `${asset.url}?page=2` }], hasMore: false })
      : Response.json({ ok: true, assets: [asset], hasMore: true, nextCursor: 'page-2' });
  };
  let library!: ReturnType<typeof useWorkspaceAssetLibrary>;
  const target = { kind: 'field' as const, field: { id: 'image_urls', label: 'References', type: 'image' as const, maxCount: 10 } };
  function Owner() {
    library = useWorkspaceAssetLibrary({ userId: 'owner', showNotice() {}, setInputAssets() {} });
    return React.createElement('output', {}, library.visibleAssetLibrary.map(item => item.id).join(','));
  }
  try {
    await h.render(React.createElement(Owner));
    await act(async () => library.setAssetPickerTarget(target));
    assert.equal(library.assetLibraryHasMore, true);
    await act(async () => library.loadMoreAssetLibrary());
    assert.deepEqual(requests, [
      '/api/media-library/assets?limit=30&kind=image',
      '/api/media-library/assets?limit=30&kind=image&cursor=page-2',
    ]);
    assert.deepEqual(library.visibleAssetLibrary.map(item => item.id), [asset.id, 'page-2']);
    assert.equal(library.assetLibraryHasMore, false);
  } finally {
    globalThis.fetch = oldFetch;
    await h.close();
  }
});

test('image and character library SWR caches are account scoped across reopen and late responses', async () => {
  const { useImageLibraryData } = await import('../frontend/app/(core)/(workspace)/app/image/_hooks/useImageLibraryData');
  const h = await harness(); const oldFetch = globalThis.fetch;
  const requests: { url: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async input => new Promise(resolve => requests.push({ url: String(input), resolve }));
  let ids: string[] = [];
  function Owner({ userId, character }: { userId: string | null; character: boolean }) {
    const result = useImageLibraryData({ userId, source: 'all', isCharacterMode: character });
    ids = result.data?.map(item => item.id) ?? [];
    return React.createElement('output', {}, ids.join(','));
  }
  const cache = new Map();
  const view = (userId: string | null, character = false, open = true) => React.createElement(SWRConfig, { value: { provider: () => cache } }, open ? React.createElement(Owner, { userId, character }) : null);
  try {
    await h.render(view('A')); assert.equal(requests.length, 1);
    await h.render(view('B')); assert.deepEqual(ids, []); assert.equal(requests.length, 2);
    await act(async () => requests[1].resolve(Response.json({ ok: true, assets: [{ ...asset, id: 'B-image' }] })));
    await act(async () => requests[0].resolve(Response.json({ ok: true, assets: [asset] })));
    assert.deepEqual(ids, ['B-image']);
    await h.render(view('B', false, false)); await h.render(view('B')); assert.deepEqual(ids, ['B-image']);
    await h.render(view('B', true)); assert.deepEqual(ids, []); assert.equal(requests.length, 3);
    await act(async () => requests[2].resolve(Response.json({ ok: true, characters: [{ id: 'B-character', imageUrl: asset.url }] })));
    assert.deepEqual(ids, ['B-character']);
    await h.render(view(null)); assert.deepEqual(ids, []);
    assert.match(requests[0].url, /kind=image/); assert.match(requests[2].url, /character-references/);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('audio source-video owner masks account data/loading/errors synchronously and rejects late replies on switch, logout and reopen', async () => {
  const { useAudioGeneratedVideos } = await import('../frontend/app/(core)/(workspace)/app/audio/_hooks/useAudioGeneratedVideos');
  const h = await harness(); const oldFetch = globalThis.fetch;
  const requests: { resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async () => new Promise(resolve => requests.push({ resolve }));
  let state!: ReturnType<typeof useAudioGeneratedVideos>;
  const observations: { account: string | null; ids: string[]; error: string | null; loading: boolean }[] = [];
  function Owner({ account, open }: { account: string | null; open: boolean }) {
    state = useAudioGeneratedVideos({ user: account ? { id: account } : null, open, loadErrorMessage: 'Could not load clips' });
    observations.push({ account, ids: state.generatedVideos.map(clip => clip.jobId), error: state.generatedVideosError, loading: state.isGeneratedVideosLoading });
    return React.createElement('output', {}, JSON.stringify(state));
  }
  const render = (account: string | null, open = true) => h.render(React.createElement(Owner, { account, open }));
  const reply = (index: number, id: string) => act(async () => requests[index].resolve(Response.json({ ok: true, jobs: [{ jobId: id, videoUrl: `https://private.example/${id}.mp4?sig=Exact`, thumbUrl: `https://private.example/${id}.jpg`, durationSec: 5, aspectRatio: '16:9', createdAt: '2026-09-08T00:00:00Z', hasAudio: true, engineLabel: 'Model' }] })));
  try {
    await render('A'); await reply(0, 'A-original');
    assert.equal(state.generatedVideos[0].url, 'https://private.example/A-original.mp4?sig=Exact');
    await render('A', false);
    const start = observations.length;
    await render('B', false);
    assert.ok(observations.slice(start).every(value => value.ids.length === 0 && value.error === null && value.loading === false));
    await render('B'); assert.equal(requests.length, 2); assert.equal(state.isGeneratedVideosLoading, true); await reply(1, 'B-original');
    await render('B', false); await render('B'); assert.equal(requests.length, 2, 'same account reopen can retain its own loaded clips');
    await render('A'); assert.equal(requests.length, 3);
    await render('B'); assert.equal(requests.length, 4); await reply(3, 'B-new'); await reply(2, 'A-late');
    assert.deepEqual(state.generatedVideos.map(clip => clip.jobId), ['B-new']);
    await render('A'); assert.equal(requests.length, 5);
    const logoutStart = observations.length; await render(null);
    await act(async () => requests[4].resolve(Response.json({ ok: false, error: 'A-private-error' }, { status: 500 })));
    assert.ok(observations.slice(logoutStart).every(value => value.ids.length === 0 && value.error === null && value.loading === false));
    await render('B'); assert.equal(requests.length, 6);
    await act(async () => requests[5].resolve(Response.json({ ok: false, error: 'B-error' }, { status: 500 })));
    assert.equal(state.generatedVideosError, 'B-error'); assert.equal(state.isGeneratedVideosLoading, false);
    const errorSwitch = observations.length; await render('A');
    assert.ok(observations.slice(errorSwitch).every(value => value.error === null && value.ids.length === 0 && value.loading));
    await render('A', false); await reply(6, 'closed-late'); await render('A'); assert.equal(requests.length, 8);
    await reply(7, 'A-reopened'); assert.deepEqual(state.generatedVideos.map(clip => clip.jobId), ['A-reopened']);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});
