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
