import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurrentPricingHubData } from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/currentPricingHubData';

test('Pricing image rows and popular image check use current customer quotes', async () => {
  const data = await buildCurrentPricingHubData('en', async (input) => ({
    status: 'exact', amountCents: input.mode === 't2i' ? 321 : 654,
    currency: 'USD', revision: 'current', scenarioLabel: 'test',
  }));
  assert.ok(data.otherSurfaces.imageRows.length > 0);
  for (const row of data.otherSurfaces.imageRows) {
    assert.equal(row.standardImage, '$3.21');
    assert.equal(row.highQualityImage, '$3.21');
  }
  assert.equal(data.popularChecks.find((row) => row.id === 'one-image-generation')?.price, '$3.21');
});

test('Pricing suppresses old image amounts when a current quote is unavailable', async () => {
  const data = await buildCurrentPricingHubData('fr', async () => ({ status: 'unavailable' }));
  for (const row of data.otherSurfaces.imageRows) {
    assert.doesNotMatch(row.standardImage, /\d+[.,]\d{2}/);
    assert.doesNotMatch(row.highQualityImage, /\d+[.,]\d{2}/);
  }
});

test('Pricing audio and tools project current server totals, including Character Builder quantities', async () => {
  const requests: Array<{ productKey: string; quantity: number }> = [];
  const data = await buildCurrentPricingHubData('en', async () => ({ status: 'unavailable' }), {
    audio: async () => ({ totalCents: 432, currency: 'USD' }),
    product: async (input) => { requests.push(input); return { totalCents: 543, currency: 'USD' }; },
  });
  for (const row of data.otherSurfaces.audioRows) {
    if (row.id === 'audio-cinematic' || row.id === 'audio-cinematic-voice') {
      assert.doesNotMatch(row.thirtySeconds, /\$4\.32/, 'source-backed packs do not support 30-second jobs');
      assert.match(row.mode, /10 s/);
      continue;
    }
    assert.equal(row.thirtySeconds, '$4.32');
    assert.equal(row.sixtySeconds, '$4.32');
    assert.equal(row.oneTwentySeconds, '$4.32');
  }
  assert.match(data.otherSurfaces.toolRows.find((row) => row.id === 'character-builder-draft')!.standardOutput, /\$5\.43/);
  assert.ok(requests.some((input) => input.productKey === 'character-draft' && input.quantity === 3));
  assert.ok(requests.some((input) => input.productKey === 'character-final' && input.quantity === 2));
  assert.match(data.otherSurfaces.toolRows.find((row) => row.id === 'video-upscale')!.standardOutput, /minimum/i);
});

test('Pricing never retains literal audio or tool prices when their effective sources are unavailable', async () => {
  const unavailable = async () => { throw new Error('database unavailable'); };
  const data = await buildCurrentPricingHubData('fr', async () => ({ status: 'unavailable' }), {
    audio: unavailable, product: unavailable,
  });
  for (const row of data.otherSurfaces.audioRows) assert.doesNotMatch(row.thirtySeconds, /\d+[.,]\d{2}/);
  for (const row of data.otherSurfaces.toolRows) {
    assert.doesNotMatch(row.standardOutput, /\d+[.,]\d{2}/);
    assert.doesNotMatch(row.proOutput, /\d+[.,]\d{2}/);
  }
});
