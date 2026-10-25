import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { listFalEngines } from '../frontend/src/config/falEngines';
import type { EnginePickerContext } from '../frontend/src/components/ui/engine-select/model-picker-types';
const require = createRequire(import.meta.url);
require.extensions['.css'] = module => { module.exports = { __esModule: true, default: new Proxy({}, { get: (_target, key) => String(key) }) }; };

test('model rows apply in one action while comparison controls, information and compatibility remain independent', async () => {
  const dom = new JSDOM('<button id="opener">Open</button><div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ React, window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(dom.window.HTMLElement.prototype, 'getClientRects', { value: () => [{ width: 100, height: 44 }] });
  const { createRoot } = require('../frontend/node_modules/react-dom/client') as typeof import('react-dom/client');
  const { EnginePickerDialog } = await import('../frontend/src/components/ui/engine-select/EnginePickerDialog.client');
  const engines = listFalEngines().filter(entry => ['wan-3-prime', 'wan-3', 'kling-o3-pro', 'minimax-h3', 'seedance-2-5', 'flux-3-max'].includes(entry.id)).map(entry => entry.engine);
  let chosen: string | null = null, closed = false;
  const controlChanges: string[][] = [];
  const context: EnginePickerContext = { key: 'direct-draft', scope: 'test-direct-dialog', label: '5 s · 720p', mode: 't2v',
    controls: [{ id: 'durationSec', label: 'Durée', value: '5', options: [{ value: '5', label: '5 s' }, { value: '10', label: '10 s' }] }],
    onControlChange: (id, value) => { controlChanges.push([id, value]); },
    options: Object.fromEntries(engines.map(engine => [engine.id, { summary: '5 s · 720p', changes: engine.id === 'minimax-h3' ? [{ label: 'Audio', before: 'Sans audio', after: 'Audio inclus' }] : [] }])) };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const open = async () => {
    chosen = null; closed = false; dom.window.document.getElementById('opener')!.focus();
    await act(async () => { root.render(React.createElement(EnginePickerDialog, { engines, engineId: 'wan-3-prime', mode: 't2v', locale: 'fr', registryMeta: null, context,
      onSelect: (id: string) => { chosen = id; }, onClose: () => { closed = true; root.render(null); } }));
      await new Promise(resolve => setTimeout(resolve, 20)); });
  };
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === name || element.textContent?.trim() === name);
    assert.ok(button, `button ${name}`);
    await act(async () => button.click());
  };
  const assertNoConfirmation = () => assert.ok(![...dom.window.document.querySelectorAll('button')].some(button => button.textContent?.trim() === 'Confirmer les réglages'));
  try {
    await open();
    const duration = dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="Prix pour — Durée"]')!;
    await act(async () => { duration.value = '10'; duration.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.deepEqual(controlChanges, [['durationSec', '10']]);
    assert.equal(chosen, null); assert.equal(closed, false, 'editing comparison options must not apply or close');
    await click('Tous les modèles');
    const search = dom.window.document.querySelector('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, 'kling');
      search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.ok(dom.window.document.querySelector('[data-model-id="kling-o3-pro"]'));
    await click('Effacer la recherche'); await click('Notre sélection');
    assert.equal(chosen, null); assert.equal(closed, false);
    await click('Choisir MiniMax H3');
    assert.equal(chosen, 'minimax-h3', 'a model with transferable setting adaptations still applies in one click');
    assert.equal(closed, true); assertNoConfirmation();
    assert.equal(dom.window.document.activeElement?.id, 'opener');

    context.options['minimax-h3'].disabledReason = 'Incompatible avec vos références';
    await open(); await click('Choisir MiniMax H3');
    assert.equal(chosen, null); assert.equal(closed, false);
    await click('Informations sur MiniMax H3');
    assert.equal(chosen, null); assert.equal(closed, false, 'information must not select a model');
    const blockedApply = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Utiliser MiniMax H3');
    assert.equal(blockedApply?.disabled, true);
    await click('Fermer le choix de modèle');
    delete context.options['minimax-h3'].disabledReason;

    const attempts: string[] = []; let accept = false;
    context.onApply = id => { attempts.push(id); return accept; };
    await open(); await click('Choisir MiniMax H3');
    assert.deepEqual(attempts, ['minimax-h3']); assert.equal(closed, false); assert.equal(chosen, null);
    assertNoConfirmation();
    accept = true; await click('Choisir MiniMax H3');
    assert.equal(closed, true); assert.equal(chosen, null, 'a contextual transaction never falls through to an unguarded model switch');

    attempts.length = 0; await open(); await click('Choisir Wan 3 Prime');
    assert.equal(closed, true); assert.deepEqual(attempts, [], 'clicking the unchanged current model simply closes');
    context.hasChanges = true; context.scenarioKey = 'duration-10';
    context.options['wan-3-prime'].changes = [{ label: 'Durée', before: '5 s', after: '10 s' }];
    await open(); await click('Choisir Wan 3 Prime');
    assert.deepEqual(attempts, ['wan-3-prime']); assert.equal(closed, true);
    assert.equal(dom.window.document.activeElement?.id, 'opener');

    context.hasChanges = false;
    await open(); await click('Informations sur MiniMax H3'); await click('Utiliser MiniMax H3');
    assert.equal(closed, true); assertNoConfirmation();
  } finally {
    await act(async () => root.unmount());
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
    dom.window.close();
  }
});
