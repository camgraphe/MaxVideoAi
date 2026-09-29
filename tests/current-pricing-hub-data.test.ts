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
