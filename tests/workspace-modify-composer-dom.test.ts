import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import type { Dictionary } from '../frontend/lib/i18n/types';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { CoreSettingsBar } from '../frontend/components/CoreSettingsBar';
import type { ComposerProps } from '../frontend/components/Composer';

import {coerceFormState} from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';
import {resolveVideoOperationEngine} from '../frontend/lib/video-operation';
import {OwnedGenerationSourcePicker} from '../frontend/app/(core)/(workspace)/app/_components/OwnedGenerationSourcePicker.client';
const noop = () => {};
for (const { id } of listFalEngines().filter(entry => entry.modes.some(({ mode }) => mode === 'v2v'))) {
  test(`${id}: Modify puts its source first and preserves every supported reference`, async () => {
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
    dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
    const entry = listFalEngines().find(entry => entry.id === id)!;
    const form=coerceFormState(entry.engine,'v2v',null);
    const engine = resolveVideoOperationEngine(entry.engine,'v2v',form.operation);
    const caps = engine.modeCaps?.v2v ?? entry.modes.find(({mode})=>mode==='v2v')!.ui;
    const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: 'v2v',
      allowsUnifiedVeoFirstLast: id.startsWith('veo'), isUnifiedHappyHorse: id === 'happy-horse-1-0',
      isUnifiedSeedance: id.startsWith('seedance'), isUnifiedGeminiOmni: id === 'gemini-omni-flash', uiLocale: 'en' });
    const source = summary.assetFields.find(({ field, required }) => field.type === 'video' && required)!;
    const libraryCalls: unknown[] = [];
    const root = createRoot(dom.window.document.getElementById('root')!);
    const settings = React.createElement(CoreSettingsBar, { density: 'workspace', engine, mode: 'v2v', caps,
      durationSec: 7, onDurationChange: noop, resolution: '720p', onResolutionChange: noop,
      aspectRatio: '16:9', onAspectRatioChange: noop, fps: 24, onFpsChange: noop,
      showAudioControl: caps.audioToggle, audioEnabled: true, onAudioChange: noop });
    const render = async (assets: ComposerProps['assets'] = {}, error?: string) => act(async () => root.render(
      React.createElement(I18nProvider, { locale: 'en', dictionary: {} as Dictionary, fallback: {} as Dictionary,
        children: React.createElement(Composer, { density: 'workspace', engine, caps, activeManualMode: 'v2v',
          prompt: '', onPromptChange: noop, price: null, currency: 'USD', isLoading: false, error,
          beforeAssets: id==='flux-3-draft' ? React.createElement(OwnedGenerationSourcePicker,{account:null,operation:'flux-draft-enhance',sourceJobId:'',locale:'en',onSelect:noop}) : undefined,
          promptRequired: summary.promptRequired, assetFields: summary.assetFields, assets, settingsBar: settings,
          onGenerate: noop, onAssetRemove: noop, onOpenLibrary: (field, index) => libraryCalls.push([field.id, index]) }),
      }),
    ));
    try {
      await render();
      const doc = dom.window.document;
      if(id==='flux-3-draft'){
        assert.ok(doc.querySelector('[data-testid="owned-generation-source-picker"]'),'Enhance uses the owned native Draft picker');
        assert.equal(summary.assetFields.some(({field})=>field.type==='video'),false);
        assert.equal(doc.querySelector('input[type="file"]'),null,'no arbitrary video upload for Enhance');
        // Owned-source and exact quote admission belong to WorkspaceComposerSurface;
        // seedance-edit-workspace-browser covers that real surface, including zero-cent quotes.
        return;
      }
      assert.match(doc.body.textContent ?? '', /Upload the video to modify.*calculate the price/);
      assert.equal(doc.querySelector('[role="alert"]'), null);
      assert.match(doc.querySelector('.app-generation-quote > .relative')?.textContent ?? '', /Add a video/);
      assert.equal(doc.querySelector<HTMLButtonElement>('.app-generation-action')!.disabled, true);
      const commands = [...doc.querySelectorAll<HTMLButtonElement>('[data-reference-command]')];
      assert.equal(commands[0].dataset.referenceCommand, source.field.id);
      const expectedFields = [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])].filter(field => ['image', 'video', 'audio'].includes(field.type) && (!field.modes?.length || field.modes.includes('v2v')));
      const visibleFieldIds = new Set(summary.assetFields.map(({ field }) => field.id));
      for (const field of expectedFields) assert.ok(visibleFieldIds.has(field.id), `supported Modify reference ${field.id} remains available`);
      await act(async () => commands[0].click());
      const upload = doc.querySelector<HTMLInputElement>('input[type="file"]');
      assert.ok(upload?.accept.includes('video') || upload?.accept.includes('mp4'));
      const library = [...doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label')?.startsWith('Choose from Media'));
      assert.ok(library);
      await act(async () => library.click());
      assert.deepEqual(libraryCalls, [[source.field.id, 0]]);
      assert.equal(doc.activeElement, commands[0]);
      await render({ [source.field.id]: [{ kind: 'video', name: 'source.mp4', size: 1, type: 'video/mp4', previewUrl: 'blob:source', status: 'uploading' }] });
      assert.match(doc.body.textContent ?? '', /Uploading your video/);
      await render({ [source.field.id]: [{ kind: 'video', name: 'source.mp4', size: 1, type: 'video/mp4', previewUrl: '/source.mp4', status: 'ready' }] }, 'The uploaded video is too long.');
      assert.equal(doc.querySelector('[role="alert"]')?.textContent, 'The uploaded video is too long.');
      assert.doesNotMatch(doc.body.textContent ?? '', /Upload the video to modify/);
    } finally {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    }
  });
}
