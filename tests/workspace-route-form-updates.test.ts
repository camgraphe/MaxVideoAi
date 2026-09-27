import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceEngineModeState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

const engines = listFalEngines().filter((entry) => entry.id === 'seedance-2-0').map((entry) => entry.engine);
const assets = {};
const noop = () => {};
const workflowCopy = {
  generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported',
  audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio',
};

async function mount(withEngineNormalization = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let current!: ReturnType<typeof useWorkspaceRouteFormState>;
  let scope: string | null = 'account-a';
  let authChecked = false;
  let consumerRenders = 0;
  let mounted = true;
  function Consumer({ prompt }: { prompt: string }) {
    consumerRenders += 1;
    return React.createElement('output', null, prompt);
  }
  function Normalized({ route }: { route: typeof current }) {
    useWorkspaceEngineModeState({ ...route, engines, inputAssets: assets,
      effectiveRequestedEngineToken: null, authChecked, hydratedForScope: scope, storageScope: scope ?? 'anon',
      preserveStoredDraftRef: React.useRef(false), requestedEngineOverrideIdRef: React.useRef(null),
      requestedEngineOverrideTokenRef: React.useRef(null), requestedModeOverrideRef: React.useRef(null),
      writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: noop });
    return React.createElement(Consumer, { prompt: route.prompt });
  }
  function Fixture() {
    current = useWorkspaceRouteFormState(scope);
    return withEngineNormalization
      ? React.createElement(Normalized, { route: current })
      : React.createElement(Consumer, { prompt: current.prompt });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => root.render(React.createElement(Fixture));
  await act(async () => render());
  return {
    get current() { return current; },
    get renders() { return consumerRenders; },
    get text() { return dom.window.document.querySelector('output')?.textContent; },
    async auth(checked: boolean) { authChecked = checked; await act(async () => render()); },
    async scope(next: string | null) { scope = next; await act(async () => render()); },
    async unmount() { await act(async () => root.unmount()); mounted = false; },
    async close() {
      if (mounted) await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('unchanged route fields do not render the workspace consumer again', async (t) => {
  const view = await mount();
  try {
    const start = view.renders;
    const updates = [
      () => view.current.setPrompt(view.current.prompt),
      () => view.current.setPrompt((value) => value),
      () => view.current.setForm((value) => value),
      () => view.current.setShotType('customize'),
      () => view.current.setKlingElements((value) => value),
      () => view.current.clearCompositePreview(),
    ];
    for (const update of updates) await act(async () => update());
    t.diagnostic(JSON.stringify({ unchangedUpdates: updates.length, consumerRenders: view.renders - start }));
    assert.equal(view.renders - start, 0, 'same-value setters must preserve the route state bailout');
  } finally { await view.close(); }
});

test('auth completion normalizes an already valid form without a second consumer render', async (t) => {
  const view = await mount(true);
  try {
    assert.equal(engines.length, 1);
    const form = coerceFormState(engines[0], 't2v', null);
    await act(async () => view.current.setForm(form));
    const start = view.renders;
    await view.auth(true);
    assert.equal(view.current.form, form, 'real engine normalization keeps the valid form');
    t.diagnostic(JSON.stringify({ authTransitions: 1, consumerRenders: view.renders - start }));
    assert.equal(view.renders - start, 1, 'only the actual auth transition should render the consumer');
  } finally { await view.close(); }
});

test('changed values and batched functional updates remain visible in order', async () => {
  const view = await mount();
  try {
    const initial = view.current.prompt;
    await act(async () => {
      view.current.setPrompt('Edited');
      view.current.setPrompt((value) => value + ' once');
      view.current.setPrompt((value) => value);
      view.current.setPrompt((value) => value + ' twice');
      view.current.setNegativePrompt('Negative');
    });
    assert.equal(view.text, 'Edited once twice');
    assert.equal(view.current.negativePrompt, 'Negative');
    await act(async () => view.current.setPrompt(initial));
    assert.equal(view.text, initial, 'a real change back to the initial value must still render');
    await act(async () => view.current.setCfgScale(NaN));
    assert.ok(Number.isNaN(view.current.cfgScale));
    await act(async () => view.current.setCfgScale(0));
    assert.equal(view.current.cfgScale, 0);
  } finally { await view.close(); }
});

test('account changes reset values and invalidate old commands even after returning to the same account', async () => {
  const view = await mount();
  try {
    const initial = view.current.prompt;
    const oldA = view.current.setPrompt;
    await act(async () => oldA('Private A'));
    await view.scope(null);
    assert.equal(view.text, initial);
    let staleCalls = 0;
    await act(async () => {
      oldA(() => { staleCalls += 1; return 'Stale A'; });
      view.current.setPrompt('Pending auth');
    });
    assert.equal(view.text, initial);
    await view.scope('account-b');
    await act(async () => view.current.setPrompt('Private B'));
    assert.equal(view.text, 'Private B');
    await view.scope('account-a');
    assert.equal(view.text, initial);
    await act(async () => oldA(() => { staleCalls += 1; return 'Stale A again'; }));
    assert.equal(staleCalls, 0);
    assert.equal(view.text, initial);
    await act(async () => view.current.setPrompt('Current A'));
    assert.equal(view.text, 'Current A');
    const afterUnmount = view.current.setPrompt;
    await view.unmount();
    afterUnmount(() => { staleCalls += 1; return 'Unmounted'; });
    assert.equal(staleCalls, 0);
  } finally { await view.close(); }
});
