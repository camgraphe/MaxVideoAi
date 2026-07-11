import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { analyticsConsentFromUpdateEvent } from '../frontend/lib/analytics/consent-client';

function withAnalyticsStorage(value: string | null, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = {
    getItem: (key: string) => key === 'mv-consent-analytics' ? value : null,
  } as Storage;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: storage },
  });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
    else Reflect.deleteProperty(globalThis, 'window');
  }
}

test('consent event detail wins during same-page grants and withdrawals', () => {
  withAnalyticsStorage(null, () => {
    assert.equal(analyticsConsentFromUpdateEvent(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: true, ads: false } },
    })), true);
  });
  withAnalyticsStorage('granted', () => {
    assert.equal(analyticsConsentFromUpdateEvent(new CustomEvent('consent:updated', {
      detail: { categories: { analytics: false, ads: true } },
    })), false);
  });
});

test('ads-only and detail-free updates re-read the unchanged analytics state', () => {
  withAnalyticsStorage('granted', () => {
    assert.equal(analyticsConsentFromUpdateEvent(new CustomEvent('consent:updated', {
      detail: { categories: { ads: false } },
    })), true);
    assert.equal(analyticsConsentFromUpdateEvent(new Event('consent:updated')), true);
  });
});

test('Express Checkout remounts only when the analytics consent primitive changes', () => {
  const source = readFileSync(
    'frontend/app/(core)/billing/_components/WalletExpressCheckout.tsx',
    'utf8'
  );
  assert.match(source, /analyticsConsentFromUpdateEvent/);
  assert.match(source, /window\.addEventListener\('consent:updated'/);
  assert.match(source, /setAnalyticsConsentGranted\(\(current\) => current === nextConsent \? current : nextConsent\)/);
  const dependencyBlocks = [...source.matchAll(/\}, \[\n([\s\S]*?)\n  \]\);/g)].map((match) => match[1]);
  const mountEffectDependencies = dependencyBlocks.find((block) => block.includes('amountCents')) ?? '';
  assert.match(mountEffectDependencies, /analyticsConsentGranted/);
  assert.doesNotMatch(mountEffectDependencies, /labels\.|onCaptchaRequired|onPaymentFailed|onPaymentStarted/);
});
