import assert from 'node:assert/strict';
import test from 'node:test';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { useBillingTopupAnalytics } from '../frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics';
import { useBillingCheckoutReturnToast } from '../frontend/app/(core)/billing/_hooks/useBillingCheckoutReturnToast';
import {
  clearBrowserAnalyticsAuthContext,
  resolveBrowserCommercialAnalyticsAuthContext,
  COMMERCIAL_ANALYTICS_RESOLVED_EVENT,
} from '../frontend/lib/analytics/commercial-client';

test('the consumed checkout return retains one Ads attempt until its ordinary account role resolves', async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://maxvideoai.test/billing?status=success&amount=25&currency=USD' });
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, React, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const savedFetch = globalThis.fetch;
  document.cookie = `mv-consent=${encodeURIComponent(JSON.stringify({ version: '2026-07', timestamp: Date.now(), categories: { analytics: false, ads: true }, source: 'preferences' }))}`;
  clearBrowserAnalyticsAuthContext();
  let release!: (response: Response) => void;
  globalThis.fetch = async () => new Promise((done) => { release = done; });
  const role = resolveBrowserCommercialAnalyticsAuthContext('ordinary-account', 'local-fixture', {});
  await Promise.resolve();
  const calls: unknown[][] = [];
  window.gtag = (...args) => { calls.push(args); };
  let trigger!: (value?: number, currency?: string) => void;
  let successCount = 0;
  const callbacks = {
    cancelledMessage: 'cancelled', successMessage: 'success',
    onAmountReturned() {}, onCancelled() {}, onReturnTarget() {}, onStatus() {}, onToast() {},
    onSuccess() { successCount += 1; },
  };
  function Probe() {
    const analytics = useBillingTopupAnalytics({});
    trigger = analytics.triggerGoogleAdsConversion;
    useBillingCheckoutReturnToast({ ...callbacks, accountId: 'ordinary-account', authLoading: false, onGoogleAdsConversion: trigger });
    return null;
  }
  const root = createRoot(document.getElementById('root')!);
  try {
    await act(async () => root.render(React.createElement(Probe)));
    assert.equal(successCount, 1, 'role measurement does not block checkout return handling');
    assert.equal(new URL(window.location.href).searchParams.has('status'), false);
    trigger(25, 'USD');
    assert.deepEqual(calls, [], 'both hook calls remain silent while the role is unknown');
    await act(async () => { release(new Response(JSON.stringify({ ok: false, commercialAnalyticsEligible: true }))); await role; });
    trigger(25, 'USD');
    window.dispatchEvent(new window.Event(COMMERCIAL_ANALYTICS_RESOLVED_EVENT));
    assert.equal(calls.length, 1, 'the hook and role notification share the original return attempt');
    assert.equal(calls[0][0], 'event');
    assert.equal(calls[0][1], 'conversion');
    assert.equal((calls[0][2] as Record<string, unknown>).value, 25);
    assert.equal((calls[0][2] as Record<string, unknown>).currency, 'USD');
  } finally {
    await act(async () => root.unmount());
    clearBrowserAnalyticsAuthContext();
    globalThis.fetch = savedFetch;
    dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
