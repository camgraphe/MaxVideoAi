import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { calculateGoogleOmniProviderCostCents } from '../frontend/src/lib/google-omni-pricing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
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

test('Google Omni exact pricing rejects source-video modes without verified duration metadata', () => {
  assert.throws(
    () => buildBillingPricingFacts({
      engine,
      durationSec: 5,
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

  assert.equal(billing.facts.vendorSubtotalExactCents, 31);
  assert.equal(publicFacts.facts.vendorSubtotalExactCents, 31);
  assert.equal(billing.meta.provider_cost_source, 'google_omni_1_1_token_pricing');
  assert.equal(publicFacts.meta.provider_cost_source, 'google_omni_1_1_token_pricing');
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
