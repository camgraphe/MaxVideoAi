import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { SettingsControls } from '../frontend/components/SettingsControls';
import { supportsVideoCfgScaleControl } from '../frontend/src/lib/video-input-schema';
import { getFalEngineById } from '../frontend/src/config/falEngines';

// Render the real advanced panel: schema membership alone cannot catch a global-param slider.
test('Kling CFG slider follows the active schema and retains its saved value across modes', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app' });
  const globals = { React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const changes: number[] = [];
  const noop = () => {};
  try {
    const render = async (mode: 't2v' | 'i2v', engineId = 'kling-2-6-pro') => {
      const engine = getFalEngineById(engineId)!.engine;
      await act(async () => root.render(React.createElement(I18nProvider, {
        locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(SettingsControls, {
          engine, mode, durationSec: 5, resolution: '1080p', aspectRatio: '16:9', fps: 24,
          onDurationChange: noop, onResolutionChange: noop, onAspectRatioChange: noop, onFpsChange: noop,
          variant: 'advanced', advancedOpen: true, cfgScale: 0.7, onCfgScaleChange: value => changes.push(value),
        }),
      })));
    };
    await render('t2v');
    assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="range"]')?.value, '0.7');
    await render('i2v');
    assert.ok(!dom.window.document.querySelector('input[type="range"]'), 'I2V must hide the unsupported CFG slider');
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /CFG scale/);
    await render('t2v');
    assert.equal(dom.window.document.querySelector<HTMLInputElement>('input[type="range"]')?.value, '0.7', 'returning to T2V restores the saved CFG');
    assert.deepEqual(changes, [], 'mode visibility changes must not reset saved CFG');
    await render('t2v', 'kling-3-pro');
    assert.ok(dom.window.document.querySelector('input[type="range"]'), 'other supported global CFG models retain their control');
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('CFG eligibility preserves legacy params-only models and honors authored mode restrictions', () => {
  const engine = getFalEngineById('kling-2-6-pro')!.engine;
  assert.equal(supportsVideoCfgScaleControl(engine, 'i2v'), false);
  assert.equal(supportsVideoCfgScaleControl(engine, 't2v'), true);
  assert.equal(supportsVideoCfgScaleControl({ ...engine, inputSchema: undefined }, 'i2v'), true);
  assert.equal(supportsVideoCfgScaleControl({ ...engine, params: {} }, 't2v'), false);
});
