import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { useWorkspaceEditorAssetLibrary, invalidateWorkspaceEditorAssetLibraryCache } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useWorkspaceEditorAssetLibrary';
import { useStudioMediaIntent } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useStudioMediaIntent';
import { useStudioMediaHandoff } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_hooks/useStudioMediaHandoff';
import { stageStudioMediaHandoff } from '../frontend/lib/studio-media-handoff';
import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

function harness() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://local.test' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  return { dom, render: (view: React.ReactElement) => act(async () => root.render(view)),
    close: async () => { await act(async () => root.unmount()); dom.window.close(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}

test('library scopes initial/pagination/search/account/close, refuses stale pages and retries failures without demos', async () => {
  const h = harness(); const previousFetch = globalThis.fetch;
  const requests: { url: string; signal?: AbortSignal | null; resolve: (response: Response) => void }[] = [];
  globalThis.fetch = async (input, init) => new Promise<Response>((resolve) => requests.push({ url: String(input), signal: init?.signal, resolve }));
  let library!: ReturnType<typeof useWorkspaceEditorAssetLibrary>;
  function Fixture({ owner, open }: { owner: string; open: boolean }) {
    library = useWorkspaceEditorAssetLibrary(open ? null : undefined, DEFAULT_STUDIO_COPY.assetLibrary, owner);
    return React.createElement('output', {}, library.assets.map((asset) => asset.id).join(','));
  }
  const render = (owner: string, open = true) => h.render(React.createElement(Fixture, { owner, open }));
  const respond = (index: number, id: string, hasMore = false) => act(async () => requests[index].resolve(Response.json({ ok: true, assets: [{ id, kind: 'audio', url: `https://media.maxvideoai.com/${id}.wav`, mime: 'audio/wav' }], hasMore, nextCursor: hasMore ? 'opaque' : null })));
  try {
    await render('a'); assert.equal(requests.length, 1);
    await respond(0, 'a-first', true);
    let oldPagination!: Promise<void>;
    await act(async () => { oldPagination = library.loadMore(); });
    await render('b'); assert.equal(requests.length, 3); assert.equal(library.assets.length, 0);
    await respond(1, 'a-late'); await oldPagination; assert.equal(library.assets.length, 0);
    await respond(2, 'b-first', true); assert.equal(library.assets[0].id, 'b-first');
    await act(async () => library.setSearchQuery('spoken'));
    assert.match(requests[3].url, /q=spoken/); assert.doesNotMatch(requests[3].url, /cursor=/);
    await render('b', false); assert.equal(requests[3].signal?.aborted, true);
    await respond(3, 'closed-result'); assert.equal(library.assets.length, 0);
    await render('b'); assert.equal(requests.length, 5);
    await act(async () => requests[4].resolve(Response.json({ ok: false }, { status: 500 })));
    assert.equal(library.assets.length, 0); assert.equal(library.usingFallback, false); assert.ok(library.error);
    await act(async () => library.retry()); assert.equal(requests.length, 6);
    await respond(5, 'retry-success'); assert.equal(library.assets[0].id, 'retry-success');
    await act(async () => library.setSource('recent')); assert.match(requests[6].url, /recent-outputs/); assert.equal(library.selectedAssetIds.length, 0);
  } finally { globalThis.fetch = previousFetch; invalidateWorkspaceEditorAssetLibraryCache(); await h.close(); }
});

test('upload intent invalidates on account/project/node/folder changes, close and unmount', async () => {
  const h = harness(); let intent!: ReturnType<typeof useStudioMediaIntent>;
  function Fixture({ scope }: { scope: string }) { intent = useStudioMediaIntent(scope); return null; }
  try {
    await h.render(React.createElement(StrictMode, {}, React.createElement(Fixture, { scope: 'a:project:node:folder' })));
    let current = intent.begin(); assert.equal(current(), true);
    for (const scope of ['b:project:node:folder', 'b:new:node:folder', 'b:new:other:folder', 'b:new:other:new-folder']) {
      await h.render(React.createElement(StrictMode, {}, React.createElement(Fixture, { scope })));
      assert.equal(current(), false); current = intent.begin();
    }
    intent.cancel(); assert.equal(current(), false);
    current = intent.begin(); await h.render(React.createElement('div')); assert.equal(current(), false);
  } finally { await h.close(); }
});

test('handoff survives StrictMode once and cannot reappear after close or account/project/token changes', async () => {
  const h = harness(); let result!: ReturnType<typeof useStudioMediaHandoff>;
  function Fixture({ account, project }: { account: string; project: string }) { result = useStudioMediaHandoff(account, project); return React.createElement('output', {}, result.handoff?.ref.kind ?? 'none'); }
  const ref = { type: 'asset' as const, assetId: `ma_${'a'.repeat(32)}`, kind: 'audio' as const };
  const stage = (token: string) => stageStudioMediaHandoff(h.dom.window.sessionStorage, 'a', { ref, intent: 'project' }, token);
  const render = (account: string, project: string, token: string) => h.render(React.createElement(StrictMode, {}, React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams({ studioMedia: token }) }, React.createElement(Fixture, { account, project }))));
  try {
    stage('one'); await render('a', 'project', 'one'); assert.equal(result.handoff?.ref.kind, 'audio');
    await act(async () => result.close()); await render('a', 'project', 'one'); assert.equal(result.handoff, null);
    stage('two'); await render('a', 'project', 'two'); assert.ok(result.handoff);
    await render('b', 'project', 'two'); assert.equal(result.handoff, null);
    await render('a', 'project', 'two'); assert.equal(result.handoff, null);
    stage('three'); await render('a', 'project', 'three'); assert.ok(result.handoff);
    await render('a', 'other', 'three'); assert.equal(result.handoff, null);
  } finally { await h.close(); }
});

test('handoff receiver requires confirmation, resolves exact ref and cancels a pending acceptance', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = {}; };
  const h = harness(); const previousFetch = globalThis.fetch;
  let resolve!: (value: Response) => void;
  const ref = { type: 'asset' as const, assetId: `ma_${'b'.repeat(32)}`, kind: 'audio' as const };
  const imports: unknown[] = [];
  globalThis.fetch = async (_input, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { refs: [ref] });
    return new Promise<Response>((done) => { resolve = done; });
  };
  try {
    const { StudioMediaHandoffReceiver } = await import('../frontend/app/(core)/(workspace)/app/studio/workspace/_components/StudioMediaHandoffReceiver');
    const copy = DEFAULT_STUDIO_COPY.viewer.projectMedia;
    const render = async (token: string) => {
      stageStudioMediaHandoff(h.dom.window.sessionStorage, 'owner', { ref, intent: 'project' }, token);
      await h.render(React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams({ studioMedia: token }) }, React.createElement(StudioMediaHandoffReceiver, { accountId: 'owner', projectId: 'project', projectName: 'Chosen project', onImport: (assets) => imports.push(assets), copy })));
    };
    const click = (label: string) => act(async () => Array.from(h.dom.window.document.querySelectorAll('button')).find((button) => button.textContent === label)!.click());
    const response = () => Response.json({ ok: true, assets: [{ id: 'internal', ref, kind: 'audio', url: 'https://media.maxvideoai.com/original.wav', mime: 'audio/wav', mediaFacts: { source: 'probe', durationSec: 15 } }] });
    await render('one'); assert.equal(imports.length, 0);
    assert.match(h.dom.window.document.body.textContent!, /Chosen project/);
    await click(copy.importMedia); await click(copy.handoffCancel);
    await act(async () => resolve(response())); assert.equal(imports.length, 0);
    await render('two'); await click(copy.importMedia);
    await act(async () => resolve(response())); assert.equal(imports.length, 1);
    assert.equal(h.dom.window.document.querySelector('[role="dialog"]'), null);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader; else delete require.extensions['.css'];
    await h.close();
  }
});
