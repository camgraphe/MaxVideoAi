import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { useHostedWalletCheckout as HostedHook } from '../frontend/hooks/useHostedWalletCheckout';

type Options = Parameters<typeof HostedHook>[0];
async function fixture() {
  const previousGaId = process.env.NEXT_PUBLIC_GA_ID;
  process.env.NEXT_PUBLIC_GA_ID = 'G-HOSTED-FIXTURE';
  const { useHostedWalletCheckout } = await import('../frontend/hooks/useHostedWalletCheckout');
  if (previousGaId === undefined) delete process.env.NEXT_PUBLIC_GA_ID;
  else process.env.NEXT_PUBLIC_GA_ID = previousGaId;
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://billing.example.test/' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ token: string | null; signal: AbortSignal | null | undefined; resolve: (response: Response) => void; reject: (error: Error) => void }> = [];
  const started: string[] = [];
  const failed: string[] = [];
  const rates: string[] = [];
  const events: Blob[] = [];
  for (const [key, value] of Object.entries({
    window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true,
    navigator: { sendBeacon: (_url: string, body: Blob) => { events.push(body); return true; } },
    fetch: (_url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      // Deliberately ignore abort: retired continuations still need a logical guard.
      requests.push({ token: new Headers(init.headers).get('Authorization'), signal: init.signal, resolve, reject });
    }),
  })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  let current!: ReturnType<typeof useHostedWalletCheckout>;
  function Probe({ owner, token = owner, options = {} }: { owner: string | null; token?: string | null; options?: Partial<Options> }) {
    current = useHostedWalletCheckout({
      accountId: owner, accessToken: token, amountCents: 1000, currency: 'EUR', locale: 'en',
      source: 'billing', stripePromise: null, returnTarget: '/app',
      onStarted: () => { started.push(owner!); }, onFailed: () => { failed.push(owner!); },
      onRateLimited: () => { rates.push(owner!); }, ...options,
    });
    return null;
  }
  const root = createRoot(dom.window.document.getElementById('root')!);
  let mounted = true;
  const unmount = async () => { if (mounted) { await act(async () => root.unmount()); mounted = false; } };
  return {
    dom, requests, started, failed, rates, get current() { return current; },
    async eventNames() { return Promise.all(events.map(async body => JSON.parse(await body.text()).eventName)); },
    async render(owner: string | null, token = owner, options?: Partial<Options>) { await act(async () => root.render(React.createElement(Probe, { owner, token, options }))); },
    async start() { let pending!: Promise<void>; await act(async () => { pending = current.startCheckout(); }); return { pending }; },
    unmount,
    async close() {
      await unmount(); dom.window.close();
      for (const [key, value] of saved) {
        if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

const ready = (id: string) => Response.json({ id: `cs_${id}`, url: `#${id}` });

test('a hosted response from a retired account cannot redirect, write return storage or report analytics', async () => {
  const f = await fixture();
  try {
    await f.render('A'); const { pending } = await f.start();
    await f.render('B');
    await act(async () => { f.requests[0].resolve(ready('A')); await pending; });
    assert.deepEqual(f.started, []);
    assert.deepEqual(await f.eventNames(), ['hosted_checkout_requested']);
    assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), null);
    assert.equal(f.dom.window.location.hash, '');
    assert.equal(f.current.isSubmitting, false);
  } finally { await f.close(); }
});

for (const result of ['captcha', 'rate', 'reject'] as const) {
  test(`account replacement releases the lock and retired ${result} cannot affect the new attempt`, async () => {
    const f = await fixture();
    try {
      await f.render('A'); const a = await f.start();
      await f.render('B'); const b = await f.start();
      assert.equal(f.requests.length, 2, 'account B starts without waiting for A');
      f.dom.window.sessionStorage.setItem('mv-wallet-checkout-return', 'current-B-marker');
      await act(async () => {
        if (result === 'reject') f.requests[0].reject(new Error('late network failure'));
        else f.requests[0].resolve(Response.json(result === 'captcha' ? { captchaRequired: true } : { retryAfterSeconds: 30 }, { status: result === 'captcha' ? 403 : 429 }));
        await a.pending;
      });
      assert.equal(f.current.captchaRequired, false);
      assert.equal(f.current.retryAfterSeconds, null);
      assert.equal(f.current.failureReason, null);
      assert.equal(f.current.isSubmitting, true, 'old finally cannot unlock B');
      assert.deepEqual(f.failed, []); assert.deepEqual(f.rates, []);
      assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), 'current-B-marker');
      assert.deepEqual(await f.eventNames(), ['hosted_checkout_requested', 'hosted_checkout_requested']);
      await f.start(); assert.equal(f.requests.length, 2, 'duplicate clicks stay suppressed');
      await act(async () => { f.requests[1].resolve(Response.json({}, { status: 500 })); await b.pending; });
      assert.deepEqual(f.failed, ['B']); assert.equal(f.current.isSubmitting, false);
    } finally { await f.close(); }
  });
}

test('same-account token refresh and callback refresh preserve the pending hosted attempt and reset identity', async () => {
  const f = await fixture();
  try {
    await f.render('A', 'token-1'); const reset = f.current.resetCheckout; const { pending } = await f.start();
    await f.render('A', 'token-2'); await f.start();
    assert.equal(f.current.resetCheckout, reset);
    assert.equal(f.requests.length, 1);
    await act(async () => { f.requests[0].resolve(ready('A')); await pending; });
    assert.deepEqual(f.started, ['A']); assert.equal(f.dom.window.location.hash, '#A');
    assert.ok(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'));
  } finally { await f.close(); }
});

test('close/reset retires a pending attempt and reopening can start independently', async () => {
  const f = await fixture();
  try {
    await f.render('A'); const a = await f.start(); const reset = f.current.resetCheckout;
    await act(async () => f.current.resetCheckout()); const b = await f.start();
    assert.equal(f.current.resetCheckout, reset);
    assert.equal(f.requests.length, 2);
    await act(async () => { f.requests[0].resolve(ready('old')); await a.pending; });
    assert.deepEqual(f.started, []); assert.equal(f.current.isSubmitting, true);
    await act(async () => { f.requests[1].resolve(ready('new')); await b.pending; });
    assert.equal(f.dom.window.location.hash, '#new');
  } finally { await f.close(); }
});

for (const options of [{ amountCents: 2500 }, { currency: 'USD' }, { locale: 'fr' }, { source: 'workspace' }, { returnTarget: undefined }, { stripePromise: Promise.resolve(null) }] satisfies Partial<Options>[]) {
  test(`configuration change retires the pending attempt: ${Object.keys(options)[0]}`, async () => {
    const f = await fixture();
    try {
      await f.render('A'); const a = await f.start(); const reset = f.current.resetCheckout;
      await f.render('A', 'A', options);
      assert.equal(f.current.resetCheckout, reset);
      await act(async () => { f.requests[0].resolve(ready('old')); await a.pending; });
      assert.deepEqual(f.started, []); assert.equal(f.current.isSubmitting, false);
    } finally { await f.close(); }
  });
}

test('account A to B to A never revives the first A attempt', async () => {
  const f = await fixture();
  try {
    await f.render('A'); const a = await f.start(); await f.render('B'); await f.render('A');
    await act(async () => { f.requests[0].resolve(ready('old-A')); await a.pending; });
    assert.deepEqual(f.started, []); assert.equal(f.dom.window.location.hash, '');
  } finally { await f.close(); }
});

test('unmount suppresses late callbacks, analytics, storage and navigation', async () => {
  const f = await fixture();
  try {
    await f.render('A'); const a = await f.start(); await f.unmount();
    await act(async () => { f.requests[0].resolve(ready('old')); await a.pending; });
    assert.deepEqual(f.started, []); assert.deepEqual(f.failed, []);
    assert.deepEqual(await f.eventNames(), ['hosted_checkout_requested']);
    assert.equal(f.dom.window.location.hash, '');
    assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), null);
  } finally { await f.close(); }
});

test('a retired Stripe loader cannot redirect and its rejection cannot clear a newer attempt', async () => {
  const f = await fixture();
  let resolveStripe!: (value: any) => void;
  const stripePromise = new Promise<any>(resolve => { resolveStripe = resolve; });
  let redirects = 0;
  try {
    await f.render('A', 'A', { stripePromise }); const a = await f.start();
    await act(async () => { f.requests[0].resolve(Response.json({ id: 'cs_A' })); });
    assert.deepEqual(f.started, ['A']);
    await f.render('B'); const b = await f.start();
    f.dom.window.sessionStorage.setItem('mv-wallet-checkout-return', 'current-B-marker');
    await act(async () => { resolveStripe({ redirectToCheckout: async () => { redirects++; return {}; } }); await a.pending; });
    assert.equal(redirects, 0); assert.equal(f.current.isSubmitting, true);
    assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), 'current-B-marker');
    await act(async () => { f.requests[1].resolve(ready('B')); await b.pending; });
  } finally { await f.close(); }
});

test('late Stripe redirect rejection cannot fail or unlock a new attempt', async () => {
  const f = await fixture();
  let rejectRedirect!: (error: Error) => void;
  const stripePromise = Promise.resolve({ redirectToCheckout: () => new Promise((_resolve, reject) => { rejectRedirect = reject; }) }) as any;
  try {
    await f.render('A', 'A', { stripePromise }); const a = await f.start();
    await act(async () => { f.requests[0].resolve(Response.json({ id: 'cs_A' })); });
    await f.render('B'); const b = await f.start();
    f.dom.window.sessionStorage.setItem('mv-wallet-checkout-return', 'current-B-marker');
    await act(async () => { rejectRedirect(new Error('late Stripe rejection')); await a.pending; });
    assert.deepEqual(f.failed, []); assert.equal(f.current.isSubmitting, true);
    assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), 'current-B-marker');
    await act(async () => { f.requests[1].resolve(ready('B')); await b.pending; });
  } finally { await f.close(); }
});

test('onStarted may reset synchronously without allowing the remaining redirect effects', async () => {
  const f = await fixture();
  try {
    await f.render('A', 'A', { onStarted: () => f.current.resetCheckout() }); const a = await f.start();
    await act(async () => { f.requests[0].resolve(ready('old')); await a.pending; });
    assert.equal(f.dom.window.location.hash, '');
    assert.equal(f.dom.window.sessionStorage.getItem('mv-wallet-checkout-return'), null);
    assert.deepEqual(await f.eventNames(), ['hosted_checkout_requested']);
  } finally { await f.close(); }
});

test('a checkout without a confirmed account cannot start', async () => {
  const f = await fixture();
  try { await f.render(null, 'leftover-token'); await f.start(); assert.equal(f.requests.length, 0); }
  finally { await f.close(); }
});


test('retirement during analytics lookup cannot consume a current proof or start a stale request', async () => {
  const f = await fixture();
  const fields: Array<{ field: string; callback: (value: string) => void }> = [];
  f.dom.window.localStorage.setItem('mv-consent-analytics', 'granted');
  (f.dom.window as any).gtag = (_command: string, _id: string, field: string, callback: (value: string) => void) => fields.push({ field, callback });
  try {
    await f.render('A'); const a = await f.start(); assert.equal(f.requests.length, 0);
    await f.render('B');
    await act(async () => f.current.handleCaptchaToken('proof-B'));
    const b = await f.start(); assert.equal(fields.length, 4);
    await act(async () => {
      for (const { field, callback } of fields.slice(0, 2)) callback(field === 'client_id' ? '123.456' : '123456');
      await a.pending;
    });
    assert.equal(f.requests.length, 0); assert.equal(f.current.captchaToken, 'proof-B');
    assert.equal(f.current.isSubmitting, true);
    await act(async () => { for (const { field, callback } of fields.slice(2)) callback(field === 'client_id' ? '123.456' : '123456'); });
    assert.equal(f.requests.length, 1); assert.equal(f.requests[0].token, 'Bearer B');
    await act(async () => { f.requests[0].resolve(ready('B')); await b.pending; });
    assert.deepEqual(f.started, ['B']);
  } finally { await f.close(); }
});

test('retirement during response body reading ignores the body even when its reader ignores abort', async () => {
  const f = await fixture(); let resolveBody!: (value: unknown) => void;
  try {
    await f.render('A'); const a = await f.start();
    await act(async () => f.requests[0].resolve({ ok: true, status: 200, json: () => new Promise(resolve => { resolveBody = resolve; }) } as Response));
    await f.render('B'); const b = await f.start();
    await act(async () => { resolveBody({ id: 'cs_old', url: '#old' }); await a.pending; });
    assert.deepEqual(f.started, []); assert.equal(f.current.isSubmitting, true);
    await act(async () => { f.requests[1].resolve(ready('B')); await b.pending; });
    assert.deepEqual(f.started, ['B']);
  } finally { await f.close(); }
});

test('a hosted deadline unlocks the UI for deliberate retry without retrying or adopting a late result', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = await fixture();
  try {
    await f.render('A'); const a = await f.start();
    await act(async () => { t.mock.timers.tick(30_000); await a.pending; });
    assert.equal(f.current.isSubmitting, false); assert.equal(f.current.failureReason, 'network');
    assert.equal(f.requests.length, 1); assert.deepEqual(f.failed, ['A']);
    const b = await f.start(); assert.equal(f.requests.length, 2);
    await act(async () => f.requests[0].resolve(ready('expired')));
    assert.deepEqual(f.started, []); assert.equal(f.current.isSubmitting, true);
    await act(async () => { f.requests[1].resolve(ready('retry')); await b.pending; });
    assert.deepEqual(f.started, ['A']); assert.equal(f.dom.window.location.hash, '#retry');
  } finally { await f.close(); }
});
