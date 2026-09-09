import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { MediaActionPanel } from '../frontend/components/library/MediaActionPanel.client';

test('media inspector keeps actions with one original reader and restores focus', async () => {
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
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /aaaaa|signature|secret/);
    assert.equal(dom.window.document.querySelector('video'), null);
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>('button[aria-label="Lire la vidéo"]')!.click());
    assert.equal(dom.window.document.querySelectorAll('video').length, 1);
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('src'), original);
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('preload'), 'none');
    assert.equal(dom.window.document.querySelector('video')?.hasAttribute('autoplay'), true);
    assert.ok(dom.window.document.querySelector('[data-destination]'));
    await act(async () => [...dom.window.document.querySelectorAll('button')].find(button => button.textContent === 'Partager')!.click());
    assert.match(dom.window.document.body.textContent ?? '', /Copier le lien du média/);
    assert.ok(dom.window.document.querySelector('[data-destination]'));
    const second = 'https://private.example/second.mp4';
    await act(async () => root.render(React.createElement(MediaActionPanel, { asset: { id: 'second', url: second, kind: 'video' }, locale: 'fr', onClose: () => root.render(null) }, React.createElement('button', { 'data-destination': true }, 'Destination'))));
    assert.equal(dom.window.document.querySelector('video'), null);
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>('button[aria-label="Lire la vidéo"]')!.click());
    assert.equal(dom.window.document.querySelectorAll('video').length, 1);
    assert.equal(dom.window.document.querySelector('video')?.getAttribute('src'), second);
    const originalLink = dom.window.document.querySelector('a[aria-label="Ouvrir l’original"]');
    assert.equal(originalLink?.getAttribute('href'), second);
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Copier le lien du média/);
    await act(async () => dom.window.document.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')!.click());
    assert.equal(dom.window.document.activeElement, opener);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
