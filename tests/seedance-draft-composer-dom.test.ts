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
function composer(engineId: string, controls: SeedanceDraftControls, mode: Mode = 't2v', iterations = 1, overrides: Partial<React.ComponentProps<typeof WorkspaceComposerSurface>> = {}) {
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
    composerWorkflowNotice: null, pendingGenerations: [], handleAssetAdd: noop, handleAssetRemove: noop, handleOpenAssetLibrary: noop, showNotice: noop,
    supportsKlingV3Controls: false, supportsKlingV3VoiceControl: false, multiPromptEnabled: false, setMultiPromptEnabled: noop,
    multiPromptScenes: [], multiPromptTotalSec: 4, multiPromptActive: false, multiPromptInvalid: false, multiPromptError: null,
    handleMultiPromptAddScene: noop, handleMultiPromptRemoveScene: noop, handleMultiPromptUpdateScene: noop,
    audioWorkflowUnsupported: false, audioWorkflowLocked: false, showRetakeWorkflowAction: false, activeMode: mode, submissionMode: mode, capability: undefined,
    handleDurationChange: noop, handleFramesChange: noop, handleResolutionChange: noop, handleAspectRatioChange: noop, handleFpsChange: noop,
    supportsAudioToggle: false, voiceControlEnabled: false, cfgScale: null, setCfgScale: noop, shotType: 'customize', setShotType: noop,
    voiceIdsInput: '', setVoiceIdsInput: noop, isSeedance: engineId.includes('seedance'), seedValue: '', handleSeedChange: noop,
    cameraFixedValue: false, handleCameraFixedChange: noop, safetyCheckerValue: true, handleSafetyCheckerChange: noop, showSafetyCheckerControl: false,
    klingElements: [], handleKlingElementAdd: noop, handleKlingElementRemove: noop, handleKlingElementAssetAdd: noop, handleKlingElementAssetRemove: noop, handleOpenKlingAssetLibrary: noop, setViewMode: noop,
    ...overrides,
  };
  const oldReact = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return new JSDOM(renderToStaticMarkup(React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(WorkspaceComposerSurface, props) })));
  } finally {
    if (oldReact) Object.defineProperty(globalThis, 'React', oldReact); else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('Kling empty subject builder is optional on the first composer render', () => {
  const controls = { available: false, selected: false, phase: 'setup', live: true, toggle: noop, generate: noop } as const;
  const dom = composer('kling-o3-pro', controls, 'i2v', 1, {
    isUnifiedKlingO3: true, supportsKlingV3Controls: true,
    klingElements: [{ id: 'default-empty', frontal: null, video: null, references: [null, null, null] }],
  });
  try {
    assert.equal(dom.window.document.querySelector('input[accept="image/*"]'), null);
    assert.ok(dom.window.document.querySelector('[data-reference-command="collections"]'), 'References remains available even without regular asset fields');
  } finally { dom.window.close(); }
});

test('hydrated Kling subject reference slots occupy the first composer render', () => {
  const controls = { available: false, selected: false, phase: 'setup', live: true, toggle: noop, generate: noop } as const;
  for (const count of [1, 2]) {
    const dom = composer('kling-o3-pro', controls, 'i2v', 1, {
      isUnifiedKlingO3: true,
      supportsKlingV3Controls: true,
      klingElements: Array.from({ length: count }, (_, index) => ({
        id: `subject-${index}`, frontal: { id: `frontal-${index}`, kind: 'image', name: 'retained.png', url: '/retained.png', previewUrl: '/retained.png', status: 'ready' }, video: null, references: [null, null, null],
      })),
    });
    try {
      assert.match(dom.window.document.body.textContent ?? '', /Subject references/);
      assert.equal(dom.window.document.querySelectorAll('input[accept="image/*"]').length, 4 * count);
      assert.equal(dom.window.document.querySelectorAll('input[accept="video/*"]').length, count);
    } finally { dom.window.close(); }
  }
});

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

test('Storyboard creation action stays available in Create but does not distract from Modify or Extend', () => {
  const controls = { available: false, selected: false, phase: 'setup', live: true, toggle: noop, generate: noop } as const;
  for (const id of ['seedance-2-5', 'seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'kling-o3-pro', 'kling-o3-standard']) {
    for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'] as const) {
      if (!engines.find(engine => engine.id === id)!.modes.includes(mode)) continue;
      const dom = composer(id, controls, mode);
      try {
        const storyboard = [...dom.window.document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Storyboard');
        assert.equal(storyboard, ['t2v', 'i2v', 'ref2v'].includes(mode), `${id}/${mode}`);
      } finally { dom.window.close(); }
    }
  }
});
