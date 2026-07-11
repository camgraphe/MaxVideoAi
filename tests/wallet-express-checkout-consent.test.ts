import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  analyticsConsentFromUpdateEvent,
  hasAnalyticsConsentCookieInBrowser,
} from '../frontend/lib/analytics/consent-client';

function consentCookie(analytics: boolean, ads = false): string {
  return `mv-consent=${encodeURIComponent(JSON.stringify({
    version: '2026-07',
    timestamp: 1_000,
    categories: { analytics, ads },
    source: 'preferences',
  }))}`;
}

function withConsentSources({
  cookie,
  storageValue,
}: {
  cookie: string;
  storageValue: string | null;
}, run: () => void) {
  const descriptors = {
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  };
  const storage = {
    getItem: (key: string) => key === 'mv-consent-analytics' ? storageValue : null,
  } as Storage;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie },
  });
  try {
    run();
  } finally {
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('consent event detail wins during same-page grants and withdrawals', () => {
  withConsentSources({ cookie: consentCookie(false), storageValue: null }, () => {
    assert.equal(analyticsConsentFromUpdateEvent(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: true, ads: false } },
    })), true);
  });
  withConsentSources({ cookie: consentCookie(true), storageValue: 'granted' }, () => {
    assert.equal(analyticsConsentFromUpdateEvent(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: false, ads: true } },
    })), false);
  });
});

test('Express consent follows the wallet cookie when local storage is missing', () => {
  withConsentSources({ cookie: consentCookie(true), storageValue: null }, () => {
    const initialConsent = hasAnalyticsConsentCookieInBrowser();
    assert.equal(initialConsent, true);

    const withdrawnConsent = analyticsConsentFromUpdateEvent(
      new CustomEvent('consent:updated', {
        detail: { categories: { analytics: false, ads: true } },
      }),
      hasAnalyticsConsentCookieInBrowser
    );
    assert.equal(withdrawnConsent, false);
    assert.notEqual(withdrawnConsent, initialConsent);

    const adsOnlyConsent = analyticsConsentFromUpdateEvent(
      new CustomEvent('consent:updated', { detail: { categories: { ads: false } } }),
      hasAnalyticsConsentCookieInBrowser
    );
    assert.equal(adsOnlyConsent, initialConsent);
    assert.equal(
      analyticsConsentFromUpdateEvent(new Event('consent:updated'), hasAnalyticsConsentCookieInBrowser),
      initialConsent
    );
  });
});

test('Express Checkout remounts only when the analytics consent primitive changes', () => {
  const source = readFileSync(
    'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx',
    'utf8'
  );
  assert.match(source, /analyticsConsentFromUpdateEvent/);
  assert.match(source, /useState\(hasAnalyticsConsentCookieInBrowser\)/);
  assert.match(source, /updateAnalyticsConsent\(hasAnalyticsConsentCookieInBrowser\(\)\)/);
  assert.match(source, /window\.addEventListener\('consent:updated'/);
  assert.match(source, /setAnalyticsConsentGranted\(\(current\) => current === nextConsent \? current : nextConsent\)/);
  assert.match(source, /analyticsConsentGranted \? 'analytics-granted' : 'analytics-denied'/);
  const dependencyBlocks = [...source.matchAll(/\}, \[\n([\s\S]*?)\n  \]\);/g)].map((match) => match[1]);
  const mountEffectDependencies = dependencyBlocks.find((block) => block.includes('amountCents')) ?? '';
  assert.match(mountEffectDependencies, /analyticsConsentGranted/);
  assert.doesNotMatch(mountEffectDependencies, /labels\.|onCaptchaRequired|onPaymentFailed|onPaymentStarted/);
});
