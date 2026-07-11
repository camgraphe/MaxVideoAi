import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSafeAnalyticsLocation,
  getAnalyticsRouteContext,
  getSafeAnalyticsPath,
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

test('safe locations remove query, hash, locale prefix, and dynamic ids', () => {
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/login?code=secret#token'), 'https://maxvideoai.com/login');
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/billing?checkoutSessionId=cs_secret'), 'https://maxvideoai.com/billing');
  assert.equal(getSafeAnalyticsPath('/video/job_123/private-slug'), '/video/:video');
  assert.equal(getSafeAnalyticsPath('/fr/pricing?utm_source=google'), '/pricing');
  assert.equal(buildSafeAnalyticsLocation('https://maxvideoai.com', '/tools/angle?next=/private#secret'), 'https://maxvideoai.com/tools/angle');
});
