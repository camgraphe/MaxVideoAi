import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBillingCheckoutReturnToast } from '../frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast';
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
    assert.deepEqual(calls, []);
    assert.equal(new URL(window.location.href).searchParams.get('status'), 'success');

    await act(async () => root.render(React.createElement(Probe, { accountId: null, authLoading: false })));
    assert.deepEqual(calls, []);
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
    await act(async () => rootRender());
    async function rootRender() {
      const root = roots.root ?? createRoot(fixture.container);
      roots.root = root;
      root.render(React.createElement(Probe, { currency: 'USD' }));
    }
    for (let attempt = 0; attempt < 20 && observations.at(-1)?.quoteCurrencies[0] !== 'USD'; attempt += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    }
    assert.equal(observations.at(-1)?.quoteCurrencies[0], 'USD');

    const switchIndex = observations.length;
    await act(async () => roots.root!.render(React.createElement(Probe, { currency: 'EUR' })));
    const firstEuroRender = observations.slice(switchIndex).find((entry) => entry.currency === 'EUR');
    assert.deepEqual(firstEuroRender, { currency: 'EUR', quoteCurrencies: [], loading: true });
  } finally {
    if (roots.root) await act(async () => roots.root!.unmount());
    if (savedFetch) Object.defineProperty(globalThis, 'fetch', savedFetch);
    else delete (globalThis as Record<string, unknown>).fetch;
    fixture.restore();
  }
});

const roots: { root?: ReturnType<typeof createRoot> } = {};
