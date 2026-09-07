import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { MediaActionPanel } from '../frontend/components/library/MediaActionPanel.client';

test('media panel mounts its original player only for explicit enlarged preview and restores actions/focus', async () => {
  const dom = new JSDOM('<button id="opener">Actions</button><div id="root"></div>', { url: 'http://localhost', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  dom.window.HTMLElement.prototype.getClientRects = function () { return [{ width: 44, height: 44 }] as unknown as DOMRectList; };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const original = 'https://private.example/' + 'a'.repeat(64) + '.mp4?signature=secret';
  const opener = dom.window.document.getElementById('opener') as HTMLButtonElement;
  opener.focus();
  try {
    await act(async () => root.render(React.createElement(MediaActionPanel, { asset: { id: 'original', url: original, kind: 'video' }, locale: 'fr', onClose: () => root.render(null) }, React.createElement('button', { 'data-destination': true }, 'Destination'))));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
    assert.equal(dom.window.document.querySelector('video'), null);
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /aaaaa|signature|secret/);
    const preview = [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Aperçu')!;
    await act(async () => preview.click());
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('src'), original);
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('preload'), 'none');
    assert.ok(dom.window.document.querySelector('.app-media-panel.is-preview'));
    assert.equal(dom.window.document.querySelector('[data-destination]'), null);
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Retour')!.click());
    assert.equal(dom.window.document.querySelector('video'), null);
    assert.ok(dom.window.document.querySelector('[data-destination]'));
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Fermer')!.click());
    assert.equal(dom.window.document.activeElement, opener);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
