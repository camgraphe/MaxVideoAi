import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAnalyticsTouch, createAnalyticsJourneyRecord, prepareJourneyEvents, resolveAnalyticsTouch } from '../frontend/lib/analytics/journey';

const route = { landingRouteFamily: 'marketing', landingSurface: '/pricing', locale: 'en' };
const uuid = '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9';

test('resolution prioritizes campaign, organic, referral, then direct', () => {
  const campaign = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/pricing?utm_source=Google&utm_medium=CPC&utm_campaign=Launch&utm_content=Hero&utm_term=private', referrer: 'https://partner.example/post', siteOrigin: 'https://maxvideoai.com', ...route });
  assert.deepEqual(campaign, { source: 'google', medium: 'cpc', campaign: 'Launch', content: 'Hero', ...route });
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: 'https://www.google.com/search?q=x', siteOrigin: 'https://maxvideoai.com', ...route }).medium, 'organic');
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: 'https://partner.example/post', siteOrigin: 'https://maxvideoai.com', ...route }).medium, 'referral');
  assert.equal(resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route }).source, 'direct');
});

test('referral hostname attribution is bounded', () => {
  const hostname = `${'a'.repeat(40)}.${'b'.repeat(40)}.example`;
  const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${hostname}/post`, siteOrigin: 'https://maxvideoai.com', ...route });
  assert.equal(touch.source.length, 80);
  assert.equal(touch.referrerHost?.length, 80);
  assert.equal(touch.source, touch.referrerHost);
});

test('organic classification accepts verified engines and rejects lookalikes', () => {
  const organicHosts = [
    ['www.google.com', 'google'],
    ['www.bing.com', 'bing'],
    ['search.yahoo.com', 'yahoo'],
    ['duckduckgo.com', 'duckduckgo'],
    ['www.ecosia.org', 'ecosia'],
    ['www.baidu.com', 'baidu'],
    ['yandex.ru', 'yandex'],
  ] as const;
  for (const [hostname, source] of organicHosts) {
    const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${hostname}/search`, siteOrigin: 'https://maxvideoai.com', ...route });
    assert.equal(touch.medium, 'organic');
    assert.equal(touch.source, source);
  }

  for (const hostname of ['google.partner.example', 'yahoo.partner.example', 'yandex.partner.example']) {
    const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${hostname}/post`, siteOrigin: 'https://maxvideoai.com', ...route });
    assert.equal(touch.medium, 'referral');
    assert.equal(touch.source, hostname);
  }
});

test('organic classification uses the complete hostname before bounded storage', () => {
  const googleHostname = `${'a'.repeat(40)}.${'b'.repeat(40)}.google.com`;
  const googleTouch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${googleHostname}/search`, siteOrigin: 'https://maxvideoai.com', ...route });
  assert.equal(googleTouch.medium, 'organic');
  assert.equal(googleTouch.source, 'google');
  assert.equal(googleTouch.referrerHost?.length, 80);

  const lookalikeHostname = `${'a'.repeat(40)}.${'b'.repeat(20)}.google.com.partner.example`;
  const lookalikeTouch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${lookalikeHostname}/post`, siteOrigin: 'https://maxvideoai.com', ...route });
  assert.equal(lookalikeTouch.medium, 'referral');
  assert.equal(lookalikeTouch.source.length, 80);
  assert.equal(lookalikeTouch.referrerHost?.length, 80);
});

test('google country registrable domains are organic without accepting lookalikes', () => {
  for (const hostname of ['google.ch', 'images.google.co.ch', 'www.google.com.ch']) {
    const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: `https://${hostname}/search`, siteOrigin: 'https://maxvideoai.com', ...route });
    assert.equal(touch.medium, 'organic');
    assert.equal(touch.source, 'google');
  }

  const lookalike = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: 'https://google.partner.example/post', siteOrigin: 'https://maxvideoai.com', ...route });
  assert.equal(lookalike.medium, 'referral');
});

test('first touch is immutable and identical touches do not refresh time', () => {
  const first = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/?utm_source=google&utm_medium=cpc', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: 1_000, touch: first });
  const same = applyAnalyticsTouch(record, first, 2_000);
  assert.deepEqual(same.firstTouch, first);
  assert.equal(same.lastTouchAt, 1_000);
  const next = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/?utm_source=newsletter&utm_medium=email', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const updated = applyAnalyticsTouch(same, next, 3_000);
  assert.deepEqual(updated.firstTouch, first);
  assert.deepEqual(updated.lastTouch, next);
  assert.equal(updated.lastTouchAt, 3_000);
});

test('event preparation emits one entry and first-generation sequence', () => {
  const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: Date.UTC(2026, 6, 6), touch });
  const first = prepareJourneyEvents(record, 'generation_started', { local_key: 'local-1' }, Date.UTC(2026, 6, 7));
  assert.deepEqual(first.events.map((entry) => entry.event), ['funnel_entry', 'generation_started']);
  assert.equal(first.events[1]?.payload.is_first_generation, true);
  assert.equal(first.events[1]?.payload.generation_sequence, 1);
  assert.equal(first.events[1]?.payload.acquisition_cohort, '2026-W28');
  const second = prepareJourneyEvents(first.record, 'generation_started', { local_key: 'local-2' }, Date.UTC(2026, 6, 8));
  assert.deepEqual(second.events.map((entry) => entry.event), ['generation_started']);
  assert.equal(second.events[0]?.payload.is_first_generation, false);
  assert.equal(second.events[0]?.payload.generation_sequence, 2);
});

test('topup preparation increments attempts without confusing checkout-opened', () => {
  const touch = resolveAnalyticsTouch({ href: 'https://maxvideoai.com/', referrer: '', siteOrigin: 'https://maxvideoai.com', ...route });
  const record = createAnalyticsJourneyRecord({ journeyId: uuid, now: Date.UTC(2026, 6, 6), touch });
  const started = prepareJourneyEvents(record, 'topup_started', {}, Date.UTC(2026, 6, 7));
  assert.equal(started.events.at(-1)?.payload.topup_sequence, 1);
  assert.equal(started.events.at(-1)?.payload.is_first_topup_attempt, true);
  const opened = prepareJourneyEvents(started.record, 'topup_checkout_opened', {}, Date.UTC(2026, 6, 7));
  assert.equal(opened.record.topupStartedCount, 1);
});
