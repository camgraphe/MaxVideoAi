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
