import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { useModelPickerEstimates } from '../frontend/src/components/ui/engine-select/useModelPickerEstimates';
import { CUSTOMER_PRICING_REFRESH_EVENT } from '../frontend/lib/customer-tariff-revision';
import type { PickerEstimateRequest } from '../frontend/src/components/ui/engine-select/model-picker-types';

const require = createRequire(import.meta.url);
type Harness = {
  scope: string | null;
  requests: Record<string, PickerEstimateRequest>;
  visible: string[] | undefined;
  latest: ReturnType<typeof useModelPickerEstimates>;
  dom: JSDOM;
  render: () => Promise<void>;
  tick: () => Promise<void>;
};
async function withHarness(scope: string, run: (h: Harness) => Promise<void>) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = require('../frontend/node_modules/react-dom/client') as typeof import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  const h: Harness = { scope, requests: {}, visible: undefined, latest: null!, dom,
    render: async () => { await act(async () => root.render(React.createElement(Component))); },
    tick: async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 230)); }); },
  };
  function Component() {
    h.latest = useModelPickerEstimates(h.scope, h.requests, h.visible);
    return React.createElement('section', {}, Object.keys(h.requests).map(id =>
      React.createElement('output', { key: id, 'data-model': id }, h.latest.rows[id]?.quote?.amount ?? 'pending')));
  }
  try { await run(h); } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
  }
}

test('a visibility batch change keeps an already resolved model visible without reloading it', async () => {
  await withHarness('scroll-shared-row', async h => {
    const calls: string[] = [];
    const request = (id: string): PickerEstimateRequest => ({ key: id, load: async () => { calls.push(id); return { amount: 100, currency: 'USD' }; } });
    h.requests = { a: request('a'), b: request('b') };
    await h.render(); await h.tick();
    const b = h.dom.window.document.querySelector('[data-model="b"]');
    assert.equal(b?.textContent, '100');
    h.requests = { b: request('b'), c: request('c') };
    await h.render();
    assert.equal(h.dom.window.document.querySelector('[data-model="b"]'), b, 'the row stays mounted');
    assert.equal(b?.textContent, '100', 'scroll must not replace a resolved price with a loading label');
    await h.tick();
    h.requests = { a: request('a'), b: request('b') }; await h.render();
    assert.equal(h.latest.rows.a?.quote?.amount, 100, 'cached values are available before the debounce');
    await h.tick();
    assert.deepEqual(calls, ['a', 'b', 'c']);
  });
});

test('only visible models start quotes while resolved offscreen rows keep their prices during repeated scrolls', async () => {
  await withHarness('scroll-known-catalogue', async h => {
    const calls: string[] = [];
    h.requests = Object.fromEntries(['a', 'b'].map(id => [id, { key: id, load: async () => { calls.push(id); return { amount: 200, currency: 'USD' }; } }]));
    h.visible = ['a']; await h.render(); await h.tick();
    assert.deepEqual(calls, ['a'], 'hidden models must not generate catalogue-wide requests');
    h.visible = ['b']; await h.render();
    assert.equal(h.latest.rows.a?.quote?.amount, 200);
    await h.tick();
    for (const visible of [['a'], ['b'], ['a'], ['b']]) {
      h.visible = visible; await h.render();
      assert.equal(h.latest.rows.a?.quote?.amount, 200);
      assert.equal(h.latest.rows.b?.quote?.amount, 200);
      await h.tick();
    }
    assert.deepEqual(calls, ['a', 'b']);
  });
});

test('hidden model settings, account and tariff changes cannot expose prices from a previous context', async () => {
  await withHarness('scroll-context-a', async h => {
    let amount = 100, calls = 0;
    const request = (key: string): PickerEstimateRequest => ({ key, load: async () => { calls++; return { amount, currency: 'USD' }; } });
    h.requests = { a: request('duration-5') }; h.visible = ['a']; await h.render(); await h.tick();
    h.visible = []; await h.render();
    h.requests = { a: request('duration-10') }; await h.render();
    assert.equal(h.latest.rows.a?.quote, undefined, 'offscreen prices must also follow their exact request key');
    amount = 200; h.visible = ['a']; await h.render(); await h.tick();
    assert.equal(h.latest.rows.a?.quote?.amount, 200);
    h.scope = 'scroll-context-b'; await h.render();
    assert.equal(h.latest.rows.a?.quote, undefined);
    amount = 300; await h.tick();
    assert.equal(h.latest.rows.a?.quote?.amount, 300);
    await act(async () => h.dom.window.dispatchEvent(new h.dom.window.Event(CUSTOMER_PRICING_REFRESH_EVENT)));
    assert.equal(h.latest.rows.a?.quote, undefined);
    amount = 400; await h.tick();
    assert.equal(h.latest.rows.a?.quote?.amount, 400);
    assert.equal(calls, 4);
    h.scope = null; await h.render(); assert.deepEqual(h.latest.rows, {});
  });
});

test('returning after cache expiry refreshes the quote and an error cannot leave an old price frozen', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    await withHarness('scroll-expiring-price', async h => {
      let amount = 100, calls = 0, fail = false;
      h.requests = { a: { key: 'same-scenario', load: async () => { calls++; if (fail) throw new Error('offline'); return { amount, currency: 'USD' }; } } };
      h.visible = ['a']; await h.render(); await h.tick();
      h.visible = []; await h.render(); now += 60_001; amount = 200;
      h.visible = ['a']; await h.render(); await h.tick();
      assert.equal(h.latest.rows.a?.quote?.amount, 200); assert.equal(calls, 2);
      h.visible = []; await h.render(); now += 60_001; fail = true;
      h.visible = ['a']; await h.render(); await h.tick();
      assert.equal(h.latest.rows.a?.quote, undefined); assert.equal(h.latest.rows.a?.error, true);
      fail = false; amount = 300; await act(async () => h.latest.retry()); await h.tick();
      assert.equal(h.latest.rows.a?.quote?.amount, 300);
    });
  } finally { Date.now = originalNow; }
});
