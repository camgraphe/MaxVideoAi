import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuntimeModelById } from '../frontend/config/model-runtime.ts';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public.ts';
import { quotePublicModelScenario, quoteWithVerifiedPolicy, resolvePublicModelScenario } from '../frontend/server/pricing/quote-public-model-scenario.ts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';

test('public GPT size quotes require valid dimensions and preserve the requested billing context', () => {
  for (const modelId of ['gpt-image-2', 'gpt-image-2-5-flare', 'gpt-image-2-5-sunburst']) {
    const input = { modelId, mode: 'i2i', durationSec: 1, quality: 'high' };
    const fixed = resolvePublicModelScenario({ ...input, resolution: '1920x1080' });
    assert.ok(fixed);
    for (const resolution of ['custom', 'auto']) {
      const scenario = resolvePublicModelScenario({ ...input, resolution, customImageSize: { width: 1920, height: 1088 } });
      assert.ok(scenario);
      assert.equal(scenario.id, fixed.id);
      assert.equal(scenario.context.resolution, resolution);
      assert.deepEqual(scenario.context.customImageSize, { width: 1920, height: 1088 });
      const facts = buildBillingPricingFacts(scenario.context, scenario.context.engine.pricingDetails, 'USD').facts;
      assert.deepEqual(buildManualTariffScenario(scenario.context, facts).selector, fixed.selector);
      assert.equal(resolvePublicModelScenario({ ...input, resolution }), null);
      assert.equal(resolvePublicModelScenario({ ...input, resolution, customImageSize: { width: 0, height: 1088 } }), null);
    }
    assert.ok(resolvePublicModelScenario({ ...input, resolution: 'auto', customImageSize: { width: 512, height: 512 } }),
      'verified automatic source dimensions follow existing charging bounds');
    for (const customImageSize of [{ width: 512, height: 512 }, { width: 1920, height: 1080 }, { width: 4096, height: 2160 }]) {
      assert.equal(resolvePublicModelScenario({ ...input, resolution: 'custom', customImageSize }), null);
    }
    assert.equal(resolvePublicModelScenario({ ...input, resolution: 'not-a-size' }), null);
    assert.equal(resolvePublicModelScenario({ ...input, resolution: '9999x9999' }), null);
    assert.equal(resolvePublicModelScenario({ ...input, resolution: '1024x1024', customImageSize: { width: 3840, height: 2160 } }), null);
    assert.equal(resolvePublicModelScenario({ ...input, resolution: '1024x1024', aspectRatio: 'bogus' }), null);
  }
  assert.equal(resolvePublicModelScenario({ modelId: 'nano-banana', mode: 't2i', durationSec: 1,
    resolution: '1024', customImageSize: { width: 1024, height: 1024 } }), null);
});

test('malformed public image dimensions return unavailable without coercing JSON objects or strings', () => {
  for (const resolution of ['auto', 'custom', '1024x1024']) {
    for (const customImageSize of [null, [], { width: '1024', height: 1024 },
      { width: { toString: {} }, height: 1024 }, { width: true, height: 1024 },
      { width: Infinity, height: 1024 }, { width: 1024 }]) {
      assert.equal(resolvePublicModelScenario({ modelId: 'gpt-image-2', mode: 't2i', durationSec: 1,
        resolution, customImageSize: customImageSize as never }), null);
    }
  }
});

test('public quotes select exact bounded references and preserve the default Luma reference count', async () => {
  const gpt = { modelId: 'gpt-image-2-5-flare', mode: 'i2i', durationSec: 4, resolution: '1024x1024', quality: 'high' };
  const selected = resolvePublicModelScenario({ ...gpt, referenceImageCount: 16 });
  assert.ok(selected);
  assert.equal(selected.context.durationSec, 4);
  assert.equal(selected.context.referenceImageCount, 16);
  const quote = await quotePublicModelScenario({ ...gpt, referenceImageCount: 16 }, async () => ({
    totalCents: 200, currency: 'USD',
  } as never));
  assert.equal(quote.status, 'exact');
  if (quote.status === 'exact') assert.equal(quote.scenarioLabel, 'i2i · 4 images · 1024x1024');
  assert.equal(resolvePublicModelScenario({ ...gpt, referenceImageCount: 17 }), null);
  const luma = { modelId: 'luma-uni-1', mode: 'i2i', durationSec: 1, resolution: '2K' };
  assert.equal(resolvePublicModelScenario(luma)?.context.referenceImageCount, 0);
  assert.equal(resolvePublicModelScenario({ ...luma, referenceImageCount: 1 })?.context.referenceImageCount, 1);
  assert.equal(resolvePublicModelScenario({ ...luma, referenceImageCount: 1.5 }), null);
});

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
  await assert.rejects(computeCurrentPublicSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => ({
    status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed',
  }) } }), /CURRENT_PRICING_POLICY_UNAVAILABLE/);
});

test('strict current public projection uses the captured effective database policy', async () => {
  const scenario = resolvePublicModelScenario({ modelId: 'pika-text-to-video', mode: 't2v', durationSec: 5, resolution: '720p' });
  assert.ok(scenario);
  let reads = 0;
  const pricing = await computeCurrentPublicSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => {
    reads += 1;
    return { status: 'loaded', rules: [{ id: 'effective-pika', engineId: 'pika-text-to-video',
      marginPercent: 1, marginFlatCents: 7, currency: 'USD' }] };
  } } });
  assert.equal(reads, 1);
  assert.equal(pricing.totalCents, 47);
  assert.equal((pricing.meta?.pricingPolicy as { sourceRuleId: string }).sourceRuleId, 'effective-pika');
});
