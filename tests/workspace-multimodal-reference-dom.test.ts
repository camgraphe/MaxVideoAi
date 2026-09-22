import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act, createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { useWorkspaceEngineModeState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceEngineModeState';
import { useWorkspaceInputSchemaState } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceInputSchemaState';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import type { FormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-form-state';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import { SettingsGenericAdvancedFields } from '../frontend/components/settings-controls/settings-control-generic-fields';
import { getEngineModeLabel } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

async function loadComposer() {
  const require = createRequire(import.meta.url);
  const previous = require.extensions['.css'];
  require.extensions['.css'] = () => {};
  try { return await import('../frontend/components/Composer'); } finally {
    if (previous) require.extensions['.css'] = previous;
    else delete require.extensions['.css'];
  }
}

const noop = () => {};
const workflowCopy = { generateVideo: 'Generate', removeAudioToUnlock: 'Remove audio', audioUnsupported: 'Unsupported',
  audioLocked: 'Locked', audioLockedFallback: 'Locked', removeAudioToUseEdit: 'Remove audio' };
function reference(fieldId: string, kind: ReferenceAsset['kind']): ReferenceAsset {
  return { id: fieldId, fieldId, kind, name: fieldId, size: 1, type: `${kind}/test`, status: 'ready',
    url: `https://example.com/${fieldId}`, previewUrl: `https://example.com/${fieldId}` };
}

for (const id of ['wan-3', 'wan-3-prime', 'minimax-h3', 'minimax-h3-max']) {
  test(`${id}: mounted mode and schema effects retain a manual reference session and uploaded media`, async () => {
    const { Composer } = await loadComposer();
    const engine = listFalEngines().find((entry) => entry.id === id)!.engine;
    const engines = [engine];
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app' });
    const previous = new Map<string, PropertyDescriptor | undefined>();
    for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
      HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true })) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }
    dom.window.HTMLElement.prototype.getClientRects = function () {
      return [{ width: 10, height: 10 }] as unknown as DOMRectList;
    };
    let current: {
      mode: ReturnType<typeof useWorkspaceEngineModeState>;
      schema: ReturnType<typeof useWorkspaceInputSchemaState>;
      inputAssets: Record<string, (ReferenceAsset | null)[]>;
      setInputAssets: React.Dispatch<React.SetStateAction<Record<string, (ReferenceAsset | null)[]>>>;
    };
    function Harness() {
      const [form, setForm] = useState<FormState | null>(() => coerceFormState(engine, 't2v', null));
      const [inputAssets, setInputAssets] = useState<Record<string, (ReferenceAsset | null)[]>>({});
      const [optionsOpen, setOptionsOpen] = useState(false);
      const mode = useWorkspaceEngineModeState({ engines, form, setForm, inputAssets, klingElements: [], shotType: 'customize', setShotType: noop,
        effectiveRequestedEngineToken: null, authChecked: true, hydratedForScope: 'test', storageScope: 'test',
        preserveStoredDraftRef: useRef(false), requestedEngineOverrideIdRef: useRef(null), requestedEngineOverrideTokenRef: useRef(null),
        requestedModeOverrideRef: useRef(null), writeStorage: noop, uiLocale: 'en', workflowCopy, showNotice: noop });
      const schema = useWorkspaceInputSchemaState({ ...mode, uiLocale: 'en', authChecked: true, authLoading: false,
        authenticatedUserId: 'test', uploadLockedCopy: 'Sign in', setInputAssets, setForm });
      current = { mode, schema, inputAssets, setInputAssets };
      return createElement(Composer, {
        engine, density: 'workspace', prompt: '', onPromptChange: noop, price: null, currency: 'USD', isLoading: false,
        promptRequired: schema.inputSchemaSummary.promptRequired, assetFields: schema.inputSchemaSummary.assetFields, assets: inputAssets,
        modeToggles: mode.composerModeToggles, activeManualMode: mode.activeManualMode, onModeToggle: mode.handleComposerModeToggle,
        onGenerate: noop,
        optionsControl: createElement('button', { 'data-options': true, onClick: () => setOptionsOpen(!optionsOpen) }, 'Options'),
        extraFields: optionsOpen ? createElement(SettingsGenericAdvancedFields, {
          fields: schema.inputSchemaSummary.secondaryFields, values: form!.extraInputValues,
          onChange: (field, value) => setForm((current) => current ? { ...current, extraInputValues: { ...current.extraInputValues, [field.id]: value } } : current),
        }) : undefined,
      });
    }
    const root = createRoot(dom.window.document.getElementById('root')!);
    try {
      await act(async () => root.render(createElement(I18nProvider, {
        locale: 'en', dictionary: {} as Dictionary, fallback: {} as Dictionary, children: createElement(Harness),
      })));
      if (id.startsWith('wan-')) {
        const modeButtons = [...dom.window.document.querySelectorAll<HTMLButtonElement>('.app-mode-switch button')];
        for (const nextMode of ['ref2v', 'v2v', 'extend'] as const) {
          assert.ok(modeButtons.some((button) => button.textContent === getEngineModeLabel(id, nextMode, 'en')),
            `${nextMode} must be reachable from the composer`);
        }
        await act(async () => modeButtons.find((button) => button.textContent === getEngineModeLabel(id, 'ref2v', 'en'))!.click());
        await act(async () => dom.window.document.querySelector<HTMLButtonElement>('[data-options]')!.click());
        for (const label of ['Document URL', 'Public webpage URL']) {
          const control = [...dom.window.document.querySelectorAll('label')].find((entry) => entry.textContent?.includes(label))?.querySelector('textarea');
          assert.ok(control, `${label} must be reachable with no media uploads`);
          assert.equal(control.disabled, false);
        }
      } else {
        await act(async () => dom.window.document.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!.click());
        const soundtrack = dom.window.document.querySelector<HTMLButtonElement>('[data-reference-role="target_audio_url"]');
        assert.ok(soundtrack, 'generic-role soundtrack must be visible in the actual reference popup');
        await act(async () => soundtrack.click());
        const upload = dom.window.document.querySelector<HTMLButtonElement>('[data-reference-field="target_audio_url"] .app-reference-add-target');
        const input = dom.window.document.querySelector<HTMLInputElement>('[data-reference-field="target_audio_url"] input[type="file"]');
        assert.ok(upload);
        assert.ok(input);
        assert.equal(upload.disabled, false);
        assert.equal(input.disabled, false);
        assert.match(input.accept, /audio\/|\.mp3|\.wav/);
        let filePickerOpened = false;
        input.click = () => { filePickerOpened = true; };
        await act(async () => upload.click());
        assert.equal(filePickerOpened, true);
        await act(async () => upload.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
        await act(async () => current.mode.handleModeChange('ref2v'));
      }
      assert.equal(current!.mode.submissionMode, 'ref2v');
      assert.ok(current!.schema.inputSchemaSummary.assetFields.some(({ field }) => field.id === 'reference_audio_urls'));
      const assets = { reference_audio_urls: [reference('reference_audio_urls', 'audio')] };
      await act(async () => current.setInputAssets(assets));
      assert.equal(current!.mode.submissionMode, 'ref2v');
      assert.equal(current!.mode.audioWorkflowUnsupported, false);
      assert.equal(current!.mode.composerWorkflowNotice, null, 'reference audio must not claim that audio-to-video controls are locked');
      assert.deepEqual(current!.inputAssets, assets);
      await act(async () => current.mode.handleModeChange('i2v'));
      assert.equal(current!.mode.submissionMode, 'ref2v');
      assert.deepEqual(current!.inputAssets, assets, 'automatic mode correction must never prune existing references');
      if (id.startsWith('wan-')) {
        const edited = { ...assets, video_url: [reference('video_url', 'video')] };
        await act(async () => current.setInputAssets(edited));
        await act(async () => current.mode.handleComposerModeToggle('extend'));
        assert.equal(current!.mode.submissionMode, 'extend');
        assert.equal(current!.mode.audioWorkflowUnsupported, false);
        assert.deepEqual(current!.inputAssets, edited);
      }
    } finally {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    }
  });
}
