import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { ConsentScriptGate } from '../frontend/components/legal/ConsentScriptGate';

test('stored consent cannot mount a script before the current policy version is known', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.com' });
  let resolveVersion!: (response: Response) => void;
  const version = new Promise<Response>(resolve => { resolveVersion = resolve; });
  const globals = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => version };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  const record = { version: 'old-policy', timestamp: 1, categories: { analytics: true, ads: true }, source: 'banner' };
  dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify(record))}; Path=/`;
  try {
    await act(async () => root.render(React.createElement(ConsentScriptGate, { categories: 'analytics' }, React.createElement('script', { src: 'https://tracker.example/script.js' }))));
    assert.equal(Boolean(dom.window.document.querySelector('script')), false, 'pending policy validation must not mount a tracker');
    await act(async () => { resolveVersion(new Response(JSON.stringify({ ok: true, version: 'current-policy' }))); await version; });
    assert.equal(Boolean(dom.window.document.querySelector('script')), false, 'expired policy authorization cannot enable a tracker');
    await act(async () => {
      const current = { ...record, version: 'current-policy' };
      dom.window.document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify(current))}; Path=/`;
      dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: current }));
    });
    assert.ok(dom.window.document.querySelector('script'), 'a new explicit choice enables the category');
    await act(async () => dom.window.dispatchEvent(new dom.window.CustomEvent('consent:updated', { detail: { ...record, version: 'current-policy', categories: { analytics: false, ads: false } } })));
    assert.equal(dom.window.document.querySelector('script'), null, 'withdrawal still unmounts the gated component');
  } finally {
    resolveVersion(new Response(JSON.stringify({ ok: true, version: 'current-policy' })));
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
