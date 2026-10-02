import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { WorkspaceComposerSurface } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceComposerSurface';
import type { SeedanceDraftControls } from '../frontend/lib/seedance-workflow-contract';
import type { Mode } from '../frontend/types/engines';

const noop = () => {};
const engines = getBaseEngines();
function composer(engineId: string, controls: SeedanceDraftControls, mode: Mode = 't2v', iterations = 1) {
  const selectedEngine = engines.find(engine => engine.id === engineId)!;
  assert.ok(selectedEngine);
  const props: React.ComponentProps<typeof WorkspaceComposerSurface> = {
    localDraftPreview: controls, selectedEngine,
    form: { engineId, mode, durationSec: 4, resolution: controls.selected ? '480p' : '720p', aspectRatio: '16:9', fps: 24, iterations, audio: false, extraInputValues: {} },
    setForm: noop, prompt: 'A valley', setPrompt: noop, negativePrompt: '', setNegativePrompt: noop,
    price: 1.03, currency: 'USD', isPricing: false, isSubmitting: false, preflightError: null, preflight: null, composerRef: undefined, startRender: noop,
    inputSchemaSummary: { assetFields: [], promotedFields: [], secondaryFields: [], promptRequired: true, negativePromptRequired: false },
    inputAssets: {}, isUnifiedSeedance: engineId.includes('seedance'), isUnifiedKlingO3: false, klingO3UnsupportedVideoReason: null,
    workflowCopy: { clearReferencesToUseStartEnd: '', clearStartEndToUseReferences: '', removeAudioToUnlock: '' }, guestUploadLockedReason: null,
    uiLocale: 'en', composerModeToggles: undefined, activeManualMode: null, handleComposerModeToggle: noop,
    composerWorkflowNotice: null, inProgressMessage: null, handleAssetAdd: noop, handleAssetRemove: noop, handleOpenAssetLibrary: noop, showNotice: noop,
    supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, multiPromptEnabled: false, setMultiPromptEnabled: noop,
    multiPromptScenes: [], multiPromptTotalSec: 4, multiPromptActive: false, multiPromptInvalid: false, multiPromptError: null,
    handleMultiPromptAddScene: noop, handleMultiPromptRemoveScene: noop, handleMultiPromptUpdateScene: noop,
    audioWorkflowUnsupported: false, audioWorkflowLocked: false, showRetakeWorkflowAction: false, activeMode: mode, submissionMode: mode, capability: undefined,
    handleDurationChange: noop, handleFramesChange: noop, handleResolutionChange: noop, handleAspectRatioChange: noop, handleFpsChange: noop,
    supportsAudioToggle: false, voiceControlEnabled: false, cfgScale: null, setCfgScale: noop, shotType: 'customize', setShotType: noop,
    voiceIdsInput: '', setVoiceIdsInput: noop, isSeedance: engineId.includes('seedance'), seedValue: '', handleSeedChange: noop,
    cameraFixedValue: false, handleCameraFixedChange: noop, safetyCheckerValue: true, handleSafetyCheckerChange: noop, showSafetyCheckerControl: false,
    klingElements: [], handleKlingElementAdd: noop, handleKlingElementRemove: noop, handleKlingElementAssetAdd: noop, handleKlingElementAssetRemove: noop, handleOpenKlingAssetLibrary: noop, setViewMode: noop,
  };
  const oldReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(WorkspaceComposerSurface, props) })));
  } finally {
    if (oldReact) Object.defineProperty(globalThis, 'React', oldReact); else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('unavailable Draft controls do not add instructions or override normal generation labels', () => {
  const controls = { available: false, selected: false, phase: 'setup', live: true, toggle: noop, generate: noop } as const;
  for (const [engineId, mode, iterations] of [['pika-text-to-video', 't2v', 1], ['seedance-2-5', 'ref2v', 1], ['seedance-2-5', 't2v', 2]] as const) {
    const dom = composer(engineId, controls, mode, iterations);
    try {
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Draft|Parcours local|admin/);
      assert.equal(dom.window.document.querySelector('.app-generation-label')?.textContent, 'Generate');
      assert.equal(dom.window.document.querySelector('input[type="checkbox"]'), null);
    } finally { dom.window.close(); }
  }
});

test('available Draft preserves normal generation until selected, then uses the compact 480p action', () => {
  for (const selected of [false, true]) {
    const dom = composer('seedance-2-5', { available: true, selected, phase: 'setup', live: true, toggle: noop, generate: noop });
    try {
      assert.equal(dom.window.document.querySelector('.app-generation-label')?.textContent, selected ? 'Draft 480p' : 'Generate');
      assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked, selected);
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Parcours local|admin|Prototype local/);
    } finally { dom.window.close(); }
  }
});
