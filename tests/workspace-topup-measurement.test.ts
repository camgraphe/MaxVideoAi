import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { WorkspaceTopUpModal } from '../frontend/app/(core)/(workspace)/app/_components/WorkspaceTopUpModal';
import { DEFAULT_WORKSPACE_COPY } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-copy';
import { useWorkspaceTopupPaymentQuote } from '../frontend/app/(core)/(workspace)/app/_hooks/useWorkspaceTopupPaymentQuote';
import { normalizeCheckoutInteractionEventPayload } from '../frontend/server/checkout-events';

type Event = { eventName: string; amountCents?: number; metadata: Record<string, unknown> };

function mountBrowser(fetcher?: typeof fetch) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/app', pretendToBeVisual: true });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const pending: Promise<Event>[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon(url: string, body: Blob) {
      assert.equal(url, '/api/checkout-events');
      pending.push(body.text().then(text => JSON.parse(text)));
      return true;
    } },
    ...(fetcher ? { fetch: fetcher } : {}),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  return {
    dom, root, events: () => Promise.all(pending),
    async cleanup() {
      await act(async () => root.unmount());
      dom.window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('only a visible settled payment review counts as a displayed quote, once per selection', async () => {
  const browser = mountBrowser();
  let visibility: DocumentVisibilityState = 'hidden';
  Object.defineProperty(browser.dom.window.document, 'visibilityState', { get: () => visibility });
  const props = {
    modal: { message: 'Add credits to continue.' }, copy: DEFAULT_WORKSPACE_COPY.topUp,
    currency: 'USD', chargeCurrency: 'EUR', topUpAmount: 1000,
    paymentAmountLabel: '€9.20' as string | null, quoteLoading: true, quoteError: false,
    isTopUpLoading: false, topUpError: null,
    checkoutCaptchaError: false, checkoutCaptchaRequired: false,
    checkoutCaptchaResetGeneration: 0, checkoutCaptchaToken: null,
    onCheckoutCaptchaError() {}, onCheckoutCaptchaToken() {}, onClose() {}, onSubmit() {},
    onSelectPresetAmount() {}, onCustomAmountChange() {},
  };
  const render = async (patch: Partial<typeof props> = {}) => {
    await act(async () => browser.root.render(React.createElement(WorkspaceTopUpModal, { ...props, ...patch })));
  };
  try {
    await render({ quoteLoading: false });
    assert.deepEqual(await browser.events(), [], 'a hidden tab is not a displayed review');
    visibility = 'visible';
    await act(async () => browser.dom.window.document.dispatchEvent(new browser.dom.window.Event('visibilitychange')));
    let events = await browser.events();
    assert.deepEqual(events.map(e => e.eventName), ['topup_review_opened', 'topup_quote_displayed']);
    assert.equal(events[1].amountCents, 1000);
    assert.equal(events[1].metadata.currency, 'EUR');
    assert.equal(events[1].metadata.source, 'workspace');
    assert.equal(events[1].metadata.tax_included, false);
    await render({ quoteLoading: false, isTopUpLoading: true });
    assert.equal((await browser.events()).length, 2, 'ordinary rerenders cannot inflate exposure');
    await render({ topUpAmount: 2500, quoteLoading: true });
    assert.equal((await browser.events()).length, 2, 'the previous label during loading is not a new quote');
    await render({ topUpAmount: 2500, quoteLoading: false, paymentAmountLabel: '€23.00' });
    events = await browser.events();
    assert.equal(events.at(-1)?.eventName, 'topup_quote_displayed');
    assert.equal(events.at(-1)?.amountCents, 2500);
    await render({ topUpAmount: 5000, quoteLoading: false, quoteError: true, paymentAmountLabel: null });
    assert.equal((await browser.events()).at(-1)?.eventName, 'topup_quote_fallback_displayed');
    await render({ quoteLoading: false });
    assert.equal((await browser.events()).length, 4, 'returning to a previously displayed amount is deduplicated');
    await act(async () => browser.root.render(null));
    await render({ quoteLoading: false });
    assert.deepEqual((await browser.events()).slice(-2).map(e => e.eventName), ['topup_review_opened', 'topup_quote_displayed']);
  } finally { await browser.cleanup(); }
});

test('currency and quote measurements distinguish failures and suppress superseded requests', async () => {
  let releaseLate!: (response: Response) => void;
  const late = new Promise<Response>(resolve => { releaseLate = resolve; });
  const browser = mountBrowser((async (url, options) => {
    if (url === '/api/me/currency') return Response.json({ ok: false }, { status: 503 });
    const { amounts } = JSON.parse(String(options?.body));
    if (amounts[0] === 1000) return late;
    if (amounts[0] === 5000) return Response.json({ ok: false }, { status: 503 });
    if (amounts[0] === 7500) return new Response('not json', { status: 200 });
    return Response.json({ ok: true, quotes: [{ usdAmountCents: 2500, currency: 'USD', localAmountMinor: 2500 }] });
  }) as typeof fetch);
  let result!: ReturnType<typeof useWorkspaceTopupPaymentQuote>;
  function Probe({ amountCents, enabled }: { amountCents: number; enabled: boolean }) {
    result = useWorkspaceTopupPaymentQuote({ amountCents, enabled, accessToken: 'test-token' });
    return null;
  }
  const render = async (amountCents: number, enabled = true) => {
    await act(async () => browser.root.render(React.createElement(Probe, { amountCents, enabled })));
  };
  try {
    await render(1000, false);
    assert.deepEqual(await browser.events(), []);
    await render(1000);
    await render(2500);
    await act(async () => releaseLate(Response.json({ ok: true, quotes: [{ usdAmountCents: 1000, currency: 'USD', localAmountMinor: 1000 }] })));
    assert.equal(result.paymentAmountMinor, 2500);
    let events = await browser.events();
    const currency = events.find(e => e.eventName === 'topup_currency_resolved');
    assert.equal(currency?.metadata.status, 'fallback');
    assert.equal(currency?.metadata.currency, 'USD');
    assert.equal(typeof currency?.metadata.latency_ms, 'number');
    const quotes = events.filter(e => e.eventName === 'topup_quote_resolved');
    assert.equal(quotes.length, 1, 'an aborted quote does not report success or failure');
    assert.equal(quotes[0].amountCents, 2500);
    assert.equal(quotes[0].metadata.status, 'ready');
    assert.equal(quotes[0].metadata.payment_amount_minor, 2500);
    assert.ok(Number(quotes[0].metadata.latency_ms) >= 0);
    assert.equal(events.some(e => e.eventName === 'topup_quote_displayed'), false, 'fetch completion alone is not display');
    await render(5000);
    assert.equal(result.quoteError, true);
    events = await browser.events();
    assert.equal(events.at(-1)?.eventName, 'topup_quote_resolved');
    assert.equal(events.at(-1)?.metadata.status, 'error');
    assert.equal(events.at(-1)?.metadata.failure_category, 'http');
    await render(7500);
    assert.equal(result.quoteError, true);
    assert.equal((await browser.events()).at(-1)?.metadata.failure_category, 'invalid_response');
  } finally { releaseLate(Response.json({})); await browser.cleanup(); }
});

test('the authenticated event endpoint accepts review measurements and still rejects unknown events', () => {
  for (const eventName of ['topup_review_opened', 'topup_currency_resolved', 'topup_quote_resolved', 'topup_quote_displayed', 'topup_quote_fallback_displayed']) {
    const payload = normalizeCheckoutInteractionEventPayload({
      eventName, mode: 'hosted', amountCents: 1000,
      metadata: { source: 'workspace', currency: 'EUR', latency_ms: 43, status: 'ready' },
    });
    assert.equal(payload?.eventName, eventName);
    assert.equal(payload?.metadata?.latency_ms, 43);
  }
  assert.equal(normalizeCheckoutInteractionEventPayload({ eventName: 'invented_event' }), null);
});
