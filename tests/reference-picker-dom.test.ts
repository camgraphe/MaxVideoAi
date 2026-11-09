import {mediaGridGlobals} from './helpers/media-grid-dom';
import './helpers/uppy-node-fixture';
import { mockBrowserSession } from './helpers/browser-session-fixture';
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
import { getMediaInputEligibility } from '../frontend/lib/media-input-eligibility';
import { AssetLibraryModal } from '../frontend/components/library/AssetLibraryModal';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';

async function harness() {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = { FormData:dom.window.FormData, ...mediaGridGlobals(dom.window), window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const doc = dom.window.document;
  return { dom, doc, render: async (element: React.ReactElement) => act(async () => root.render(element)),
    click: async (selector: string) => act(async () => doc.querySelector<HTMLButtonElement>(selector)!.click()),
    close: async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}
const asset: AssetBrowserAsset = { id: 'original', url: 'https://private.example/original.png?sig=Exact', thumbUrl: 'https://private.example/thumb.png?sig=Thumb', kind: 'image', width: 1024, height: 768, jobId: 'job-7', sourceOutputId: 'output-7' };
const props: AssetLibraryBrowserProps = { title: 'Reference', assetType: 'image', assets: [asset], isLoading: false, source: 'all', availableSources: ['all', 'upload'], sourceLabels: { all: 'All', upload: 'Uploaded' }, onSourceChange() {}, searchPlaceholder: 'Search', sourcesTitle: 'Source', emptyLabel: 'Empty', emptySearchLabel: 'No match', renderAssetActions: () => null };

for (const example of [
  { kind: 'image', fieldId: 'keyframe_images', label: 'Keyframe 1', name: 'keyframe.png', mime: 'image/png', wrongName: 'clip.mp4', wrongMime: 'video/mp4' },
  { kind: 'video', fieldId: 'video_url', label: 'Source video', name: 'clip.mp4', mime: 'video/mp4', wrongName: 'keyframe.png', wrongMime: 'image/png' },
] as const) {
  test(`${example.label} library import accepts its media kind and rejects a mismatched file before upload`, async () => {
    const h = await harness(); const previousFetch = globalThis.fetch;
    const selected: File[] = [];
    globalThis.fetch = async () => { throw new Error('The owned import callback must handle the upload'); };
    try {
      const field = { id: example.fieldId, type: example.kind, label: example.label, acceptedMimeTypes: [example.mime] };
      await h.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children:
        React.createElement(AssetLibraryModal, { fieldLabel: example.label, assetType: example.kind,
          assets: [], isLoading: false, error: null, onClose() {}, onSelect() {}, source: 'all', onSourceChange() {},
          onRefresh() {}, onDelete() {}, deletingAssetId: null,
          getEligibility: (asset, context) => getMediaInputEligibility({ asset, field, context }),
          onImportFile: async file => { selected.push(file); } }) }));
      const input = h.doc.querySelector<HTMLInputElement>('input[type=file]')!;
      assert.equal(input.accept, `${example.kind}/*`);
      const choose = async (name: string, mime: string) => {
        const file = new h.dom.window.File(['source'], name, { type: mime }) as unknown as File;
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        await act(async () => { input.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })); });
        return file;
      };
      await choose(example.wrongName, example.wrongMime);
      assert.deepEqual(selected, [], 'a mismatched media file must not reach upload');
      assert.ok(h.doc.querySelector('[role=alert]'), 'the user should see why the file cannot be imported');
      const accepted = await choose(example.name, example.mime);
      assert.deepEqual(selected, [accepted], 'the original file must reach its owned import handler once');
      assert.equal(h.doc.querySelector('[role=alert]'), null);
    } finally { globalThis.fetch = previousFetch; await h.close(); }
  });
}

test('audio reference library imports through its supplied owned callback without generic upload requests', async () => {
  const h = await harness(); const previousFetch = globalThis.fetch;
  let selected: File | undefined;
  globalThis.fetch = async () => { throw new Error('Generic upload must not run'); };
  try {
    await h.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children:
      React.createElement(AssetLibraryModal, { fieldLabel: 'Soundtrack', assetType: 'audio', assets: [], isLoading: false, error: null,
        onClose() {}, onSelect() {}, source: 'all', onSourceChange() {}, onRefresh() {}, onDelete() {}, deletingAssetId: null,
        onImportFile: async file => { selected = file; } }) }));
    assert.match(h.doc.querySelector('h2')!.textContent!, /audio/);
    const input = h.doc.querySelector<HTMLInputElement>('input[type=file]')!;
    assert.equal(input.accept, 'audio/*');
    const file = new h.dom.window.File(['audio'], 'sound.wav', { type: 'audio/wav' }) as unknown as File;
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => { input.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })); });
    assert.equal(selected, file);
    assert.equal(h.doc.querySelector('[role=alert]'), null);
  } finally { globalThis.fetch = previousFetch; await h.close(); }
});

test('an audio reference slot requests and retains audio originals from Media', async () => {
  const { useWorkspaceAssetLibrary } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary');
  const session = await mockBrowserSession('A');
  const h = await harness(); const oldFetch = globalThis.fetch; const urls: string[] = [];
  const audio = { id: 'voice', url: 'https://private.example/voice.wav?sig=Exact', kind: 'audio', mime: 'audio/wav', durationSec: 9 };
  globalThis.fetch = async input => { urls.push(String(input)); return Response.json({ ok: true, assets: [audio] }); };
  let library!: ReturnType<typeof useWorkspaceAssetLibrary>;
  function Owner() { library = useWorkspaceAssetLibrary({ userId: 'A', showNotice() {}, setInputAssets() {} }); return null; }
  try {
    await h.render(React.createElement(Owner));
    await act(async () => library.setAssetPickerTarget({ kind: 'field', field: { id: 'audio_urls', type: 'audio', label: 'Audio', maxCount: 3 } }));
    assert.equal(library.assetLibraryKind, 'audio');
    assert.match(urls[0], /kind=audio/);
    assert.equal(library.visibleAssetLibrary[0].url, audio.url);
    assert.equal(library.visibleAssetLibrary[0].durationSec, 9);
  } finally { await session.restore(); globalThis.fetch = oldFetch; await h.close(); }
});

test('picker filters known incompatibilities, explains all-media exclusions and keeps unknown originals selectable', async () => {
  const h = await harness(); let chosen: AssetBrowserAsset | undefined;
  const unknown = { ...asset, id: 'unknown', mime: null, size: null };
  const wrong = { ...asset, id: 'wrong', mime: 'image/gif', url: 'https://media.example/image.gif' };
  const field = { id: 'image', type: 'image' as const, label: 'Image', acceptedMimeTypes: ['image/png'], maxSizeMB: 5 };
  try {
    await h.render(React.createElement(AssetLibraryBrowser, { ...props, assets: [unknown, wrong], selection: {
      scope: 'owner:image', getEligibility: value => getMediaInputEligibility({ asset: value, field }), onConfirm: value => { chosen = value; },
    } }));
    assert.equal(h.doc.querySelectorAll('.compact-media-check input').length, 1);
    assert.match(h.doc.body.textContent!, /validated|verified/i);
    await h.click('.compact-media-check input'); await h.click('.app-picker-use'); assert.equal(chosen, unknown);
    await act(async () => {
      const select = h.doc.querySelector<HTMLSelectElement>('select[data-compatibility-filter]')!;
      select.value = 'all'; select.dispatchEvent(new h.dom.window.Event('change', { bubbles: true }));
    });
    const cards = h.doc.querySelectorAll<HTMLButtonElement>('.compact-media-check input');
    assert.equal(cards.length, 2); assert.equal(cards[1].disabled, true);
    assert.match(cards[1].closest('[data-media-key]')!.textContent!, /Format/);
    await h.render(React.createElement(AssetLibraryBrowser, { ...props, assets: [wrong], selection: {
      scope: 'owner:image:other-slot', getEligibility: value => getMediaInputEligibility({ asset: value, field }),
    } }));
    assert.match(h.doc.querySelector('.app-picker-empty')!.textContent!, /All media/,
      'incompatible results must not claim that the account library is empty');
  } finally { await h.close(); }
});

test('staged selection confirms exact original once, keeps rejection in panel, and cancels without insertion', async () => {
  const h = await harness();
  let calls = 0; let closed = 0; let resolve!: (value: string | void) => void;
  const view = () => React.createElement(AssetLibraryBrowser, { ...props, onClose: () => closed++, selection: { scope: 'account/target/0', onConfirm: async selected => { calls++; assert.equal(selected, asset); return new Promise<string | void>(done => { resolve = done; }); } } });
  try {
    await h.render(view());
    assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true);
    await h.click('.compact-media-check input'); assert.equal(calls, 0);
    assert.equal(h.doc.querySelector('img')!.getAttribute('src'), asset.thumbUrl);
    await h.click('.app-picker-use'); await h.click('.app-picker-use');
    assert.equal(calls, 1); assert.equal(h.doc.querySelector('fieldset')!.disabled, true);
    await act(async () => resolve('Maximum references reached'));
    assert.match(h.doc.querySelector('[role="alert"]')!.textContent!, /Maximum/);
    assert.equal(closed, 0); assert.equal(h.doc.querySelector('.compact-media-check input')!.checked, true);
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
    await h.click('.compact-media-check input');
    h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.focus();
    await h.click('.app-picker-use');
    assert.ok(h.doc.querySelector('[role=dialog]')!.contains(h.doc.activeElement),'busy collection focus stays within the modal');
    await act(async () => h.doc.activeElement!.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.ok(h.doc.querySelector('[role="dialog"]'));
    await act(async () => resolve());
    assert.equal(h.doc.querySelector('[role="dialog"]'), null);
  } finally { await h.close(); }
});

test('source changes retain choice; destination and account retire it and observed replacements cannot resurrect', async () => {
  const h = await harness();
  let calls = 0;
  const view = (scope: string, source: 'all' | 'upload' = 'all', assets = [asset]) => React.createElement(AssetLibraryBrowser, { ...props, source, assets, selection: { scope, onConfirm: () => { calls++; } } });
  try {
    await h.render(view('owner-a:slot0')); await h.click('.compact-media-check input');
    await h.render(view('owner-a:slot0', 'upload')); assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, false);
    for (const [scope, source] of [['owner-a:slot1', 'all'], ['owner-b:slot1', 'all']] as const) {
      await h.render(view(scope, source)); assert.equal(h.doc.querySelector<HTMLButtonElement>('.app-picker-use')!.disabled, true); await h.click('.compact-media-check input');
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
  const h = await harness(); const session=await mockBrowserSession('alice');const previousFetch=globalThis.fetch;let proofs=0;
  globalThis.fetch=async(input,init)=>{const url=String(input);if(url.includes('/recent-outputs'))return new Response(JSON.stringify({ok:true,outputs:[],hasMore:false}));if(url.includes('/selection/validate-job-video')){proofs++;assert.deepEqual(JSON.parse(String(init?.body)),{jobId:'job1',originalUrl:video.url});return new Response(JSON.stringify({ok:true}));}throw Error('Unexpected '+url);};
  const video = { jobId: 'job1', url: 'https://private.example/original.mp4?sig=Exact', thumbUrl: 'https://private.example/poster.jpg?sig=Thumb', label: 'Clip', createdAt: new Date().toISOString(), hasAudio: true, durationSec: 5, aspectRatio: '16:9' };
  const copy = { picker: { title: 'Video source', description: 'Choose a video', close: 'Close', empty: 'Empty', audioBadge: 'Audio' }, source: { durationPending: 'Pending' } } as AudioWorkspaceCopy;
  let selected: unknown; let closed = 0;
  try {
    h.doc.getElementById('opener')!.focus();
    await h.render(React.createElement(AudioGeneratedVideoPickerModal, { open: true, userId:'alice', videos: [video], isLoading: false, error: null, locale: 'en', copy, onClose: () => closed++, onSelect: value => { selected = value; } }));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(h.doc.querySelector('#root [role="dialog"]'), null); assert.ok(h.doc.querySelector('body > .app-library-picker-layer [role="dialog"]'));
    assert.equal(h.doc.querySelector('video'), null); assert.equal(h.doc.querySelector('img')!.getAttribute('loading'), 'lazy');
    await h.click('.compact-media-check input'); assert.equal(selected, undefined); await h.click('.app-picker-use'); assert.equal(selected, video);assert.equal(proofs,1,'authenticated historical proof must run');
    await act(async () => h.doc.querySelector('[role="dialog"]')!.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); assert.equal(closed, 1);
    await h.render(React.createElement(AudioGeneratedVideoPickerModal, { open: false, videos: [], isLoading: false, error: null, locale: 'en', copy, onClose() {}, onSelect() {} }));
    assert.equal(h.doc.activeElement?.id, 'opener'); assert.equal(h.doc.body.style.overflow, '');
  } finally { globalThis.fetch=previousFetch;await session.restore();await h.close(); }
});


test('reference role navigation defaults to compatible images and preserves actual field/index callbacks', async () => {
  const h = await harness();
  const fields: AssetFieldConfig[] = [
    { field: { id: 'end_image_url', label: 'End image', type: 'image', maxCount: 1 }, required: false, role: 'frame' },
    { field: { id: 'image_url', label: 'Start image', type: 'image', maxCount: 1 }, required: false, role: 'primary' },
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
    assert.deepEqual([...h.doc.querySelectorAll('.app-reference-role-row')].map(row => [...row.querySelectorAll('[data-reference-role]')].map(button => button.getAttribute('data-reference-role'))),
      [['image_urls', 'video_urls', 'audio_urls'], ['image_url', 'end_image_url', 'video_url']]);
    await h.click('[data-reference-role="audio_urls"]');
    assert.match(h.doc.body.textContent!, /Model does not allow audio/);
    assert.equal(h.doc.querySelectorAll('[data-rendered-field]').length, 1);
    await h.click('[data-reference-role="image_urls"]'); await h.click('[data-library]');
    assert.deepEqual(calls, ['image_urls:2']); assert.equal(JSON.stringify(assets), snapshot);
  } finally { await h.close(); }
});

test('video library owner hides prior account immediately, reopens empty and rejects late account/source responses', async () => {
  const { useWorkspaceAssetLibrary } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary');
  const session = await mockBrowserSession('A');
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
    session.setUserId('B');
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
    session.setUserId(null); await h.render(React.createElement(Owner, { userId: null })); assert.deepEqual(library.visibleAssetLibrary, []); assert.equal(library.assetPickerTarget, null);
  } finally { await session.restore(); globalThis.fetch = oldFetch; await h.close(); }
});

test('video reference Media picker appends cursor pages without replacing the first page', async () => {
  const { useWorkspaceAssetLibrary } = await import('../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetLibrary');
  const session = await mockBrowserSession('owner');
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
    await session.restore();
    globalThis.fetch = oldFetch;
    await h.close();
  }
});

test('image and character library SWR caches are account scoped across reopen and late responses', async () => {
  const { useImageLibraryData } = await import('../frontend/app/(core)/(workspace)/app/image/_hooks/useImageLibraryData');
  const h = await harness(); const oldFetch = globalThis.fetch;
  const session = await mockBrowserSession('A');
  const requests: { url: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async input => new Promise(resolve => requests.push({ url: String(input), resolve }));
  let ids: string[] = [];
  function Owner({ userId, character }: { userId: string | null; character: boolean }) {
    const result = useImageLibraryData({ userId, source: 'all', isCharacterMode: character });
    ids = result.data?.map(item => item.id) ?? [];
    return React.createElement('output', {}, ids.join(','));
  }
  const cache = new Map();
  const view = (userId: string | null, character = false, open = true) => {
    session.setUserId(userId);
    return React.createElement(SWRConfig, { value: { provider: () => cache } }, open ? React.createElement(Owner, { userId, character }) : null);
  };
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
  } finally { await session.restore(); globalThis.fetch = oldFetch; await h.close(); }
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
  const session = await mockBrowserSession('A');
  const render = (account: string | null, open = true) => {session.setUserId(account);return h.render(React.createElement(Owner, { account, open }));};
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
  } finally { await session.restore(); globalThis.fetch = oldFetch; await h.close(); }
});


test('ordered basket survives source/page/cache changes, reorders, and retains a refused confirmation', async () => {
  const h = await harness(); const second = {...asset, id:'second', url:'https://media.invalid/second.png'};
  const accepted: AssetBrowserAsset[][] = [];
  const view = (assets: AssetBrowserAsset[], source: 'all'|'upload'='all', scope='owner/model/role') => React.createElement(AssetLibraryBrowser, {...props,assets,source,selection:{scope,onConfirmMany:(items:AssetBrowserAsset[])=>{accepted.push(items);return 'Live budget changed';}}});
  try {
    await h.render(view([asset,second])); await h.click('.compact-media-check input');
    await act(async()=>h.doc.querySelectorAll<HTMLInputElement>('.compact-media-check input')[1].click());
    await h.render(view([], 'upload'));
    assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,2);
    await h.click('[data-basket-move="up"]');
    await h.click('.app-picker-use'); assert.deepEqual(accepted,[[second,asset]]);
    assert.match(h.doc.querySelector('[role=alert]')!.textContent!,/Live budget/);
    assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,2);
    await h.render(view([asset], 'all', 'owner/model2/role'));
    assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,0);
  } finally {await h.close();}
});

for (const outcome of ['accept', 'trash', 'version'] as const) {
 test(`direct activation validates only the clicked source once and handles ${outcome}`, async () => {
  const session = await mockBrowserSession('A'), h = await harness(), oldFetch = globalThis.fetch;
  const reference = { type: 'asset' as const, assetId: 'ma_' + 'a'.repeat(32), kind: 'image' as const };
  const clicked: AssetBrowserAsset = { ...asset, libraryRef: reference, sourceRevision: 'sr_one' };
  const other: AssetBrowserAsset = { ...asset, id: 'other', url: 'https://private.example/other.png?sig=Other', libraryRef: { ...reference, assetId: 'ma_' + 'b'.repeat(32) }, sourceRevision: 'sr_two' };
  const requests: unknown[] = [], accepted: AssetBrowserAsset[][] = [];
  let finish!: (response: Response) => void;
  globalThis.fetch = async (input, init) => {
   assert.ok(String(input).endsWith('/selection/validate'));
   requests.push(JSON.parse(String(init?.body)));
   return new Promise(resolve => { finish = resolve; });
  };
  try {
   await h.render(React.createElement(AssetLibraryBrowser, { ...props, assets: [clicked, other], selection: { ownerId: 'A', scope: 'model:append', onConfirmMany: items => { accepted.push(items); } } }));
   await act(async () => h.doc.querySelectorAll<HTMLInputElement>('.compact-media-check input')[1].click());
   const primary = h.doc.querySelector<HTMLButtonElement>('.compact-media-preview')!;
   await act(async () => { primary.click(); primary.click(); });
   assert.deepEqual(requests, [{ candidates: [{ reference: { ...reference, sourceRevision: 'sr_one' }, originalUrl: 'https://private.example/original.png?sig=Exact' }] }]);
   assert.equal(accepted.length, 0, 'insertion waits for authoritative validation');
   await act(async () => finish(Response.json({ ok: true, results: [{ reference, ...(outcome === 'accept' ? {} : { error: outcome === 'trash' ? 'SOURCE_TRASHED' : 'SOURCE_VERSION_CHANGED' }), state: { key: 'lo_one', favorite: false, collectionIds: [], trashedAt: outcome === 'trash' ? '2026-11-09T00:00:00Z' : null } }] })));
   assert.equal(accepted.length, outcome === 'accept' ? 1 : 0);
   if (outcome === 'accept') assert.deepEqual(accepted[0].map(item => [item.id, item.url]), [['original', 'https://private.example/original.png?sig=Exact']]);
   else assert.ok(h.doc.querySelector('[role=alert]'), 'a refusal remains visible');
   assert.equal(h.doc.querySelectorAll('[data-basket-item]').length, 1, 'the unrelated pending choice is preserved');
  } finally { globalThis.fetch = oldFetch; await h.close(); await session.restore(); }
 });
}

for (const activation of ['basket', 'direct'] as const)
for(const change of ['model','role','account','reopen'] as const)test(`late ${activation} validation cannot accept a retired ${change} intent, including ABA`,async()=>{
 const session=await mockBrowserSession('A'),h=await harness(),oldFetch=globalThis.fetch;let finish!:(x:Response)=>void,calls=0;
 globalThis.fetch=async()=>new Promise(resolve=>finish=resolve);
 const view=(scope='model-A:role-A',owner='A')=>React.createElement(AssetLibraryBrowser,{...props,selection:{scope,ownerId:owner,onConfirmMany:()=>{calls++;}}});
 try{
  await h.render(view());
  if (activation === 'basket') { await h.click('.compact-media-check input'); await h.click('.app-picker-use'); }
  else await h.click('.compact-media-preview');
  assert.equal(calls,0);
  if(change==='reopen')await h.render(React.createElement('div'));else await h.render(view(change==='model'?'model-B:role-A':change==='role'?'model-A:role-B':'model-A:role-A',change==='account'?'B':'A'));
  await h.render(view());
  await act(async()=>finish(Response.json({ok:true,results:[{reference:{type:'legacy',assetId:asset.id,kind:'image'}}]})));
  assert.equal(calls,0);assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,0);
 }finally{globalThis.fetch=oldFetch;await h.close();await session.restore();}
});

test('search-hidden Trash choice stays recoverable, Restore changes only organization, and Preview returns to the same host and basket',async()=>{
 const session=await mockBrowserSession('A'),h=await harness(),oldFetch=globalThis.fetch;let trashed=true,calls=0;const seen:any[]=[];
 const state=()=>({key:'lo_item',favorite:false,trashedAt:trashed?'2026-11-09T00:00:00Z':null,collectionIds:[]});
 globalThis.fetch=async(url,init)=>{const body=init?.body?JSON.parse(String(init.body)):{};seen.push({url:String(url),body});if(String(url).endsWith('/selection/validate'))return Response.json({ok:true,results:[{reference:body.candidates[0].reference,state:state(),...trashed?{error:'SOURCE_TRASHED'}:{}}]});if(String(url).endsWith('/organization')){trashed=false;return Response.json({ok:true,succeededCount:1,failedCount:0,results:[{status:'succeeded',state:state()}]});}return Response.json({ok:true,collections:[]});};
 const view=(assets=[asset])=>React.createElement('section',{'data-host':'stable'},React.createElement(AssetLibraryBrowser,{...props,assets,selection:{scope:'model:append',ownerId:'A',onConfirmMany:items=>{calls++;assert.equal(items[0].url,asset.url);}}}));
 try{
  await h.render(view());const host=h.doc.querySelector('[data-host]');await h.click('.compact-media-check input');await h.click('.compact-media-inspect');assert.equal(h.doc.querySelector('[data-host]'),host);assert.equal(h.doc.querySelectorAll('[role=dialog]').length,0);
  const back=[...h.doc.querySelectorAll('button')].find(b=>b.textContent==='Back')!;await act(async()=>back.click());assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,1);
  await h.render(view([]));await h.click('.app-picker-use');assert.equal(calls,0);assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,1);assert.match(h.doc.body.textContent!,/In Trash/);
  const restore=[...h.doc.querySelectorAll('button')].find(b=>b.textContent==='Restore')!;await act(async()=>restore.click());assert.equal(calls,0);
  await h.click('.app-picker-use');assert.equal(calls,1);assert.equal(seen.filter(x=>x.url.endsWith('/organization')).length,1);assert.equal(seen[0].body.candidates[0].originalUrl,asset.url);
 }finally{globalThis.fetch=oldFetch;await h.close();await session.restore();}
});

test('one dialog retains its real import queue after close/reopen and stages successful results only on Choose',async()=>{
 const {LibraryPickerDialog}=await import('../frontend/components/library/LibraryPickerDialog.client');
 const session=await mockBrowserSession('A'),h=await harness(),oldFetch=globalThis.fetch;
 const uploaded={id:'internal',assetId:'ma_'+'a'.repeat(32),url:'https://example.invalid/import.png',kind:'image'};let finish!:(x:Response)=>void,uploads=0,accepted=0;
 globalThis.fetch=async(url,init)=>{if(String(url).includes('/uploads/')){uploads++;return new Promise(done=>finish=done);}if(String(url).endsWith('/organization'))return Response.json({ok:true,succeededCount:1,failedCount:0});return Response.json({ok:true,results:JSON.parse(String(init?.body)).candidates.map((c:any)=>({reference:c.reference}))});};
 const view=(open:boolean)=>React.createElement(LibraryPickerDialog,{...props,assets:[],open,userId:'A',intent:'model:references',selection:{onConfirm:()=>{accepted++;}}});
 try{
 await h.render(view(true));const input=h.doc.querySelector<HTMLInputElement>('input[type=file]')!;Object.defineProperty(input,'files',{configurable:true,value:[new h.dom.window.File(['png'],'source.png',{type:'image/png'})]});await act(async()=>input.dispatchEvent(new h.dom.window.Event('change',{bubbles:true})));
 await h.click('.app-library-import button');assert.equal(uploads,1);await h.render(view(false));assert.equal(h.doc.querySelector('[role=dialog]'),null);
 await act(async()=>finish(Response.json({ok:true,asset:uploaded})));assert.equal(accepted,0);
 await h.render(view(true));assert.equal(h.doc.querySelectorAll('[role=dialog]').length,1);assert.equal(h.doc.querySelectorAll('[data-basket-item]').length,0);
 const queue=[...h.doc.querySelectorAll('button')].find(b=>b.textContent?.startsWith('1 ·'))!;await act(async()=>queue.click());
 const choose=[...h.doc.querySelectorAll('button')].find(b=>b.textContent==='Choose · source.png')!;assert.ok(choose);await act(async()=>choose.click());assert.equal(accepted,0);await h.click('.app-picker-use');assert.equal(accepted,1);assert.equal(uploads,1);
 }finally{globalThis.fetch=oldFetch;await h.close();await session.restore();}
});

test('authenticated Audio picker validates persisted outputs and never falls back around Trash or an exact-source mismatch',async()=>{
 const h=await harness(),session=await mockBrowserSession('alice'),previousFetch=globalThis.fetch;
 const video={jobId:'persisted-job',url:'https://owned.test/original.mp4',thumbUrl:null,label:'Persisted',createdAt:new Date().toISOString(),hasAudio:true,durationSec:5,aspectRatio:'16:9'};
 const copy={picker:{title:'Video source',description:'Choose',close:'Close',empty:'Empty',audioBadge:'Audio'},source:{durationPending:'Pending'}} as AudioWorkspaceCopy;
 let mode='valid',selected:unknown,validations=0,historical=0;
 globalThis.fetch=async(input,init)=>{const url=String(input);if(url.includes('/recent-outputs'))return new Response(JSON.stringify({ok:true,hasMore:false,outputs:[{id:'actual-output',jobId:video.jobId,url:mode==='replaced'?'https://owned.test/new.mp4':video.url,status:'ready'}]}));if(url.includes('/selection/validate-job-video')){historical++;throw Error('must never fall back');}if(url.includes('/selection/validate')){validations++;const {candidates}=JSON.parse(String(init?.body));assert.deepEqual(candidates,[{reference:{type:'job-output',jobId:video.jobId,outputId:'actual-output',kind:'video'},originalUrl:video.url}]);return new Response(JSON.stringify({ok:true,results:[{reference:candidates[0].reference,...mode==='trash'?{error:'SOURCE_TRASHED',state:{key:'group',favorite:false,collectionIds:[],trashedAt:'2026-11-09'}}:{}}]}));}throw Error(url);};
 const view=(open:boolean)=>React.createElement(AudioGeneratedVideoPickerModal,{open,userId:'alice',videos:[video],isLoading:false,error:null,locale:'en',copy,onClose(){},onSelect(value){selected=value;}});
 try{for(mode of ['valid','trash','replaced']){selected=undefined;await h.render(view(true));await h.click('.compact-media-check input');await h.click('.app-picker-use');assert.equal(selected,mode==='valid'?video:undefined);if(mode!=='valid')assert.ok(h.doc.querySelector('[role=alert]'));await h.render(view(false));}assert.equal(validations,2);assert.equal(historical,0);}
 finally{globalThis.fetch=previousFetch;await session.restore();await h.close();}
});

for (const mode of ['preview', 'import'] as const) {
  test(`existing modal moves focus into inline ${mode} and restores the initiating control`, async () => {
    const { createLibraryImportQueue } = await import('../frontend/lib/library-import-queue');
    const session = await mockBrowserSession('A'), h = await harness(), oldFetch = globalThis.fetch;
    const queue = createLibraryImportQueue({ userId: 'A' });
    globalThis.fetch = async (url) => String(url).includes('seedance-workflow')
      ? Response.json(null, { status: 404 }) : String(url).includes('/media-library/browse')
        ? Response.json({ ok: true, assets: [{ ...asset, kind: 'image', sourceRevision: 'sr_focus', organization: { key: 'lo_focus', favorite: false, collectionIds: [], trashedAt: null } }], totalCount: 1, nextCursor: null, hasMore: false })
        : Response.json({ ok: true, items: [], nextCursor: null, hasMore: false });
    try {
      await h.render(React.createElement(SWRConfig, { value: { provider: () => new Map() } }, React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children:
        React.createElement(AssetLibraryModal, { fieldLabel: 'References', ownerId: 'A', assetType: 'image',
          assets: [asset], isLoading: false, error: null, onClose() {}, onSelect() {}, source: 'all', onSourceChange() {},
          onRefresh() {}, onDelete() {}, deletingAssetId: null, importQueue: queue }) })));
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
      const host = h.doc.querySelector('[role=dialog]')!;
      const trigger = mode === 'preview' ? h.doc.querySelector<HTMLButtonElement>('.compact-media-inspect')!
        : [...h.doc.querySelectorAll<HTMLButtonElement>('.app-picker-import button')].find(button => button.textContent === 'Import')!;
      await act(async () => trigger.focus());
      if (mode === 'preview') await act(async () => trigger.click());
      else {
        const input = h.doc.querySelector<HTMLInputElement>('.app-picker-import input[type=file]')!;
        await act(async () => trigger.click());
        Object.defineProperty(input, 'files', { configurable: true, value: [new h.dom.window.File(['image'], 'queued.png', { type: 'image/png' })] });
        await act(async () => input.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })));
      }
      const back = [...h.doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Back')!;
      assert.ok(h.doc.activeElement === back, 'the visible Back control receives entry focus');
      assert.ok(host.contains(h.doc.activeElement));
      assert.equal(h.doc.querySelectorAll('[role=dialog]').length, 1);
      if (mode === 'preview') {
        const organize = [...h.doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Organize')!;
        await act(async () => { organize.focus(); organize.click(); });
        assert.ok(h.doc.activeElement === organize, 'inline management retains its visible initiating control');
        assert.equal(h.doc.querySelectorAll('[role=dialog]').length, 1);
      }
      back.focus(); await act(async () => back.click());
      assert.ok(h.doc.activeElement === trigger, 'Back restores the exact initiating control');
      assert.equal(h.doc.querySelector('[role=dialog]'), host);
    } finally { queue.retire(); globalThis.fetch = oldFetch; await h.close(); await session.restore(); }
  });
}
