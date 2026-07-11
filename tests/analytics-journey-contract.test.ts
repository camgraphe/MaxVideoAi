import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseWalletAnalyticsJourney,
  sanitizeAttributionFieldValue,
  sanitizeAttributionValue,
  walletAnalyticsJourneyCacheKey,
} from '../frontend/lib/analytics/journey-contract';

const valid = {
  version: 1,
  journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
  cohortWeek: '2026-W28',
  firstSource: 'google',
  firstMedium: 'cpc',
  firstCampaign: 'summer_launch',
  firstContent: 'video_a',
  lastSource: 'partner.example',
  lastMedium: 'referral',
  lastCampaign: 'creator_wave',
  lastContent: 'cta_2',
} as const;

test('attribution sanitization is bounded', () => {
  assert.equal(sanitizeAttributionValue('  Google Ads  ', { lowercase: true }), 'google ads');
  assert.equal(sanitizeAttributionValue('<script>alert(1)</script>'), 'scriptalert1/script');
  assert.equal(sanitizeAttributionValue('x'.repeat(120))?.length, 80);
  assert.equal(sanitizeAttributionValue('   '), null);
});

test('field attribution rejects URL, path, query, and hash shapes before sanitizing', () => {
  assert.equal(sanitizeAttributionFieldValue('summer_launch'), 'summer_launch');
  assert.equal(sanitizeAttributionFieldValue('partner.com'), 'partner.com');
  for (const value of [
    'https://tracker.example/private',
    'prefix https://tracker.example/private',
    'javascript:alert(1)',
    '//tracker.example/private',
    '/oauth/callback',
    'tracker.example/private',
    'www.example.com/private',
    'oauth\\callback',
    'summer?token=private',
    'summer#private',
  ]) {
    assert.equal(sanitizeAttributionFieldValue(value), null, value);
  }
});

test('wallet parser accepts only the versioned bounded contract', () => {
  assert.deepEqual(parseWalletAnalyticsJourney(valid), valid);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, version: 2 }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, journeyId: 'invalid' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, cohortWeek: '2026-28' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, firstSource: '' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, firstSource: 'https://tracker.example/private' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, firstSource: 'tracker.example/private' }), null);
  assert.equal(parseWalletAnalyticsJourney({ ...valid, firstCampaign: 'summer#private' }), null);
});

test('wallet cache keys change with attribution', () => {
  assert.equal(walletAnalyticsJourneyCacheKey(valid), walletAnalyticsJourneyCacheKey({ ...valid }));
  assert.notEqual(walletAnalyticsJourneyCacheKey(valid), walletAnalyticsJourneyCacheKey({ ...valid, lastCampaign: 'other' }));
  assert.equal(walletAnalyticsJourneyCacheKey(null), 'no-attribution');
});
