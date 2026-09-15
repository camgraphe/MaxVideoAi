import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { Stripe } from '@stripe/stripe-js';
import { useBillingCurrencyState } from '../frontend/app/(core)/billing/_hooks/useBillingCurrencyState';
import { useBillingTopupSelection } from '../frontend/app/(core)/billing/_hooks/useBillingTopupSelection';
import { useBillingTopupQuotes } from '../frontend/app/(core)/billing/_hooks/useBillingTopupQuotes';
import { WalletExpressCheckout } from '../frontend/app/(core)/billing/_components/WalletExpressCheckout';
import { DEFAULT_BILLING_COPY as copy } from '../frontend/app/(core)/billing/_lib/billing-copy';

test('editing a draft, refreshing auth and rotating CAPTCHA preserve the payable wallet element', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://billing.example.test' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: string[] = [];
  let mounts = 0;
  const stripePromise = Promise.resolve({ initCheckout() {
    const listeners: Record<string, (event: unknown) => void> = {};
    return {
      loadActions: async () => ({ type: 'success', actions: {} }),
      createExpressCheckoutElement: () => ({
        on: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; },
        mount: () => { mounts++; listeners.ready({ availablePaymentMethods: { applePay: true } }); },
        destroy() {},
      }),
    };
  } } as unknown as Stripe);
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon: () => true },
    fetch: async (url: string, options?: RequestInit) => {
      requests.push(url);
      if (url === '/api/me/currency') return Response.json({ ok: true, enabled: ['EUR', 'USD'], currency: 'EUR' });
      if (url === '/api/topup/quote') {
        const body = JSON.parse(String(options?.body));
        return Response.json({ ok: true, quotes: body.amounts.map((amount: number) => ({ usdAmountCents: amount, localAmountMinor: amount, currency: body.currency })) });
      }
      if (url === '/api/wallet') return Response.json({ id: 'cs_test', checkoutAttemptId: 1, clientSecret: 'secret_test', expiresAt: Date.now()/1000 + 1800 });
      throw new Error(`Unexpected request: ${url}`);
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let selection!: ReturnType<typeof useBillingTopupSelection>;
  const formatUsdAmount = (cents: number) => String(cents);
  function Probe({ token = 'auth-a', captchaToken = null }: { token?: string; captchaToken?: string | null }) {
    const session = React.useMemo(() => ({ user: { id: 'user-a' }, access_token: token }), [token]);
    const currency = useBillingCurrencyState({ session, authLoading: false, copy });
    selection = useBillingTopupSelection({ copy, formatUsdAmount });
    const quotes = useBillingTopupQuotes({
      session, authLoading: false, normalizedChargeCurrency: currency.normalizedChargeCurrency,
      selectedTopupCents: selection.selectedTopupCents,
      quoteErrorMessage: 'Quote failed',
    });
    return React.createElement(WalletExpressCheckout, {
      enabled: !currency.currencyLoading && !quotes.quoteLoading,
      amountCents: selection.selectedTopupCents, chargeCurrency: currency.normalizedChargeCurrency,
      session, captchaToken, locale: 'en', stripePromise, labels: copy.wallet,
      onCaptchaRequired() {}, onPaymentStarted() {}, onPaymentFailed() {},
    });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const settle = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 350)); }); };
  try {
    await act(async () => root.render(React.createElement(Probe)));
    await settle();
    assert.equal(mounts, 1);
    const initialRequests = requests.length;
    await act(async () => selection.onCustomAmountInputChange('35'));
    await settle();
    await act(async () => selection.onCustomAmountInputChange('36'));
    await settle();
    assert.equal(mounts, 1, 'typing an uncommitted amount must not reboot Apple Pay');
    assert.equal(requests.length, initialRequests, 'draft edits must not fetch quotes or create sessions');
    await act(async () => root.render(React.createElement(Probe, { token: 'auth-refreshed' })));
    await settle();
    assert.equal(mounts, 1, 'same-account auth refresh must not reboot Apple Pay');
    await act(async () => root.render(React.createElement(Probe, { token: 'auth-refreshed', captchaToken: 'captcha-fresh' })));
    await settle();
    await act(async () => root.render(React.createElement(Probe, { token: 'auth-refreshed', captchaToken: null })));
    await settle();
    assert.equal(mounts, 1, 'CAPTCHA renewal/expiry must not replace an already prepared session');
    await act(async () => selection.applyCustomAmount());
    await settle();
    assert.equal(mounts, 2, 'applying the new amount must prepare a matching payment');
    assert.equal(requests.filter(url => url === '/api/wallet').length, 2);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
