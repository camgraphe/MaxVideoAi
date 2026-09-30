import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceAssetState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';

const engines = getBaseEngines(), engineMap = new Map(engines.map((engine) => [engine.id, engine]));
const noop = () => {};
const comparison = (id: string) => `from=${id}&remix=1&engine=wan-3-prime&mode=t2v&duration=24&resolution=720p&aspect=16%3A9&audio=1`;
const video = (id: string) => ({ ok: true, video: {
  id, engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', prompt: `${id} public prompt`,
  durationSec: 24, aspectRatio: '16:9', outputWidth: 1280, outputHeight: 720, hasAudio: true, createdAt: '',
} });

async function mount(initialSearch: string) {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/app?${initialSearch}` });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => new Promise<Response>((resolve) => requests.push({ url, resolve })),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let searchString = initialSearch, current!: ReturnType<typeof useWorkspaceRouteFormState>;
  const replacements: string[] = [];
  const replaceRoute = (href: string) => replacements.push(href);
  function Fixture() {
    const route = useWorkspaceRouteFormState('intent-tests'), assets = useWorkspaceAssetState('intent-tests');
    const params = new URLSearchParams(searchString);
    useWorkspaceVideoSettings({
      ...route, ...assets, accountScope: 'intent-tests', activeDraftReady: true, draftRevision: JSON.stringify([route.prompt, route.form]),
      engines, engineMap, provider: 'fal', fromVideoId: params.get('from'), requestedJobId: null, searchString,
      authChecked: true, hydratedForScope: 'intent-tests', storageScope: 'intent-tests', effectiveRequestedEngineId: params.get('engine'),
      effectiveRequestedEngineToken: null, rendersLength: 0, readScopedStorage: () => null, writeScopedStorage: noop,
      replaceRoute, setSelectedPreview: noop, setNotice: noop,
    });
    current = route;
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  const change = (next: string) => { searchString = next; root.render(React.createElement(Fixture)); };
  const resolve = (url: string, body: unknown) => {
    const request = requests.find((candidate) => candidate.url === url);
    assert.ok(request, `expected pending ${url}`);
    request.resolve(new Response(JSON.stringify(body), { status: 200 }));
  };
  return {
    get current() { return current; }, requests, replacements, change, resolve,
    async dispose() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

for (const next of [comparison('b'), '']) test(`a queued shared payload cannot apply after ${next ? 'choosing another source' : 'leaving the import'}`, async () => {
  const fixture = await mount(comparison('a'));
  try {
    const originalPrompt = fixture.current.prompt;
    await act(async () => {
      fixture.resolve('/api/videos/a', video('a'));
      // Let fetch + Response.json enqueue fields without committing the passive apply.
      for (let step = 0; step < 12; step += 1) await Promise.resolve();
      fixture.change(next);
    });
    assert.equal(fixture.current.prompt, originalPrompt);
    assert.deepEqual(fixture.replacements, [], 'an obsolete import cannot clear the new route');
    if (next) {
      await act(async () => fixture.resolve('/api/videos/b', video('b')));
      assert.equal(fixture.current.prompt, 'b public prompt');
      assert.equal(fixture.current.form?.engineId, 'wan-3-prime');
      assert.equal(fixture.replacements.length, 1);
    }
  } finally { await fixture.dispose(); }
});

test('a previous original job cannot replace the draft while a new example is pending', async () => {
  const fixture = await mount('from=a');
  try {
    await act(async () => fixture.resolve('/api/videos/a', video('a')));
    assert.equal(fixture.current.prompt, 'a public prompt');
    assert.ok(fixture.requests.some(({ url }) => url === '/api/jobs/a'));
    await act(async () => fixture.change(''));
    await act(async () => fixture.change(comparison('b')));
    await act(async () => fixture.resolve('/api/jobs/a', { ok: true, settingsSnapshot: {
      schemaVersion: 1, surface: 'video', engineId: 'seedance-2-5', inputMode: 't2v', prompt: 'a obsolete private details',
      core: { durationSec: 24, resolution: '720p', aspectRatio: '16:9', audio: true }, refs: { inputs: [] },
    } }));
    assert.equal(fixture.current.prompt, 'a public prompt');
    await act(async () => fixture.resolve('/api/videos/b', video('b')));
    assert.equal(fixture.current.prompt, 'b public prompt');
    assert.equal(fixture.current.form?.engineId, 'wan-3-prime');
  } finally { await fixture.dispose(); }
});
