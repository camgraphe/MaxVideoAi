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
import { getVideoExcerptLimits } from '../frontend/lib/video-excerpt';

import { OwnedGenerationSourcePicker } from '../frontend/app/(core)/(workspace)/app/_components/OwnedGenerationSourcePicker.client';
const noop = () => {};
for (const { id } of listFalEngines().filter(entry => entry.modes.some(mode => mode.mode === 'extend'))) {
  test(`${id}: Extend puts its source first, guides pricing and only offers meaningful controls`, async () => {
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
    const engine = entry.engine;
    const caps = entry.modes.find(({ mode }) => mode === 'extend')!.ui;
    const summary = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: 'extend',
      allowsUnifiedVeoFirstLast: id.startsWith('veo'), isUnifiedHappyHorse: false,
      isUnifiedSeedance: id.startsWith('seedance'), isUnifiedGeminiOmni: id === 'gemini-omni-flash', uiLocale: 'en' });
    const source = summary.assetFields.find(({ field, required }) => field.type === 'video' && required)!;
    const libraryCalls: unknown[] = [];
    const root = createRoot(dom.window.document.getElementById('root')!);
    const settings = React.createElement(CoreSettingsBar, { density: 'workspace', engine, mode: 'extend', caps,
      durationSec: 7, onDurationChange: noop, resolution: '720p', onResolutionChange: noop,
      aspectRatio: '16:9', onAspectRatioChange: noop, fps: 24, onFpsChange: noop,
      showAudioControl: caps.audioToggle, audioEnabled: true, onAudioChange: noop });
    const render = async (assets: ComposerProps['assets'] = {}, error?: string) => act(async () => root.render(
      React.createElement(I18nProvider, { locale: 'en', dictionary: {} as Dictionary, fallback: {} as Dictionary,
        children: React.createElement(Composer, { density: 'workspace', engine, caps, activeManualMode: 'extend',
          prompt: '', onPromptChange: noop, price: null, currency: 'USD', isLoading: false, error,
          beforeAssets: id === 'luma-ray-3-2' ? React.createElement(OwnedGenerationSourcePicker,{account:null,operation:'luma-extend',sourceJobId:'',locale:'en',onSelect:noop}) : undefined,
          promptRequired: summary.promptRequired, assetFields: summary.assetFields, assets, settingsBar: settings,
          onGenerate: noop, onAssetRemove: noop, onOpenLibrary: (field, index) => libraryCalls.push([field.id, index]) }),
      }),
    ));
    try {
      await render();
      const doc = dom.window.document;
      if (id === 'luma-ray-3-2') {
        const picker = doc.querySelector('[data-testid="owned-generation-source-picker"]');
        assert.ok(picker);
        assert.match(picker.textContent ?? '', /Choose an owned generation.*exact price/);
        assert.equal(doc.querySelector('input[type="file"]'), null);
        assert.ok(picker.compareDocumentPosition(doc.querySelector('textarea')!) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
        assert.equal(doc.querySelector<HTMLButtonElement>('.app-generation-action')!.disabled, true);
        return;
      }
      assert.match(doc.body.textContent ?? '', /Upload the video to extend.*calculate the price/);
      assert.equal(doc.querySelector('[role="alert"]'), null);
      if (id.startsWith('seedance-2-')) assert.match(doc.querySelector('[role="note"]')?.textContent ?? '', /recognizable person/);
      assert.match(doc.querySelector('.app-generation-quote > .relative')?.textContent ?? '', /Add a video/);
      assert.equal(doc.querySelector<HTMLButtonElement>('.app-generation-action')!.disabled, true);
      assert.equal(doc.querySelector('[data-settings-density]'), null, 'result settings wait for the required source');
      const commands = [...doc.querySelectorAll<HTMLButtonElement>('[data-reference-command]')];
      assert.equal(commands[0].dataset.referenceCommand, source.field.id);
      assert.doesNotMatch(commands.map(button => button.textContent).join(' '), /Start frame|End frame/);
      await act(async () => commands[0].click());
      const upload = doc.querySelector<HTMLInputElement>('input[type="file"]');
      assert.ok(upload?.accept.includes('video') || upload?.accept.includes('mp4'));
      const library = [...doc.querySelectorAll<HTMLButtonElement>('button')].find(button => button.getAttribute('aria-label')?.startsWith('Choose from Media'));
      assert.ok(library);
      await act(async () => library.click());
      assert.deepEqual(libraryCalls, [[source.field.id, 0]]);
      assert.equal(doc.activeElement, commands[0]);
      const limits = getVideoExcerptLimits(engine, 'extend');
      const sourceDurationSec = Math.min(limits?.maxDurationSec ?? 5, Math.max(limits?.minDurationSec ?? 1, 5));
      await render({ [source.field.id]: [{ kind: 'video', name: 'source.mp4', size: 1, type: 'video/mp4',
        url: 'https://example.invalid/source.mp4', previewUrl: '/source.mp4', status: 'ready', durationSec: sourceDurationSec }] });
      assert.ok(doc.querySelector('[data-settings-density]'), 'all supported settings return with a ready source');
      const settingButton = (label: string) => [...doc.querySelectorAll<HTMLButtonElement>('[data-settings-density] button')].find(button => button.textContent?.startsWith(label));
      if (caps.duration && 'options' in caps.duration && caps.duration.options.length === 1) {
        assert.equal(settingButton('Generated duration'), undefined, 'fixed 7s is not a selector');
        assert.ok(doc.body.textContent?.includes(String(caps.duration.options[0]).replace(/s$/, "") + "s"));
      } else {
        assert.ok(settingButton('Generated duration'));
      }
      if (id === 'ltx-2-3') {
        assert.equal(settingButton('Resolution'), undefined);
        assert.equal(settingButton('Frame rate'), undefined);
        assert.equal(settingButton('Audio'), undefined);
      }
      await render({ [source.field.id]: [{ kind: 'video', name: 'source.mp4', size: 1, type: 'video/mp4', previewUrl: 'blob:source', status: 'uploading' }] });
      assert.match(doc.body.textContent ?? '', /Uploading your video/);
      assert.equal(doc.querySelector('[data-settings-density]'), null);
      await render({ [source.field.id]: [{ kind: 'video', name: 'source.mp4', size: 1, type: 'video/mp4', previewUrl: '/source.mp4', status: 'ready' }] }, 'The uploaded video is too long.');
      assert.equal(doc.querySelector('[role="alert"]')?.textContent, 'The uploaded video is too long.');
      assert.doesNotMatch(doc.body.textContent ?? '', /Upload the video to extend/);
    } finally {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
    }
  });
}
