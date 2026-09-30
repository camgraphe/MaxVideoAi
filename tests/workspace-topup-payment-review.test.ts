import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { WorkspaceTopUpModal } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal';
import { DEFAULT_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-copy';
import { useWorkspacePricingGate } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspacePricingGate';

test('workspace top-up reviews credits and the local payment quote before checkout', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  const baseProps = {
    modal: { message: 'Add credits to continue.' },
    copy: DEFAULT_WORKSPACE_COPY.topUp,
    currency: 'USD',
    topUpAmount: 2500,
    isTopUpLoading: false,
    topUpError: null,
    checkoutCaptchaError: false,
    checkoutCaptchaRequired: false,
    checkoutCaptchaResetGeneration: 0,
    checkoutCaptchaToken: null,
    onCheckoutCaptchaError() {},
    onCheckoutCaptchaToken() {},
    onClose() {},
    onSubmit() {},
    onSelectPresetAmount() {},
    onCustomAmountChange() {},
  };
  try {
    await act(async () => root.render(React.createElement(WorkspaceTopUpModal, {
      ...baseProps,
      paymentAmountLabel: '€23.40',
      quoteLoading: false,
      quoteError: false,
    })));
    const content = dom.window.document.body.textContent ?? '';
    assert.match(content, /Credits received/);
    assert.match(content, /\$25\.00/);
    assert.match(content, /Amount before tax/);
    assert.match(content, /€23\.40/);
    assert.match(content, /Tax may be added\. Stripe shows the final total/i);

    await act(async () => root.render(React.createElement(WorkspaceTopUpModal, {
      ...baseProps,
      paymentAmountLabel: null,
      quoteLoading: true,
      quoteError: false,
    })));
    const submit = dom.window.document.querySelector<HTMLButtonElement>('button[type="submit"]');
    assert.equal(submit?.disabled, true, 'checkout should wait until the displayed quote has settled');

    await act(async () => root.render(React.createElement(WorkspaceTopUpModal, {
      ...baseProps,
      paymentAmountLabel: null,
      quoteLoading: false,
      quoteError: true,
    })));
    assert.match(dom.window.document.body.textContent ?? '', /Shown by Stripe before payment/);
    assert.equal(dom.window.document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled, false);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});

test('workspace top-up uses the preferred charge currency and a fresh quote for the selected credits', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const quoteRequests: Array<{ currency: string; amounts: number[] }> = [];
  let checkoutRequests = 0;
  let releaseFirstQuote!: () => void;
  const firstQuoteGate = new Promise<void>(resolve => { releaseFirstQuote = resolve; });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    React,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async (url: string, options?: RequestInit) => {
      if (url === '/api/me/currency') {
        return Response.json({ ok: true, currency: 'EUR', enabled: ['EUR', 'USD'] });
      }
      if (url === '/api/topup/quote') {
        const body = JSON.parse(String(options?.body)) as { currency: string; amounts: number[] };
        quoteRequests.push(body);
        if (body.amounts[0] === 5000) return Response.json({ ok: false }, { status: 503 });
        if (body.amounts[0] === 1000) await firstQuoteGate;
        return Response.json({ ok: true, quotes: body.amounts.map(amount => ({
          usdAmountCents: amount,
          localAmountMinor: Math.round(amount * 0.92),
          currency: body.currency,
        })) });
      }
      if (url === '/api/wallet') {
        checkoutRequests++;
        return Response.json({ error: 'test checkout should not start yet' }, { status: 400 });
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  let pricing!: ReturnType<typeof useWorkspacePricingGate>;
  function Probe() {
    pricing = useWorkspacePricingGate({
      accessToken: 'test-token',
      locale: 'en',
      topUpCopy: DEFAULT_WORKSPACE_COPY.topUp,
      form: null,
      selectedEngine: null,
      authChecked: true,
      memberTier: 'Member',
      setMemberTier() {},
      supportsAudioToggle: false,
      effectiveDurationSec: 5,
      voiceControlEnabled: false,
      submissionMode: 'text-to-video',
      inputAssets: {},
    });
    return null;
  }
  const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); };
  try {
    await act(async () => root.render(React.createElement(Probe)));
    await act(async () => pricing.setTopUpModal({ message: 'Add credits to continue.' }));
    assert.equal(pricing.topUpQuoteLoading, true);
    await act(async () => pricing.handleTopUpSubmit({ preventDefault() {} } as never));
    assert.equal(checkoutRequests, 0, 'checkout must not start while the displayed amount is loading');
    releaseFirstQuote();
    await settle();
    assert.equal(pricing.topUpChargeCurrency, 'EUR');
    assert.equal(pricing.topUpPaymentAmountMinor, 920);
    assert.equal(pricing.topUpQuoteLoading, false);
    assert.deepEqual(quoteRequests[0], { currency: 'EUR', amounts: [1000] });

    await act(async () => pricing.handleSelectPresetAmount(2500));
    await settle();
    assert.equal(pricing.topUpPaymentAmountMinor, 2300);
    assert.deepEqual(quoteRequests.at(-1), { currency: 'EUR', amounts: [2500] });

    await act(async () => pricing.handleSelectPresetAmount(5000));
    await settle();
    assert.equal(pricing.topUpPaymentAmountMinor, null);
    assert.equal(pricing.topUpQuoteError, true, 'Stripe remains the fallback when the preview is unavailable');
  } finally {
    releaseFirstQuote();
    await act(async () => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
