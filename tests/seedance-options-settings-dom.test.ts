import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { SettingsControls } from '../frontend/components/SettingsControls';
import { getBaseEngines } from '../frontend/src/lib/engines';
import { summarizeWorkspaceInputSchema } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-input-schema';
import { coerceFormState } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-engine-helpers';

test('restoring Seedance Auto retains its choice and maximum pricing duration', () => {
  for (const engine of getBaseEngines().filter(candidate => ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'seedance-2-5'].includes(candidate.id))) {
    const restored = coerceFormState(engine, 't2v', { engineId: engine.id, mode: 't2v', durationSec: 5, durationOption: 'auto',
      resolution: '720p', aspectRatio: '16:9', fps: 24, iterations: 1, audio: false, extraInputValues: {} });
    assert.equal(restored.durationOption, 'auto');
    assert.equal(restored.durationSec, engine.maxDurationSec);
  }
});

test('Seedance settings visibly offer Auto and submit output switches without unsupported seed controls', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app', pretendToBeVisual: true });
  const globals = { React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const durations: Array<string | number> = [], values: Record<string, unknown> = {};
  const noop = () => {};
  try {
    for (const engineId of ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini', 'seedance-2-5']) {
      const engine = getBaseEngines().find(candidate => candidate.id === engineId)!;
      const fields = summarizeWorkspaceInputSchema({ selectedEngine: engine, activeMode: 't2v', allowsUnifiedVeoFirstLast: false,
        isUnifiedHappyHorse: false, isUnifiedSeedance: true, isUnifiedGeminiOmni: false, uiLocale: 'fr' }).secondaryFields;
      const common = { engine, durationSec: 5, durationOption: 'auto', resolution: '720p', aspectRatio: '16:9', fps: 24, mode: 't2v' as const,
        onDurationChange: (raw: number | string) => durations.push(raw), onResolutionChange: noop, onAspectRatioChange: noop, onFpsChange: noop,
        showSeedanceControls: false, advancedFields: fields, advancedFieldValues: values,
        onAdvancedFieldChange: (field: {id: string}, value: unknown) => { values[field.id] = value; } };
      const render = (advanced: boolean) => act(async () => root.render(React.createElement(I18nProvider,
        { locale: 'fr', dictionary: {}, fallback: {}, children: React.createElement(SettingsControls,
          { ...common, caps: { duration: { options: ['auto', 4, 5, engine.maxDurationSec] }, aspectRatio: ['16:9'], resolution: ['720p'] },
            ...(advanced ? { variant: 'advanced' as const, advancedOpen: true } : {}) }) })));
      await render(false);
      const auto = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'auto');
      assert.ok(auto, `${engineId} Auto duration must be visible`);
      assert.match(auto.className, /bg-brand/, 'Auto remains selected without a numeric fallback');
      await act(async () => auto.click());
      assert.equal(durations.at(-1), 'auto');
      await render(true);
      assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Seed|Lock seed/i);
      for (const label of [...dom.window.document.querySelectorAll('label')]) {
        if (/dernière image|Filigrane/.test(label.textContent ?? '')) {
          await act(async () => label.querySelector<HTMLButtonElement>('button')!.click());
        }
      }
      assert.equal(values.return_last_frame, true);
      assert.equal(values.watermark, true);
      const format = dom.window.document.querySelector('select');
      if (engineId === 'seedance-2-5') {
        assert.ok(format);
        await act(async () => { format.value = 'mov'; format.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
        assert.equal(values.output_format, 'mov');
      } else assert.equal(format, null);
    }
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
