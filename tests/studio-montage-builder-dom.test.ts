import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

import { DEFAULT_STUDIO_COPY } from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-copy';

test('montage library retry keeps focus in the dialog so Escape returns to its trigger', async () => {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = {}; };
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio/projects', pretendToBeVisual: true });
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previousGlobals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.HTMLElement.prototype.getClientRects = function () {
    return [{ width: 10, height: 10 }] as unknown as DOMRectList;
  };
  Object.assign(dom.window.HTMLElement.prototype, { attachEvent() {}, detachEvent() {} });
  const previousFetch = globalThis.fetch;
  const requests: Array<ReturnType<typeof Promise.withResolvers<Response>>> = [];
  globalThis.fetch = async () => {
    const request = Promise.withResolvers<Response>();
    requests.push(request);
    return request.promise;
  };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch: async () => {} } as never;
  try {
    const { StudioMontageBuilder } = await import('../frontend/app/(core)/(workspace)/app/studio/projects/StudioMontageBuilder.client');
    await act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router },
      React.createElement(StudioMontageBuilder, { copy: DEFAULT_STUDIO_COPY.projects.montage, enabled: true }))));
    const trigger = dom.window.document.querySelector<HTMLButtonElement>('[data-studio-montage-open="true"]')!;
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 5)));
    assert.equal(requests.length, 1);
    await act(async () => requests[0].resolve(Response.json({ ok: false }, { status: 503 })));
    assert.ok(dom.window.document.querySelector('[data-studio-montage-validation-error="true"]'));
    const retry = dom.window.document.querySelector<HTMLButtonElement>('[data-studio-montage-library-retry="true"]')!;
    retry.focus();
    await act(async () => retry.click());
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 20)));
    assert.equal(requests.length, 2);
    await act(async () => requests[1].resolve(Response.json({ ok: true, assets: [], nextCursor: null })));
    await act(async () => new Promise((resolve) => dom.window.setTimeout(resolve, 20)));
    const dialog = dom.window.document.querySelector<HTMLElement>('[data-studio-montage-dialog="true"]')!;
    assert.ok(dialog.contains(dom.window.document.activeElement), 'retry completion should retain an event target inside the dialog');
    await act(async () => dom.window.document.activeElement?.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    ));
    assert.equal(dom.window.document.querySelector('[data-studio-montage-dialog="true"]'), null);
    assert.equal(dom.window.document.activeElement, trigger);
  } finally {
    globalThis.fetch = previousFetch;
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previousGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
    else delete require.extensions['.css'];
  }
});
