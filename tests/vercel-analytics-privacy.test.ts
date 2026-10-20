import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeVercelAnalyticsEvent } from '../frontend/lib/analytics/vercel-context';

test('Vercel page views retain public pages and approved campaigns, without arbitrary query values', () => {
  assert.deepEqual(sanitizeVercelAnalyticsEvent({
    type: 'pageview',
    url: 'https://maxvideoai.com/fr/blog/ai-video?utm_source=google&utm_medium=cpc&utm_campaign=Launch&utm_content=Hero&token=private',
  }), {
    type: 'pageview',
    url: 'https://maxvideoai.com/fr/blog/ai-video?utm_source=google&utm_medium=cpc&utm_campaign=Launch&utm_content=Hero',
  });
});

test('Vercel private pages collapse identifiers and excluded or foreign URLs are dropped', () => {
  assert.equal(sanitizeVercelAnalyticsEvent({
    type: 'pageview', url: 'https://maxvideoai.com/app/studio/conversation/private-id?token=secret',
  })?.url, 'https://maxvideoai.com/app/studio');
  for (const url of ['https://maxvideoai.com/admin/payments', 'https://maxvideoai.com/auth/reset-password', 'https://example.com/']) {
    assert.equal(sanitizeVercelAnalyticsEvent({ type: 'pageview', url }), null);
  }
});
