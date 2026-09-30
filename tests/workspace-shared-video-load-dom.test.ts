import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';

type Options = Parameters<typeof useWorkspaceVideoSettings>[0];
const noop = () => {};

async function mount(locale = 'en') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app?from=example' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ resolve: (response: Response) => void; reject: (error: Error) => void }> = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => {
      assert.equal(url, '/api/videos/example');
      return new Promise<Response>((resolve, reject) => requests.push({ resolve, reject }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const notices: string[] = [], replacements: string[] = [], writes: unknown[] = [];
  let options = {
    locale, accountScope: 'public', activeDraftReady: true, engines: [], engineMap: new Map(), provider: 'fal',
    fromVideoId: 'example', requestedJobId: null, searchString: 'from=example', sharedVideoSettings: null,
    authChecked: true, hydratedForScope: 'public', storageScope: 'public', effectiveRequestedEngineId: null,
    effectiveRequestedEngineToken: null, rendersLength: 0, compositeOverride: null, compositeOverrideSummary: null,
    focusComposer: noop, readScopedStorage: () => null, writeScopedStorage: noop,
    replaceRoute: (href: string) => replacements.push(href),
    setNotice: (notice: string | null) => { if (notice) notices.push(notice); },
    ...Object.fromEntries(['setPrompt', 'setNegativePrompt', 'setMemberTier', 'setCfgScale', 'setShotType',
      'setVoiceIdsInput', 'setMultiPromptEnabled', 'setMultiPromptScenes', 'setForm', 'setInputAssets',
      'setKlingElements', 'setSelectedPreview', 'setCompositeOverride', 'setCompositeOverrideSummary',
      'setSharedPrompt', 'setSharedVideoSettings'].map((key) => [key, (value: unknown) => writes.push(value)])),
  } as Options;
  let pending = false;
  function Fixture() { pending = useWorkspaceVideoSettings(options).sharedVideoImportPending; return null; }
  const root = createRoot(dom.window.document.getElementById('root')!);
  await act(async () => root.render(React.createElement(Fixture)));
  writes.length = 0;
  return {
    notices, replacements, writes,
    get pending() { return pending; },
    async respond(status: number, body: unknown = { ok: false }) {
      await act(async () => requests[0].resolve(new Response(JSON.stringify(body), { status })));
    },
    async failNetwork() { await act(async () => requests[0].reject(new Error('offline'))); },
    async change(patch: Partial<Options>) {
      options = { ...options, ...patch };
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async dispose() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('shared example failures are visible in each locale and keep the draft and retry URL', async () => {
  for (const [locale, status, expected] of [['en', 503, 'could not be loaded'], ['fr', 404, 'Impossible de charger'], ['es', 500, 'No se pudo cargar']] as const) {
    const fixture = await mount(locale);
    try {
      await fixture.respond(status);
      assert.equal(fixture.notices.length, 1);
      assert.ok(fixture.notices[0].includes(expected));
      assert.deepEqual(fixture.replacements, []);
      assert.deepEqual(fixture.writes, []);
      assert.equal(fixture.pending, false, 'failure returns access to the existing draft');
    } finally { await fixture.dispose(); }
  }
});

test('unusable responses and network failures also show a notice', async () => {
  for (const failure of ['payload', 'network']) {
    const fixture = await mount();
    try {
      if (failure === 'payload') await fixture.respond(200, { ok: true, video: null });
      else await fixture.failNetwork();
      assert.equal(fixture.notices.length, 1);
      assert.deepEqual(fixture.writes, []);
    } finally { await fixture.dispose(); }
  }
});

test('a late example error cannot interrupt another account', async () => {
  for (const patch of [{ accountScope: 'another-account' }]) {
    const fixture = await mount();
    try {
      await fixture.change(patch);
      await fixture.respond(503);
      assert.deepEqual(fixture.notices, []);
      assert.deepEqual(fixture.writes, []);
    } finally { await fixture.dispose(); }
  }
});

test('an import failure remains visible after automatic draft reconciliation', async () => {
  const fixture = await mount();
  try {
    assert.equal(fixture.pending, true);
    await fixture.change({ draftRevision: 'reconciled' });
    await fixture.respond(503);
    assert.equal(fixture.notices.length, 1);
    assert.equal(fixture.pending, false);
    assert.deepEqual(fixture.replacements, []);
    assert.deepEqual(fixture.writes, []);
  } finally { await fixture.dispose(); }
});

test('a successful response for the previous account cannot import or redirect', async () => {
  const fixture = await mount();
  try {
    await fixture.change({ accountScope: 'another-account' });
    await fixture.respond(200, { ok: true, video: { id: 'example', engineId: 'seedance-2-5', prompt: 'Previous account example', createdAt: '' } });
    assert.deepEqual(fixture.notices, []);
    assert.deepEqual(fixture.replacements, []);
    assert.deepEqual(fixture.writes, []);
    assert.equal(fixture.pending, true, 'the new account still owns its separate pending request');
  } finally { await fixture.dispose(); }
});
