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

test('Vercel retains the approved ChatGPT paid campaign while stripping unrelated and unapproved query values', () => {
  const campaign = 'utm_source=chatgpt&utm_medium=cpc&utm_campaign=chatgpt_ads_pilot_202611&utm_content=no_subscription_v1';
  const url = 'https://maxvideoai.com/pricing';
  assert.equal(sanitizeVercelAnalyticsEvent({
    type: 'pageview', url: `${url}?${campaign}&token=private-query#private-hash`,
  })?.url, `${url}?${campaign}`);
  for (const rejected of [
    campaign.replace('chatgpt_ads_pilot_202611', 'private-campaign'),
    campaign.replace('no_subscription_v1', 'private-creative'),
  ]) {
    assert.equal(sanitizeVercelAnalyticsEvent({ type: 'pageview', url: `${url}?${rejected}` })?.url, url);
  }
});

test('Vercel keeps localized Higgsfield pages and the single bounded Reddit campaign', () => {
  const campaign = 'utm_source=reddit&utm_medium=organic_social&utm_campaign=community_pilot&utm_content=mcp_quote';
  for (const prefix of ['', '/fr', '/es']) {
    const url = `https://maxvideoai.com${prefix}/higgsfield-alternative`;
    assert.equal(sanitizeVercelAnalyticsEvent({
      type: 'pageview', url: `${url}?${campaign}&token=private-query#private-hash`,
    })?.url, `${url}?${campaign}`);
    assert.equal(sanitizeVercelAnalyticsEvent({
      type: 'pageview', url: `${url}?${campaign.replace('mcp_quote', 'private-campaign')}`,
    })?.url, url);
    assert.equal(sanitizeVercelAnalyticsEvent({
      type: 'pageview', url: `${url}/private-descendant?token=private-query`,
    })?.url, 'https://maxvideoai.com/other');
  }
});
