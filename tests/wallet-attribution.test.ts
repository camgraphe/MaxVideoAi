import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCheckoutAttemptAttributionMetadata,
  buildTopupAttributionGa4Params,
  buildWalletAttributionMetadata,
  matchesWalletAttribution,
  normalizeWalletAttribution,
} from '../frontend/server/wallet-attribution';

const input = {
  version: 1,
  journeyId: '7df6d42a-4b70-4eca-82fe-3a320c4a6eb9',
  cohortWeek: '2026-W28',
  firstSource: 'google',
  firstMedium: 'cpc',
  firstCampaign: 'launch',
  lastSource: 'newsletter',
  lastMedium: 'email',
} as const;

test('server accepts attribution only with consent', () => {
  const untrusted = new Proxy({}, {
    get() {
      throw new Error('consent denial must short-circuit parsing');
    },
  });

  assert.equal(normalizeWalletAttribution(untrusted, false), null);
  assert.equal(normalizeWalletAttribution({ ...input, journeyId: 'invalid' }, true), null);
  assert.equal(normalizeWalletAttribution(input, true)?.fingerprint.length, 32);
});

test('fingerprints use a fixed-order normalized projection', () => {
  const normalized = normalizeWalletAttribution({
    lastMedium: ' EMAIL ',
    firstCampaign: 'launch',
    firstMedium: ' CPC ',
    cohortWeek: '2026-W28',
    journeyId: '7DF6D42A-4B70-4ECA-82FE-3A320C4A6EB9',
    lastSource: ' NEWSLETTER ',
    firstSource: ' GOOGLE ',
    version: 1,
  }, true);

  assert.deepEqual(normalized?.journey, input);
  assert.equal(normalized?.fingerprint, '3aae283070284ead002c7d8f310ca15b');
  assert.equal(normalized?.fingerprint, normalizeWalletAttribution(input, true)?.fingerprint);
});

test('metadata projections are bounded and purpose-specific', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const stripe = buildWalletAttributionMetadata(normalized);

  assert.equal(stripe.journey_id, input.journeyId);
  assert.equal(stripe.attribution_fingerprint, normalized.fingerprint);
  assert.deepEqual(buildCheckoutAttemptAttributionMetadata(normalized), {
    journeyId: input.journeyId,
    acquisitionCohort: '2026-W28',
    firstSource: 'google',
    firstMedium: 'cpc',
    lastSource: 'newsletter',
    lastMedium: 'email',
    attributionFingerprint: normalized.fingerprint,
  });
  for (const [key, value] of Object.entries(stripe)) {
    assert.ok(key.length <= 40);
    assert.ok(value.length <= 80);
  }
  assert.ok(Object.keys(stripe).length <= 11);
});

test('null attributions produce empty metadata projections', () => {
  assert.deepEqual(buildWalletAttributionMetadata(null), {});
  assert.deepEqual(buildCheckoutAttemptAttributionMetadata(null), {});
});

test('reuse matching is symmetric', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const stripe = buildWalletAttributionMetadata(normalized);

  assert.equal(matchesWalletAttribution({}, null), true);
  assert.equal(matchesWalletAttribution(stripe, normalized), true);
  assert.equal(matchesWalletAttribution({}, normalized), false);
  assert.equal(matchesWalletAttribution(stripe, null), false);
  assert.equal(matchesWalletAttribution({
    ...stripe,
    journey_id: 'b1675fb7-bd06-44ec-a0ba-740af7f69e83',
  }, normalized), false);
  assert.equal(matchesWalletAttribution({ ...stripe, attribution_fingerprint: 'different' }, normalized), false);
});

test('webhook projection revalidates and allowlists attribution fields without fingerprints', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const metadata = {
    ...buildWalletAttributionMetadata(normalized),
    unrelated: 'do-not-forward',
  };
  const params = buildTopupAttributionGa4Params(metadata);

  assert.equal(params.journey_id, input.journeyId);
  assert.equal(params.first_touch_source, 'google');
  assert.equal('attribution_fingerprint' in params, false);
  assert.equal('unrelated' in params, false);
});

test('webhook projection rejects malformed or raw URL-like attribution metadata', () => {
  const normalized = normalizeWalletAttribution(input, true)!;
  const metadata = buildWalletAttributionMetadata(normalized);

  for (const invalidMetadata of [
    { ...metadata, journey_id: 'invalid' },
    { ...metadata, acquisition_cohort: '2026-28' },
    { ...metadata, first_touch_source: 'https://tracker.example/private' },
    { ...metadata, first_touch_medium: 'oauth/callback' },
    { ...metadata, first_touch_campaign: 'launch?token=private' },
    { ...metadata, first_touch_content: 'creative#private' },
    { ...metadata, last_touch_source: 'tracker.example/private' },
    { ...metadata, last_touch_medium: 'oauth\\callback' },
    { ...metadata, last_touch_campaign: 'launch?token=private' },
    { ...metadata, last_touch_content: 'creative#private' },
  ]) {
    assert.deepEqual(buildTopupAttributionGa4Params(invalidMetadata), {});
  }
});
