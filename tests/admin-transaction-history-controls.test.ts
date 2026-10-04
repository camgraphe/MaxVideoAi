import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
test('history filter changes discard the cursor and pending navigation locks controls', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/admin/transactions' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    self:dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const urls: string[] = [];
  try {
    const { TransactionHistoryControls } = await import(
      '../frontend/components/admin/transactions/TransactionHistoryControls'
    );
    const props = {
      filters: { period: 'all' as const, type: 'all' as const, query: 'archive', cursor: 'old', limit: 50 },
      nextCursor: 'next',
      pending: false,
      onNavigate: (url: string) => urls.push(url),
      onRefresh: () => {},
    };
    await act(async () => root.render(React.createElement(TransactionHistoryControls, props)));
    const button = (name: string) =>
      [...dom.window.document.querySelectorAll('button')].find((el) => el.textContent === name)!;
    await act(async () => button('Refunds').click());
    assert.equal(new URL(urls[0], 'http://localhost').searchParams.get('cursor'), null);
    assert.equal(new URL(urls[0], 'http://localhost').searchParams.get('type'), 'refund');
    await act(async () => button('Next page').click());
    assert.equal(new URL(urls[1], 'http://localhost').searchParams.get('cursor'), 'next');
    const period = dom.window.document.querySelector<HTMLSelectElement>('select[aria-label="Transaction period"]')!;
    await act(async () => {
      period.value = 'today';
      period.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(new URL(urls[2], 'http://localhost').searchParams.get('period'), 'today');
    assert.equal(new URL(urls[2], 'http://localhost').searchParams.get('cursor'), null);
    await act(async () => root.render(React.createElement(TransactionHistoryControls, { ...props, pending: true })));
    assert.equal(button('Search').disabled, true);
    assert.equal(button('Next page').disabled, true);
    assert.equal(button('Refunds').disabled, true);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, value] of previous) {
      if (value) Object.defineProperty(globalThis, key, value);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
