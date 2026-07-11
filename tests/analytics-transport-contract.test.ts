import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('all transports use consented journey preparation', () => {
  for (const file of ['frontend/components/analytics/GA4EventBridge.tsx', 'frontend/components/analytics/GA4RouteTracker.tsx', 'frontend/lib/analytics/ga-events.ts']) {
    assert.match(readFileSync(file, 'utf8'), /prepareBrowserAnalyticsEvents/);
  }
  const routeTracker = readFileSync('frontend/components/analytics/GA4RouteTracker.tsx', 'utf8');
  assert.doesNotMatch(routeTracker, /searchParams\?\.toString\(\)/);
  assert.match(routeTracker, /buildSafeAnalyticsLocation/);
});

test('all transports use the ordered prepared-event sender', () => {
  for (const file of ['frontend/components/analytics/GA4EventBridge.tsx', 'frontend/components/analytics/GA4RouteTracker.tsx', 'frontend/lib/analytics/ga-events.ts']) {
    assert.match(readFileSync(file, 'utf8'), /sendPreparedAnalyticsEvents/);
  }
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.match(bridge, /slice\(unsentIndex\)/);
});

test('direct retries cancel and clean up on consent and storage updates', () => {
  const sender = readFileSync('frontend/lib/analytics/ga-events.ts', 'utf8');
  assert.match(sender, /consent:updated/);
  assert.match(sender, /storage/);
  assert.match(sender, /removeEventListener/);
});

test('billing analytics uses shared consent-aware persistence and ads consent', () => {
  const hook = readFileSync('frontend/app/(core)/billing/_hooks/useBillingTopupAnalytics.ts', 'utf8');
  assert.doesNotMatch(hook, /sessionStorage/);
  assert.match(hook, /persistPendingTopupCancelledEvent/);
  assert.match(hook, /readPendingTopupCancelledEvent/);
  assert.match(hook, /hasAdsConsentInBrowser/);

  const consentClient = readFileSync('frontend/lib/analytics/consent-client.ts', 'utf8');
  assert.match(consentClient, /CONSENT_COOKIE_NAME/);
  assert.match(consentClient, /parseConsent/);
});

test('consent withdrawal clears queued analytics', () => {
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.match(bridge, /consent:updated/);
  assert.match(bridge, /clearBrowserAnalyticsState/);
  assert.match(bridge, /queuedEventsRef\.current = \[\]/);
});
