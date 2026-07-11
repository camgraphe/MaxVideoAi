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

test('consent withdrawal clears queued analytics', () => {
  const bridge = readFileSync('frontend/components/analytics/GA4EventBridge.tsx', 'utf8');
  assert.match(bridge, /consent:updated/);
  assert.match(bridge, /clearBrowserAnalyticsState/);
  assert.match(bridge, /queuedEventsRef\.current = \[\]/);
});
