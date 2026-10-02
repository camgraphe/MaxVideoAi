import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveCurrentModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-public-offer';

test('model offer uses the current exact customer quote for its visible and structured amount', async () => {
  const entry = getFalEngineById('pika-text-to-video')!;
  const offer = await resolveCurrentModelPublicOffer(entry, entry.engine, async (input) => {
    assert.equal(input.modelId, entry.id);
    return { status: 'exact', amountCents: 1234, currency: 'USD', revision: 'r1', scenarioLabel: 'current' };
  });
  assert.equal(offer?.amountCents, 1234);
  assert.equal(offer?.currency, 'USD');
  assert.equal(offer?.scenario.mode, 't2v');
});

test('model offer omits unavailable and retired prices instead of showing a stale number', async () => {
  const entry = getFalEngineById('pika-text-to-video')!;
  const unavailable = await resolveCurrentModelPublicOffer(entry, entry.engine,
    async () => ({ status: 'unavailable' }));
  assert.equal(unavailable, null);
  const retired = getFalEngineById('seedance-1-5-pro')!;
  assert.equal(await resolveCurrentModelPublicOffer(retired, retired.engine,
    async () => { throw new Error('retired model must not be quoted'); }), null);
});
