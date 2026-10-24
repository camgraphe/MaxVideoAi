import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '../frontend/lib/i18n/I18nProvider';
import { getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { KlingElementsBuilder, type KlingElementState } from '../frontend/components/KlingElementsBuilder';

test('References opts into subject builder and hydration preserves subjects and ordinary references', async () => {
  const require = createRequire(import.meta.url);
  const css = require.extensions['.css']; require.extensions['.css'] = () => {};
  const { Composer } = await import('../frontend/components/Composer');
  if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const removed: unknown[] = [];
  const retained = { id: 'frontal', kind: 'image' as const, name: 'retained.png', url: '/retained.png', previewUrl: '/retained.png', status: 'ready' as const };
  const empty: KlingElementState = { id: 'subject', frontal: null, video: null, references: [null, null, null] };
  const regular = { ...retained, size: 123, type: 'image/png' };
  const field = { id: 'image_urls', type: 'image' as const, label: 'Reference images', maxCount: 7 };
  const render = async (elements: KlingElementState[], hasSubjects: boolean, key = 'first') => act(async () => root.render(
    React.createElement(I18nProvider, { locale: 'en', dictionary: {}, fallback: {}, children: React.createElement(Composer, {
      key, density: 'workspace', engine: getBaseEngineIncludingHidden('kling-o3-pro')!, prompt: 'Keep @Element1', onPromptChange: () => {},
      price: null, currency: 'USD', isLoading: false, promptRequired: true, assetFields: [{ field, required: false }], assets: { image_urls: [regular] },
      onAssetRemove: (...args) => removed.push(args),
      subjectReferences: { hasSubjects, content: React.createElement(KlingElementsBuilder, { elements,
        onAddElement: () => {}, onRemoveElement: (...args) => removed.push(args), onAddAsset: () => {}, onRemoveAsset: (...args) => removed.push(args) }) },
    }) }),
  ));
  const doc = dom.window.document;
  const clickReferences = async () => act(async () => doc.querySelector<HTMLButtonElement>('[data-reference-command="collections"]')!.click());
  try {
    await render([empty], false);
    assert.equal(doc.querySelector('input[accept="image/*"]'), null, 'default empty subject slots stay hidden');
    assert.match(doc.querySelector('.app-reference-selected-summary')!.textContent!, /Image/);
    await clickReferences();
    const enable = [...doc.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button => button.querySelector('.app-reference-command-label')?.textContent === 'Kling subjects (optional)');
    assert.ok(enable, 'Kling-specific subjects are explicitly optional');
    const menuText = doc.querySelector('[role="dialog"]')!.textContent!;
    assert.ok(menuText.indexOf('Reference images') >= 0);
    assert.ok(menuText.indexOf('Reference images') < menuText.indexOf('Kling subjects (optional)'), 'ordinary references come before the optional Kling module');
    await act(async () => enable.click());
    assert.equal(doc.querySelector('[role="dialog"]'), null);
    assert.equal(doc.querySelectorAll('input[accept="image/*"]').length, 4);
    assert.equal(doc.querySelector('textarea')?.value, 'Keep @Element1');
    await render([{ ...empty, frontal: retained }], true, 'hydrated');
    assert.ok(doc.querySelector('img[alt="retained.png"]'), 'hydrated subjects are visible without opt-in');
    await clickReferences();
    const close = [...doc.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(button => button.textContent === 'Close')!;
    await act(async () => close.click());
    assert.ok(doc.querySelector('img[alt="retained.png"]'));
    assert.equal(doc.querySelector('textarea')?.value, 'Keep @Element1');
    assert.equal(doc.querySelectorAll('.app-reference-selected-item').length, 1);
    assert.deepEqual(removed, [], 'opening/closing References never removes subject or regular assets');
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
