import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getBytePlusVideoListRate,
  getPublishedPromotionAt,
  getSeedance15ListRate,
  getSeedance25StepListRate,
  quoteSeedreamListCost,
} from '../frontend/server/byteplus-list-tariff';

test('the temporary Fast and Mini campaign has an end boundary and never poses as an account rate', () => {
  const fast = getBytePlusVideoListRate({ profile: 'fast', resolution: '720p', billingInputType: 'video_input' });
  assert.equal(fast.unitPriceUsdPer1kTokens, 0.0033);
  assert.equal(fast.effectiveUnitPriceUsdPer1kTokens, null);
  assert.deepEqual(fast.promotion, {
    unitPriceUsdPer1kTokens: 0.002475,
    startsAt: '2026-08-07T06:00:00.000Z',
    endsAt: '2026-10-07T06:00:00.000Z',
    status: 'published_temporary_promotion',
  });
  const mini = getBytePlusVideoListRate({ profile: 'mini', resolution: '480p', billingInputType: 'no_video_input' });
  assert.equal(mini.promotion?.unitPriceUsdPer1kTokens, 0.0014);
  assert.equal(getPublishedPromotionAt(fast, '2026-10-07T05:59:59.999Z')?.unitPriceUsdPer1kTokens, 0.002475);
  assert.equal(getPublishedPromotionAt(fast, '2026-10-07T06:00:00.000Z'), null);
  assert.throws(() => getBytePlusVideoListRate({ profile: 'fast', resolution: '1080p', billingInputType: 'no_video_input' }));
});

test('Seedance 1.5 distinguishes audio and draft token multipliers', () => {
  assert.deepEqual(getSeedance15ListRate({ audio: true, step: 'normal' }), {
    unitPriceUsdPer1kTokens: 0.0024,
    tokenMultiplier: 1,
    effectiveUnitPriceUsdPer1kTokens: null,
  });
  assert.deepEqual(getSeedance15ListRate({ audio: false, step: 'draft' }), {
    unitPriceUsdPer1kTokens: 0.0012,
    tokenMultiplier: 0.7,
    effectiveUnitPriceUsdPer1kTokens: null,
  });
  assert.equal(getSeedance15ListRate({ audio: true, step: 'draft' }).tokenMultiplier, 0.6);
});

test('Seedance 2.5 Draft and final are separately billed at their own resolutions', () => {
  const draft = getSeedance25StepListRate({ step: 'draft', billingInputType: 'video_input' });
  const final = getSeedance25StepListRate({ step: 'final', billingInputType: 'video_input' });
  assert.equal(draft.resolution, '480p');
  assert.equal(draft.unitPriceUsdPer1kTokens, 0.0064);
  assert.equal(final.resolution, '1080p');
  assert.equal(final.unitPriceUsdPer1kTokens, 0.007);
  assert.equal(draft.billing, 'separate_task');
  assert.equal(final.billing, 'separate_task');
  assert.equal(final.effectiveUnitPriceUsdPer1kTokens, null);
});

test('Seedream charges successful outputs by actual pixel tier and additional Pro references', () => {
  assert.equal(quoteSeedreamListCost({ model: 'lite', outputPixels: [3000000, 3000000], inputImages: 8 }).totalUsd, 0.07);
  assert.equal(quoteSeedreamListCost({ model: 'pro', outputPixels: [2610000], inputImages: 1 }).totalUsd, 0.045);
  assert.equal(quoteSeedreamListCost({ model: 'pro', outputPixels: [2610001], inputImages: 3 }).totalUsd, 0.096);
  assert.equal(quoteSeedreamListCost({ model: 'pro', outputPixels: [], inputImages: 3 }).totalUsd, 0);
  assert.throws(() => quoteSeedreamListCost({ model: 'pro', outputPixels: [0], inputImages: 0 }));
});
