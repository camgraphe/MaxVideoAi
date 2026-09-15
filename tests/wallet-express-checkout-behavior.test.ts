import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { Stripe } from '@stripe/stripe-js';
import { DEFAULT_BILLING_COPY } from '../frontend/app/(core)/billing/_lib/billing-copy';
import { WalletExpressCheckout } from '../frontend/app/(core)/billing/_components/WalletExpressCheckout';

test('native checkout settles selection, reuses sessions, handles retries and retires late callbacks', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://billing.example.test' });
  const globals = ['window', 'document', 'navigator', 'React', 'IS_REACT_ACT_ENVIRONMENT', 'fetch'];
  const originals = globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const events: string[] = [];
  const values = {
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon: () => true },
  };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const requests: number[] = [];
  let resolveLate: ((response: Response) => void) | null = null;
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (_url: unknown, options: RequestInit) => {
    const amount = JSON.parse(String(options.body)).amountCents;
    requests.push(amount);
    if (amount === 5000) return new Promise<Response>((resolve) => { resolveLate = resolve; });
    return Response.json({ id: `cs_${amount}`, clientSecret: `secret_${amount}`, checkoutAttemptId: amount, expiresAt: Date.now() / 1000 + 1800 });
  } });
  type Listener = (event?: any) => any;
  const elements: Array<{ listeners: Record<string, Listener>; destroyed: boolean }> = [];
  let confirmations = 0;
  let releaseConfirmation: (() => void) | null = null;
  const stripe = {
    initCheckout() {
      const element = { listeners: {} as Record<string, Listener>, destroyed: false };
      elements.push(element);
      return {
        loadActions: async () => ({ type: 'success', actions: {
          confirm: async () => {
            confirmations += 1;
            await new Promise<void>((resolve) => { releaseConfirmation = resolve; });
            return { type: 'error', error: { message: 'Choose another card.' } };
          },
        } }),
        createExpressCheckoutElement(options: { buttonHeight: number }) {
          assert.equal(options.buttonHeight, 50);
          return {
            on(name: string, listener: Listener) { element.listeners[name] = listener; },
            mount() { element.listeners.ready({ availablePaymentMethods: { applePay: true } }); },
            destroy() { element.destroyed = true; },
          };
        },
      };
    },
  } as unknown as Stripe;
  const root = createRoot(dom.window.document.getElementById('root')!);
  const props = {
    enabled: true, amountCents: 1000, chargeCurrency: 'EUR', locale: 'en',
    session: { access_token: 'test-token', user: { id: 'user-a' } },
    stripePromise: Promise.resolve(stripe), labels: DEFAULT_BILLING_COPY.wallet,
    onCaptchaRequired() { events.push('captcha'); },
    onPaymentStarted() { events.push('started'); },
    onPaymentFailed() { events.push('failed'); },
  };
  const render = async (amountCents: number, enabled = true) => {
    await React.act(async () => { root.render(React.createElement(WalletExpressCheckout, { ...props, amountCents, enabled })); });
  };
  const settle = async () => { await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); }); };
  try {
    await render(1000, false);
    await settle();
    assert.deepEqual(requests, [], 'currency detection must settle before a payable session is created');
    await render(1000);
    await render(2500);
    await settle();
    assert.deepEqual(requests, [2500], 'rapid selection changes must create only the final session');
    await render(1000);
    await settle();
    await render(2500);
    await settle();
    assert.deepEqual(requests, [2500, 1000], 'returning to a previous amount reuses its session');
    assert.equal(elements[0].destroyed, true);
    const active = elements.at(-1)!;
    const event = { paymentFailed() { events.push('sheet-failed'); } };
    let confirmation: Promise<void>;
    await React.act(async () => {
      confirmation = active.listeners.confirm(event);
      await active.listeners.confirm(event);
    });
    assert.equal(confirmations, 1, 'duplicate confirm events cannot submit twice');
    await React.act(async () => { releaseConfirmation!(); await confirmation!; });
    assert.deepEqual(events, ['started', 'sheet-failed', 'failed']);
    await React.act(async () => { active.listeners.cancel(); });
    assert.match(dom.window.document.body.textContent ?? '', /Payment window closed/);
    await React.act(async () => {
      confirmation = active.listeners.confirm(event);
    });
    assert.equal(confirmations, 2, 'a failed payment can be retried on the same session');
    await React.act(async () => { releaseConfirmation!(); await confirmation!; });
    assert.deepEqual(requests, [2500, 1000], 'a declined card must not create a fresh session and reset failure limits');

    await render(5000);
    await settle();
    await render(1000);
    await React.act(async () => { resolveLate!(Response.json({ captchaRequired: true }, { status: 403 })); });
    assert.equal(events.includes('captcha'), false, 'a retired amount request cannot open a security challenge');
    await settle();
    await React.act(async () => { elements.at(-1)!.listeners.ready({ availablePaymentMethods: null }); });
    assert.equal(dom.window.document.getElementById('root')!.firstElementChild?.hasAttribute('hidden'), true, 'devices without wallets should not show an empty payment panel');
  } finally {
    await React.act(async () => { root.unmount(); });
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
