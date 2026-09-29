import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurrentHomePriceDemo } from '../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/current-home-price-demo-data';

test('home price demo uses current exact customer cents for all three controls', async () => {
  const [demo] = await buildCurrentHomePriceDemo('en', async (input) => ({
    status: 'exact', amountCents: input.durationSec * 100, currency: 'USD',
    revision: 'current', scenarioLabel: 'test',
  }));
  assert.deepEqual(demo.steps.map((step) => step.amountCents), [500, 1500, 1500]);
});

test('home price demo disappears if any current scenario cannot be quoted', async () => {
  assert.deepEqual(await buildCurrentHomePriceDemo('fr', async () => ({ status: 'unavailable' })), []);
});
