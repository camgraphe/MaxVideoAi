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

test('visible quote lifecycle shares pending work, cancels queued work, and isolates account and tariff changes', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.com/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const { createRoot } = require('../frontend/node_modules/react-dom/client') as typeof import('react-dom/client');
  const root = createRoot(dom.window.document.getElementById('root')!);
  let pending: Array<(value: { amount: number; currency: string }) => void> = [];
  let calls = 0, scope = 'account-a', open = false;
  const options: Record<string, PickerEstimateRequest> = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [String(index), {
    key: `model-${index}`, load: () => { calls++; return new Promise(resolve => pending.push(resolve)); },
  }]));
  let latest!: ReturnType<typeof useModelPickerEstimates>;
  function Harness() { latest = useModelPickerEstimates(open ? scope : null, open ? options : {}); return null; }
  const render = () => act(async () => root.render(React.createElement(Harness)));
  const tick = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 230)); });
  const resolve = async (amount: number) => { const batch = pending; pending = []; await act(async () => batch.forEach(done => done({ amount, currency: 'USD' }))); };
  try {
    await render(); await tick(); assert.equal(calls, 0, 'closed picker performs no requests');
    open = true; await render(); open = false; await render(); await tick(); assert.equal(calls, 0, 'rapid close cancels debounce');
    open = true; await render(); await tick(); assert.equal(calls, 3);
    open = false; await render(); assert.equal(latest.rows['0'], undefined);
    open = true; await render(); await tick(); assert.equal(calls, 3, 'reopening shares the three active requests');
    assert.equal(latest.stats()?.queued, 3);
    await resolve(100); await resolve(100);
    assert.equal(calls, 6); assert.equal(Object.keys(latest.rows).length, 6);
    open = false; await render(); open = true; await render(); await tick();
    assert.equal(calls, 6, 'warm reopening uses the cache');
    scope = 'account-b'; await render(); assert.equal(Object.keys(latest.rows).length, 0);
    await tick(); assert.equal(calls, 9);
    await act(async () => dom.window.dispatchEvent(new dom.window.Event(CUSTOMER_PRICING_REFRESH_EVENT)));
    assert.equal(Object.keys(latest.rows).length, 0);
    await tick(); await resolve(9999);
    assert.equal(Object.keys(latest.rows).length, 0, 'late prior tariff prices remain hidden');
    await resolve(200); await resolve(200);
    assert.ok(Object.values(latest.rows).every(row => row.quote?.amount === 200));
    assert.equal(latest.stats()?.peakActive, 3);
  } finally {
    await act(async () => root.unmount());
    await resolve(100);
    dom.window.close();
    for (const [key, descriptor] of previous) descriptor ? Object.defineProperty(globalThis, key, descriptor) : Reflect.deleteProperty(globalThis, key);
  }
});
