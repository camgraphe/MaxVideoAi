import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuntimeModelById } from '../frontend/config/model-runtime.ts';
import { quotePublicModelScenario, quoteWithVerifiedPolicy, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario.ts';

test('public scenario resolution uses supported video and image selectors only', () => {
  const video = resolvePublicModelScenario({ modelId: 'seedance-2-0-mini', mode: 't2v', durationSec: 5,
    resolution: '720p', audio: false });
  assert.ok(video);
  assert.equal(video.selector.engineId, 'seedance-2-0-mini');
  const image = resolvePublicModelScenario({ modelId: 'nano-banana-pro', mode: 't2i', durationSec: 1,
    resolution: '2k' });
  assert.ok(image);
  assert.equal(image.selector.mode, 't2i');
  assert.equal(getRuntimeModelById('lumaRay2')?.publication.pricing.published, false);
  assert.ok(resolvePublicModelScenario({ modelId: 'lumaRay2', mode: 't2v', durationSec: 5,
    resolution: '720p' }), 'a published legacy model page can ask for a quote without joining the Pricing listing');
  assert.equal(resolvePublicModelScenario({ modelId: 'seedance-2-0-mini', mode: 't2v', durationSec: 5,
    resolution: '720p', quantity: 2 }), null);
});

test('public exact quote carries current cents and a price-sensitive revision; failed reads omit the amount', async () => {
  const input = { modelId: 'seedance-2-0-mini', mode: 't2v', durationSec: 5, resolution: '720p', audio: false };
  const quoted = await quotePublicModelScenario(input, async () => ({ totalCents: 95,
    currency: 'USD', meta: { customerTariffRevision: 7 } } as never));
  const changed = await quotePublicModelScenario(input, async () => ({ totalCents: 96,
    currency: 'USD', meta: { customerTariffRevision: 8 } } as never));
  assert.equal(quoted.status, 'exact');
  assert.equal(changed.status, 'exact');
  if (quoted.status !== 'exact' || changed.status !== 'exact') return;
  assert.equal(quoted.amountCents, 95);
  assert.notEqual(quoted.revision, changed.revision);
  assert.deepEqual(await quotePublicModelScenario(input, async () => { throw new Error('database unavailable'); }),
    { status: 'unavailable' });
});

test('a pricing-rule outage cannot show a versioned fallback as the current customer price', async () => {
  const scenario = resolvePublicModelScenario({ modelId: 'pika-text-to-video', mode: 't2v',
    durationSec: 5, resolution: '720p' });
  assert.ok(scenario);
  await assert.rejects(quoteWithVerifiedPolicy(scenario, async () => ({ status: 'unavailable',
    rules: [], errorCode: 'pricing_rules_query_failed' })), /CURRENT_PRICING_POLICY_UNAVAILABLE/);
});
