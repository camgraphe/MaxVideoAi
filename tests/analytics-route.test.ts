import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAnalyticsRouteContext,
  shouldLoadMarketingAnalytics,
  shouldLoadSpeedInsights,
} from '../frontend/lib/analytics-route.ts';

test('billing and workspace routes are eligible for Speed Insights', () => {
  assert.equal(shouldLoadSpeedInsights(getAnalyticsRouteContext('/billing').family), true);
  assert.equal(shouldLoadSpeedInsights(getAnalyticsRouteContext('/app').family), true);
  assert.equal(shouldLoadSpeedInsights(getAnalyticsRouteContext('/jobs').family), true);
});

test('admin routes stay excluded from Speed Insights', () => {
  assert.equal(shouldLoadSpeedInsights(getAnalyticsRouteContext('/admin').family), false);
});

test('marketing analytics stay scoped to marketing and public tools', () => {
  assert.equal(shouldLoadMarketingAnalytics(getAnalyticsRouteContext('/pricing').family), true);
  assert.equal(shouldLoadMarketingAnalytics(getAnalyticsRouteContext('/tools/angle').family), true);
  assert.equal(shouldLoadMarketingAnalytics(getAnalyticsRouteContext('/billing').family), false);
  assert.equal(shouldLoadMarketingAnalytics(getAnalyticsRouteContext('/app').family), false);
});
