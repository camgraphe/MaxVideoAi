import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';

async function mountEntry(locale = 'en') {
  const require = createRequire(import.meta.url);
  const previousCssLoader = require.extensions['.css'];
  require.extensions['.css'] = (module) => { module.exports = {}; };
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/app/studio/projects', pretendToBeVisual: true });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, React, IS_REACT_ACT_ENVIRONMENT: true };
  const previousGlobals = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  const previousFetch = globalThis.fetch;
  const requests: Array<{ input: unknown; init: RequestInit; pending: ReturnType<typeof Promise.withResolvers<Response>> }> = [];
  globalThis.fetch = async (input, init) => {
    const pending = Promise.withResolvers<Response>();
    requests.push({ input, init: init ?? {}, pending });
    return pending.promise;
  };
  const destinations: string[] = [];
  const router = { back() {}, forward() {}, refresh() {}, push(url: string) { destinations.push(url); }, replace() {}, prefetch: async () => {} } as never;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const { StudioConversationEntry } = await import('../frontend/app/(core)/(workspace)/app/studio/projects/StudioConversationEntry.client');
  const render = async (nextLocale: string) => act(async () => root.render(React.createElement(AppRouterContext.Provider, { value: router }, React.createElement(StudioConversationEntry, { locale: nextLocale }))));
  await render(locale);
  return {
    dom, requests, destinations, render,
    get button() { return dom.window.document.querySelector<HTMLButtonElement>('button')!; },
    async close() {
      await act(async () => root.unmount());
      globalThis.fetch = previousFetch;
      dom.window.close();
      for (const [key, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      if (previousCssLoader) require.extensions['.css'] = previousCssLoader;
      else delete require.extensions['.css'];
    },
  };
}

test('rapid entry clicks create once, wait for the server receipt and navigate to the connected project', async () => {
  const view = await mountEntry();
  try {
    assert.equal(view.requests.length, 0, 'mounting must never create a project');
    await act(async () => { view.button.click(); view.button.click(); });
    assert.equal(view.requests.length, 1);
    assert.equal(view.button.disabled, true);
    assert.deepEqual(view.destinations, []);
    const request = view.requests[0];
    assert.equal(request.input, '/api/studio/conversation-projects');
    assert.equal(request.init.method, 'POST');
    const business = JSON.parse(String(request.init.body));
    assert.equal(business.name, 'Untitled project');
    assert.equal(typeof business.idempotencyKey, 'string');
    assert.ok(business.idempotencyKey.length > 10);
    await act(async () => request.pending.resolve(Response.json({ ok: true, result: { projectId: 'project_accepted', sequenceId: 'sequence_a', revision: 0 } })));
    assert.deepEqual(view.destinations, ['/app/studio/conversation/project_accepted']);
    assert.equal(view.button.disabled, true, 'navigation must not permit another creation');
    assert.equal(view.dom.window.localStorage.length, 0, 'creation must not fabricate a local project');
  } finally { await view.close(); }
});

test('lost creation acknowledgement retries the identical command even if the locale changes', async () => {
  const view = await mountEntry();
  try {
    await act(async () => view.button.click());
    const initialBody = view.requests[0].init.body;
    await act(async () => view.requests[0].pending.reject(new TypeError('Connection lost after commit')));
    assert.equal(view.button.disabled, false);
    assert.ok(view.dom.window.document.querySelector('[role="alert"]'));
    assert.deepEqual(view.destinations, []);
    assert.equal(view.dom.window.localStorage.length, 0);
    await view.render('fr');
    await act(async () => view.button.click());
    assert.equal(view.requests.length, 2);
    assert.equal(view.requests[1].init.body, initialBody, 'a translated default name must not conflict with the original receipt');
    await act(async () => view.requests[1].pending.resolve(Response.json({ ok: true, result: { projectId: 'project_original', sequenceId: 'sequence_a', revision: 0 } })));
    assert.deepEqual(view.destinations, ['/app/studio/conversation/project_original']);
  } finally { await view.close(); }
});

test('unauthorized and malformed responses never navigate or claim success and retry retains identity', async () => {
  const view = await mountEntry('fr');
  try {
    await act(async () => view.button.click());
    assert.equal(JSON.parse(String(view.requests[0].init.body)).name, 'Projet sans titre');
    await act(async () => view.requests[0].pending.resolve(Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })));
    assert.match(view.dom.window.document.querySelector('[role="alert"]')!.textContent ?? '', /connect/i);
    assert.equal(view.button.disabled, false);
    await act(async () => view.button.click());
    await act(async () => view.requests[1].pending.resolve(Response.json({ ok: true, result: { projectId: '' } })));
    assert.equal(view.button.disabled, false);
    assert.ok(view.dom.window.document.querySelector('[role="alert"]'));
    assert.deepEqual(view.destinations, []);
    assert.equal(view.requests[1].init.body, view.requests[0].init.body);
  } finally { await view.close(); }
});
