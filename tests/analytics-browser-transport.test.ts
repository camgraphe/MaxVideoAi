import assert from 'node:assert/strict';
import test from 'node:test';

import { dispatchGaEvent } from '../frontend/lib/analytics/ga-events';
import { COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, COMMERCIAL_ANALYTICS_RESOLVED_EVENT } from '../frontend/lib/analytics/commercial-client';

type TimerCallback = () => void;

test('browser transport bounds oversaturated completion while preserving acquisition and success evidence', async () => {
  const { sendPreparedAnalyticsEvents } = await import('../frontend/lib/analytics/ordered-events');
  const attribution = {
    journey_id: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9', acquisition_cohort: '2026-W41',
    first_touch_source: 'youtube', first_touch_medium: 'paid_video', first_touch_campaign: 'claude_desktop_clip_20261005', first_touch_content: 'result_horizontal48',
    last_touch_source: 'youtube', last_touch_medium: 'paid_video', last_touch_campaign: 'claude_desktop_clip_20261005', last_touch_content: 'result_horizontal48',
    route_family: 'workspace', job_id: 'job123', generation_sequence: 2, completion_source: 'generation',
  };
  const diagnostics = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`diagnostic_${i}`, i]));
  let sent: Record<string, unknown> = {};
  sendPreparedAnalyticsEvents((_command, _event, payload) => { sent = payload as Record<string, unknown>; }, [
    { event: 'first_media_completed_in_journey', payload: { ...diagnostics, ...attribution } },
  ]);
  assert.ok(Object.keys(sent).length <= 25);
  for (const [key, value] of Object.entries(attribution)) assert.equal(sent[key], value, key);
});

test('legacy Google Ads return conversion never sends before eligibility and sends once after delayed resolution', async () => {
  const { dispatchGoogleAdsConversion } = await import('../frontend/lib/analytics/ga-events');
  await withBrowser({ adsConsent: true }, async (browser) => {
    const calls: unknown[][] = [];
    browser.window.gtag = (...args) => { calls.push(args); };
    browser.window.__mvaiCommercialAnalyticsPending = true;
    const payload = { send_to: 'AW-local-fixture', value: 25, currency: 'USD' };
    const result = dispatchGoogleAdsConversion(payload, { maxAttempts: 2, retryDelayMs: 100 });
    payload.value = 999;
    browser.dispatch(new CustomEvent(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, { detail: { resetJourney: false } }));
    assert.deepEqual(calls, []);
    browser.runNextTimer();
    assert.deepEqual(calls, [], 'a retry cannot emit for an unresolved role');
    browser.window.__mvaiCommercialAnalyticsPending = false;
    browser.dispatch(new Event(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
    assert.equal(await result, true);
    browser.dispatch(new Event(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
    browser.runNextTimer();
    assert.deepEqual(calls, [['event', 'conversion', { send_to: 'AW-local-fixture', value: 25, currency: 'USD' }]]);
    assert.equal(browser.timerCount(), 0);
    assert.equal(browser.listenerCount(COMMERCIAL_ANALYTICS_RESOLVED_EVENT), 0);
    assert.equal(browser.listenerCount(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT), 0);
  });
});

test('pending Ads returns are discarded on admin resolution, consent denial, account reset or timeout', async () => {
  const { dispatchGoogleAdsConversion } = await import('../frontend/lib/analytics/ga-events');
  for (const outcome of ['admin', 'denied', 'account', 'timeout'] as const) {
    await withBrowser({ adsConsent: true }, async (browser) => {
      const calls: unknown[][] = [];
      browser.window.gtag = (...args) => { calls.push(args); };
      browser.window.__mvaiCommercialAnalyticsPending = true;
      const result = dispatchGoogleAdsConversion({ send_to: 'AW-local-fixture' }, { maxAttempts: 2, retryDelayMs: 100 });
      assert.equal(browser.timerCount(), 1, 'the consented pending return is retained within a bounded retry window');
      if (outcome === 'admin') {
        browser.window.__mvaiCommercialAnalyticsPending = false;
        browser.window.__mvaiCommercialAnalyticsExcluded = true;
        browser.dispatch(new Event(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
      } else if (outcome === 'denied') {
        browser.dispatch(new CustomEvent('consent:updated', { detail: { categories: { ads: false } } }));
      } else if (outcome === 'account') {
        browser.dispatch(new CustomEvent(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT, { detail: { resetJourney: true } }));
      } else {
        browser.runNextTimer();
        browser.runNextTimer();
      }
      assert.equal(await result, false, outcome);
      browser.window.__mvaiCommercialAnalyticsExcluded = false;
      browser.window.__mvaiCommercialAnalyticsPending = false;
      browser.dispatch(new Event(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
      browser.runNextTimer();
      assert.deepEqual(calls, [], `${outcome} cannot revive the discarded return`);
      assert.equal(browser.timerCount(), 0);
      assert.equal(browser.listenerCount(COMMERCIAL_ANALYTICS_RESOLVED_EVENT), 0);
      assert.equal(browser.listenerCount(COMMERCIAL_ANALYTICS_CONTEXT_CHANGED_EVENT), 0);
    });
  }
});

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
    __mvaiCommercialAnalyticsPending: false,
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

test('direct dispatch keeps retries across granted and ads-only consent updates', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    assert.equal(browser.timerCount(), 1);
    browser.dispatch(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: true, ads: false } },
    }));
    browser.dispatch(new CustomEvent('consent:updated', {
      detail: { categories: { ads: true } },
    }));
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    browser.runNextTimer();
    assert.equal(await result, true);
    assert.deepEqual(calls, ['funnel_entry', 'topup_cancelled']);
    assert.equal(browser.listenerCount('consent:updated'), 0);
    assert.equal(browser.listenerCount('storage'), 0);
  });
});

test('direct dispatch cancels retries on an explicit analytics withdrawal', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    browser.dispatch(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: false, ads: true } },
    }));
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    browser.runNextTimer();
    assert.equal(await result, false);
    assert.deepEqual(calls, []);
    assert.equal(browser.timerCount(), 0);
  });
});

test('analytics storage updates cancel only after consent is actually removed', async () => {
  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    const storageEvent = new Event('storage');
    Object.defineProperty(storageEvent, 'key', { value: 'mv-consent-analytics' });
    browser.dispatch(storageEvent);
    browser.window.gtag = (_command, event) => { calls.push(String(event)); };
    browser.runNextTimer();
    assert.equal(await result, true);
    assert.deepEqual(calls, ['funnel_entry', 'topup_cancelled']);
  });

  await withBrowser({ analyticsConsent: true }, async (browser) => {
    const calls: string[] = [];
    const result = dispatchGaEvent('topup_cancelled', {}, { maxAttempts: 2, retryDelayMs: 100 });
    browser.window.localStorage.removeItem('mv-consent-analytics');
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
    browser.dispatch(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: true, ads: false } },
    }));
    assert.equal(await result, false);
    assert.equal(browser.timerCount(), 0);
  });
});
