import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { Stripe } from '@stripe/stripe-js';
import { DEFAULT_BILLING_COPY } from '../frontend/app/(core)/billing/_lib/billing-copy';
import { WalletExpressCheckout } from '../frontend/app/(core)/billing/_components/WalletExpressCheckout';

test('slow wallets recover and deliberate retries reuse the same guarded session', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://billing.example.test' });
  const originals = ['window', 'document', 'navigator', 'React', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const timers = new Map<number, { delay: number; callback: () => void }>();
  let timerId = 0, requests = 0, tokensTaken = 0, confirmations = 0;
  let resolvePreparation: (response: Response) => void = () => {};
  let holdPreparation = true;
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    timers.set(++timerId, { delay, callback }); return timerId;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = (id: number) => { timers.delete(id); };
  const values = {
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon: () => true },
    fetch: async () => {
      requests++;
      if (holdPreparation) return new Promise<Response>(resolve => { resolvePreparation = resolve; });
      return response();
    },
  };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const response = () => Response.json({ id: 'cs_same_guarded_session', clientSecret: 'same-secret',
    checkoutAttemptId: 17, expiresAt: Date.now() / 1000 + 1800 });
  type Listener = (event?: any) => any;
  const elements: Array<{ listeners: Record<string, Listener>; destroyed: boolean }> = [];
  const stripe = {
    initCheckout({ clientSecret }: { clientSecret: string }) {
      assert.equal(clientSecret, 'same-secret');
      const element = { listeners: {} as Record<string, Listener>, destroyed: false };
      elements.push(element);
      return {
        loadActions: async () => ({ type: 'success', actions: { confirm: async () => {
          confirmations++; return { type: 'error', error: { message: 'Try another card.' } };
        } } }),
        createExpressCheckoutElement() { return {
          on(name: string, listener: Listener) { element.listeners[name] = listener; },
          mount() {}, destroy() { element.destroyed = true; },
        }; },
      };
    },
  } as unknown as Stripe;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const props = {
    enabled: true, amountCents: 1000, chargeCurrency: 'EUR', locale: 'en',
    session: { access_token: 'synthetic', user: { id: 'user-a' } },
    stripePromise: Promise.resolve(stripe), labels: DEFAULT_BILLING_COPY.wallet,
    takeCaptchaToken() { tokensTaken++; return null; },
    onCaptchaRequired() {}, onPaymentStarted() {}, onPaymentFailed() {},
  };
  const runTimer = async (delay: number) => {
    const timer = [...timers].find(([, entry]) => entry.delay === delay);
    assert.ok(timer, `expected ${delay} ms timer`);
    timers.delete(timer[0]);
    await React.act(async () => { timer[1].callback(); });
  };
  try {
    await React.act(async () => { root.render(React.createElement(WalletExpressCheckout, props)); });
    await runTimer(300);
    assert.equal(requests, 1);
    await runTimer(10_000);
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /Loading secure payment options/);
    const slowRetry = dom.window.document.querySelector('button')!;
    await React.act(async () => { slowRetry.click(); });
    await runTimer(300);
    assert.equal(requests, 1, 'retry during preparation must share the in-flight request');
    assert.equal(tokensTaken, 1);
    holdPreparation = false;
    await React.act(async () => { resolvePreparation(response()); });
    assert.equal(elements.length, 1, 'a slow preparation must still mount its original session');
    await React.act(async () => { elements[0].listeners.ready({ availablePaymentMethods: { googlePay: true } }); });
    assert.equal(elements[0].destroyed, false);
    assert.equal(dom.window.document.querySelector('[aria-label]')?.classList.contains('hidden'), false);
    assert.equal(requests, 1);

    await React.act(async () => { elements[0].listeners.loaderror({ error: { message: 'Connection interrupted.' } }); });
    const retry = [...dom.window.document.querySelectorAll('button')].find(button => /Try again/i.test(button.textContent ?? ''));
    assert.ok(retry, 'a wallet connection error must offer a deliberate retry');
    await React.act(async () => { retry.click(); });
    await runTimer(300);
    assert.equal(elements.length, 2);
    assert.equal(elements[0].destroyed, true);
    assert.equal(requests, 1, 'retry must not create a new payable session or reset card-failure limits');
    assert.equal(tokensTaken, 1, 'retrying a prepared session must not consume another CAPTCHA token');
    await runTimer(10_000);
    assert.equal(elements[1].destroyed, false, 'a loading timeout must not destroy the pending wallet');
    await React.act(async () => { elements[1].listeners.ready({ availablePaymentMethods: { applePay: true, link: true } }); });
    assert.doesNotMatch(dom.window.document.body.textContent ?? '', /taking longer|Connection interrupted/i);
    assert.equal(dom.window.document.querySelector('[aria-label]')?.classList.contains('hidden'), false);
    await React.act(async () => { await elements[1].listeners.confirm({ paymentFailed() {} }); });
    assert.equal(confirmations, 1, 'a recovered wallet must still accept a deliberate payment confirmation');
    assert.equal(requests, 1);
    let sdkReloads = 0;
    await React.act(async () => { root.render(React.createElement(WalletExpressCheckout, {
      ...props, stripePromise: Promise.resolve(null),
      onRetryConnection() {
        sdkReloads++;
        root.render(React.createElement(WalletExpressCheckout, props));
      },
    })); });
    await runTimer(300);
    const sdkRetry = dom.window.document.querySelector('button')!;
    assert.ok(sdkRetry, 'an initial SDK loading failure must be retryable');
    await React.act(async () => { sdkRetry.click(); });
    await runTimer(300);
    assert.equal(sdkReloads, 1);
    assert.equal(elements.length, 3, 'retry must initialize the newly loaded SDK');
    assert.equal(requests, 1, 'SDK recovery must preserve the prepared session');
    assert.equal(tokensTaken, 1);
    await React.act(async () => { elements[2].listeners.ready({ availablePaymentMethods: { googlePay: true } }); });
    assert.equal(dom.window.document.querySelector('[aria-label]')?.classList.contains('hidden'), false);
    await React.act(async () => { root.render(React.createElement(WalletExpressCheckout, { ...props, enabled: false })); });
    await React.act(async () => { elements[2].listeners.ready({ availablePaymentMethods: { applePay: true } }); });
    assert.equal(dom.window.document.getElementById('root')!.textContent, '', 'retired callbacks cannot restore wallets after hosted handoff');
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
