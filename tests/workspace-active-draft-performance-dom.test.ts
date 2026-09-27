import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceAssetState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import { useWorkspaceDraftHydration } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration';
import { decodeWorkspaceActiveDraft, encodeWorkspaceActiveDraft, workspaceActiveDraftKey } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-active-draft';
import { serializeWorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import { prepareWorkspaceModelCandidate, type WorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-candidate';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

const noop = () => {};
const readEmpty = () => null;
const engines = listFalEngines().filter((entry) => entry.id === 'seedance-2-0').map((entry) => entry.engine);
const jobs: never[] = [];
type Current = ReturnType<typeof useWorkspaceRouteFormState> & ReturnType<typeof useWorkspaceAssetState> & {
  hydration: ReturnType<typeof useWorkspaceDraftHydration>;
};

async function mount(stored: string | null = null) {
  let authStatus = 'authed';
  let accountId: string | null = 'draft-performance';
  let revision = 0;
  let writes = 0;
  let current!: Current;
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
  if (stored !== null) dom.window.sessionStorage.setItem(workspaceActiveDraftKey(accountId), stored);
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: {
      getItem: (key: string) => dom.window.sessionStorage.getItem(key),
      setItem: (key: string, value: string) => {
        writes += 1;
        dom.window.sessionStorage.setItem(key, value);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  function Fixture({ unrelated }: { unrelated: number }) {
    const route = useWorkspaceRouteFormState(accountId ?? 'public');
    const assets = useWorkspaceAssetState(accountId ?? 'public');
    const [hydratedForScope, setHydratedForScope] = React.useState<string | null>(null);
    const preserveStoredDraftRef = React.useRef(false), hasStoredFormRef = React.useRef(false);
    const hydration = useWorkspaceDraftHydration({
      ...route, ...assets, engines, authStatus, accountId,
      accessToken: accountId ? 'synthetic-token' : null, locale: 'en',
      requestedJobId: null, fromVideoId: null, effectiveRequestedEngineId: null,
      effectiveRequestedEngineToken: '', effectiveRequestedMode: null,
      storageScope: accountId ?? 'anon', hydratedForScope, setHydratedForScope,
      readStorage: readEmpty, readScopedStorage: readEmpty, writeStorage: noop,
      recentJobs: jobs, selectedPreview: null, rendersLength: 0, preserveStoredDraftRef, hasStoredFormRef,
      setSelectedPreview: noop, hydratePendingRendersFromStorage: noop, resetRenderState: noop,
    });
    current = { ...route, ...assets, hydration };
    return React.createElement('output', null, unrelated);
  }
  const container = dom.window.document.getElementById('root')!;
  let root = createRoot(container);
  let mounted = true;
  const render = () => root.render(React.createElement(Fixture, { unrelated: revision++ }));
  await act(async () => render());
  return {
    get current() { return current; },
    get writes() { return writes; },
    storage: dom.window.sessionStorage,
    render,
    unmount() { root.unmount(); mounted = false; },
    async close() {
      if (!mounted) root = createRoot(container);
      await act(async () => { authStatus = 'loggedOut'; accountId = null; render(); });
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

function setup(current: Current): WorkspaceModelSetup {
  assert.ok(current.form);
  return {
    form: current.form, inputAssets: current.inputAssets, klingElements: current.klingElements,
    cfgScale: current.cfgScale, prompt: current.prompt, negativePrompt: current.negativePrompt,
    multiPromptEnabled: current.multiPromptEnabled, multiPromptScenes: current.multiPromptScenes,
    shotType: current.shotType, voiceIdsInput: current.voiceIdsInput,
  };
}

// Observe the real serializer's work, without replacing any application module or result.
async function countSetupEncoding(action: () => void) {
  const stringify = JSON.stringify, parse = JSON.parse;
  const counts = { stringify: 0, normalization: 0 };
  JSON.stringify = ((value: unknown, ...args: unknown[]) => {
    if (value && typeof value === 'object' && 'form' in value && 'inputAssets' in value) counts.stringify += 1;
    return Reflect.apply(stringify, JSON, [value, ...args]);
  }) as typeof JSON.stringify;
  JSON.parse = ((value: string, ...args: unknown[]) => {
    if (value.startsWith('{"form"')) counts.normalization += 1;
    return Reflect.apply(parse, JSON, [value, ...args]);
  }) as typeof JSON.parse;
  try {
    await act(async () => flushSync(action));
    return counts;
  } finally {
    JSON.stringify = stringify;
    JSON.parse = parse;
  }
}

for (const size of ['small', 'large'] as const) {
  test(`connected ${size} active draft skips unchanged parent work and validates each prompt edit once`, async () => {
    const view = await mount();
    try {
      const references = Array.from({ length: size === 'small' ? 1 : 9 }, (_, index) => {
        // Deliberately long synthetic URLs approach the accepted storage budget; these are
        // valid reference slots, not a claim about typical uploaded URL lengths.
        const url = `https://media.example/reference-${index}.png?synthetic=${'x'.repeat(size === 'small' ? 16 : 40000)}`;
        return { id: `reference-${index}`, fieldId: 'image_urls', name: `Reference ${index}.png`,
          kind: 'image' as const, status: 'ready' as const, url, previewUrl: url,
          type: 'image/png', size: 500_000, width: 1280, height: 720 };
      });
      await act(async () => {
        view.current.setForm({ ...view.current.form!, mode: 'r2v' });
        view.current.setPrompt('Synthetic reference draft');
        view.current.setInputAssets({ image_urls: references });
      });
      const initial = serializeWorkspaceModelSetup(setup(view.current));
      assert.ok(initial.ok);
      assert.equal(prepareWorkspaceModelCandidate({
        engine: engines[0], currentEngine: engines[0], current: initial.setup, restoreSetup: initial.setup, locale: 'en',
      }).applicable, true);
      assert.equal(view.current.hydration.error, null);
      const writesBefore = view.writes;
      for (let index = 0; index < 3; index += 1) {
        assert.deepEqual(await countSetupEncoding(view.render), { stringify: 0, normalization: 0 },
          'unrelated parent updates must not encode or normalize the complete unchanged setup');
      }
      assert.equal(view.writes, writesBefore);
      const edit = await countSetupEncoding(() => view.current.setPrompt('Changed prompt'));
      assert.equal(edit.normalization, 1, 'a changed setup is validated once, including the save-triggered render');
      assert.ok(edit.stringify <= 4, 'a prompt edit must not repeat complete setup encoding after its own save');
      assert.equal(view.writes, writesBefore + 1);
      assert.equal(decodeWorkspaceActiveDraft(view.storage.getItem(workspaceActiveDraftKey('draft-performance')), 'draft-performance').current?.setup.prompt, 'Changed prompt');

      // No delay between a committed edit and route departure: a debounce would lose this.
      await act(async () => {
        flushSync(() => view.current.setPrompt('Last committed edit'));
        view.unmount();
      });
      const saved = decodeWorkspaceActiveDraft(view.storage.getItem(workspaceActiveDraftKey('draft-performance')), 'draft-performance');
      assert.equal(saved.current?.setup.prompt, 'Last committed edit');
      assert.deepEqual(saved.current?.setup.inputAssets, initial.setup.inputAssets);
    } finally {
      await view.close();
    }
  });
}

test('each authored setup field independently saves and an invalid edit can be repaired to the saved value', async () => {
  const view = await mount();
  const stored = () => decodeWorkspaceActiveDraft(
    view.storage.getItem(workspaceActiveDraftKey('draft-performance')), 'draft-performance',
  ).current!.setup;
  try {
    const updates: Array<[keyof WorkspaceModelSetup, () => void, unknown]> = [
      ['form', () => view.current.setForm({ ...view.current.form!, iterations: 2 }), 2],
      ['inputAssets', () => view.current.setInputAssets({ image_urls: [null] }), { image_urls: [null] }],
      ['klingElements', () => view.current.setKlingElements([]), []],
      ['cfgScale', () => view.current.setCfgScale(0.5), 0.5],
      ['prompt', () => view.current.setPrompt('Independent prompt'), 'Independent prompt'],
      ['negativePrompt', () => view.current.setNegativePrompt('Independent negative'), 'Independent negative'],
      ['multiPromptEnabled', () => view.current.setMultiPromptEnabled(true), true],
      ['multiPromptScenes', () => view.current.setMultiPromptScenes([{ id: 'scene', prompt: 'Scene', duration: 5 }]), [{ id: 'scene', prompt: 'Scene', duration: 5 }]],
      ['shotType', () => view.current.setShotType('intelligent'), 'intelligent'],
      ['voiceIdsInput', () => view.current.setVoiceIdsInput('synthetic-voice'), 'synthetic-voice'],
    ];
    for (const [key, update, expected] of updates) {
      const before = view.writes;
      assert.equal((await countSetupEncoding(update)).normalization, 1, `${key} must invalidate the saved setup`);
      assert.equal(view.writes, before + 1, `${key} must be persisted`);
      assert.deepEqual(key === 'form' ? stored().form.iterations : stored()[key], expected);
    }
    const previous = view.storage.getItem(workspaceActiveDraftKey('draft-performance'));
    await act(async () => view.current.setCfgScale(NaN));
    assert.equal(view.current.hydration.error, 'invalid');
    assert.equal(view.storage.getItem(workspaceActiveDraftKey('draft-performance')), previous);
    const beforeRepair = view.writes;
    assert.equal((await countSetupEncoding(() => view.current.setCfgScale(0.5))).normalization, 1);
    assert.equal(view.current.hydration.error, null);
    assert.equal(view.writes, beforeRepair, 'repair to the existing saved setup needs no redundant write');
    assert.equal(stored().cfgScale, 0.5);
  } finally {
    await view.close();
  }
});

test('removing recovery immediately saves an edit that now fits the combined draft limit', async () => {
  const initial: WorkspaceModelSetup = {
    form: coerceFormState(engines[0], 't2v', null), inputAssets: {}, klingElements: [],
    cfgScale: null, prompt: 'Previous current', negativePrompt: '', multiPromptEnabled: false,
    multiPromptScenes: [], shotType: 'customize', voiceIdsInput: '',
  };
  const recovery = { modelId: engines[0].id, updatedAt: 1, setup: { ...initial, prompt: 'r'.repeat(600_000) } };
  const encoded = encodeWorkspaceActiveDraft({ current: { ...recovery, setup: initial }, recovery }, 'draft-performance');
  assert.ok(encoded.ok);
  const view = await mount(encoded.value);
  const read = () => decodeWorkspaceActiveDraft(
    view.storage.getItem(workspaceActiveDraftKey('draft-performance')), 'draft-performance',
  );
  try {
    const editedPrompt = 'e'.repeat(600_000);
    await act(async () => view.current.setPrompt(editedPrompt));
    assert.ok(serializeWorkspaceModelSetup(setup(view.current)).ok, 'the edited setup is individually valid');
    assert.equal(view.current.hydration.error, 'oversized', 'only the combined current/recovery envelope is too large');
    assert.equal(read().current?.setup.prompt, 'Previous current');
    assert.equal(read().recovery?.setup.prompt.length, 600_000);

    const before = view.writes;
    assert.equal((await countSetupEncoding(() => view.current.hydration.removeRecovery())).normalization, 1,
      'removing recovery must retry the pending current edit once');
    assert.equal(view.current.hydration.error, null);
    assert.equal(view.writes, before + 2, 'remove recovery and synchronously persist the now-fitting current edit');
    assert.equal(read().recovery, null);
    assert.ok(read().current?.setup.prompt === editedPrompt, 'persist the edited current, not the equally large recovery');
    assert.deepEqual(await countSetupEncoding(view.render), { stringify: 0, normalization: 0 });

    await act(async () => view.unmount());
    assert.ok(read().current?.setup.prompt === editedPrompt, 'the exact retried edit survives immediate departure');
  } finally {
    await view.close();
  }
});

for (const error of ['invalid', 'oversized'] as const) {
  test(`using the current draft keeps its ${error} save error until the input is repaired`, async () => {
    const view = await mount();
    const key = workspaceActiveDraftKey('draft-performance');
    try {
      await act(async () => view.current.setPrompt('Last valid draft'));
      const previous = view.storage.getItem(key);
      await act(async () => {
        if (error === 'invalid') view.current.setCfgScale(NaN);
        else view.current.setPrompt('x'.repeat(1024 * 1024));
      });
      assert.equal(view.current.hydration.error, error);
      await act(async () => view.current.hydration.discardRejected());
      assert.equal(view.current.hydration.error, error, 'a click cannot make rejected current input saveable');
      assert.equal(view.storage.getItem(key), previous, 'keep the previous valid record');
      await act(async () => {
        view.current.setCfgScale(null);
        view.current.setPrompt('Repaired draft');
      });
      assert.equal(view.current.hydration.error, null);
      assert.equal(decodeWorkspaceActiveDraft(view.storage.getItem(key), 'draft-performance').current?.setup.prompt, 'Repaired draft');
    } finally {
      await view.close();
    }
  });
}
