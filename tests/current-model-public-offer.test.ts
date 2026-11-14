import assert from 'node:assert/strict';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines';
import { resolveCurrentModelPublicOffer } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/current-model-public-offer';

test('model offer uses the current exact customer quote for its visible and structured amount', async () => {
  const entry = getFalEngineById('veo-3-1')!;
  assert.equal(entry.lifecycle, 'current');
  assert.equal(entry.surfaces.app.enabled, true);
  const offer = await resolveCurrentModelPublicOffer(entry, entry.engine, async (input) => {
    assert.equal(input.modelId, entry.id);
    return { status: 'exact', amountCents: 1234, currency: 'USD', revision: 'r1', scenarioLabel: 'current' };
  });
  assert.equal(offer?.amountCents, 1234);
  assert.equal(offer?.currency, 'USD');
  assert.equal(offer?.scenario.mode, 't2v');
});

test('model offer omits unavailable and retired prices instead of showing a stale number', async () => {
  const entry = getFalEngineById('veo-3-1')!;
  let calls = 0;
  const unavailable = await resolveCurrentModelPublicOffer(entry, entry.engine,
    async () => { calls++; return { status: 'unavailable' }; });
  assert.equal(calls, 1, 'a current published model must consult current pricing');
  assert.equal(unavailable, null);
  for (const modelId of ['seedance-1-5-pro', 'pika-text-to-video']) {
    const retired = getFalEngineById(modelId)!;
    assert.equal(retired.surfaces.app.enabled, false);
    assert.equal(await resolveCurrentModelPublicOffer(retired, retired.engine,
      async () => { throw new Error(`${modelId} must not be quoted after retirement`); }), null);
  }
});
