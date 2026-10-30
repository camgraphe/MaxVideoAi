import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { Stripe } from '@stripe/stripe-js';
import { WalletExpressCheckout } from '../frontend/app/(core)/billing/_components/WalletExpressCheckout';
import { DEFAULT_BILLING_COPY } from '../frontend/app/(core)/billing/_lib/billing-copy';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const prepared = (name: string) => Response.json({ id: `cs_${name}`, clientSecret: `secret_${name}`,
  checkoutAttemptId: 17, expiresAt: Date.now() / 1000 + 1800 });
type Listener = (event?: { error?: { message: string }; availablePaymentMethods?: Record<string, boolean> }) => void;
type Request = { body: Record<string, unknown>; headers: Record<string, string>; signal: AbortSignal | null | undefined };

async function fixture(respond: (request: Request, index: number) => Promise<Response> | Response) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://billing.example.test/' });
  const saved = ['window', 'document', 'navigator', 'React', 'IS_REACT_ACT_ENVIRONMENT', 'fetch']
    .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const timers = new Map<number, { at: number; callback: () => void }>();
  const requests: Request[] = [];
  const elements: Array<{ secret: string; listeners: Record<string, Listener>; destroyed: boolean }> = [];
  let now = 0, timerId = 0, tokensTaken = 0, challenges = 0, payments = 0;
  let captcha: string | null = 'captcha-first';
  dom.window.setTimeout = ((callback: () => void, delay: number) => {
    const id = ++timerId; timers.set(id, { at: now + delay, callback }); return id;
  }) as typeof dom.window.setTimeout;
  dom.window.clearTimeout = id => { timers.delete(id); };
  const stripe = { initCheckout({ clientSecret }: { clientSecret: string }) {
    const element = { secret: clientSecret, listeners: {} as Record<string, Listener>, destroyed: false };
    elements.push(element);
    return {
      loadActions: async () => ({ type: 'success', actions: { confirm: async () => { payments++; throw new Error('No test payment allowed'); } } }),
      createExpressCheckoutElement: () => ({
        on(name: string, listener: Listener) { element.listeners[name] = listener; },
        mount() { element.listeners.ready({ availablePaymentMethods: { applePay: true } }); },
        destroy() { element.destroyed = true; },
      }),
    };
  } } as unknown as Stripe;
  const values = { window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon: () => true },
    fetch: async (url: unknown, init: RequestInit) => {
      assert.equal(url, '/api/wallet');
      const request = { body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string>, signal: init.signal };
      requests.push(request);
      return respond(request, requests.length);
    },
  };
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const root = createRoot(dom.window.document.getElementById('root')!);
  let props = {
    enabled: true, amountCents: 1000, chargeCurrency: 'EUR', locale: 'en', captchaToken: null as string | null,
    session: { access_token: 'token-A', user: { id: 'A' } }, stripePromise: Promise.resolve(stripe),
    labels: DEFAULT_BILLING_COPY.wallet,
    takeCaptchaToken() { tokensTaken++; const token = captcha; captcha = null; return token; },
    onCaptchaRequired() { challenges++; }, onPaymentStarted() { payments++; }, onPaymentFailed() { payments++; },
  };
  return {
    requests, elements, dom,
    get tokensTaken() { return tokensTaken; }, get challenges() { return challenges; }, get payments() { return payments; },
    async render(change: Partial<typeof props> = {}, strict = false) {
      props = { ...props, ...change };
      await React.act(async () => root.render(strict
        ? React.createElement(React.StrictMode, null, React.createElement(WalletExpressCheckout, props))
        : React.createElement(WalletExpressCheckout, props)));
    },
    async advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at; timers.delete(next[0]);
        await React.act(async () => { next[1].callback(); });
      }
      now = target;
    },
    async retry() {
      const button = [...dom.window.document.querySelectorAll('button')].find(item => item.textContent === DEFAULT_BILLING_COPY.wallet.expressRetry);
      assert.ok(button, 'recoverable preparation must offer a deliberate retry');
      await React.act(async () => { button.click(); });
    },
    async loadError() {
      await React.act(async () => { elements.at(-1)!.listeners.loaderror({ error: { message: 'Connection interrupted' } }); });
    },
    async giveCaptcha(value: string) {
      captcha = value;
      await this.render({ captchaToken: value });
    },
    async close() {
      await React.act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

for (const stage of ['fetch', 'body']) {
  test(`a ${stage} deadline releases manual recovery and ignores the retired response`, async t => {
    t.mock.method(console, 'warn', () => {});
    const oldFetch = deferred<Response>();
    const oldBody = deferred<unknown>();
    const currentFetch = deferred<Response>();
    const f = await fixture((_request, index) => index > 1 ? currentFetch.promise
      : stage === 'fetch' ? oldFetch.promise : Promise.resolve({ ok: true, status: 200, json: () => oldBody.promise } as Response));
    try {
      await f.render(); await f.advance(300);
      assert.equal(f.requests.length, 1);
      await f.advance(10_000); await f.retry(); await f.advance(300);
      assert.equal(f.requests.length, 1, 'the soft timeout must retain the same request and CAPTCHA');
      assert.equal(f.tokensTaken, 1);
      await f.advance(20_000);
      assert.equal(f.requests.length, 1, 'the hard deadline cannot retry automatically');
      await f.giveCaptcha('captcha-second');
      await f.retry(); await f.advance(300);
      assert.equal(f.requests.length, 2, 'manual recovery must not reuse an expired suspended promise');
      assert.equal(f.requests[0].signal?.aborted, true, 'the expired operation should abort its transport');
      assert.equal(f.elements.length, 0);
      assert.equal(f.tokensTaken, 2);
      assert.deepEqual(f.requests.map(request => request.body.captchaToken), ['captcha-first', 'captcha-second']);
      await React.act(async () => {
        oldFetch.resolve(prepared('retired'));
        oldBody.resolve({ id: 'cs_retired', clientSecret: 'secret_retired', expiresAt: Date.now() / 1000 + 1800 });
      });
      assert.equal(f.elements.length, 0, 'late retired results cannot mount a session over the new attempt');
      await f.advance(10_000); await f.retry(); await f.advance(300);
      assert.equal(f.requests.length, 2, 'retired finally must not evict the newer in-flight request');
      assert.equal(f.tokensTaken, 2);
      await React.act(async () => { currentFetch.resolve(prepared('current')); });
      assert.equal(f.elements.length, 1);
      assert.equal(f.elements[0].secret, 'secret_current');
      await f.loadError(); await f.retry(); await f.advance(300);
      assert.equal(f.requests.length, 2, 'a created session stays cached after connection failure');
      assert.equal(f.elements.at(-1)?.secret, 'secret_current', 'the retired result cannot replace the current cached session');
      assert.equal(f.tokensTaken, 2);
      await f.advance(60_000);
      assert.equal(f.requests.length, 2);
      assert.equal(f.dom.window.document.querySelector('button'), null, 'retired timers must not reopen recovery over a ready wallet');
      assert.equal(f.payments, 0);
    } finally { await f.close(); }
  });
}

test('429 offers manual recovery, preserves RetryAfter and consumes only a newly supplied CAPTCHA', async t => {
  t.mock.method(console, 'warn', () => {});
  const f = await fixture((_request, index) => index === 1
    ? Response.json({ retryAfterSeconds: 60 }, { status: 429 })
    : index === 2 ? Response.json({ captchaRequired: true }, { status: 403 }) : prepared('rate-recovered'));
  try {
    await f.render(); await f.advance(300);
    assert.match(f.dom.window.document.body.textContent ?? '', /1 min/);
    await f.advance(60_000);
    assert.equal(f.requests.length, 1, 'elapsed RetryAfter must not submit automatically');
    await f.retry(); await f.advance(300);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].body.captchaToken, undefined, 'the first one-use token cannot be replayed');
    assert.equal(f.challenges, 1);
    await f.giveCaptcha('captcha-after-rate-limit'); await f.advance(300);
    assert.equal(f.requests.length, 3);
    assert.equal(f.requests[2].body.captchaToken, 'captcha-after-rate-limit');
    assert.equal(f.elements.at(-1)?.secret, 'secret_rate-recovered');
    await f.loadError(); await f.retry(); await f.advance(300);
    assert.equal(f.requests.length, 3, 'connection recovery must not replace the successfully created guarded session');
    assert.equal(f.tokensTaken, 3);
    assert.equal(f.payments, 0);
  } finally { await f.close(); }
});

for (const scope of ['account', 'amount', 'currency']) {
  test(`a retired ${scope} request cannot change the current wallet or its scoped session cache`, async t => {
    t.mock.method(console, 'warn', () => {});
    const retired = deferred<Response>();
    const f = await fixture((_request, index) => index === 1 ? retired.promise : prepared('scoped-current'));
    try {
      await f.render(); await f.advance(300);
      await f.giveCaptcha('captcha-current-scope');
      const change = scope === 'account' ? { session: { access_token: 'token-B', user: { id: 'B' } } }
        : scope === 'amount' ? { amountCents: 2500 } : { chargeCurrency: 'USD' };
      await f.render(change); await f.advance(300);
      assert.equal(f.requests.length, 2, 'a different scope cannot share the old pending request');
      assert.equal(f.requests[1].headers.Authorization, scope === 'account' ? 'Bearer token-B' : 'Bearer token-A');
      assert.equal(f.requests[1].body.amountCents, scope === 'amount' ? 2500 : 1000);
      assert.equal(f.requests[1].body.currency, scope === 'currency' ? 'usd' : 'eur');
      assert.equal(f.elements.at(-1)?.secret, 'secret_scoped-current');
      await React.act(async () => {
        if (scope === 'account') retired.resolve(Response.json({ captchaRequired: true }, { status: 403 }));
        else if (scope === 'amount') retired.resolve(prepared('retired-scope'));
        else retired.reject(new Error('Retired transport failed'));
      });
      assert.equal(f.challenges, 0, 'a retired response cannot request a CAPTCHA for the new scope');
      assert.equal(f.elements.length, 1);
      assert.equal(f.elements[0].secret, 'secret_scoped-current');
      assert.equal(f.dom.window.document.querySelector('button'), null);
      await f.loadError(); await f.retry(); await f.advance(300);
      assert.equal(f.requests.length, 2);
      assert.equal(f.elements.at(-1)?.secret, 'secret_scoped-current');
      assert.equal(f.tokensTaken, 2);
      await f.advance(31_000);
      assert.equal(f.dom.window.document.querySelector('button'), null, 'an old timeout cannot overwrite the current ready state');
      assert.equal(f.payments, 0);
    } finally { await f.close(); }
  });
}

test('StrictMode still prepares only the settled native selection once', async () => {
  const f = await fixture(() => prepared('strict'));
  try {
    await f.render({}, true); await f.advance(300);
    assert.equal(f.requests.length, 1);
    assert.equal(f.tokensTaken, 1);
    assert.equal(f.elements.length, 1);
    await f.advance(31_000);
    assert.equal(f.requests.length, 1);
    assert.equal(f.dom.window.document.querySelector('button'), null);
    assert.equal(f.payments, 0);
  } finally { await f.close(); }
});
