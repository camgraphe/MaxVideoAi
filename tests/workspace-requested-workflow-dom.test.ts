import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import type { Mode } from '../frontend/types/engines';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { useWorkspaceRouteFormState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceRouteFormState';
import { useWorkspaceEngineModeState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import { useWorkspaceVideoSettings } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceVideoSettings';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveWorkspaceRequestParams } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-hydration';

const engines = getBaseEnginesByCategory('video');
const noop = () => {};
const readStorage = () => null;
const engineMap = new Map(engines.map(engine => [engine.id, engine]));
const workflowCopy = { generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported',
  audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio' };

async function mount(initialEngine = 'wan-3') {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test/app' });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    IS_REACT_ACT_ENVIRONMENT: true };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  let route!: ReturnType<typeof useWorkspaceRouteFormState>;
  let workflow!: ReturnType<typeof useWorkspaceEngineModeState>;
  let videoSettings!: ReturnType<typeof useWorkspaceVideoSettings>;
  let availableEngines = engines;
  let search = '';
  let ready = true;
  let assets: Record<string, (ReferenceAsset | null)[]> = {};
  function Fixture() {
    route = useWorkspaceRouteFormState('owner');
    const request = resolveWorkspaceRequestParams(new URLSearchParams(search), '/app');
    const engineRef = React.useRef<string | null>(null);
    const tokenRef = React.useRef<string | null>(null);
    const modeRef = React.useRef<Mode | null>(null);
    React.useEffect(() => {
      if (!request.resolvedRequestedEngineId) return;
      engineRef.current = request.resolvedRequestedEngineId;
      tokenRef.current = request.requestedEngineToken;
      modeRef.current = request.requestedMode;
    }, [request.resolvedRequestedEngineId, request.requestedEngineToken, request.requestedMode]);
    videoSettings = useWorkspaceVideoSettings({ ...route, engines: availableEngines, engineMap, locale: 'en', accountScope: 'owner',
      activeDraftReady: true, hasActiveSetup: true, provider: 'fal', fromVideoId: null, requestedJobId: null,
      searchString: search, authChecked: ready, hydratedForScope: ready ? 'owner' : null, storageScope: 'owner',
      effectiveRequestedEngineId: request.resolvedRequestedEngineId, effectiveRequestedEngineToken: request.requestedEngineToken,
      rendersLength: 0, readScopedStorage: readStorage, writeScopedStorage: noop, replaceRoute: noop,
      setSelectedPreview: noop, setNotice: noop,
      setInputAssets: update => { assets = typeof update === 'function' ? update(assets) : update; } });
    workflow = useWorkspaceEngineModeState({ ...route, engines: availableEngines, inputAssets: assets, setInputAssets: update => { assets = typeof update === 'function' ? update(assets) : update; },
      effectiveRequestedEngineToken: request.requestedEngineToken, requestedWorkflow: request.requestedWorkflow,
      authChecked: ready, hydratedForScope: ready ? 'owner' : null, storageScope: 'owner',
      preserveStoredDraftRef: React.useRef(false), requestedEngineOverrideIdRef: engineRef,
      requestedEngineOverrideTokenRef: tokenRef, requestedModeOverrideRef: modeRef,
      writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: noop });
    return React.createElement('output', null, workflow.submissionMode);
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(Fixture)));
  await act(async () => render());
  await act(async () => {
    route.setForm(coerceFormState(engines.find(e => e.id === initialEngine)!, 't2v', null));
    route.setPrompt('Keep this authored prompt');
  });
  return {
    get route() { return route; }, get workflow() { return workflow; },
    get videoSettings() { return videoSettings; },
    async refreshCatalog() { availableEngines = engines.map(engine => ({ ...engine })); await act(async () => render()); },
    async navigate(next: string) { search = next; await act(async () => render()); },
    async ready(value: boolean) { ready = value; await act(async () => render()); },
    async clearSources() { assets = {}; await act(async () => render()); },
    async source(status: 'uploading' | 'ready', fieldId = 'video_url') {
      assets = { [fieldId]: [{ id: 'source', fieldId, kind: 'video', name: 'Source.mp4', size: 1000,
        type: 'video/mp4', status, assetId: 'owned-source', durationSec: status === 'ready' ? 8 : null,
        url: 'https://example.test/original.mp4', previewUrl: 'https://example.test/preview.mp4' }] };
      await act(async () => render());
    },
    async close() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('recalling a generation with default advanced controls clears earlier CFG and shot choices', async () => {
  const view = await mount();
  try {
    await act(async () => { view.route.setCfgScale(8); view.route.setShotType('intelligent'); });
    await act(async () => view.videoSettings.applyVideoSettingsSnapshot({
      schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: 't2v', prompt: 'New setup',
      core: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
      advanced: { cfgScale: null, shotType: null }, refs: { inputs: null, elements: null },
    }));
    assert.equal(view.route.cfgScale, null);
    assert.equal(view.route.shotType, 'customize');
  } finally { await view.close(); }
});

for (const mode of ['v2v', 'extend'] as const) test(`gallery ${mode} settings supersede an earlier model link and survive catalog revalidation`, async () => {
  const view = await mount('wan-3');
  try {
    await view.navigate('engine=seedance-2-5&mode=t2v');
    assert.equal(view.route.form?.engineId, 'seedance-2-5');
    await act(async () => {
      assert.equal(view.videoSettings.applyVideoSettingsSnapshot({
        schemaVersion: 1, surface: 'video', engineId: 'wan-3', inputMode: mode,
        prompt: 'Recall this video', core: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' },
        refs: { inputs: [{ slotId: 'video_url', kind: 'video', url: 'https://example.test/source.mp4', durationSec: 5 }] },
      }), true);
    });
    assert.equal(view.route.form?.engineId, 'wan-3');
    assert.equal(view.workflow.submissionMode, mode);
    await view.refreshCatalog();
    assert.equal(view.route.form?.engineId, 'wan-3');
    assert.equal(view.workflow.submissionMode, mode);
    await view.navigate('');
    await view.navigate('engine=seedance-2-5&mode=t2v');
    assert.equal(view.route.form?.engineId, 'seedance-2-5', 'a new explicit navigation still applies');
  } finally { await view.close(); }
});

for (const sourceMode of ['v2v', 'extend'] as const) test(`manual other-engine selection leaves ${sourceMode} for Create, while current engine selection preserves it`, async () => {
  const view = await mount('wan-3');
  try {
    await act(async () => view.workflow.handleComposerModeToggle(sourceMode));
    await view.source('ready');
    await act(async () => view.workflow.handleEngineChange('wan-3'));
    assert.equal(view.workflow.submissionMode, sourceMode);
    await act(async () => view.workflow.handleEngineChange('wan-3-prime'));
    assert.equal(view.route.form?.engineId, 'wan-3-prime');
    assert.equal(view.workflow.activeManualMode, null);
    assert.equal(view.workflow.submissionMode, 't2v');
    assert.equal(view.route.prompt, 'Keep this authored prompt');
  } finally { await view.close(); }
});

test('background changer Wan Prime Modify handoff survives hydration, source preparation and removal', async () => {
  const view = await mount('wan-3-prime');
  try {
    await view.ready(false);
    await view.navigate('engine=wan-3-prime&mode=v2v');
    await view.ready(true);
    assert.equal(view.route.form?.engineId, 'wan-3-prime');
    assert.equal(view.workflow.submissionMode, 'v2v');
    await view.source('uploading');
    assert.equal(view.workflow.submissionMode, 'v2v');
    await view.source('ready');
    assert.equal(view.workflow.submissionMode, 'v2v');
    await view.clearSources();
    assert.equal(view.workflow.submissionMode, 'v2v');
    assert.equal(view.route.prompt, 'Keep this authored prompt');
  } finally { await view.close(); }
});

test('same-model gallery Extend stays selected through source preparation and quote readiness', async () => {
  const view = await mount();
  try {
    await view.navigate('engine=wan-3&mode=extend&media=first');
    assert.equal(view.workflow.submissionMode, 'extend');
    await view.source('uploading');
    assert.equal(view.workflow.submissionMode, 'extend');
    await view.source('ready');
    assert.equal(view.route.form?.mode, 'extend');
    assert.equal(view.workflow.submissionMode, 'extend');
    assert.equal(view.route.prompt, 'Keep this authored prompt');
  } finally { await view.close(); }
});

for (const id of ['seedance-2-5', 'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini']) {
  test(`${id}: Create, Modify and Extend remain selectable before and after source preparation`, async () => {
    const view = await mount(id);
    try {
      assert.deepEqual(view.workflow.composerModeToggles?.map(({ mode }) => mode), [null, 'v2v', 'extend']);
      assert.equal(view.workflow.submissionMode, 't2v');
      await act(async () => view.workflow.handleComposerModeToggle('v2v'));
      assert.equal(view.workflow.activeManualMode, 'v2v', 'empty Modify must wait for its source, not return to Create');
      assert.equal(view.workflow.submissionMode, 'v2v');
      await view.source('uploading');
      assert.equal(view.workflow.submissionMode, 'v2v');
      await view.source('ready');
      assert.equal(view.workflow.submissionMode, 'v2v');
      await view.clearSources();
      assert.equal(view.workflow.submissionMode, 'v2v', 'removing a source retains the explicit workflow');
      await act(async () => view.workflow.handleComposerModeToggle(null));
      assert.equal(view.workflow.submissionMode, 't2v');
      await view.source('ready', 'video_urls');
      assert.equal(view.workflow.submissionMode, 'ref2v', 'video references still belong to unified Create');
      assert.equal(view.workflow.activeManualMode, null);
      await view.clearSources();
      await act(async () => view.workflow.handleComposerModeToggle('extend'));
      assert.equal(view.workflow.submissionMode, 'extend');
      await view.source('uploading', 'extension_source_videos');
      assert.equal(view.workflow.submissionMode, 'extend');
      await view.source('ready', 'extension_source_videos');
      assert.equal(view.workflow.submissionMode, 'extend');
      await view.clearSources();
      await act(async () => view.workflow.handleComposerModeToggle(null));
      assert.equal(view.workflow.submissionMode, 't2v');
      await view.navigate(`engine=${id}&mode=v2v&media=gallery-source`);
      assert.equal(view.workflow.submissionMode, 'v2v', 'gallery links must select Modify before their media arrives');
      assert.equal(view.route.prompt, 'Keep this authored prompt');
    } finally { await view.close(); }
  });
}

for (const id of ['kling-o3-standard', 'kling-o3-pro']) {
  test(`${id}: Modify is explicit and does not invent an Extend capability`, async () => {
    const view = await mount(id);
    try {
      assert.deepEqual(view.workflow.composerModeToggles?.map(({ mode }) => mode), [null, 'v2v']);
      await act(async () => view.workflow.handleComposerModeToggle('v2v'));
      assert.equal(view.workflow.submissionMode, 'v2v');
      assert.equal(view.workflow.activeManualMode, 'v2v');
      await view.source('uploading');
      assert.equal(view.workflow.submissionMode, 'v2v');
      await view.source('ready');
      assert.equal(view.workflow.submissionMode, 'v2v');
      await view.clearSources();
      assert.equal(view.workflow.submissionMode, 'v2v');
      await act(async () => view.workflow.handleComposerModeToggle(null));
      assert.equal(view.workflow.submissionMode, 't2v');
      await view.navigate(`engine=${id}&mode=v2v&media=gallery-source`);
      assert.equal(view.workflow.submissionMode, 'v2v');
      assert.equal(view.route.prompt, 'Keep this authored prompt');
    } finally { await view.close(); }
  });
}

test('Kling Omni 4K exposes verified Modify but never unsupported Extend', async () => {
  const view = await mount('kling-o3-4k');
  try {
    assert.ok(view.workflow.composerModeToggles?.some(({ mode }) => mode === 'v2v'));
    assert.ok(!view.workflow.composerModeToggles?.some(({ mode }) => mode === 'extend'));
    await act(async () => view.workflow.handleComposerModeToggle('v2v'));
    assert.equal(view.workflow.submissionMode, 'v2v');
    await act(async () => view.workflow.handleComposerModeToggle('extend'));
    assert.equal(view.workflow.submissionMode, 'v2v');
  } finally { await view.close(); }
});

test('each handoff selects its mode once without overriding later manual choices', async () => {
  const view = await mount();
  try {
    await view.navigate('engine=wan-3&mode=extend&media=first');
    assert.equal(view.workflow.submissionMode, 'extend');
    await act(async () => view.workflow.handleComposerModeToggle('v2v'));
    await view.source('ready');
    await view.navigate('media=first&mode=extend&engine=wan-3&unrelated=1');
    assert.equal(view.workflow.submissionMode, 'v2v', 'query order and unrelated navigation do not replay the request');
    await view.navigate('engine=wan-3&mode=extend&media=second');
    assert.equal(view.workflow.submissionMode, 'extend', 'another card must apply even with identical engine/mode');
    await view.navigate('engine=wan-3&mode=v2v&media=third');
    assert.equal(view.workflow.submissionMode, 'v2v');
    await view.navigate('');
    await view.navigate('engine=wan-3&mode=extend&media=second');
    assert.equal(view.workflow.submissionMode, 'extend', 'returning to a request is a new navigation');
  } finally { await view.close(); }
});

test('explicit mode waits for draft hydration and does not reset authored inputs', async () => {
  const view = await mount();
  try {
    await view.ready(false);
    await view.navigate('engine=wan-3&mode=extend&media=first');
    assert.equal(view.route.form?.mode, 't2v');
    await view.ready(true);
    assert.equal(view.workflow.submissionMode, 'extend');
    await act(async () => view.workflow.handleComposerModeToggle(null));
    await view.ready(false); await view.ready(true);
    assert.equal(view.workflow.submissionMode, 't2v', 'auth refresh must not replay the same action');
    assert.equal(view.route.prompt, 'Keep this authored prompt');
  } finally { await view.close(); }
});

test('mode-only links and cross-model handoffs use executable model capabilities', async () => {
  const view = await mount('seedance-2-5');
  try {
    await view.navigate('engine=wan-3&mode=extend&media=first');
    assert.equal(view.route.form?.engineId, 'wan-3');
    assert.equal(view.workflow.submissionMode, 'extend');
    await view.navigate('engine=wan-3&mode=v2v');
    assert.equal(view.workflow.submissionMode, 'v2v');
    await view.navigate('engine=wan-3&mode=extend');
    assert.equal(view.workflow.submissionMode, 'extend');
    await view.navigate('engine=wan-3&mode=retake&media=unsupported');
    assert.notEqual(view.workflow.submissionMode, 'retake');
  } finally { await view.close(); }
});

for (const id of ['kling-o3-standard','kling-o3-pro','kling-o3-4k']) test(`${id}: new Modify is Edit and Create references retain Reference`, async()=>{
 const view=await mount(id);
 try {
  await act(async()=>view.workflow.handleComposerModeToggle('v2v'));
  assert.equal(view.route.form?.operation,'kling-edit');
  await view.source('ready');
  await act(async()=>view.workflow.handleComposerModeToggle(null));
  assert.equal(view.workflow.submissionMode,'t2v','the explicit Modify source is parked when returning to Create');
  await view.source('ready');
  assert.equal(view.route.form?.operation,'kling-reference');
  assert.equal(view.workflow.activeManualMode,null);assert.equal(view.workflow.submissionMode,'v2v');
  await view.clearSources();assert.equal(view.workflow.submissionMode,'t2v');
  await view.navigate(`engine=${id}&mode=v2v&operation=kling-edit&media=new-edit`);
  assert.equal(view.route.form?.operation,'kling-edit');
  await view.clearSources();assert.equal(view.workflow.activeManualMode,'v2v');
  await view.navigate(`engine=${id}&mode=v2v&media=legacy`);
  assert.equal(view.route.form?.operation,undefined,'legacy link retains omitted Reference');
 } finally {await view.close();}
});

for(const [id,mode,operation]of [['minimax-h3-max','v2v','h3-recast'],['flux-3','v2v','flux-fast-edit'],['flux-3-draft','v2v','flux-draft-enhance']] as const)test(`${id}: existing mode links select the supported default operation`,async()=>{
 const view=await mount();
 try{await view.navigate(`engine=${id}&mode=${mode}`);assert.equal(view.route.form?.engineId,id);assert.equal(view.route.form?.operation,operation);assert.equal(view.workflow.submissionMode,mode);}
 finally{await view.close();}
});
