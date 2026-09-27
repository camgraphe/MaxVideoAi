import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import type { WorkspaceAppReadyView } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView';

const noop = () => {};
const engines = listFalEngines().filter(({ id }) => id === 'seedance-2-0').map(({ engine }) => engine);

async function mount(large = false) {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  let requests = 0;
  let writes = 0;
  const globals = {
    React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true,
    sessionStorage: {
      getItem: (key: string) => dom.window.sessionStorage.getItem(key),
      setItem: (key: string, value: string) => { writes += 1; dom.window.sessionStorage.setItem(key, value); },
    },
    fetch: async () => { requests += 1; throw new Error('Closed review must not request quotes'); },
  };
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const require = createRequire(import.meta.url);
  const css = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = { __esModule: true, default: {} }; };
  let View: typeof WorkspaceAppReadyView;
  try {
    ({ WorkspaceAppReadyView: View } = await import('../frontend/app/(core)/(workspace)/app/_components/WorkspaceAppReadyView'));
  } finally {
    if (css) require.extensions['.css'] = css;
    else delete require.extensions['.css'];
  }
  const references = Array.from({ length: large ? 9 : 1 }, (_, index) => {
    // The large case approaches the accepted draft budget with synthetic URLs;
    // it is a bounded stress case, not a claim about typical reference URL sizes.
    const url = `https://media.example/ref-${index}.png?synthetic=${'x'.repeat(large ? 40000 : 16)}`;
    return { id: `ref-${index}`, fieldId: 'image_urls', kind: 'image' as const, status: 'ready' as const,
      name: `Reference ${index}`, type: 'image/png', size: 500000, width: 1280, height: 720, url, previewUrl: url };
  });
  let setup: WorkspaceModelSetup = {
    form: JSON.parse(JSON.stringify(coerceFormState(engines[0], 'r2v', null))),
    inputAssets: { image_urls: references }, klingElements: [],
    prompt: 'A synthetic reference scene', negativePrompt: '', multiPromptEnabled: false,
    multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '', cfgScale: null,
  };
  const root = createRoot(dom.window.document.getElementById('root')!);
  function Fixture() {
    // The real owner still calls useWorkspaceModelReview before its suspension
    // return. Unmounted gallery/composer surfaces need no fake implementation.
    const props = {
      suspended: true, activeDraft: {}, draft: {}, gallery: {}, generation: {}, inputSchema: {},
      handleRefreshJob: noop,
      app: { engines, uiLocale: 'en', authStatus: 'authed', user: { id: 'model-review-performance' }, session: { access_token: 'synthetic-token' } },
      assets: { inputAssets: setup.inputAssets, setInputAssets: noop },
      composer: { selectedEngine: engines[0], applyPreparedForm: noop, handleEngineChange: noop },
      noticeState: { showNotice: noop }, previewState: {}, pricing: { setAuthModalOpen: noop },
      renderState: { pendingGroups: [] },
      routeForm: { ...setup, memberTier: 'Member', setKlingElements: noop, setPrompt: noop, setNegativePrompt: noop,
        setMultiPromptEnabled: noop, setMultiPromptScenes: noop, setShotType: noop, setVoiceIdsInput: noop, setCfgScale: noop },
    } as unknown as React.ComponentProps<typeof WorkspaceAppReadyView>;
    return React.createElement(View, props);
  }
  const render = () => root.render(React.createElement(Fixture));
  await act(async () => render());
  return {
    render,
    get setup() { return setup; },
    get requests() { return requests; },
    get writes() { return writes; },
    edit(patch: Partial<WorkspaceModelSetup>) { setup = { ...setup, ...patch }; render(); },
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

async function observeSetupEncoding(action: () => void) {
  const stringify = JSON.stringify;
  const encoded: string[] = [];
  JSON.stringify = ((value: unknown, ...args: unknown[]) => {
    const result = Reflect.apply(stringify, JSON, [value, ...args]);
    if (value && typeof value === 'object' && 'form' in value && 'inputAssets' in value) encoded.push(result);
    return result;
  }) as typeof JSON.stringify;
  try {
    await act(async () => action());
    return encoded;
  } finally {
    JSON.stringify = stringify;
  }
}

for (const large of [false, true]) {
  test(`closed model review skips unchanged ${large ? 'large' : 'small'} setup encoding through the real ready-view owner`, async (t) => {
    const view = await mount(large);
    try {
      const counts: number[] = [];
      for (let index = 0; index < 3; index += 1) counts.push((await observeSetupEncoding(view.render)).length);
      t.diagnostic(JSON.stringify({ scenario: large ? 'large unchanged setup' : 'small unchanged setup', encodingCounts: counts }));
      assert.deepEqual(counts, [0, 0, 0], 'unrelated parent/library state must not serialize the unchanged private setup');
      assert.equal(view.requests, 0);
      assert.equal(view.writes, 0);
    } finally { await view.close(); }
  });
}

test('each authored model-review setup field invalidates its exact signature once', async (t) => {
  const view = await mount();
  try {
    const changes = {
      form: { ...view.setup.form, iterations: 2 },
      inputAssets: { image_urls: [null] },
      klingElements: [{ id: 'element', frontal: null, video: null, references: [] }],
      prompt: 'Edited prompt', negativePrompt: 'Edited negative prompt', multiPromptEnabled: true,
      multiPromptScenes: [{ id: 'scene', prompt: 'Edited scene', duration: 3 }],
      shotType: 'intelligent', voiceIdsInput: 'voice-1', cfgScale: 0.5,
    } satisfies WorkspaceModelSetup;
    const counts: Record<string, { changed: number; unchanged: number }> = {};
    for (const [key, value] of Object.entries(changes)) {
      const encoded = await observeSetupEncoding(() => view.edit({ [key]: value }));
      assert.equal(encoded.length, 1, `${key} must invalidate the signature`);
      assert.deepEqual(JSON.parse(encoded[0]), view.setup, `${key} retains the exact complete setup signature`);
      counts[key] = { changed: encoded.length, unchanged: (await observeSetupEncoding(view.render)).length };
    }
    t.diagnostic(JSON.stringify({ scenario: 'authored field invalidation', counts }));
    for (const [key, count] of Object.entries(counts)) assert.equal(count.unchanged, 0, `${key} must not encode again on an unchanged parent render`);
    assert.equal(view.requests, 0);
    assert.equal(view.writes, 0);
  } finally { await view.close(); }
});
