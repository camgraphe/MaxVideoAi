import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceAssetState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import { useWorkspaceDraftHydration } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration';
import { useWorkspaceInputSchemaState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import {
  decodeWorkspaceActiveDraft,
  workspaceActiveDraftKey,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-active-draft';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { serializeWorkspaceModelSetup } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-model-setups';
import {
  resolveWorkspaceComposerFacts,
  resolveWorkspaceWorkflow,
} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
const allEngines = listFalEngines()
  .filter((e) => ['seedance-2-0', 'kling-3-pro', 'kling-o3-pro', 'ltx-2-3'].includes(e.id))
  .map((e) => e.engine);
const noop = () => {};
const jobs: never[] = [];
async function mount({
  stored = null as string | null,
  unavailable = false,
  initialAuth = 'authed',
} = {}) {
  let engines = allEngines;
  let authStatus = initialAuth,
    accountId: string | null = 'a',
    accessToken: string | null = 'token-a';
  let requestedJobId: string | null = null,
    requestedEngineId: string | null = null,
    requestedMode: any = null;
  const renders: any[] = [];
  const requests: Array<{
    url: string;
    resolve: (value: Response) => void;
    reject: (error: Error) => void;
  }> = [];
  const notices: string[] = [];
  let libraryWrites = 0;
  const dom = new JSDOM('<div id="root"></div>', {
    url: 'http://localhost/app',
  });
  if (stored !== null) dom.window.sessionStorage.setItem(workspaceActiveDraftKey('a'), stored);
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    sessionStorage: unavailable
      ? {
          getItem() {
            throw new Error('unavailable');
          },
          setItem() {
            throw new Error('unavailable');
          },
        }
      : dom.window.sessionStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) =>
      new Promise<Response>((resolve, reject) => {
        assert.ok(url.startsWith('/api/'), 'no external requests');
        requests.push({ url, resolve, reject });
      }),
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  const { useWorkspaceReferenceAssets } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceReferenceAssets'
  );
  const { useWorkspaceKlingElementAssets } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceKlingElementAssets'
  );
  const { useWorkspaceVideoSettings } = await import(
    '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings'
  );
  const showNotice = (notice: string | null) => {
    if (notice) notices.push(notice);
  };
  const setLibrary = () => {
    libraryWrites += 1;
  };
  const engineMap = new Map(engines.map((e) => [e.id, e]));
  const legacy = new Map<string, string>();
  const readStorage = (key: string) => legacy.get(`${accountId ?? 'anon'}:${key}`) ?? null;
  const writeStorage = (key: string, value: string) => {
    legacy.set(`${accountId ?? 'anon'}:${key}`, value);
  };
  let current: any;
  function Fixture() {
    const confirmed = authStatus === 'authed' && accountId && accessToken ? accountId : null;
    const route = useWorkspaceRouteFormState(
      confirmed ?? (authStatus === 'loggedOut' ? 'public' : null),
    );
    const assets = useWorkspaceAssetState(confirmed ?? (authStatus === 'loggedOut' ? 'public' : null));
    const [hydratedForScope, setHydratedForScope] = React.useState<string | null>(null);
    const preserveStoredDraftRef = React.useRef(false),
      hasStoredFormRef = React.useRef(false);
    const hydration = useWorkspaceDraftHydration({
      ...route,
      ...assets,
      engines,
      requestedJobId,
      fromVideoId: null,
      effectiveRequestedEngineId: requestedEngineId,
      effectiveRequestedEngineToken: requestedEngineId ?? '',
      effectiveRequestedMode: requestedMode,
      storageScope: accountId ?? 'anon',
      hydratedForScope,
      setHydratedForScope,
      readStorage,
      readScopedStorage: readStorage,
      writeStorage,
      recentJobs: jobs,
      selectedPreview: null,
      rendersLength: 0,
      preserveStoredDraftRef,
      hasStoredFormRef,
      setSelectedPreview: noop,
      hydratePendingRendersFromStorage: noop,
      resetRenderState: noop,
      authStatus,
      accountId,
      accessToken,
      locale: 'en',
    } as any);
    const selectedEngine = engines.find((e) => e.id === route.form?.engineId) ?? null;
    const workflow = resolveWorkspaceWorkflow({
      engine: selectedEngine,
      form: route.form,
      inputAssets: assets.inputAssets,
      klingElements: route.klingElements,
    });
    useWorkspaceInputSchemaState({
      ...workflow,
      selectedEngine,
      uiLocale: 'en',
      authChecked: true,
      authLoading: false,
      authenticatedUserId: 'a',
      uploadLockedCopy: '',
      setForm: route.setForm,
      setInputAssets: assets.setInputAssets,
      hydrationReady: (hydration as any)?.ready ?? true,
    } as any);
    const referenceHandlers = useWorkspaceReferenceAssets({
      ...assets,
      accountScope: confirmed,
      engineId: route.form?.engineId,
      inputSchema: selectedEngine?.inputSchema,
      preferredMode: workflow.submissionMode,
      workflowCopy: {
        clearReferencesToUseStartEnd: 'clear refs',
        clearStartEndToUseReferences: 'clear frames',
      },
      showNotice,
      assetLibrarySource: 'all',
      resetAssetLibraryForSource: noop,
      setAssetPickerTarget: noop,
      setAssetLibrary: setLibrary,
    });
    const klingHandlers = useWorkspaceKlingElementAssets({
      ...route,
      accountScope: confirmed,
      showNotice,
      assetLibrarySource: 'all',
      resetAssetLibraryForSource: noop,
      setAssetPickerTarget: noop,
    });
    const videoSettings = useWorkspaceVideoSettings({
      ...route,
      ...assets,
      accountScope: confirmed ?? (authStatus === 'loggedOut' ? 'public' : null),
      activeDraftReady: hydration.ready,
      hasActiveSetup: hydration.hasActiveSetup,
      draftRevision: hydration.revision,
      engines,
      engineMap,
      provider: 'fal',
      fromVideoId: null,
      requestedJobId,
      searchString: '',
      sharedVideoSettings: null,
      authChecked: Boolean(confirmed),
      hydratedForScope,
      storageScope: accountId ?? 'anon',
      effectiveRequestedEngineId: requestedEngineId,
      effectiveRequestedEngineToken: requestedEngineId,
      rendersLength: 0,
      compositeOverride: null,
      compositeOverrideSummary: null,
      focusComposer: noop,
      readScopedStorage: readStorage,
      writeScopedStorage: writeStorage,
      replaceRoute: noop,
      setSelectedPreview: noop,
      setNotice: showNotice,
    } as any);
    current = {
      ...route,
      ...assets,
      hydration,
      workflow,
      referenceHandlers,
      klingHandlers,
      videoSettings,
    };
    renders.push({
      authStatus,
      accountId,
      prompt: route.prompt,
      form: route.form,
      inputAssets: assets.inputAssets,
      klingElements: route.klingElements,
      ready: hydration.ready,
    });
    return React.createElement('output', null, JSON.stringify(assets.inputAssets));
  }
  const container = dom.window.document.getElementById('root')!;
  let root = createRoot(container);
  await act(async () => root.render(React.createElement(Fixture)));
  return {
    get current() {
      return current;
    },
    renders,
    requests,
    notices,
    get libraryWrites() {
      return libraryWrites;
    },
    storage: dom.window.sessionStorage,
    async auth(
      status: string,
      id: string | null = accountId,
      token: string | null = id ? `token-${id}` : null,
    ) {
      authStatus = status;
      accountId = id;
      accessToken = token;
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async request(engine: string | null, mode: any = null, job: string | null = null) {
      requestedEngineId = engine;
      requestedMode = mode;
      requestedJobId = job;
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async retireEngine(id: string) {
      await act(async () => root.unmount());
      engines = engines.filter((e) => e.id !== id);
      root = createRoot(container);
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async pauseEngine(id: string) {
      await act(async () => root.unmount());
      engines = engines.map((engine) =>
        engine.id === id ? { ...engine, availability: 'paused' as const } : engine,
      );
      root = createRoot(container);
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async removeEngineField(id: string, fieldId: string) {
      await act(async () => root.unmount());
      engines = engines.map((engine) =>
        engine.id === id
          ? {
              ...engine,
              inputSchema: engine.inputSchema
                ? {
                    ...engine.inputSchema,
                    required: engine.inputSchema.required?.filter((field) => field.id !== fieldId),
                    optional: engine.inputSchema.optional?.filter((field) => field.id !== fieldId),
                  }
                : engine.inputSchema,
            }
          : engine,
      );
      root = createRoot(container);
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async remount() {
      await act(async () => root.unmount());
      root = createRoot(container);
      await act(async () => root.render(React.createElement(Fixture)));
    },
    async close() {
      authStatus = 'loggedOut';
      accountId = null;
      accessToken = null;
      await act(async () => root.render(React.createElement(Fixture)));
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}
test('ready Start frame survives attach → route departure → Video remount with exact original role', async () => {
  const view = await mount();
  try {
    const frame = {
      id: 'frame-original',
      fieldId: 'image_url',
      kind: 'image',
      name: 'Original',
      size: 42,
      type: 'image/png',
      status: 'ready',
      url: 'https://assets.test/original.png',
      previewUrl: 'https://assets.test/preview.png',
      assetId: 'owned-image',
      width: 640,
      height: 360,
      durationSec: null,
    };
    await act(async () => {
      view.current.setPrompt('My complete draft');
      view.current.setInputAssets({ image_url: [frame] });
    });
    assert.deepEqual(view.current.inputAssets.image_url, [frame]);
    await view.remount();
    assert.equal(view.current.prompt, 'My complete draft');
    assert.deepEqual(view.current.inputAssets.image_url, [frame]);
  } finally {
    await view.close();
  }
});

const media = (fieldId: string, kind: 'image' | 'video' | 'audio' = 'image', index = 0) => ({
  id: `${fieldId}-${index}`,
  fieldId,
  kind,
  name: `${kind} original`,
  size: 42,
  type: `${kind}/${kind === 'image' ? 'png' : kind === 'audio' ? 'mpeg' : 'mp4'}`,
  status: 'ready' as const,
  url: `https://assets.test/${fieldId}-${index}`,
  previewUrl: `https://assets.test/preview-${fieldId}-${index}`,
  assetId: `owned-${fieldId}-${index}`,
  width: kind === 'audio' ? null : 640,
  height: kind === 'audio' ? null : 360,
  durationSec: kind === 'image' ? null : 7.25,
});
const snapshot = (view: Awaited<ReturnType<typeof mount>>) => {
  const {
    form,
    prompt,
    negativePrompt,
    inputAssets,
    klingElements,
    multiPromptEnabled,
    multiPromptScenes,
    shotType,
    voiceIdsInput,
    cfgScale,
  } = view.current;
  return JSON.parse(
    JSON.stringify({
      form,
      prompt,
      negativePrompt,
      inputAssets,
      klingElements,
      multiPromptEnabled,
      multiPromptScenes,
      shotType,
      voiceIdsInput,
      cfgScale,
    }),
  );
};
for (const scenario of [
  {
    name: 'Start and End frame',
    engine: 'seedance-2-0',
    mode: 't2v',
    assets: {
      image_url: [media('image_url')],
      end_image_url: [media('end_image_url')],
    },
  },
  {
    name: 'mixed sparse image, video and audio references',
    engine: 'seedance-2-0',
    mode: 'r2v',
    assets: {
      image_urls: [null, media('image_urls', 'image', 1)],
      video_urls: [media('video_urls', 'video')],
      audio_urls: [null, media('audio_urls', 'audio', 1)],
    },
  },
])
  test(`complete ${scenario.name} and specialized values survive committed departure`, async () => {
    const view = await mount();
    try {
      const engine = allEngines.find((e) => e.id === scenario.engine)!;
      assert.ok(engine, 'real catalog engine required');
      await act(async () => {
        view.current.setForm(coerceFormState(engine, scenario.mode as any, null));
        view.current.setInputAssets(scenario.assets);
        view.current.setPrompt('A retained prompt');
        view.current.setNegativePrompt('No flicker');
        view.current.setVoiceIdsInput('voice-one,voice-two');
        view.current.setCfgScale(0.7);
        view.current.setMultiPromptEnabled(true);
        view.current.setShotType('intelligent');
        view.current.setMultiPromptScenes([
          { id: 'scene-one', prompt: 'Opening', duration: 3 },
          { id: 'scene-two', prompt: 'Ending', duration: 4 },
        ]);
      });
      assert.deepEqual(view.current.inputAssets, scenario.assets);
      const expected = snapshot(view);
      await view.remount();
      assert.deepEqual(snapshot(view), expected);
      assert.equal(view.current.hydration.error, null);
    } finally {
      await view.close();
    }
  });
test('Kling frontal, sparse references and source video retain distinct original identities', async () => {
  const view = await mount();
  try {
    const engine = allEngines.find((e) => e.id === 'kling-3-pro')!;
    await act(async () => {
      view.current.setForm(coerceFormState(engine, 't2v', null));
      view.current.setKlingElements([
        {
          id: 'subject-one',
          frontal: media('frontal'),
          references: [null, media('reference', 'image', 1)],
          video: media('video', 'video'),
        },
      ]);
    });
    const serialized = serializeWorkspaceModelSetup(snapshot(view));
    assert.equal(serialized.ok, true);
    await view.remount();
    assert.deepEqual(snapshot(view), serialized.ok ? serialized.setup : null);
  } finally {
    await view.close();
  }
});
test('initial pending auth imports no private assets; A → pending → B → A and logout never flash the previous account', async () => {
  const view = await mount({ initialAuth: 'unknown' });
  try {
    assert.equal(view.current.form, null);
    assert.deepEqual(view.current.inputAssets, {});
    await view.auth('authed', 'a');
    await act(async () => {
      view.current.setPrompt('private-A');
      view.current.setInputAssets({ image_url: [media('image_url')] });
    });
    const a = snapshot(view),
      oldSetPrompt = view.current.setPrompt,
      oldSetAssets = view.current.setInputAssets;
    let start = view.renders.length;
    await view.auth('refreshing', 'a');
    assert.ok(
      view.renders
        .slice(start)
        .every((r) => r.prompt !== 'private-A' && Object.keys(r.inputAssets).length === 0),
    );
    await act(async () => {
      oldSetPrompt('stale-A');
      oldSetAssets({ image_url: [media('foreign')] });
    });
    await view.auth('authed', 'b');
    assert.deepEqual(view.current.inputAssets, {});
    await act(async () => {
      view.current.setPrompt('private-B');
    });
    start = view.renders.length;
    await view.auth('authed', 'a');
    assert.ok(view.renders.slice(start).every((r) => r.prompt !== 'private-B'));
    assert.deepEqual(snapshot(view), a);
    start = view.renders.length;
    await view.auth('loggedOut', null);
    assert.ok(
      view.renders
        .slice(start)
        .every((r) => Object.keys(r.inputAssets).length === 0 && r.prompt !== 'private-A'),
    );
  } finally {
    await view.close();
  }
});
test('incomplete, malformed and oversized edits keep the previous complete record and report status', async () => {
  const view = await mount();
  try {
    await act(async () => {
      view.current.setInputAssets({ image_url: [media('image_url')] });
    });
    const expected = snapshot(view),
      raw = view.storage.getItem(workspaceActiveDraftKey('a'));
    await act(async () =>
      view.current.setInputAssets({
        image_url: [
          {
            ...media('image_url'),
            status: 'uploading',
            url: undefined,
            previewUrl: 'blob:pending',
          },
        ],
      }),
    );
    assert.equal(view.current.hydration.error, 'incomplete');
    assert.equal(view.storage.getItem(workspaceActiveDraftKey('a')), raw);
    await act(async () => {
      view.current.setInputAssets(expected.inputAssets);
      view.current.setCfgScale(NaN);
    });
    assert.equal(view.current.hydration.error, 'invalid');
    assert.equal(view.storage.getItem(workspaceActiveDraftKey('a')), raw);
    await act(async () => {
      view.current.setCfgScale(expected.cfgScale);
      view.current.setPrompt('x'.repeat(1024 * 1024));
    });
    assert.equal(view.current.hydration.error, 'oversized');
    assert.equal(view.storage.getItem(workspaceActiveDraftKey('a')), raw);
    await view.remount();
    assert.deepEqual(snapshot(view), expected);
  } finally {
    await view.close();
  }
});
for (const stored of ['{corrupt', 'x'.repeat(1024 * 1024 + 1)])
  test(`rejected ${stored[0] === '{' ? 'corrupt' : 'oversized'} storage is kept until explicit replacement`, async () => {
    const view = await mount({ stored });
    try {
      assert.ok(view.current.hydration.error);
      assert.equal(view.storage.getItem(workspaceActiveDraftKey('a')), stored);
      await act(async () => view.current.setPrompt('A new edit'));
      assert.equal(view.storage.getItem(workspaceActiveDraftKey('a')), stored);
      await act(async () => view.current.hydration.discardRejected());
      assert.notEqual(view.storage.getItem(workspaceActiveDraftKey('a')), stored);
    } finally {
      await view.close();
    }
  });
test('unavailable storage preserves a complete draft across same-document navigation and pending auth only', async () => {
  const view = await mount({ unavailable: true });
  try {
    await act(async () => {
      view.current.setInputAssets({ image_url: [media('image_url')] });
      view.current.setPrompt('memory-A');
    });
    const expected = snapshot(view);
    assert.equal(view.current.hydration.memoryOnly, true);
    await view.remount();
    assert.deepEqual(snapshot(view), expected);
    await view.auth('refreshing', 'a');
    await view.auth('authed', 'a');
    assert.deepEqual(snapshot(view), expected);
    await view.auth('authed', 'b');
    await view.auth('authed', 'a');
    assert.deepEqual(view.current.inputAssets, {});
    await act(async () => {
      view.current.setPrompt('temporary');
      view.current.setInputAssets({ image_url: [media('image_url')] });
    });
    await view.auth('loggedOut', null);
    await view.auth('authed', 'a');
    assert.deepEqual(view.current.inputAssets, {});
  } finally {
    await view.close();
  }
});
test('explicit job/model requests retain the previous complete setup for Configurations', async () => {
  const view = await mount();
  try {
    await act(async () => {
      view.current.setInputAssets({ image_url: [media('image_url')] });
      view.current.setPrompt('recover me');
    });
    const previous = snapshot(view);
    await view.request('seedance-2-0');
    assert.deepEqual(view.current.hydration.recoverySetup.setup, previous);
    await view.remount();
    assert.equal(view.current.form.engineId, 'seedance-2-0');
    assert.deepEqual(view.current.inputAssets, {});
    assert.deepEqual(view.current.hydration.recoverySetup.setup, previous);
    await view.request(null, null, 'job_explicit');
    assert.ok(view.current.hydration.recoverySetup);
  } finally {
    await view.close();
  }
});
for (const rejected of ['retired', 'paused', 'inapplicable'] as const)
  test(`${rejected} active model recovery stays removed after remount`, async () => {
    const view = await mount();
    try {
      const engine = allEngines.find((entry) => entry.id === 'seedance-2-0')!;
      await act(async () => {
        view.current.setForm(coerceFormState(engine, 't2v', null));
        view.current.setPrompt(`recover ${rejected}`);
        view.current.setInputAssets({ image_url: [media('image_url')] });
      });
      const expected = snapshot(view);
      if (rejected === 'retired') await view.retireEngine(expected.form.engineId);
      else if (rejected === 'paused') await view.pauseEngine(expected.form.engineId);
      else await view.removeEngineField(expected.form.engineId, 'image_url');
      assert.equal(view.current.hydration.error, rejected === 'inapplicable' ? 'invalid' : 'retired');
      assert.deepEqual(view.current.hydration.recoverySetup.setup, expected);
      assert.deepEqual(view.current.inputAssets, {});
      const fallback = snapshot(view);
      await act(async () => view.current.hydration.removeRecovery());
      assert.equal(view.current.hydration.recoverySetup, null);
      assert.deepEqual(snapshot(view), fallback);
      const removed = decodeWorkspaceActiveDraft(
        view.storage.getItem(workspaceActiveDraftKey('a')),
        'a',
      );
      assert.equal(removed.current, null);
      assert.equal(removed.recovery, null);
      await view.remount();
      assert.equal(view.current.hydration.recoverySetup, null);
      assert.equal(view.current.prompt, fallback.prompt);
      assert.deepEqual(snapshot(view).form, fallback.form);
      assert.deepEqual(view.current.inputAssets, fallback.inputAssets);
      assert.equal(view.current.negativePrompt, fallback.negativePrompt);
    } finally {
      await view.close();
    }
  });

test('explicit request keeps displaced recovery distinct and Remove preserves the new current draft', async () => {
  const view = await mount();
  try {
    await act(async () => {
      view.current.setPrompt('previous active draft');
      view.current.setInputAssets({ image_url: [media('image_url')] });
    });
    const previous = snapshot(view);
    await view.request('seedance-2-0');
    assert.deepEqual(view.current.hydration.recoverySetup.setup, previous);
    await view.remount();
    assert.equal(view.current.form.engineId, 'seedance-2-0');
    assert.deepEqual(view.current.hydration.recoverySetup.setup, previous);
    await act(async () => view.current.setPrompt('new current draft'));
    const next = snapshot(view);
    assert.notDeepEqual(next, previous);
    let stored = decodeWorkspaceActiveDraft(
      view.storage.getItem(workspaceActiveDraftKey('a')),
      'a',
    );
    assert.deepEqual(stored.recovery?.setup, previous);
    assert.deepEqual(stored.current?.setup, next);
    await view.request(null);
    assert.deepEqual(snapshot(view), next);
    await act(async () => view.current.hydration.removeRecovery());
    stored = decodeWorkspaceActiveDraft(
      view.storage.getItem(workspaceActiveDraftKey('a')),
      'a',
    );
    assert.equal(stored.recovery, null);
    assert.deepEqual(stored.current?.setup, next);
    await view.remount();
    assert.deepEqual(snapshot(view), next);
    assert.equal(view.current.hydration.recoverySetup, null);
  } finally {
    await view.close();
  }
});

for (const departure of ['route', 'account'] as const) {
  for (const kind of ['field-upload', 'field-mirror', 'kling-upload'] as const)
    test(`late ${kind} after ${departure} departure cannot mutate draft, notice or library cache`, async () => {
      const view = await mount();
      try {
        const field = {
          id: 'image_url',
          type: 'image',
          label: 'Start frame',
          maxCount: 1,
        };
        await act(async () => {
          if (kind === 'field-upload')
            view.current.referenceHandlers.handleAssetAdd(
              field,
              new File(['file'], 'source.bin', {
                type: 'application/octet-stream',
              }),
              0,
            );
          else if (kind === 'field-mirror')
            void view.current.referenceHandlers.handleSelectLibraryAsset(
              field,
              {
                id: 'character',
                url: 'https://fal.media/character.png',
                source: 'character',
                kind: 'image',
              },
              0,
            );
          else
            view.current.klingHandlers.handleKlingElementAssetAdd(
              view.current.klingElements[0].id,
              'frontal',
              new File(['file'], 'source.bin', {
                type: 'application/octet-stream',
              }),
            );
        });
        assert.equal(view.requests.length, 1);
        assert.ok(
          view.requests[0].url ===
            (kind === 'field-mirror' ? '/api/media-library/ensure' : '/api/uploads/image'),
        );
        const retired =
          kind === 'kling-upload' ? view.current.klingHandlers : view.current.referenceHandlers;
        if (departure === 'route') await view.remount();
        else await view.auth('authed', 'b');
        const before = snapshot(view),
          noticeCount = view.notices.length,
          writes = view.libraryWrites;
        await act(async () =>
          view.requests[0].resolve(
            new Response(
              JSON.stringify({
                ok: true,
                asset: { id: 'late', url: 'https://assets.test/late' },
              }),
              { status: 200 },
            ),
          ),
        );
        assert.deepEqual(snapshot(view), before);
        assert.equal(view.notices.length, noticeCount);
        assert.equal(view.libraryWrites, writes);
        await act(async () => {
          if (kind === 'kling-upload') retired.handleKlingElementAdd();
          else
            retired.handleSelectLibraryAsset(
              field,
              {
                id: 'stale-ready',
                url: 'https://assets.test/stale',
                source: 'upload',
                kind: 'image',
              },
              0,
            );
        });
        assert.deepEqual(snapshot(view), before);
      } finally {
        await view.close();
      }
    });
}
test('failed obsolete mirror emits no notice, and settled reservations never replace a newer reference', async () => {
  const view = await mount();
  try {
    const field = { id: 'image_url', type: 'image', maxCount: 1 };
    await act(async () => {
      void view.current.referenceHandlers.handleSelectLibraryAsset(
        field,
        {
          id: 'character',
          url: 'https://fal.media/character.png',
          source: 'character',
          kind: 'image',
        },
        0,
      );
    });
    await act(async () => {
      view.current.setInputAssets({
        image_url: [media('image_url', 'image', 4)],
      });
    });
    await act(async () =>
      view.requests[0].resolve(
        new Response(
          JSON.stringify({
            ok: true,
            asset: { id: 'late', url: 'https://assets.test/late' },
          }),
          { status: 200 },
        ),
      ),
    );
    assert.equal(view.current.inputAssets.image_url[0].id, 'image_url-4');
    assert.equal(view.libraryWrites, 0);
    await act(async () => {
      void view.current.referenceHandlers.handleSelectLibraryAsset(
        field,
        {
          id: 'character',
          url: 'https://fal.media/character.png',
          source: 'character',
          kind: 'image',
        },
        0,
      );
    });
    await view.auth('authed', 'b');
    await act(async () => view.requests[1].reject(new Error('obsolete failed mirror')));
    assert.deepEqual(view.notices, []);
  } finally {
    await view.close();
  }
});
for (const departure of ['edit', 'account', 'route'] as const)
  test(`requested-job response after ${departure} cannot overwrite a newer draft`, async () => {
    const view = await mount();
    try {
      await act(async () => {
        view.current.setPrompt('prior draft');
        view.current.setInputAssets({ image_url: [media('image_url')] });
      });
      const prior = snapshot(view);
      await view.request(null, null, 'job_requested');
      assert.equal(view.requests.length, 1);
      assert.deepEqual(view.current.hydration.recoverySetup.setup, prior);
      if (departure === 'edit') await act(async () => view.current.setPrompt('newer edit'));
      else if (departure === 'account') await view.auth('authed', 'b');
      else await view.remount();
      const expected = snapshot(view);
      await act(async () =>
        view.requests[0].resolve(
          new Response(
            JSON.stringify({
              ok: true,
              settingsSnapshot: {
                schemaVersion: 1,
                surface: 'video',
                engineId: 'seedance-2-0',
                inputMode: 't2v',
                prompt: 'stale response',
                refs: { inputAssets: {} },
              },
            }),
            { status: 200 },
          ),
        ),
      );
      assert.deepEqual(snapshot(view), expected);
      assert.deepEqual(view.notices, []);
    } finally {
      await view.close();
    }
  });
test('successful explicit job applies after active recovery is secured; failed job keeps recovery usable', async () => {
  const view = await mount();
  try {
    await act(async () => {
      view.current.setPrompt('previous');
      view.current.setInputAssets({ image_url: [media('image_url')] });
    });
    const prior = snapshot(view);
    await view.request(null, null, 'job_success');
    assert.deepEqual(view.current.hydration.recoverySetup.setup, prior);
    await act(async () =>
      view.requests[0].resolve(
        new Response(
          JSON.stringify({
            ok: true,
            settingsSnapshot: {
              schemaVersion: 1,
              surface: 'video',
              engineId: 'seedance-2-0',
              inputMode: 't2v',
              prompt: 'Explicit job wins',
              refs: { inputAssets: {} },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    assert.equal(view.current.prompt, 'Explicit job wins');
    assert.equal(view.current.form.engineId, 'seedance-2-0');
    await view.request(null, null, 'job_failed');
    const recovery = view.current.hydration.recoverySetup;
    await act(async () =>
      view.requests[1].resolve(
        new Response(JSON.stringify({ ok: false, error: 'Job unavailable' }), {
          status: 404,
        }),
      ),
    );
    assert.deepEqual(view.current.hydration.recoverySetup, recovery);
    assert.ok(view.notices.includes('Job unavailable'));
  } finally {
    await view.close();
  }
});

test('source audio duration and schema form values survive real schema reconciliation and remount', async () => {
  const view = await mount();
  try {
    const engine = allEngines.find((e) => e.id === 'ltx-2-3')!;
    await act(async () => {
      view.current.setForm({
        ...coerceFormState(engine, 'a2v', null),
        extraInputValues: { guidance_scale: 1.3 },
      });
      view.current.setInputAssets({ audio_url: [media('audio_url', 'audio')] });
      view.current.setCfgScale(0.4);
    });
    assert.equal(view.current.workflow.primaryAudioDurationSec, 7);
    assert.equal(view.current.inputAssets.audio_url[0].durationSec, 7.25);
    assert.equal(view.current.form.extraInputValues.guidance_scale, 1.3);
    const expected = snapshot(view);
    await view.remount();
    assert.deepEqual(snapshot(view), expected);
    const facts = resolveWorkspaceComposerFacts({
      ...snapshot(view),
      engine,
      workflow: view.current.workflow,
    });
    assert.equal(facts.effectiveDurationSec, 7);
  } finally {
    await view.close();
  }
});
test('ready temporary preview is normalized to its valid original, without persisting a blob or File', async () => {
  const view = await mount();
  try {
    await act(async () =>
      view.current.setInputAssets({
        image_url: [
          {
            ...media('image_url'),
            previewUrl: 'blob:temporary',
            file: new File(['bytes'], 'unused.bin'),
          },
        ],
      }),
    );
    const raw = view.storage.getItem(workspaceActiveDraftKey('a'))!;
    assert.ok(!raw.includes('blob:'));
    assert.ok(!raw.includes('unused.bin'));
    await view.remount();
    assert.equal(view.current.inputAssets.image_url[0].url, 'https://assets.test/image_url-0');
    assert.equal(
      view.current.inputAssets.image_url[0].previewUrl,
      'https://assets.test/image_url-0',
    );
  } finally {
    await view.close();
  }
});

for (const initialAuth of ['authed', 'loggedOut']) {
  test(`gallery recall applies full settings after immediate tile commit (${initialAuth})`, async () => {
    const view = await mount({ initialAuth });
    try {
      await act(async () => {
        view.current.videoSettings.applyVideoSettingsFromTile({
          id: 'job_gallery', engineId: 'kling-3-pro', prompt: 'Gallery prompt',
          durationSec: 5, aspectRatio: '16:9', iterationCount: 1,
        });
        void view.current.videoSettings.hydrateVideoSettingsFromJob('job_gallery');
      });
      assert.equal(view.current.prompt, 'Gallery prompt');
      assert.equal(view.current.form.engineId, 'kling-3-pro');
      await act(async () => view.requests.at(-1)!.resolve(new Response(JSON.stringify({
        ok: true, settingsSnapshot: {
          schemaVersion: 1, surface: 'video', engineId: 'kling-3-pro', inputMode: 't2v',
          prompt: 'Full gallery prompt', core: { durationSec: 10, resolution: '1080p', audio: true },
          refs: { inputs: [{ slotId: 'image_url', url: 'https://assets.test/frame.jpg', kind: 'image' }] },
        },
      }))));
      assert.equal(view.current.prompt, 'Full gallery prompt');
      assert.equal(view.current.form.durationSec, 10);
      assert.equal(view.current.form.resolution, '1080p');
      assert.equal(view.current.form.audio, true);
      assert.ok(view.current.inputAssets.image_url?.length);
    } finally { await view.close(); }
  });
}

for (const departure of ['edit', 'selection', 'account'] as const) {
  test(`gallery detail response cannot overwrite newer ${departure}`, async () => {
    const view = await mount();
    try {
      const tile = { id: 'job_old', engineId: 'kling-3-pro', prompt: 'Old tile', durationSec: 5, aspectRatio: '16:9', iterationCount: 1 };
      await act(async () => {
        view.current.videoSettings.applyVideoSettingsFromTile(tile);
        void view.current.videoSettings.hydrateVideoSettingsFromJob(tile.id);
      });
      const oldRequest = view.requests.at(-1)!;
      if (departure === 'edit') await act(async () => view.current.setPrompt('My new edit'));
      if (departure === 'account') await view.auth('authed', 'b');
      if (departure === 'selection') await act(async () => {
        view.current.videoSettings.applyVideoSettingsFromTile({ ...tile, id: 'job_new', prompt: 'New selection' });
        void view.current.videoSettings.hydrateVideoSettingsFromJob('job_new');
      });
      const expected = view.current.prompt;
      await act(async () => oldRequest.resolve(new Response(JSON.stringify({
        ok: true, settingsSnapshot: { schemaVersion: 1, surface: 'video', engineId: 'kling-3-pro', inputMode: 't2v', prompt: 'Stale details' },
      }))));
      assert.equal(view.current.prompt, expected);
    } finally { await view.close(); }
  });
}
