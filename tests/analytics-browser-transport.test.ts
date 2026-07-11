import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchGaEvent } from '../frontend/lib/analytics/ga-events';

type TimerCallback = () => void;

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

async function withBrowser(
  options: { adsConsent?: boolean; analyticsConsent?: boolean },
  run: (browser: {
    dispatch: (event: Event) => void;
    listenerCount: (type: string) => number;
    runNextTimer: () => void;
    timerCount: () => number;
    window: Window & { gtag?: (...args: unknown[]) => void };
  }) => Promise<void>,
) {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
  };
  const target = new EventTarget();
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const timers = new Map<number, TimerCallback>();
  let timerId = 0;
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (options.analyticsConsent) localStorage.setItem('mv-consent-analytics', 'granted');
  const consentCookie = encodeURIComponent(JSON.stringify({
    version: '2026-07',
    timestamp: 1_000,
    categories: { analytics: Boolean(options.analyticsConsent), ads: Boolean(options.adsConsent) },
    source: 'preferences',
  }));
  const browserWindow = {
    localStorage,
    sessionStorage,
    location: {
      href: 'https://maxvideoai.com/billing',
      hostname: 'maxvideoai.com',
      origin: 'https://maxvideoai.com',
      pathname: '/billing',
      protocol: 'https:',
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const entries = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      entries.add(listener);
      listeners.set(type, entries);
      target.addEventListener(type, listener);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(listener);
      target.removeEventListener(type, listener);
    },
    dispatchEvent(event: Event) {
      return target.dispatchEvent(event);
    },
    setTimeout(callback: TimerCallback) {
      timerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(id: number) {
      timers.delete(id);
    },
  } as unknown as Window & { gtag?: (...args: unknown[]) => void };

  Object.defineProperty(globalThis, 'window', { configurable: true, value: browserWindow });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: `mv-consent=${consentCookie}`, referrer: '', documentElement: { lang: 'en' } },
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9' },
  });

  try {
    await run({
      dispatch: (event) => { browserWindow.dispatchEvent(event); },
      listenerCount: (type) => listeners.get(type)?.size ?? 0,
      runNextTimer: () => {
        const next = timers.entries().next().value as [number, TimerCallback] | undefined;
        if (!next) return;
        timers.delete(next[0]);
        next[1]();
      },
      timerCount: () => timers.size,
      window: browserWindow,
    });
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('ordered sender stops at a thrown event and resumes without resending successes', async () => {
  const module = await import('../frontend/lib/analytics/ga-events.ts') as Record<string, unknown>;
  assert.equal(typeof module.sendPreparedAnalyticsEvents, 'function');
  const sendPreparedAnalyticsEvents = module.sendPreparedAnalyticsEvents as (
    gtag: (...args: unknown[]) => void,
    events: Array<{ event: string; payload: Record<string, unknown> }>,
    startIndex?: number,
  ) => number;
  const events = [
    { event: 'entry', payload: {} },
    { event: 'primary', payload: {} },
    { event: 'after', payload: {} },
  ];
  const calls: string[] = [];
  let throwPrimary = true;
  const gtag = (_command: unknown, event: unknown) => {
    calls.push(String(event));
    if (event === 'primary' && throwPrimary) {
      throwPrimary = false;
      throw new Error('blocked');
    }
  };

  const unsentIndex = sendPreparedAnalyticsEvents(gtag, events);
  assert.equal(unsentIndex, 1);
  assert.deepEqual(calls, ['entry', 'primary']);
  assert.equal(sendPreparedAnalyticsEvents(gtag, events, unsentIndex), events.length);
  assert.deepEqual(calls, ['entry', 'primary', 'primary', 'after']);
});

test('direct dispatch catches gtag failures and retries only unsent prepared events', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    let throwPrimary = true;
    browser.window.gtag = (_command, event) => {
      calls.push(String(event));
      if (event === 'topup_cancelled' && throwPrimary) {
        throwPrimary = false;
        throw new Error('blocked');
      }
    };

    const result = dispatchGaEvent('topup_cancelled', { route_family: 'billing' }, { maxAttempts: 2, retryDelayMs: 100 })
      .then((value) => ({ value }), (error: unknown) => ({ error }));
    assert.deepEqual(calls, ['funnel_entry', 'topup_cancelled']);
    if (browser.timerCount() > 0) browser.runNextTimer();
    assert.deepEqual(await result, { value: true });
    assert.deepEqual(calls, ['funnel_entry', 'topup_cancelled', 'topup_cancelled']);
    assert.equal(browser.listenerCount('consent:updated'), 0);
    assert.equal(browser.listenerCount('storage'), 0);
  });
});

test('direct dispatch cancels stale retries on any consent update', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    assert.equal(browser.timerCount(), 1);
    browser.dispatch(new Event('consent:updated'));
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    browser.runNextTimer();
    assert.equal(await result, false);
    assert.deepEqual(calls, []);
    assert.equal(browser.listenerCount('consent:updated'), 0);
    assert.equal(browser.listenerCount('storage'), 0);
  });
});

test('direct dispatch cancels stale retries on analytics storage updates', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    const storageEvent = new Event('storage');
    Object.defineProperty(storageEvent, 'key', { value: 'mv-consent-analytics' });
    browser.dispatch(storageEvent);
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    browser.runNextTimer();
    assert.equal(await result, false);
    assert.deepEqual(calls, []);
    assert.equal(browser.timerCount(), 0);
  });
});

test('Google Ads conversion requires ads consent and cancels retries on consent updates', async () => {
  const module = await import('../frontend/lib/analytics/ga-events.ts') as Record<string, unknown>;
  assert.equal(typeof module.dispatchGoogleAdsConversion, 'function');
  const dispatchGoogleAdsConversion = module.dispatchGoogleAdsConversion as (
    payload: Record<string, unknown>,
    options?: { maxAttempts?: number; retryDelayMs?: number },
  ) => Promise<boolean>;

  await withBrowser({ adsConsent: false }, async (browser) => {
    const calls: string[] = [];
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    assert.equal(await dispatchGoogleAdsConversion({ send_to: 'AW-test/label' }), false);
    assert.deepEqual(calls, []);
  });

  await withBrowser({ adsConsent: true }, async (browser) => {
    const result = dispatchGoogleAdsConversion(
      { send_to: 'AW-test/label' },
      { maxAttempts: 2, retryDelayMs: 100 },
    );
    assert.equal(browser.timerCount(), 1);
    browser.dispatch(new Event('consent:updated'));
    assert.equal(await result, false);
    assert.equal(browser.timerCount(), 0);
  });
});
