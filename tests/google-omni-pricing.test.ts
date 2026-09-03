import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import {
  calculateGoogleOmniProviderCost,
  calculateGoogleOmniProviderCostCents,
} from '../frontend/src/lib/google-omni-pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { resolveGoogleOmniInheritedDurationSec } from '../frontend/src/server/video-providers/google-vertex-omni/pricing-context';
import { estimateGoogleVertexOmniCost } from '../frontend/src/server/video-providers/google-vertex-omni/cost';

const engine = listFalEngines().find((entry) => entry.id === 'gemini-omni-flash')?.engine;
assert.ok(engine);

test('Google Omni 1.1 prices each output resolution from the documented output token rates', () => {
  const base = { outputDurationSec: 3, inputImageCount: 0, inputVideoDurationSec: 0 } as const;
  assert.equal(calculateGoogleOmniProviderCostCents({ ...base, outputResolution: '360p' }), 10);
  assert.equal(calculateGoogleOmniProviderCostCents({ ...base, outputResolution: '720p' }), 30);
  assert.equal(calculateGoogleOmniProviderCostCents({ ...base, outputResolution: '1080p' }), 46);
  assert.equal(calculateGoogleOmniProviderCostCents({ ...base, outputResolution: '4k' }), 91);
});

test('Google Omni 1.1 includes image and source-video input tokens before final cent rounding', () => {
  assert.equal(calculateGoogleOmniProviderCostCents({
    outputResolution: '720p',
    outputDurationSec: 3,
    inputImageCount: 2,
    inputVideoDurationSec: 0,
  }), 31);
  assert.equal(calculateGoogleOmniProviderCostCents({
    outputResolution: '720p',
    outputDurationSec: 3,
    inputImageCount: 0,
    inputVideoDurationSec: 5,
  }), 35);
});

test('Google Omni pricing retains fractional exact cents for canonical commercial math', () => {
  const pricing = calculateGoogleOmniProviderCost({
    outputResolution: '720p',
    outputDurationSec: 3,
    inputImageCount: 0,
    inputVideoDurationSec: 0,
  });
  assert.equal(pricing.providerCostUsd, 0.30408);
  assert.equal(pricing.providerCostExactCents, 30.408);
  assert.equal(pricing.providerCostCents, 30);
});

test('Google Omni exact pricing rejects source-video modes without verified duration metadata', () => {
  assert.throws(
    () => buildBillingPricingFacts({
      engine,
      durationSec: 5,
      inheritedDurationSec: 5,
      resolution: '720p',
      mode: 'extend',
      inputImageCount: 0,
    }, engine.pricingDetails, 'USD'),
    /source video duration metadata/i
  );
  assert.throws(
    () => buildPublicPricingFacts({
      engine,
      durationSec: 5,
      inheritedDurationSec: 5,
      resolution: '720p',
      mode: 'v2v',
      inputImageCount: 0,
    }),
    /source video duration metadata/i
  );
});

test('Google Omni billing and public facts use the same factual token calculator', () => {
  const context = {
    engine,
    durationSec: 3,
    resolution: '720p',
    mode: 'fl2v' as const,
    inputImageCount: 2,
    inputVideoDurationSec: 0,
  };
  const billing = buildBillingPricingFacts(context, engine.pricingDetails, 'USD');
  const publicFacts = buildPublicPricingFacts(context);

  assert.equal(billing.facts.vendorSubtotalExactCents, 30.744);
  assert.equal(publicFacts.facts.vendorSubtotalExactCents, 30.744);
  assert.equal(billing.meta.provider_cost_source, 'google_omni_1_1_token_pricing');
  assert.equal(publicFacts.meta.provider_cost_source, 'google_omni_1_1_token_pricing');
});

test('Google Omni edit pricing ignores selected duration and requires trusted inherited duration', () => {
  const contexts = [
    {
      mode: 'v2v' as const,
      inputVideoDurationSec: 4,
      expectedExactCents: 44.0192,
    },
    {
      mode: 'retake' as const,
      inputVideoDurationSec: 0,
      expectedExactCents: 40.544,
    },
  ];

  for (const context of contexts) {
    const billing = buildBillingPricingFacts({
      engine,
      durationSec: 10,
      inheritedDurationSec: 4,
      resolution: '720p',
      ...context,
    }, engine.pricingDetails, 'USD');
    const publicFacts = buildPublicPricingFacts({
      engine,
      durationSec: 3,
      inheritedDurationSec: 4,
      resolution: '720p',
      ...context,
    });
    assert.equal(billing.facts.quantity, 4);
    assert.equal(publicFacts.facts.quantity, 4);
    assert.equal(billing.facts.vendorSubtotalExactCents, context.expectedExactCents);
    assert.equal(publicFacts.facts.vendorSubtotalExactCents, context.expectedExactCents);
  }

  for (const mode of ['v2v', 'retake'] as const) {
    assert.throws(() => buildBillingPricingFacts({
      engine,
      durationSec: 5,
      resolution: '720p',
      mode,
      inputVideoDurationSec: mode === 'v2v' ? 5 : 0,
    }, engine.pricingDetails, 'USD'), /inherited.*duration/i);
  }
});

test('Google Omni inherited duration resolves only from trusted source or owned interaction data', async () => {
  assert.equal(await resolveGoogleOmniInheritedDurationSec({
    engineId: 'gemini-omni-flash',
    mode: 'v2v',
    userId: 'user_123',
    trustedSourceVideoDurationSec: 4.25,
  }), 4.25);

  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const resolved = await resolveGoogleOmniInheritedDurationSec({
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    userId: 'user_123',
    previousInteractionId: 'interactions/owned_123',
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
      return [{ duration_sec: 6 }] as never;
    },
  });
  assert.equal(resolved, 6);
  assert.match(queries[0]?.sql ?? '', /user_id = \$1/);
  assert.match(queries[0]?.sql ?? '', /provider_job_id = \$2/);
  assert.match(queries[0]?.sql ?? '', /engine_id = 'gemini-omni-flash'/);
  assert.match(queries[0]?.sql ?? '', /provider = 'google_vertex_omni_direct'/);
  assert.match(queries[0]?.sql ?? '', /status = 'completed'/);
  assert.deepEqual(queries[0]?.params, ['user_123', 'interactions/owned_123']);

  assert.equal(await resolveGoogleOmniInheritedDurationSec({
    engineId: 'gemini-omni-flash',
    mode: 'retake',
    userId: 'user_123',
    previousInteractionId: 'interactions/unowned',
    queryFn: async () => [] as never,
  }), undefined);
});

test('Google Omni provider estimates stay unavailable until source-video duration is verified', () => {
  const unverified = estimateGoogleVertexOmniCost({
    engineId: 'gemini-omni-flash',
    mode: 'extend',
    durationSec: 3,
    resolution: '720p',
  });
  assert.equal(unverified.providerCostUsd, null);

  const verified = estimateGoogleVertexOmniCost({
    engineId: 'gemini-omni-flash',
    mode: 'extend',
    durationSec: 3,
    resolution: '720p',
    inputVideoDurationSec: 5,
  });
  assert.equal(verified.providerCostUsd, 0.34752);
  assert.equal(verified.source, 'google_omni_1_1_token_pricing');
});
