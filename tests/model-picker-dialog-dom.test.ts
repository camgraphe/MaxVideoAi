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

test('dialog keeps selection provisional, confirms differences, searches closed families and restores focus', async () => {
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
  let chosen: string | null = null;
  let closed = false;
  const context: EnginePickerContext = { key: 'draft-a', scope: 'test-dialog', label: '5 s · 720p', mode: 't2v',
    options: Object.fromEntries(engines.map(engine => [engine.id, { summary: '5 s · 720p', changes: engine.id === 'minimax-h3' ? [{ label: 'Audio', before: 'Sans audio', after: 'Audio inclus' }] : [] }])) };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const render = () => root.render(React.createElement(EnginePickerDialog, { engines, engineId: 'wan-3-prime', mode: 't2v', locale: 'fr', registryMeta: null, context,
    onSelect: (id: string) => { chosen = id; }, onClose: () => { closed = true; } }));
  const click = async (name: string) => {
    const button = [...dom.window.document.querySelectorAll('button')].find(element => element.getAttribute('aria-label') === name || element.textContent?.trim() === name);
    assert.ok(button, `button ${name}`);
    await act(async () => button.click());
  };
  try {
    dom.window.document.getElementById('opener')!.focus();
    await act(async () => { render(); await new Promise(resolve => setTimeout(resolve, 20)); });
    await click('Choisir MiniMax H3');
    assert.equal(chosen, null);
    const scrollBody = dom.window.document.querySelector<HTMLElement>('.body')!;
    scrollBody.scrollTop = 180;
    await click('Utiliser MiniMax H3');
    assert.equal(scrollBody.scrollTop, 0, 'confirmation starts at the top so its back button remains visible on small screens');
    assert.match(dom.window.document.body.textContent ?? '', /Sans audio.*Audio inclus/s);
    assert.equal(chosen, null);
    await click('Revenir aux modèles');
    await click('Tous les modèles');
    const search = dom.window.document.querySelector('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')!.set!.call(search, 'kling');
      search.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.ok(dom.window.document.querySelector('[data-model-id="kling-o3-pro"]'));
    assert.match(dom.window.document.body.textContent ?? '', /1 modèle · 1 famille/);
    await click('Effacer la recherche');
    assert.equal(dom.window.document.activeElement, search);
    await click('Notre sélection');
    await click('Choisir MiniMax H3');
    await click('Utiliser MiniMax H3');
    context.key = 'changed-settings';
    await act(async () => render());
    assert.equal(chosen, null, 'external settings changes invalidate a pending confirmation');
    assert.ok(![...dom.window.document.querySelectorAll('button')].some(button => button.textContent === 'Confirmer les réglages'));
    await click('Informations sur MiniMax H3');
    await click('Utiliser MiniMax H3');
    assert.equal(chosen, null, 'detail use also requires confirmation');
    await click('Confirmer les réglages');
    assert.equal(chosen, 'minimax-h3');
    assert.equal(closed, true);
    await act(async () => root.unmount());
    assert.equal(dom.window.document.activeElement?.id, 'opener');
  } finally {
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
    dom.window.close();
  }
});
