import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBillingCheckoutReturnToast } from '../frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast';
import { useBillingCheckoutReconciliation } from '../frontend/app/(core)/billing/_hooks/useBillingCheckoutReconciliation';
import { persistPendingWalletCheckoutReturn } from '../frontend/lib/wallet/checkout-return';
import { useBillingTopupQuotes } from '../frontend/app/(core)/billing/_hooks/useBillingTopupQuotes';

function installDom(url: string) {
  const dom = new JSDOM('<div id="root"></div>', { pretendToBeVisual: true, url });
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
  return {
    container: dom.window.document.getElementById('root')!,
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
      dom.window.close();
    },
  };
}

function response(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

test('a successful Checkout return waits for a resolved account before consuming the URL', async () => {
  const fixture = installDom('https://maxvideoai.test/billing?status=success&amountCents=2500');
  const root = createRoot(fixture.container);
  const calls: string[] = [];
  const callbacks = {
    cancelledMessage: 'cancelled',
    onAmountReturned: () => calls.push('amount'),
    onCancelled: () => calls.push('cancelled'),
    onGoogleAdsConversion: () => calls.push('conversion'),
    onReturnTarget: () => calls.push('target'),
    onStatus: () => calls.push('status'),
    onSuccess: () => calls.push('success'),
    onToast: () => calls.push('toast'),
    successMessage: 'success',
  };

  function Probe({ accountId, authLoading }: { accountId: string | null; authLoading: boolean }) {
    useBillingCheckoutReturnToast({ ...callbacks, accountId, authLoading });
    return null;
  }

  try {
    await act(async () => root.render(React.createElement(Probe, { accountId: null, authLoading: true })));
    assert.equal(calls.length, 0);
    assert.equal(new URL(window.location.href).searchParams.get('status'), 'success');

    await act(async () => root.render(React.createElement(Probe, { accountId: null, authLoading: false })));
    assert.equal(calls.length, 0);
    assert.equal(new URL(window.location.href).searchParams.get('status'), 'success');

    await act(async () => root.render(React.createElement(Probe, { accountId: 'account-a', authLoading: false })));
    assert.ok(calls.includes('success'));
    assert.equal(new URL(window.location.href).searchParams.has('status'), false);
  } finally {
    await act(async () => root.unmount());
    fixture.restore();
  }
});

test('the first render for a new quote identity never exposes the previous currency quote', async () => {
  const fixture = installDom('https://maxvideoai.test/billing');
  const savedFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const root = createRoot(fixture.container);
  const pendingEuro = new Promise<Response>(() => undefined);
  const fetchStub = (async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body ?? '{}')) as { currency?: string };
    if (request.currency === 'EUR') return pendingEuro;
    return response({
      ok: true,
      quotes: [{ usdAmountCents: 1000, localAmountMinor: 1000, currency: 'USD' }],
    });
  }) as typeof fetch;
  Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchStub });

  const observations: Array<{ currency: string; quoteCurrencies: string[]; loading: boolean }> = [];
  function Probe({ currency }: { currency: string }) {
    const state = useBillingTopupQuotes({
      authLoading: false,
      session: { access_token: 'token-a', user: { id: 'account-a' } },
      normalizedChargeCurrency: currency,
      customAmountCents: null,
      customAmountValid: false,
      quoteErrorMessage: 'quote failed',
    });
    observations.push({
      currency,
      quoteCurrencies: Object.values(state.topupQuotes).map((quote) => quote.currency),
      loading: state.quoteLoading,
    });
    return null;
  }

  try {
    await act(async () => root.render(React.createElement(Probe, { currency: 'USD' })));
    for (let attempt = 0; attempt < 20 && observations.at(-1)?.quoteCurrencies[0] !== 'USD'; attempt += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
    assert.equal(observations.at(-1)?.quoteCurrencies[0], 'USD');

    const switchIndex = observations.length;
    await act(async () => root.render(React.createElement(Probe, { currency: 'EUR' })));
    const firstEuroRender = observations.slice(switchIndex).find((entry) => entry.currency === 'EUR');
    assert.deepEqual(firstEuroRender, { currency: 'EUR', quoteCurrencies: [], loading: true });
  } finally {
    await act(async () => root.unmount());
    if (savedFetch) Object.defineProperty(globalThis, 'fetch', savedFetch);
    else delete (globalThis as Record<string, unknown>).fetch;
    fixture.restore();
  }
});


test('quote input identity masks every changed render and rejects late currency/account ABA results', async () => {
  const fixture = installDom('https://maxvideoai.test/billing');
  const savedFetch = globalThis.fetch;
  const requests: Array<{ body: { currency: string; amounts: number[] }; resolve: (body: unknown) => void }> = [];
  globalThis.fetch = (async (_url, init) => new Promise<Response>((resolve) => requests.push({
    body: JSON.parse(String(init?.body)), resolve: (body) => resolve(response(body)),
  }))) as typeof fetch;
  const root = createRoot(fixture.container);
  let state!: ReturnType<typeof useBillingTopupQuotes>;
  const observed: typeof state[] = [];
  function Probe({ account = 'A', currency = 'USD', amount = null, valid = false, pending = false }: {
    account?: string | null; currency?: string; amount?: number | null; valid?: boolean; pending?: boolean;
  }) {
    state = useBillingTopupQuotes({
      session: account ? { user: { id: account }, access_token: account } : null,
      authLoading: pending, normalizedChargeCurrency: currency,
      customAmountCents: amount, customAmountValid: valid, quoteErrorMessage: 'quote failed',
    });
    observed.push(state);
    return null;
  }
  const render = async (props: Parameters<typeof Probe>[0], shouldMask = true) => {
    const start = observed.length;
    await act(async () => root.render(React.createElement(Probe, props)));
    if (shouldMask) for (const item of observed.slice(start)) {
      assert.deepEqual(item.topupQuotes, {});
      assert.equal(item.quoteError, null);
      assert.equal(item.quoteLoading, props.account !== null && !props.pending);
    }
  };
  const resolve = async (index: number, amount = 1000) => {
    await act(async () => requests[index].resolve({ ok: true, quotes: [{
      usdAmountCents: 1000, localAmountMinor: amount, currency: requests[index].body.currency,
    }] }));
  };
  try {
    await render({});
    await resolve(0);
    await render({}, false); // Recreated session objects must not refetch the same input.
    assert.equal(requests.length, 1);
    await render({ currency: 'EUR' });
    await render({});
    await resolve(1, 860);
    assert.deepEqual(state.topupQuotes, {});
    await resolve(2, 1001);
    assert.equal(state.topupQuotes[1000]?.amountMinor, 1001);
    await render({ amount: 2500, valid: true });
    assert.equal(new Set(requests[3].body.amounts).size, requests[3].body.amounts.length);
    await resolve(3);
    await render({ amount: 3500, valid: true });
    await resolve(4);
    await render({ amount: 3500, valid: false });
    assert.equal(requests[5].body.amounts.includes(3500), false);
    await resolve(5);
    await render({ account: 'B' });
    await render({ account: 'A' });
    await resolve(6, 888);
    assert.deepEqual(state.topupQuotes, {});
    await resolve(7);
    await render({ pending: true });
    assert.equal(requests.length, 8);
    await render({});
    await render({ account: null });
    await resolve(8, 999);
    assert.deepEqual(state.topupQuotes, {});
    assert.equal(state.quoteLoading, false);
  } finally {
    await act(async () => root.unmount());
    globalThis.fetch = savedFetch;
    fixture.restore();
  }
});

test('actual success-return composition starts both bounded refresh rounds only after auth and preserves return payload once', async () => {
  const fixture = installDom('https://maxvideoai.test/billing?status=success&amount=25&amountCents=2500&currency=EUR&keep=yes#history');
  persistPendingWalletCheckoutReturn('/app');
  const root = createRoot(fixture.container);
  const calls: unknown[][] = [];
  let delayed: (() => void) | undefined;
  const savedTimeout = window.setTimeout;
  window.setTimeout = ((handler: () => void, timeout?: number) => {
    if (timeout === 1800) { delayed = handler; return 991; }
    return savedTimeout(handler, timeout);
  }) as typeof window.setTimeout;
  const refreshWallet = async () => { calls.push(['wallet']); return true; };
  const refreshReceipts = async () => { calls.push(['receipts']); return true; };
  let reconciliation!: ReturnType<typeof useBillingCheckoutReconciliation>;
  const callbacks = {
    cancelledMessage: 'cancelled', successMessage: 'refreshing account data',
    onAmountReturned: (amount: number | null) => { calls.push(['amount', amount]); },
    onCancelled: () => { calls.push(['cancelled']); },
    onGoogleAdsConversion: (amount?: number, currency?: string) => { calls.push(['conversion', amount, currency]); },
    onReturnTarget: (target: string | null) => { calls.push(['target', target]); },
    onStatus: (status: string) => { calls.push(['status', status]); },
    onToast: () => {},
  };
  function Probe({ accountId, authLoading }: { accountId: string | null; authLoading: boolean }) {
    reconciliation = useBillingCheckoutReconciliation({ accountId: authLoading ? null : accountId, refreshWallet, refreshReceipts });
    useBillingCheckoutReturnToast({ ...callbacks, accountId, authLoading, onSuccess: reconciliation.reconcile });
    return null;
  }
  const render = async (accountId: string | null, authLoading: boolean) => act(async () => root.render(
    React.createElement(React.StrictMode, null, React.createElement(Probe, { accountId, authLoading }))
  ));
  try {
    await render(null, true);
    await render(null, false);
    await render('A', true);
    assert.equal(calls.length, 0);
    assert.equal(new URL(window.location.href).searchParams.get('status'), 'success');
    await render('A', false);
    assert.equal(reconciliation.status, 'refreshing');
    assert.deepEqual(calls.filter(([name]) => name === 'wallet' || name === 'receipts'), [['wallet'], ['receipts']]);
    assert.ok(delayed);
    await act(async () => delayed!());
    assert.equal(reconciliation.status, 'refreshed');
    await render('A', false);
    assert.deepEqual(calls.filter(([name]) => name === 'wallet' || name === 'receipts'), [['wallet'], ['receipts'], ['wallet'], ['receipts']]);
    assert.deepEqual(calls.filter(([name]) => name === 'amount'), [['amount', 2500]]);
    assert.deepEqual(calls.filter(([name]) => name === 'conversion'), [['conversion', 25, 'EUR']]);
    assert.deepEqual(calls.filter(([name]) => name === 'target'), [['target', '/app']]);
    assert.equal(window.location.href, 'https://maxvideoai.test/billing?keep=yes#history');
    const oldReconcile = reconciliation.reconcile;
    await render('B', false);
    await render('A', false);
    const count = calls.length;
    await act(async () => oldReconcile());
    assert.equal(calls.length, count);
    assert.equal(reconciliation.status, 'idle');
    await act(async () => { void reconciliation.reconcile(); });
    const countBeforePending = calls.length;
    await render('A', true);
    await act(async () => delayed!());
    assert.equal(calls.length, countBeforePending);
    assert.equal(reconciliation.status, 'idle');
  } finally {
    await act(async () => root.unmount());
    window.setTimeout = savedTimeout;
    fixture.restore();
  }
});

test('cancelled returns clean up once while auth remains pending without starting reconciliation', async () => {
  const fixture = installDom('https://maxvideoai.test/billing?status=cancelled&amountCents=1000&currency=eur');
  persistPendingWalletCheckoutReturn('/app');
  const root = createRoot(fixture.container);
  const calls: unknown[][] = [];
  function Probe() {
    useBillingCheckoutReturnToast({
      accountId: null, authLoading: true, cancelledMessage: 'cancelled', successMessage: 'success',
      onAmountReturned: (amount) => { calls.push(['amount', amount]); },
      onCancelled: (amount, currency) => { calls.push(['cancelled', amount, currency]); },
      onGoogleAdsConversion: () => { calls.push(['conversion']); },
      onReturnTarget: (target) => { calls.push(['target', target]); },
      onStatus: () => {}, onToast: () => {}, onSuccess: () => { calls.push(['success']); },
    });
    return null;
  }
  try {
    await act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(Probe))));
    assert.deepEqual(calls, [['amount', 1000], ['target', null], ['cancelled', 1000, 'EUR']]);
    assert.equal(window.location.search, '');
    assert.equal(window.sessionStorage.getItem('mv-wallet-checkout-return'), null);
  } finally {
    await act(async () => root.unmount());
    fixture.restore();
  }
});
