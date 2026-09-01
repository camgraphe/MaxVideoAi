import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  PENDING_AUTH_EVENT_STORAGE_KEY,
  PENDING_TOPUP_CANCELLED_STORAGE_KEY,
  persistPendingAnalyticsEvent,
  persistPendingTopupCancelledEvent,
  readPendingAnalyticsEvent,
  readPendingTopupCancelledEvent,
} from '../frontend/lib/analytics-client';
import { hasAdsConsentInBrowser } from '../frontend/lib/analytics/consent-client';
import {
  applyStoredConsentEffects,
  clearLocalAnalyticsFlag,
} from '../frontend/components/legal/cookie-banner-client';
import {
  ANALYTICS_JOURNEY_STORAGE_KEY,
  ANALYTICS_JOURNEY_TTL_MS,
} from '../frontend/lib/analytics/journey-contract';
import {
  clearBrowserAnalyticsState,
  prepareBrowserAnalyticsEvents,
  readAnalyticsJourney,
  readWalletAnalyticsJourney,
} from '../frontend/lib/analytics/journey-browser';

test('treats the journey classifier as analytics data, not an authored public link', () => {
  const result = spawnSync(process.execPath, ['scripts/internal-link-guard.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('limits the non-link route classifier exception to analytics ownership', async () => {
  const { ALLOWED_NON_LINK_ROUTE_CLASSIFIERS } = await import('../scripts/internal-link-guard.mjs');

  assert.equal(
    ALLOWED_NON_LINK_ROUTE_CLASSIFIERS.has('frontend/lib/analytics/journey.ts'),
    true,
  );
  assert.equal(
    ALLOWED_NON_LINK_ROUTE_CLASSIFIERS.has('frontend/components/marketing/MarketingFooter.tsx'),
    false,
  );
});

test('rejects an unauthorized authored company link outside the classifier', () => {
  const fixturePath = join(
    process.cwd(),
    'frontend/lib/analytics/internal-link-guard-unauthorized-company-link.test.ts',
  );
  writeFileSync(fixturePath, "export const unauthorizedCompanyLink = '/company';\n");

  try {
    const result = spawnSync(process.execPath, ['scripts/internal-link-guard.mjs'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /internal-link-guard-unauthorized-company-link\.test\.ts/);
  } finally {
    unlinkSync(fixturePath);
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

function withBrowser(
  options: { consent: string | null; consentCookie?: string; href?: string; storedJourney?: string },
  run: (value: { localStorage: Storage; sessionStorage: Storage }) => void,
) {
  const descriptors = {
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    crypto: Object.getOwnPropertyDescriptor(globalThis, 'crypto'),
  };
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const location = new URL(options.href ?? 'https://maxvideoai.com/pricing?utm_source=google&utm_medium=cpc');
  if (options.consent) localStorage.setItem('mv-consent-analytics', options.consent);
  if (options.storedJourney) localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, options.storedJourney);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      location: {
        href: location.href,
        hostname: location.hostname,
        origin: location.origin,
        pathname: location.pathname,
        protocol: location.protocol,
      },
      dispatchEvent() {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: options.consentCookie ?? '', referrer: '', documentElement: { lang: 'en' } },
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

test('pending analytics storage projects approved fields before persistence and rejects unknown events', () => {
  withBrowser({ consent: 'granted' }, ({ sessionStorage }) => {
    persistPendingAnalyticsEvent('sign_up_completed', {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'google',
      marketing_opt_in: true,
      cta_name: 'private_media_brief',
      credential: 'Bearer private-token',
      prompt: 'my unreleased prompt',
    });
    const storedAuth = sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY);
    assert.ok(storedAuth);
    assert.doesNotMatch(storedAuth, /private|Bearer|prompt|credential/i);
    assert.deepEqual(readPendingAnalyticsEvent()?.payload, {
      route_family: 'auth',
      auth_surface: 'login',
      method: 'google',
      marketing_opt_in: true,
    });

    persistPendingAnalyticsEvent('private_prompt_export', {
      method: 'Bearer private-token',
    });
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);

    persistPendingTopupCancelledEvent({
      route_family: 'billing',
      payment_provider: 'stripe',
      payment_flow: 'checkout',
      charge_currency: 'USD',
      topup_amount_cents: 1000,
      topup_tier_id: 'private_token',
      failure_category: '4242 4242 4242 4242',
    });
    const storedTopup = sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY);
    assert.ok(storedTopup);
    assert.doesNotMatch(storedTopup, /private|4242/);
    assert.deepEqual(readPendingTopupCancelledEvent(), {
      route_family: 'billing',
      payment_provider: 'stripe',
      payment_flow: 'checkout',
      charge_currency: 'USD',
      topup_amount_cents: 1000,
    });
  });
});

test('pending analytics reads remove private fields from tampered session storage', () => {
  withBrowser({ consent: 'granted' }, ({ sessionStorage }) => {
    sessionStorage.setItem(PENDING_AUTH_EVENT_STORAGE_KEY, JSON.stringify({
      event: 'sign_up_completed',
      payload: { method: 'google', auth_surface: 'Bearer private-token', prompt: 'private brief' },
      createdAt: Date.now(),
    }));
    assert.deepEqual(readPendingAnalyticsEvent()?.payload, { method: 'google' });
    assert.doesNotMatch(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY) ?? '', /private|Bearer|prompt/i);

    sessionStorage.setItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY, JSON.stringify({
      route_family: 'billing',
      topup_amount_cents: 1000,
      topup_tier_id: 'account_123',
      payment_status: 'card_4242424242424242',
    }));
    assert.deepEqual(readPendingTopupCancelledEvent(), {
      route_family: 'billing',
      topup_amount_cents: 1000,
    });
    assert.doesNotMatch(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY) ?? '', /account|4242|card/i);
  });
});

test('pending topup cancellation persistence and replay are suppressed without analytics consent', () => {
  withBrowser({ consent: null }, ({ sessionStorage }) => {
    persistPendingTopupCancelledEvent({ topup_amount_cents: 1000 });
    assert.equal(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY), null);

    sessionStorage.setItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY, JSON.stringify({ topup_amount_cents: 1000 }));
    assert.equal(readPendingTopupCancelledEvent(), null);
    assert.equal(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY), null);
  });
});

test('analytics withdrawal clears pending topup cancellation state', () => {
  withBrowser({ consent: 'granted' }, ({ sessionStorage }) => {
    persistPendingTopupCancelledEvent({ topup_amount_cents: 1000 });
    assert.ok(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY));
    clearBrowserAnalyticsState();
    assert.equal(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY), null);
  });
});

test('ads consent is read from the official consent cookie', () => {
  const granted = encodeURIComponent(JSON.stringify({
    version: '2026-07',
    timestamp: 1_000,
    categories: { analytics: false, ads: true },
    source: 'preferences',
  }));
  withBrowser({ consent: null, consentCookie: `other=value; mv-consent=${granted}` }, () => {
    assert.equal(hasAdsConsentInBrowser(), true);
  });

  const denied = encodeURIComponent(JSON.stringify({
    version: '2026-07',
    timestamp: 1_000,
    categories: { analytics: true, ads: false },
    source: 'preferences',
  }));
  withBrowser({ consent: 'granted', consentCookie: `mv-consent=${denied}` }, () => {
    assert.equal(hasAdsConsentInBrowser(), false);
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
    sessionStorage.setItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY, JSON.stringify({ topup_amount_cents: 1000 }));
    clearBrowserAnalyticsState();
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(PENDING_TOPUP_CANCELLED_STORAGE_KEY), null);
  });
});

test('applying denied stored consent clears journey and pending auth state', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage, sessionStorage }) => {
    prepareBrowserAnalyticsEvents('sign_up_started');
    persistPendingAnalyticsEvent('sign_up_completed');

    applyStoredConsentEffects({
      version: '2026-07',
      timestamp: 1_000,
      categories: { analytics: false, ads: false },
      source: 'preferences',
    });

    assert.equal(localStorage.getItem('mv-consent-analytics'), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
  });
});

test('clearing the local analytics flag clears journey and pending auth state', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage, sessionStorage }) => {
    prepareBrowserAnalyticsEvents('sign_up_started');
    persistPendingAnalyticsEvent('sign_up_completed');

    clearLocalAnalyticsFlag();

    assert.equal(localStorage.getItem('mv-consent-analytics'), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(PENDING_AUTH_EVENT_STORAGE_KEY), null);
  });
});

for (const [label, delta] of [['longer', 1], ['shorter', -1]] as const) {
  test(`stored journeys with an altered ${label} lifetime are rejected and removed`, () => {
    withBrowser({ consent: 'granted' }, ({ localStorage }) => {
      prepareBrowserAnalyticsEvents('sign_up_started');
      const raw = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
      assert.ok(raw);
      const record = JSON.parse(raw) as { createdAt: number; expiresAt: number };
      record.expiresAt = record.createdAt + ANALYTICS_JOURNEY_TTL_MS + delta;
      localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, JSON.stringify(record));

      assert.equal(readAnalyticsJourney(), null);
      assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
    });
  });
}

test('stored journeys with URL-shaped attribution are rejected and removed', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage }) => {
    prepareBrowserAnalyticsEvents('sign_up_started');
    const raw = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    assert.ok(raw);
    const record = JSON.parse(raw) as { firstTouch: { source: string } };
    record.firstTouch.source = 'https://tracker.example/private';
    localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, JSON.stringify(record));

    assert.equal(readAnalyticsJourney(), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
  });
});

test('arbitrary marketing paths are never stored or emitted as landing surfaces', () => {
  withBrowser({
    consent: 'granted',
    href: 'https://maxvideoai.com/Bearer-private-token',
  }, ({ localStorage }) => {
    const events = prepareBrowserAnalyticsEvents('page_view', { route_family: 'marketing' });
    const stored = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY) ?? '';
    const serializedEvents = JSON.stringify(events);

    assert.doesNotMatch(stored, /Bearer|private|token/i);
    assert.doesNotMatch(serializedEvents, /Bearer|private|token/i);
    assert.equal(readAnalyticsJourney()?.firstTouch.landingSurface, undefined);
    assert.equal(events.some(({ payload }) => 'landing_surface' in payload), false);
  });
});

test('tampered stored journey landing surfaces are rejected and removed', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage }) => {
    prepareBrowserAnalyticsEvents('sign_up_started');
    const raw = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    assert.ok(raw);
    const record = JSON.parse(raw) as {
      firstTouch: { landingSurface?: string };
      lastTouch: { landingSurface?: string };
    };
    record.firstTouch.landingSurface = '/Bearer-private-token';
    record.lastTouch.landingSurface = '/private/customer-123';
    localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, JSON.stringify(record));

    assert.equal(readAnalyticsJourney(), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
  });
});

test('stored journeys with extra private fields are rejected and removed', () => {
  withBrowser({ consent: 'granted' }, ({ localStorage }) => {
    prepareBrowserAnalyticsEvents('sign_up_started');
    const raw = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    assert.ok(raw);
    const record = JSON.parse(raw) as Record<string, unknown>;
    record.prompt = 'Bearer private-token';
    localStorage.setItem(ANALYTICS_JOURNEY_STORAGE_KEY, JSON.stringify(record));

    assert.equal(readAnalyticsJourney(), null);
    assert.equal(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY), null);
  });
});

test('URL-shaped UTM values are absent from stored journeys and prepared payloads', () => {
  const url = new URL('https://maxvideoai.com/pricing');
  url.searchParams.set('utm_source', 'newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', 'https://tracker.example/private');
  url.searchParams.set('utm_content', 'cta#private');

  withBrowser({ consent: 'granted', href: url.href }, ({ localStorage }) => {
    const events = prepareBrowserAnalyticsEvents('sign_up_started');
    const stored = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
    assert.ok(stored);
    assert.doesNotMatch(stored, /tracker\.example|private/);
    assert.doesNotMatch(JSON.stringify(events), /tracker\.example|private/);
    assert.equal(readAnalyticsJourney()?.firstTouch.campaign, undefined);
    assert.equal(readAnalyticsJourney()?.firstTouch.content, undefined);
  });
});

test('scheme-less UTM paths are absent from stored journeys and prepared payloads', () => {
  for (const value of ['/oauth/callback', 'tracker.example/private', 'www.example.com/private']) {
    const url = new URL('https://maxvideoai.com/pricing');
    url.searchParams.set('utm_source', 'newsletter');
    url.searchParams.set('utm_medium', 'email');
    url.searchParams.set('utm_campaign', value);

    withBrowser({ consent: 'granted', href: url.href }, ({ localStorage }) => {
      const events = prepareBrowserAnalyticsEvents('sign_up_started');
      const stored = localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY);
      assert.ok(stored);
      assert.equal(stored.includes(value), false, value);
      assert.equal(JSON.stringify(events).includes(value), false, value);
      assert.equal(readAnalyticsJourney()?.firstTouch.campaign, undefined);
    });
  }
});

test('unapproved semantic attribution values are not stored or emitted', () => {
  const url = new URL('https://maxvideoai.com/pricing');
  url.searchParams.set('utm_source', 'newsletter');
  url.searchParams.set('utm_medium', 'email');
  url.searchParams.set('utm_campaign', 'partner.com');

  withBrowser({ consent: 'granted', href: url.href }, ({ localStorage }) => {
    const events = prepareBrowserAnalyticsEvents('sign_up_started');
    assert.equal(readAnalyticsJourney()?.firstTouch.source, 'direct');
    assert.equal(readAnalyticsJourney()?.firstTouch.campaign, undefined);
    assert.doesNotMatch(localStorage.getItem(ANALYTICS_JOURNEY_STORAGE_KEY) ?? '', /partner\.com/);
    assert.doesNotMatch(JSON.stringify(events), /partner\.com/);
  });
});
