import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCurrentOtherPricing } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/current-other-pricing';
import { getPricingHubCopy } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubCopy';
import { readRecastPublicPrice } from '../frontend/server/character-studio/recast-public-price';
import type { PublicModelQuoteInput } from '../frontend/lib/pricing-public-model-contract';

test('pricing page examples use the same current scoped Recast quote for each duration and resolution', async () => {
  for (const [multiplier, expected] of [[2, ['$1.68', '$3.36', '$8.40', '$16.80']], [2.5, ['$2.10', '$4.20', '$10.50', '$21.00']]] as const) {
    const calls: PublicModelQuoteInput[] = [];
    const data = await buildCurrentOtherPricing({ imageRows: [], audioRows: [], toolRows: [] }, 'en', {
      audio: async () => { throw new Error('not used'); }, product: async () => { throw new Error('not used'); },
      recast: async input => {
        calls.push(input);
        return readRecastPublicPrice(input, { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [{
          id: 'recast-only', engineId: 'character-recast', mode: 'recast', resolution: 'video', currency: 'USD',
          marginPercent: multiplier - 1, marginFlatCents: 0, surchargeAudioPercent: 0, surchargeUpscalePercent: 0, compatibilityProfile: 'standard',
        }] }) } });
      },
    });
    assert.deepEqual(data.recastExamples?.flatMap(row => [row.price720, row.price1080]), expected);
    assert.deepEqual(calls.map(input => [input.durationSec, input.inputVideoDurationSec ?? 0, input.resolution]),
      [[6, 0, '720p'], [6, 0, '1080p'], [15, 15, '720p'], [15, 15, '1080p']]);
    assert.ok(calls.every(input => input.modelId === 'wan-3-prime'));
  }
});

test('pricing page never keeps fabricated Recast amounts after unavailable or failed policy reads', async () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const data = await buildCurrentOtherPricing({ imageRows: [], audioRows: [], toolRows: [],
      recastExamples: [{ outputSeconds: 6, sourceSeconds: 0, price720: '$0.01', price1080: '$0.02' }] }, locale, {
      audio: async () => { throw new Error('not used'); }, product: async () => { throw new Error('not used'); },
      recast: async input => { if (input.resolution === '720p') throw new Error('DB unavailable'); return { status: 'unavailable' }; },
    });
    assert.ok(data.recastExamples?.every(row => row.price720 === getPricingHubCopy(locale).liveQuote
      && row.price1080 === getPricingHubCopy(locale).liveQuote));
    assert.match(getPricingHubCopy(locale).otherSurfaces.recastExample(15, 15), /15/);
  }
});
