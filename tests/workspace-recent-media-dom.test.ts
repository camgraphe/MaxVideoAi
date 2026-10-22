import { mockBrowserSession } from './helpers/browser-session-fixture';
import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SWRConfig } from 'swr';
import { useWorkspaceRecentMedia } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRecentMedia';
import { useWorkspaceRecentMetadata } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRecentMetadata';
import { WorkspaceRecentReferences } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceRecentReferences.client';
import { RECENT_MEDIA_DRAG_TYPE } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-recent-media';
import { WorkspaceRecentRoleDialog } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceRecentRoleDialog.client';
import type { UserAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import type { AssetFieldConfig } from '../frontend/components/Composer';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { stageMediaHandoff } from '../frontend/lib/media-handoff';

async function harness() {
  const dom = new JSDOM('<button id="opener">Recents</button><div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  dom.window.HTMLElement.prototype.getClientRects = function () { return (this.closest('[hidden]') ? [] : [{ width: 44, height: 44 }]) as unknown as DOMRectList; };
  const session = await mockBrowserSession(null);
  const root = createRoot(dom.window.document.getElementById('root')!);
  return { dom, root, session, render: async (element: React.ReactElement) => act(async () => root.render(element)),
    flush: async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }),
    close: async () => { await act(async () => root.unmount()); await session.restore(); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}
const image: UserAsset = { id: 'out1', url: '/assets/source.png?signature=secret', kind: 'image', mime: 'image/png', size: 1000 };

test('an incoming Modify video can enter the Luma source role while its custom editor remains enabled', async () => {
  const h = await harness();
  h.session.setUserId('modify-owner');
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, outputs: [] });
  const video = { id: 'video-output', source: 'recent', sourceOutputId: 'video-output', jobId: 'job-source', kind: 'video' as const,
    url: 'https://media.example/exact-original.mp4', mime: 'video/mp4', durationSec: 5, size: 1000 };
  const field = { id: 'video_url', type: 'video' as const, label: 'Source video', modes: ['v2v' as const], maxCount: 1, maxDurationSec: 18 };
  const inserted: unknown[] = [];
  try {
    stageMediaHandoff(h.dom.window.sessionStorage, 'modify-owner', video, 'video', 'incoming-modify');
    await h.render(React.createElement(SWRConfig, { value: { provider: () => new Map() } },
      React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams('media=incoming-modify&engine=luma-ray-3-2&mode=v2v') },
        React.createElement(WorkspaceRecentReferences, {
          userId: 'modify-owner', locale: 'en', engineId: 'luma-ray-3-2', mode: 'v2v', fields: [{ field, required: true }], inputAssets: {},
          inputSchema: { required: [field] },
          availability: { inputAssets: {}, isUnifiedSeedance: false, isUnifiedKlingO3: false, klingO3VideoToVideoSupported: true, hasAnyVideoInput: false,
            guestUploadLockedReason: null, workflowCopy: { clearReferencesToUseStartEnd: '', clearStartEndToUseReferences: '' },
            showOmniStudioPanel: false, showLumaRay32KeyframeEditor: true },
          onInsert: async (selectedField, selectedAsset) => { inserted.push({ field: selectedField.id, url: selectedAsset.url }); },
          children: () => null,
        }))));
    await h.flush();
    const add = h.dom.window.document.querySelector<HTMLButtonElement>('.app-recent-insert');
    assert.ok(add, 'custom editor must not hide the source role from the incoming video');
    assert.equal(add.disabled, false);
    assert.equal(inserted.length, 0, 'opening never overwrites existing input silently');
    await act(async () => add.click());
    assert.deepEqual(inserted, [{ field: 'video_url', url: video.url }]);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('actual SWR recents deduplicate the shared page and suppress old account/filter responses and logout data', async () => {
  const h = await harness();
  const oldFetch = globalThis.fetch;
  const requests: { url: string; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (input) => new Promise<Response>(resolve => requests.push({ url: String(input), resolve }));
  function Feed({ owner, kind }: { owner: string | null; kind: 'image' | 'audio' }) {
    const feed = useWorkspaceRecentMedia(owner, kind);
    return React.createElement(React.Fragment, {}, React.createElement('output', {}, JSON.stringify({ ids: feed.assets.map(a => a.id), loading: feed.loading })), React.createElement('button', { 'data-recent-refresh': true, onClick: feed.retry }, 'Refresh pending'));
  }
  const cache = new Map();
  const view = (owner: string | null, kind: 'image' | 'audio') => {
    h.session.setUserId(owner);
    return React.createElement(SWRConfig, { value: { provider: () => cache } }, React.createElement(Feed, { owner, kind }), React.createElement(Feed, { owner, kind }));
  };
  try {
    await h.render(view('owner-a', 'image')); await h.flush(); assert.equal(requests.length, 1);
    await act(async () => h.dom.window.document.querySelector<HTMLButtonElement>('[data-recent-refresh]')!.click());
    assert.equal(requests.length, 1, 'opening while the current page is loading must not duplicate its request');
    await h.render(view('owner-b', 'audio')); await h.flush(); assert.equal(requests.length, 2);
    await act(async () => requests[0].resolve(Response.json({ ok: true, outputs: [{ ...image, url: 'https://media.example/image.png', jobId: 'job1', status: 'ready' }] })));
    assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /out1/);
    await act(async () => requests[1].resolve(Response.json({ ok: true, outputs: [{ ...image, id: 'audio-b', url: 'https://media.example/audio.mp3', kind: 'audio', jobId: 'job2', status: 'ready' }] })));
    await h.flush(); assert.match(h.dom.window.document.body.textContent ?? '', /audio-b/);
    await h.render(view('owner-b', 'image')); assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /audio-b|out1/);
    await h.render(view(null, 'image')); assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /audio-b|out1/);
    assert.match(requests[0].url, /limit=30&kind=image/);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('metadata reads abort when selection changes, discard stale identities and expose retry after failure', async () => {
  const h = await harness();
  const oldFetch = globalThis.fetch;
  const requests: { signal?: AbortSignal | null; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (_input, init) => new Promise<Response>(resolve => requests.push({ signal: init?.signal, resolve }));
  function Metadata({ selected, owner }: { selected: UserAsset | null; owner: string }) {
    const result = useWorkspaceRecentMetadata(selected, owner, true);
    return React.createElement('div', {}, React.createElement('output', {}, JSON.stringify({ size: result.asset?.size, loading: result.loading, error: result.error })), React.createElement('button', { onClick: result.retry }, 'Retry'));
  }
  try {
    const first = { ...image, size: null };
    await h.render(React.createElement(Metadata, { selected: first, owner: 'a' }));
    await h.render(React.createElement(Metadata, { selected: { ...first, id: 'second' }, owner: 'b' }));
    assert.equal(requests[0].signal?.aborted, true);
    await act(async () => requests[0].resolve(Response.json({ ok: true, asset: { ...image, userId: 'a', size: 9999 } })));
    assert.doesNotMatch(h.dom.window.document.querySelector('output')?.textContent ?? '', /9999/);
    await act(async () => requests[1].resolve(Response.json({ ok: false }, { status: 503 })));
    assert.match(h.dom.window.document.querySelector('output')?.textContent ?? '', /"error":true/);
    await act(async () => h.dom.window.document.querySelector('div#root button')?.dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true })));
    assert.equal(requests.length, 3);
    await act(async () => requests[2].resolve(Response.json({ ok: true, asset: { ...image, id: 'second', userId: 'b', size: 1234 } })));
    assert.match(h.dom.window.document.querySelector('output')?.textContent ?? '', /1234/);
    await h.render(React.createElement(Metadata, { selected: null, owner: 'b' }));
    assert.doesNotMatch(h.dom.window.document.querySelector('output')?.textContent ?? '', /1234/);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('role chooser uses visible exact fields, keeps sparse slot index, focuses close and restores trigger', async () => {
  const h = await harness();
  const fields: AssetFieldConfig[] = [{ field: { id: 'start', type: 'image', label: 'Start', maxCount: 1 }, required: true }, { field: { id: 'refs', type: 'image', label: 'References', maxCount: 4 }, required: false }];
  const inserted: unknown[] = []; let closed = false;
  const opener = h.dom.window.document.getElementById('opener') as HTMLButtonElement; opener.focus();
  try {
    await h.render(React.createElement(WorkspaceRecentRoleDialog, { asset: image, fields, inputAssets: { refs: [null, null, { ...image, fieldId: 'refs', previewUrl: image.url, name: 'old image', size: 1000, type: 'image/png', status: 'ready' }] }, mode: 'i2v', locale: 'en', onClose: () => { closed = true; }, onInsert: async (entry, slot) => { inserted.push(entry.field, slot); } }));
    await h.flush(); assert.equal(h.dom.window.document.activeElement?.getAttribute('aria-label'), 'Close');
    assert.match(h.dom.window.document.body.textContent ?? '', /source.png/); assert.doesNotMatch(h.dom.window.document.body.textContent ?? '', /signature=secret/);
    const choices = [...h.dom.window.document.querySelectorAll<HTMLButtonElement>('fieldset button')]; assert.equal(choices.length, 2);
    await act(async () => choices[1].click());
    const slot = h.dom.window.document.querySelector<HTMLSelectElement>('select')!;
    assert.equal(slot.options[1].value, '2');
    await act(async () => { slot.value = '2'; slot.dispatchEvent(new h.dom.window.Event('change', { bubbles: true })); });
    await act(async () => h.dom.window.document.querySelector<HTMLButtonElement>('.app-recent-insert')!.click());
    assert.equal(inserted[0], fields[1].field); assert.equal(inserted[1], 2); assert.equal(closed, true);
    await h.render(React.createElement('div'));
    assert.equal(h.dom.window.document.activeElement, opener);
  } finally { await h.close(); }
});


test('production internal drag validates current feed token and shares the exact click insertion owner', async () => {
  const h = await harness();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: true, outputs: [{ ...image, url: 'https://media.example/source.png', jobId: 'job', status: 'ready' }] });
  const fields: AssetFieldConfig[] = [{ field: { id: 'start', type: 'image', label: 'Start', maxCount: 1 }, required: true }];
  const inserted: unknown[] = [];
  const view = (userId: string) => {
    h.session.setUserId(userId);
    return React.createElement(WorkspaceRecentReferences, {
    userId, locale: 'en', engineId: 'engine', fields, inputAssets: {}, mode: 'i2v',
    availability: { inputAssets: {}, isUnifiedSeedance: false, isUnifiedKlingO3: false, klingO3VideoToVideoSupported: true, hasAnyVideoInput: false, guestUploadLockedReason: null, workflowCopy: { clearReferencesToUseStartEnd: '', clearStartEndToUseReferences: '' }, showOmniStudioPanel: false, showLumaRay32KeyframeEditor: false },
    onInsert: async (field, asset, slot) => { inserted.push(field, asset, slot); },
    children: ({ recentMedia, recentDropProps }) => React.createElement('div', {}, recentMedia, React.createElement('div', { id: 'drop', ...recentDropProps }, 'Drop')),
  });
  };
  const data = new Map<string, string>();
  const transfer = { types: [RECENT_MEDIA_DRAG_TYPE], effectAllowed: '', dropEffect: '', setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key) ?? '' };
  const dispatch = async (node: Element, type: string) => act(async () => { const event = new h.dom.window.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(event, 'dataTransfer', { value: transfer }); node.dispatchEvent(event); });
  try {
    await h.render(view('drag-owner')); await h.flush();
    await dispatch(h.dom.window.document.getElementById('drop')!, 'drop');
    assert.equal(h.dom.window.document.querySelector('[role="dialog"]'), null);
    const card = h.dom.window.document.querySelector('.app-recent-list button')!;
    await dispatch(card, 'dragstart'); assert.ok(data.get(RECENT_MEDIA_DRAG_TYPE));
    await dispatch(h.dom.window.document.getElementById('drop')!, 'drop');
    assert.ok(h.dom.window.document.querySelector('[role="dialog"]'));
    await act(async () => h.dom.window.document.querySelector<HTMLButtonElement>('.app-recent-insert')!.click());
    assert.equal(inserted[0], fields[0].field); assert.equal((inserted[1] as UserAsset).url, 'https://media.example/source.png'); assert.equal(inserted[2], undefined);
    await dispatch(card, 'dragstart');
    await h.render(view('new-drag-owner')); await h.flush();
    await dispatch(h.dom.window.document.getElementById('drop')!, 'drop');
    assert.equal(h.dom.window.document.querySelector('[role="dialog"]'), null);
    assert.equal(inserted.length, 3);
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});

test('reopening Recents and its visible Refresh action revalidate the same successful shared page after completion', async () => {
  const h = await harness();
  h.session.setUserId('refresh-owner');
  const oldFetch = globalThis.fetch;
  let completed = 0;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ ok: true, outputs: Array.from({ length: completed }, (_, index) => ({ ...image, id: `new-${index}`, url: `https://media.example/new-${index}.png`, jobId: `job-${index}`, status: 'ready' })) });
  };
  function View() {
    const [open, setOpen] = React.useState(false);
    return React.createElement(WorkspaceRecentReferences, {
      userId: 'refresh-owner', locale: 'en', engineId: 'engine', fields: [], inputAssets: {}, mode: 'i2v',
      availability: { inputAssets: {}, isUnifiedSeedance: false, isUnifiedKlingO3: false, klingO3VideoToVideoSupported: true, hasAnyVideoInput: false, guestUploadLockedReason: null, workflowCopy: { clearReferencesToUseStartEnd: '', clearStartEndToUseReferences: '' }, showOmniStudioPanel: false, showLumaRay32KeyframeEditor: false },
      onInsert: async () => undefined,
      children: ({ recentMedia, refreshRecentMedia }) => React.createElement('div', {},
        React.createElement('button', { id: 'toggle-recents', onClick: () => { if (!open) refreshRecentMedia(); setOpen(!open); } }, open ? 'Activity' : 'Recents'),
        React.createElement('div', { hidden: !open }, recentMedia)),
    });
  }
  try {
    await h.render(React.createElement(View)); await h.flush();
    assert.equal(requests.length, 1);
    assert.equal(h.dom.window.document.querySelectorAll('.app-recent-list li').length, 0);
    completed = 1;
    await act(async () => h.dom.window.document.getElementById('toggle-recents')!.click()); await h.flush();
    assert.equal(requests.length, 2);
    assert.equal(h.dom.window.document.querySelectorAll('.app-recent-list li').length, 1);
    await act(async () => h.dom.window.document.getElementById('toggle-recents')!.click());
    completed = 2;
    await act(async () => h.dom.window.document.getElementById('toggle-recents')!.click()); await h.flush();
    assert.equal(requests.length, 3);
    assert.equal(h.dom.window.document.querySelectorAll('.app-recent-list li').length, 2);
    completed = 3;
    const refresh = h.dom.window.document.querySelector<HTMLButtonElement>('.app-recent-media button[aria-label="Refresh"]')!;
    assert.ok(refresh);
    assert.ok(refresh.getClientRects().length > 0, 'the accessible Refresh action should be visible while Recents is open');
    assert.equal(refresh.getAttribute('aria-busy'), 'false');
    await act(async () => refresh.click()); await h.flush();
    assert.equal(requests.length, 4);
    assert.equal(h.dom.window.document.querySelectorAll('.app-recent-list li').length, 3);
    assert.equal(new Set(requests).size, 1, 'all refreshes reuse the existing kind-filtered Library page');
  } finally { globalThis.fetch = oldFetch; await h.close(); }
});
