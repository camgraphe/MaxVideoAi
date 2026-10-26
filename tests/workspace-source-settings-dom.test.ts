import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';
import { CoreSettingsBar } from '../frontend/components/CoreSettingsBar';
import { coerceFormState, getModeCaps, isWorkspaceModeAvailable } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import { resolveVideoOperationEngine, type VideoOperation } from '../frontend/lib/video-operation';
import { getVideoWorkflowSourceField } from '../frontend/lib/video-source-workflow';
import { getVideoExcerptLimits } from '../frontend/lib/video-excerpt';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import type { ComposerProps } from '../frontend/components/Composer';
import type { Mode } from '../frontend/types/engines';

const noop = () => {};
const engines = getBaseEnginesByCategory('video');
async function mount(engineId: string, mode: Mode, operation?: VideoOperation) {
  const require = createRequire(import.meta.url);
  const css = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  const { Composer } = await import('../frontend/components/Composer');
  if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const base = engines.find(engine => engine.id === engineId)!;
  const form = { ...coerceFormState(base, mode, null), ...(operation ? { operation } : {}), durationSec: 7, durationOption: 7, resolution: '480p', aspectRatio: '9:16', audio: true };
  const engine = resolveVideoOperationEngine(base, mode, form.operation);
  const caps = getModeCaps(engine, mode);
  const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: mode,
    isUnifiedSeedance: engineId.startsWith('seedance'), isUnifiedHappyHorse: engineId === 'happy-horse-1-0',
    isUnifiedGeminiOmni: engineId === 'gemini-omni-flash', uiLocale: 'en' });
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mutationCalls = 0;
  const changed = () => { mutationCalls += 1; };
  const bar = React.createElement(CoreSettingsBar, { density: 'workspace', engine, mode, caps,
    durationSec: form.durationSec, durationOption: form.durationOption, onDurationChange: changed,
    resolution: form.resolution, onResolutionChange: changed, aspectRatio: form.aspectRatio, onAspectRatioChange: changed,
    fps: form.fps, onFpsChange: changed, showAudioControl: caps?.audioToggle, audioEnabled: form.audio, onAudioChange: changed });
  return {
    engine, mode, form, doc: dom.window.document, source: getVideoWorkflowSourceField(engine.inputSchema, mode as 'v2v'),
    get mutationCalls() { return mutationCalls; },
    async render(assets: ComposerProps['assets']) {
      await act(async () => root.render(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {},
        children: React.createElement(React.Fragment, null,
          React.createElement('div', { 'data-result-preview': true }, 'Previously generated result — not a source'),
          React.createElement(Composer, { density: 'workspace', engine, caps, activeManualMode: mode,
            prompt: 'Preserve this prompt', onPromptChange: changed, promptRequired: false,
            price: 1.23, currency: 'USD', isLoading: false, onGenerate: changed,
            assetFields: summary.assetFields, assets, settingsBar: bar,
            optionsControl: React.createElement('button', null, 'Independent advanced options'),
            generateControl: React.createElement('button', null, '1x'),
          })),
      })));
    },
    async close() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

for (const engine of engines) {
  for (const mode of ['v2v', 'extend', 'reframe'] as const) {
    if (!isWorkspaceModeAvailable(engine, mode)) continue;
    const operations: (VideoOperation | undefined)[] = Object.values(engine.operationCaps ?? {}).filter(entry => entry?.mode === mode).map(entry => entry!.operation);
    if (!operations.length) operations.push(coerceFormState(engine, mode, null).operation);
    for (const operation of operations) {
    const selected = resolveVideoOperationEngine(engine, mode, operation);
    if (!getVideoWorkflowSourceField(selected.inputSchema, mode)) continue;
    test(`${engine.id}/${mode}/${operation ?? 'default'}: result settings follow actual source readiness, never the result viewer`, async () => {
      const view = await mount(engine.id, mode, operation);
      try {
        const field = view.source!;
        const limits = getVideoExcerptLimits(view.engine, mode);
        const durationSec = Math.min(limits?.maxDurationSec ?? 5, Math.max(limits?.minDurationSec ?? 1, 5));
        const ready = { kind: 'video' as const, name: 'synthetic-source.mp4', size: 1, type: 'video/mp4',
          url: 'https://example.invalid/synthetic-source.mp4', previewUrl: '/synthetic-source.mp4',
          status: 'ready' as const, durationSec, width: 720, height: 1280 };
        const initialForm = structuredClone(view.form);
        for (const [state, assets, expected] of [
          ['missing', {}, false],
          ['unrelated video', { unused_fixture_video: [ready] }, false],
          ['uploading', { [field.id]: [{ ...ready, status: 'uploading' }] }, false],
          ['failed', { [field.id]: [{ ...ready, status: 'error' }] }, false],
          ...(typeof limits?.maxDurationSec === 'number' ? [['needs section', { [field.id]: [{ ...ready, durationSec: limits.maxDurationSec + 1 }] }, false] as const] : []),
          ['ready', { [field.id]: [ready] }, true],
          ['editing section', { [field.id]: [{ ...ready, excerptEditing: true }] }, false],
          ['removed', {}, false],
          ['ready again', { [field.id]: [ready] }, true],
        ] as const) {
          await view.render(assets);
          assert.ok(view.doc.querySelector('[data-result-preview]'));
          assert.equal(Boolean(view.doc.querySelector('[data-settings-density]')), expected, state);
          if (!expected) assert.equal(view.doc.querySelector<HTMLButtonElement>('.app-generation-action')!.disabled, true, state);
          assert.match(view.doc.body.textContent ?? '', /Independent advanced options/);
          assert.match(view.doc.body.textContent ?? '', /1x/);
          const prompt = view.doc.querySelector('textarea');
          if (prompt) assert.equal(prompt.value, 'Preserve this prompt');
          assert.deepEqual(view.form, initialForm, 'presentation must not rewrite requested settings');
          assert.equal(view.mutationCalls, 0);
        }
      } finally { await view.close(); }
    });
    }
  }
}

test('Create with optional video references keeps its independent settings before any video', async () => {
  for (const engine of engines) for (const mode of ['ref2v', 'r2v'] as const) {
    if (!isWorkspaceModeAvailable(engine, mode)) continue;
    const fields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
    if (!fields.some(field => field.type === 'video' && (!field.modes?.length || field.modes.includes(mode)))) continue;
    const view = await mount(engine.id, mode);
    try {
      await view.render({});
      assert.ok(view.doc.querySelector('[data-settings-density]'));
      assert.match(view.doc.body.textContent ?? '', /Independent advanced options/);
    } finally { await view.close(); }
  }
});

test('owned-generation workflows wait for the selected lineage without inventing an upload source', async () => {
  const require = createRequire(import.meta.url);
  const css = require.extensions['.css']; require.extensions['.css'] = () => {};
  const { WorkspaceComposerSurface } = await import('../frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface');
  if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
  const oldReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    for (const [engineId, mode] of [['luma-ray-3-2', 'extend'], ['flux-3-draft', 'v2v']] as const) {
      const base = engines.find(engine => engine.id === engineId)!;
      for (const sourceJob of ['', 'synthetic-owned-source', '']) {
        const form = coerceFormState(base, mode, null);
        form.extraInputValues = { ...form.extraInputValues, source_job_id: sourceJob };
        const engine = resolveVideoOperationEngine(base, mode, form.operation);
        const props = {
          selectedEngine: engine, form, setForm: noop, prompt: 'Synthetic prompt', setPrompt: noop,
          negativePrompt: '', setNegativePrompt: noop, price: null, currency: 'USD', isPricing: false, isSubmitting: false,
          preflightError: null, preflight: null, startRender: noop, inputAssets: {},
          inputSchemaSummary: { assetFields: [], promotedFields: [], secondaryFields: [], promptRequired: true, negativePromptRequired: false },
          uiLocale: 'en', isUnifiedSeedance: false, isUnifiedKlingO3: false, klingO3UnsupportedVideoReason: null,
          workflowCopy: {}, guestUploadLockedReason: null, activeManualMode: mode, handleComposerModeToggle: noop,
          composerWorkflowNotice: null, pendingGenerations: [], handleAssetAdd: noop, handleAssetRemove: noop, handleOpenAssetLibrary: noop, showNotice: noop,
          supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, multiPromptEnabled: false, setMultiPromptEnabled: noop,
          multiPromptScenes: [], multiPromptTotalSec: 4, multiPromptActive: false, multiPromptInvalid: false, multiPromptError: null,
          handleMultiPromptAddScene: noop, handleMultiPromptRemoveScene: noop, handleMultiPromptUpdateScene: noop,
          audioWorkflowUnsupported: false, audioWorkflowLocked: false, showRetakeWorkflowAction: false, activeMode: mode, submissionMode: mode, capability: getModeCaps(engine, mode),
          handleDurationChange: noop, handleFramesChange: noop, handleResolutionChange: noop, handleAspectRatioChange: noop, handleFpsChange: noop,
          supportsAudioToggle: false, voiceControlEnabled: false, cfgScale: null, setCfgScale: noop, shotType: 'customize', setShotType: noop,
          voiceIdsInput: '', setVoiceIdsInput: noop, isSeedance: false, seedValue: '', handleSeedChange: noop,
          cameraFixedValue: false, handleCameraFixedChange: noop, safetyCheckerValue: true, handleSafetyCheckerChange: noop, showSafetyCheckerControl: false,
          klingElements: [], handleKlingElementAdd: noop, handleKlingElementRemove: noop, handleKlingElementAssetAdd: noop, handleKlingElementAssetRemove: noop, handleOpenKlingAssetLibrary: noop, setViewMode: noop,
        } as React.ComponentProps<typeof WorkspaceComposerSurface>;
        const dom = new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(WorkspaceComposerSurface, props) })));
        try { assert.equal(Boolean(dom.window.document.querySelector('[data-settings-density]')), Boolean(sourceJob), `${engineId}/${sourceJob || 'none'}`); }
        finally { dom.window.close(); }
      }
    }
  } finally {
    if (oldReact) Object.defineProperty(globalThis, 'React', oldReact); else Reflect.deleteProperty(globalThis, 'React');
  }
});
