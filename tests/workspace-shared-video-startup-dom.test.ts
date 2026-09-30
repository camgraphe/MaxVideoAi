import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceAssetState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceAssetState';
import { useWorkspaceDraftHydration } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceDraftHydration';
import { useWorkspaceInputSchemaState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceWorkflow } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-workflow-projection';
import { STORAGE_KEYS } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-storage';

const noop = () => {};
const engines = getBaseEngines();
const engineMap = new Map(engines.map((engine) => [engine.id, engine]));
const oldEngine = engineMap.get('seedance-2-5')!;

for (const comparison of [false, true]) test(`first ${comparison ? 'comparison' : 'original'} import survives automatic cleanup of the previous draft`, async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: comparison
    ? 'http://localhost/app?from=example&remix=1&engine=wan-3-prime&mode=t2v&duration=24&resolution=720p&aspect=16%3A9&audio=1'
    : 'http://localhost/app?from=example' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ revision: string; resolve: (response: Response) => void }> = [];
  let revision = '';
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => {
      if (url === '/api/jobs/example') return Promise.resolve(new Response('{}', { status: 404 }));
      assert.equal(url, '/api/videos/example');
      return new Promise<Response>((resolve) => requests.push({ revision, resolve }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const legacy = new Map<string, string>([
    [STORAGE_KEYS.prompt, 'Previous 22 second draft'],
    [STORAGE_KEYS.form, JSON.stringify({ ...coerceFormState(oldEngine, 't2v', null), durationSec: 22, durationOption: 22, extraInputValues: { old_provider_option: true } })],
  ]);
  const readStorage = (key: string) => legacy.get(key) ?? null;
  const writeStorage = (key: string, value: string | null) => { if (value !== null) legacy.set(key, value); };
  const replacements: string[] = [], notices: string[] = [];
  let navigate!: React.Dispatch<React.SetStateAction<string>>;
  const initialSearch = dom.window.location.search.slice(1);
  const replaceRoute = (href: string) => { replacements.push(href); navigate(href.split('?')[1] ?? ''); };
  const setNotice = (value: React.SetStateAction<string | null>) => { if (typeof value === 'string') notices.push(value); };
  let current!: ReturnType<typeof useWorkspaceRouteFormState>;
  function Fixture() {
    const [searchString, setSearchString] = React.useState(initialSearch);
    navigate = setSearchString;
    const fromVideoId = new URLSearchParams(searchString).get('from');
    const route = useWorkspaceRouteFormState('import-startup');
    const assets = useWorkspaceAssetState('import-startup');
    const [hydratedForScope, setHydratedForScope] = React.useState<string | null>(null);
    const preserveStoredDraftRef = React.useRef(false), hasStoredFormRef = React.useRef(false);
    const hydration = useWorkspaceDraftHydration({
      ...route, ...assets, engines, authStatus: 'authed', accountId: 'import-startup', accessToken: 'token', locale: 'en',
      fromVideoId, requestedJobId: null, effectiveRequestedEngineId: null, effectiveRequestedEngineToken: '', effectiveRequestedMode: null,
      storageScope: 'import-startup', hydratedForScope, setHydratedForScope, readStorage, readScopedStorage: readStorage, writeStorage,
      recentJobs: [], selectedPreview: null, rendersLength: 0, preserveStoredDraftRef, hasStoredFormRef,
      setSelectedPreview: noop, hydratePendingRendersFromStorage: noop, resetRenderState: noop,
    });
    revision = hydration.revision;
    const videoSettings = useWorkspaceVideoSettings({
      ...route, ...assets, engines, engineMap, locale: 'en', accountScope: 'import-startup', activeDraftReady: hydration.ready, draftRevision: hydration.revision,
      provider: 'fal', fromVideoId, requestedJobId: null, searchString, authChecked: true,
      hydratedForScope, storageScope: 'import-startup', effectiveRequestedEngineId: comparison ? 'wan-3-prime' : null, effectiveRequestedEngineToken: comparison ? 'wan3prime' : null,
      rendersLength: 0, readScopedStorage: readStorage, writeScopedStorage: writeStorage, replaceRoute, setSelectedPreview: noop, setNotice,
    });
    const selectedEngine = engineMap.get(route.form?.engineId ?? '') ?? null;
    const workflow = resolveWorkspaceWorkflow({ engine: selectedEngine, form: route.form, inputAssets: assets.inputAssets, klingElements: route.klingElements });
    useWorkspaceInputSchemaState({
      ...workflow, hydrationReady: hydration.ready, selectedEngine, uiLocale: 'en', authChecked: true, authLoading: false,
      authenticatedUserId: 'import-startup', uploadLockedCopy: '', setForm: route.setForm, setInputAssets: assets.setInputAssets,
    });
    current = route;
    return videoSettings.sharedVideoImportPending ? React.createElement('output', null, 'Loading example')
      : React.createElement('input', { 'aria-label': 'Prompt', value: route.prompt, onChange: (event: React.ChangeEvent<HTMLInputElement>) => route.setPrompt(event.target.value) });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Fixture)));
    assert.equal(current.prompt, 'Previous 22 second draft');
    assert.deepEqual(current.form?.extraInputValues, {}, 'the real schema owner cleaned the legacy option');
    assert.equal(requests.length, 1);
    assert.notEqual(requests[0].revision, revision, 'startup reconciliation committed after the request began');
    assert.equal(dom.window.document.querySelector('input'), null, 'the old draft cannot be edited while the import is pending');
    await act(async () => requests[0].resolve(new Response(JSON.stringify({ ok: true, video: {
      id: 'example', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', prompt: 'New public 24 second prompt',
      durationSec: 24, aspectRatio: '16:9', requestedResolution: '720p', hasAudio: true, createdAt: '',
    } }), { status: 200 })));
    assert.equal(current.prompt, 'New public 24 second prompt');
    assert.equal(current.form?.engineId, comparison ? 'wan-3-prime' : 'seedance-2-5');
    assert.equal(current.form?.durationSec, 24);
    assert.equal(current.form?.resolution, '720p');
    assert.equal(current.form?.aspectRatio, '16:9');
    assert.equal(current.form?.audio, true);
    assert.deepEqual(notices, []);
    assert.equal(replacements.length, 1);
    assert.ok(!replacements[0].includes('from='));
    if (comparison) assert.ok(replacements[0].includes('engine=wan-3-prime'));
    assert.equal(dom.window.document.querySelector('input')?.value, 'New public 24 second prompt');
    await act(async () => current.setPrompt('My next edit'));
    assert.equal(current.prompt, 'My next edit', 'a completed import does not reapply over later edits');
    assert.equal(requests.length, 1);
    await act(async () => navigate(initialSearch));
    assert.equal(dom.window.document.querySelector('input'), null, 'choosing the same example again starts another guarded import');
    assert.equal(requests.length, 2);
    await act(async () => requests[1].resolve(new Response(JSON.stringify({ ok: true, video: {
      id: 'example', engineId: 'seedance-2-5', engineLabel: 'Seedance 2.5', prompt: 'New public 24 second prompt',
      durationSec: 24, aspectRatio: '16:9', requestedResolution: '720p', hasAudio: true, createdAt: '',
    } }), { status: 200 })));
    assert.equal(current.prompt, 'New public 24 second prompt', 'a repeated intentional choice replaces the intervening edit');
    assert.equal(replacements.length, 2);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
