import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBillingReceipts } from '../frontend/app/(core)/billing/_hooks/useBillingReceipts';
import { useBillingSessionState } from '../frontend/app/(core)/billing/_hooks/useBillingSessionState';
import type { BillingSession } from '../frontend/app/(core)/billing/_lib/billing-types';

function response(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

test('the first render for a new account never exposes the previous wallet or receipt owner', async () => {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url: 'https://maxvideoai.test/billing' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Blob: dom.window.Blob,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  const pendingAccountB = new Promise<Response>(() => undefined);
  const fetchStub = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get('authorization');
    if (url === '/api/stripe-mode') return response({ mode: 'test' });
    if (authorization === 'Bearer token-b') return pendingAccountB;
    if (url === '/api/wallet') {
      return response({ balance: 123, currency: 'USD', hasCompletedTopUp: true });
    }
    if (url.startsWith('/api/receipts')) {
      return response({
        ok: true,
        receipts: [{
          id: 1,
          type: 'topup',
          amount_cents: 12300,
          currency: 'USD',
          description: 'private-A-receipt',
          created_at: '2026-09-08T00:00:00.000Z',
          job_id: null,
          tax_amount_cents: null,
          discount_amount_cents: null,
        }],
        nextCursor: null,
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
  saved.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchStub });

  const observations: Array<{ accountId: string; balance: number | null; descriptions: string[] }> = [];
  const onDetectedCurrency = () => undefined;

  function Probe({ session }: { session: BillingSession }) {
    const walletState = useBillingSessionState({ authLoading: false, session, onDetectedCurrency });
    const receiptState = useBillingReceipts({
      authLoading: false,
      session,
      loadReceiptsError: 'load failed',
      loadMoreError: 'load more failed',
    });
    observations.push({
      accountId: session?.user?.id ?? 'none',
      balance: walletState.wallet?.balance ?? null,
      descriptions: receiptState.visibleReceipts.map((item) => item.description ?? ''),
    });
    return React.createElement('output', null, JSON.stringify(observations.at(-1)));
  }

  const accountA = { access_token: 'token-a', user: { id: 'account-a' } };
  const accountB = { access_token: 'token-b', user: { id: 'account-b' } };
  const root = createRoot(dom.window.document.getElementById('root')!);
  const flush = async () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

  try {
    await act(async () => root.render(React.createElement(Probe, { session: accountA })));
    for (let attempt = 0; attempt < 20 && observations.at(-1)?.balance !== 123; attempt += 1) {
      await flush();
    }
    assert.deepEqual(observations.at(-1), {
      accountId: 'account-a',
      balance: 123,
      descriptions: ['private-A-receipt'],
    });

    const switchIndex = observations.length;
    await act(async () => root.render(React.createElement(Probe, { session: accountB })));
    const firstAccountBRender = observations.slice(switchIndex).find((entry) => entry.accountId === 'account-b');
    assert.deepEqual(firstAccountBRender, {
      accountId: 'account-b',
      balance: null,
      descriptions: [],
    });
  } finally {
    await act(async () => root.unmount());
    Object.entries(Object.fromEntries(saved)).forEach(([key, descriptor]) => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    });
    dom.window.close();
  }
});

test('wallet and receipts retain same-owner refresh data but retire pending-auth, ABA and unmounted callbacks', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/billing' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ url: string; resolve: (body: unknown) => void }> = [];
  let exports = 0;
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: (url: string) => url === '/api/stripe-mode' ? Promise.resolve(response({ mode: 'test' }))
      : new Promise<Response>((resolve) => requests.push({ url, resolve: (body) => resolve(response(body)) })),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const savedCreateURL = URL.createObjectURL;
  URL.createObjectURL = () => { exports += 1; return 'blob:local-test'; };
  const root = createRoot(dom.window.document.getElementById('root')!);
  let current!: ReturnType<typeof useBillingSessionState> & ReturnType<typeof useBillingReceipts>;
  const observations: typeof current[] = [];
  const detected: string[] = [];
  const onDetectedCurrency = (currency: string) => { detected.push(currency); };
  function Probe({ accountId, authLoading }: { accountId: string | null; authLoading: boolean }) {
    const session = accountId ? { user: { id: accountId }, access_token: accountId } : null;
    current = {
      ...useBillingSessionState({ session, authLoading, onDetectedCurrency }),
      ...useBillingReceipts({ session, authLoading, loadReceiptsError: 'private error', loadMoreError: 'more failed' }),
    };
    observations.push(current);
    return null;
  }
  const render = async (accountId: string | null, authLoading = false) => {
    const start = observations.length;
    await act(async () => root.render(React.createElement(Probe, { accountId, authLoading })));
    return observations.slice(start);
  };
  const settle = async (start: number, balance: number, nextCursor: string | null = 'next-private') => {
    await act(async () => {
      for (const request of requests.slice(start)) request.resolve(request.url === '/api/wallet'
        ? { balance, currency: 'USD', settlementCurrency: 'EUR', hasCompletedTopUp: true }
        : { ok: true, receipts: [{ id: balance, description: `private-${balance}` }], nextCursor });
    });
  };
  const assertMasked = (values: typeof observations, loading = false) => {
    assert.ok(values.length > 0);
    for (const value of values) {
      assert.equal(value.wallet, null);
      assert.equal(value.walletError, null);
      assert.equal(value.walletStatus, loading ? 'loading' : 'idle');
      assert.deepEqual(value.receipts, { items: [], nextCursor: null, loading, error: null });
      assert.deepEqual(value.visibleReceipts, []);
    }
  };
  try {
    await render('A');
    await settle(0, 123);
    const originalA = current;
    assert.equal(current.wallet?.balance, 123);
    let refresh!: Promise<boolean[]>;
    const refreshStart = requests.length;
    await act(async () => { refresh = Promise.all([current.refreshWallet(), current.refreshReceipts()]); });
    assert.equal(current.wallet?.balance, 123);
    assert.equal(current.walletStatus, 'refreshing');
    assert.equal(current.receipts.items[0]?.id, 123);
    assert.equal(current.receipts.loading, true);
    await settle(refreshStart, 124);
    assert.deepEqual(await refresh, [true, true]);

    const supersededStart = requests.length;
    await act(async () => { void current.refreshWallet(); void current.refreshReceipts(); });
    const newestStart = requests.length;
    await act(async () => { void current.refreshWallet(); void current.refreshReceipts(); });
    await settle(newestStart, 124);
    await act(async () => requests.slice(supersededStart, newestStart).forEach((request) => request.resolve(
      request.url === '/api/wallet' ? { balance: 999 } : { ok: true, receipts: [{ id: 999 }], nextCursor: 'stale' }
    )));
    assert.equal(current.wallet?.balance, 124);
    assert.equal(current.receipts.items[0]?.id, 124);

    const errorStart = requests.length;
    await act(async () => { void current.refreshWallet(); void current.refreshReceipts(); });
    await act(async () => requests.slice(errorStart).forEach((request) => request.resolve({ error: 'private error' })));
    assert.equal(current.walletStatus, 'error');
    assert.equal(current.receipts.error, 'private error');
    assert.equal(current.wallet?.balance, 124);
    assert.equal(current.receipts.items[0]?.id, 124);

    const lateStart = requests.length;
    await act(async () => { void current.refreshWallet(); void current.loadMoreReceipts(); });
    assertMasked(await render('A', true));
    const retired = requests.length;
    await act(async () => {
      assert.equal(await originalA.refreshWallet(), false);
      assert.equal(await originalA.refreshReceipts(), false);
      await originalA.loadMoreReceipts();
      originalA.exportCSV();
    });
    assert.equal(requests.length, retired);
    assert.equal(exports, 0);
    const detectedBeforeLate = detected.length;
    await settle(lateStart, 999);
    assert.equal(detected.length, detectedBeforeLate);
    assertMasked([current]);

    const resumed = requests.length;
    assertMasked(await render('A'), true);
    await settle(resumed, 125);
    const beforeB = requests.length;
    assertMasked(await render('B'), true);
    const staleB = current;
    const beforeA = requests.length;
    assertMasked(await render('A'), true);
    // Resolve B after returning to A; the new A requests remain pending.
    await act(async () => requests.slice(beforeB, beforeA).forEach((request) => request.resolve(
      request.url === '/api/wallet' ? { balance: 888 } : { ok: true, receipts: [{ id: 888 }], nextCursor: 'B' }
    )));
    assertMasked([current], true);
    const beforeStaleCallbacks = requests.length;
    await act(async () => {
      await originalA.refreshWallet(); await originalA.refreshReceipts(); await originalA.loadMoreReceipts();
      await staleB.refreshWallet(); await staleB.refreshReceipts(); originalA.exportCSV();
    });
    assert.equal(requests.length, beforeStaleCallbacks);
    await settle(beforeA, 126);
    assert.equal(current.wallet?.balance, 126);
    const beforeLogout = current;
    assertMasked(await render(null));
    await act(async () => { await beforeLogout.refreshWallet(); await beforeLogout.refreshReceipts(); beforeLogout.exportCSV(); });
    assert.equal(requests.length, beforeStaleCallbacks);
    assert.equal(exports, 0);
    const unmountedStart = requests.length;
    await render('A');
    const atUnmount = current;
    await act(async () => root.unmount());
    const detectedAtUnmount = detected.length;
    await settle(unmountedStart, 777);
    assert.equal(detected.length, detectedAtUnmount);
    const requestCountAtUnmount = requests.length;
    await atUnmount.refreshWallet(); await atUnmount.refreshReceipts(); await atUnmount.loadMoreReceipts();
    atUnmount.exportCSV();
    assert.equal(requests.length, requestCountAtUnmount);
    assert.equal(exports, 0);
  } finally {
    await act(async () => root.unmount());
    URL.createObjectURL = savedCreateURL;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
    dom.window.close();
  }
});
