import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PENDING_AUTH_EVENT_STORAGE_KEY,
  persistPendingAnalyticsEvent,
  readPendingAnalyticsEvent,
} from '../frontend/lib/analytics-client';
import { ANALYTICS_JOURNEY_STORAGE_KEY } from '../frontend/lib/analytics/journey-contract';
import {
  clearBrowserAnalyticsState,
  prepareBrowserAnalyticsEvents,
  readAnalyticsJourney,
  readWalletAnalyticsJourney,
} from '../frontend/lib/analytics/journey-browser';

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

function withBrowser(
  options: { consent: string | null; storedJourney?: string },
  run: (value: { localStorage: Storage; sessionStorage: Storage }) => void,
) {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
  };
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  if (options.consent) localStorage.setItem('mv-consent-analytics', options.consent);
  if (options.storedJourney) localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, options.storedJourney);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      location: {
        href: 'https://maxvideoai.com/pricing?utm_source=google&utm_medium=cpc',
        origin: 'https://maxvideoai.com',
        pathname: '/pricing',
      },
      dispatchEvent() {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { referrer: '', documentElement: { lang: 'en' } },
  });
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { randomUUID: () => '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9' },
  });
  try {
    run({ localStorage, sessionStorage });
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('denied consent prepares no event and stores no journey', () => {
  withBrowser({ consent: null }, () => {
    assert.deepEqual(prepareBrowserAnalyticsEvents('sign_up_started', { method: 'password' }), []);
    assert.equal(readAnalyticsJourney(), null);
  });
});

test('granted consent creates one entry and one durable journey', () => {
  withBrowser({ consent: 'granted' }, () => {
    assert.deepEqual(
      prepareBrowserAnalyticsEvents('sign_up_started', { method: 'password' }).map((entry) => entry.event),
      ['funnel_entry', 'sign_up_started'],
    );
    assert.equal(readAnalyticsJourney()?.journeyId, '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9');
    assert.deepEqual(
      prepareBrowserAnalyticsEvents('sign_up_completed', {}).map((entry) => entry.event),
      ['sign_up_completed'],
    );
  });
});

test('pending auth events are never stored without consent', () => {
  withBrowser({ consent: null }, ({ sessionStorage }) => {
    persistPendingAnalyticsEvent('sign_up_completed', { method: 'google' });
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
    assert.equal(readPendingAnalyticsEvent(), null);
  });
});

test('wallet projection reads an existing journey without creating one', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage }) => {
    assert.equal(readWalletAnalyticsJourney(), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);

    prepareBrowserAnalyticsEvents('topup_started');
    assert.deepEqual(readWalletAnalyticsJourney(), {
      version: 1,
      journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
      cohortWeek: readAnalyticsJourney()?.cohortWeek,
      firstSource: 'google',
      firstMedium: 'cpc',
      lastSource: 'google',
      lastMedium: 'cpc',
    });
  });
});

test('denied consent clears stored analytics state', () => {
  withBrowser({ consent: null, storedJourney: JSON.stringify({ version: 1 }) }, ({ localStorage, sessionStorage }) => {
    sessionStorage.setItem(PENDING_AUTH_EVENT_STORAGE_KEY, JSON.stringify({ event: 'sign_up_completed' }));
    clearBrowserAnalyticsState();
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
  });
});
