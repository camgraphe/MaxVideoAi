import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useToolQuote } from '../frontend/src/components/tools/useToolQuote';

test('tool quotes invalidate before render, discard late responses and require a new quote after account round trips', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
  const requests: Array<{ resolve: (response: Response) => void; payload: unknown }> = [];
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, React, IS_REACT_ACT_ENVIRONMENT: true, fetch: async (_url: unknown, init?: RequestInit) => new Promise<Response>(resolve => requests.push({ resolve, payload: JSON.parse(String(init?.body)) })) };
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  let current!: ReturnType<typeof useToolQuote>;
  const renders: Array<{ account: string | null; source: string; ready: boolean }> = [];
  function Fixture({ account, source }: { account: string | null; source: string }) {
    current = useToolQuote(source ? { source } : null, account);
    renders.push({ account, source, ready: current.ready });
    return null;
  }
  const render = async (account: string | null, source: string) => act(async () => root.render(React.createElement(Fixture, { account, source })));
  const debounce = async () => act(async () => { await new Promise(resolve => setTimeout(resolve, 270)); });
  const reply = async (index: number, cents: number, currency = 'USD') => act(async () => requests[index].resolve(Response.json({ ok: true, quote: { totalCents: cents, currency } })));
  try {
    await render('a', 'one'); await debounce();
    assert.equal(current.ready, false);
    await reply(0, 12); assert.equal(current.quote?.totalCents, 12);
    const beforeChange = renders.length;
    await render('a', 'two');
    assert.ok(renders.slice(beforeChange).every(value => !value.ready), 'no stale quote during render');
    await debounce();
    await render('b', 'two'); await debounce();
    await reply(1, 99); assert.equal(current.ready, false, 'late source/account response ignored');
    await reply(2, 15); assert.equal(current.quote?.totalCents, 15);
    await render('a', 'one'); assert.equal(current.ready, false, 'returning to a source/account does not restore its old quote');
    await debounce(); await reply(3, 18); assert.equal(current.quote?.totalCents, 18);
    await act(async () => current.refresh()); assert.equal(current.ready, false);
    await debounce(); await reply(4, 20, 'invalid'); assert.equal(current.ready, false); assert.ok(current.error);
    await act(async () => current.refresh()); await debounce(); await reply(5, 20); assert.equal(current.ready, true);
    await render(null, 'one'); assert.equal(current.ready, false); assert.equal(current.quote, null);
    await render('a', ''); assert.equal(current.loading, false); assert.equal(current.ready, false);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
