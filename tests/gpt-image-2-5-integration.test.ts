import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  isGptImageFamilyEngineId,
  calculateGptImage25ProviderPrice,
  normalizeGptImageQuality,
  resolveGptImage25PricingTier,
} from '../frontend/lib/image/gptImage2.ts';
import { getImageInputField, getReferenceConstraints } from '../frontend/lib/image/inputSchema.ts';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts.ts';
import { buildPublicUnitPricingFacts } from '../frontend/src/lib/pricing-public-facts.ts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote.ts';
import { buildFalImageGenerationInput } from '../frontend/src/server/images/image-fal-generation.ts';
import { estimateImageGeneration, ImageEstimateError } from '../frontend/src/server/images/estimate-image-generation.ts';
import { getModelPageTemplateConfig } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

const expectedEndpoints = {
  'gpt-image-2-5-flare': {
    t2i: 'openai/gpt-image-2.5/flare/text-to-image',
    i2i: 'openai/gpt-image-2.5/flare/edit',
  },
  'gpt-image-2-5-sunburst': {
    t2i: 'openai/gpt-image-2.5/sunburst/text-to-image',
    i2i: 'openai/gpt-image-2.5/sunburst/edit',
  },
} as const;

const expectedMarketingImages = {
  'gpt-image-2-5-flare':
    'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/6c1fb061-f94e-497f-8f33-7b85d3bceb78.png',
  'gpt-image-2-5-sunburst':
    'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/61ed3009-b76c-4a5b-acf4-b332563f5e99.png',
} as const;

for (const [engineId, endpoints] of Object.entries(expectedEndpoints)) {
  test(`${engineId} exposes the two exact fal.ai routes`, () => {
    const entry = listFalEngines().find((candidate) => candidate.id === engineId);

    assert.ok(entry);
    assert.equal(entry.modes.find((mode) => mode.mode === 't2i')?.falModelId, endpoints.t2i);
    assert.equal(entry.modes.find((mode) => mode.mode === 'i2i')?.falModelId, endpoints.i2i);
  });

  test(`${engineId} uses its reviewed MaxVideoAI generation as model-page media`, () => {
    const entry = listFalEngines().find((candidate) => candidate.id === engineId);
    const expectedImage = expectedMarketingImages[engineId as keyof typeof expectedMarketingImages];

    assert.ok(entry);
    assert.equal(entry.media?.imagePath, expectedImage);
    assert.equal(entry.media?.videoUrl, expectedImage);
    assert.match(entry.media?.altText ?? '', /GPT Image 2\.5/);
  });

  test(`${engineId} exposes deterministic quality, background, and edit-reference controls`, () => {
    const engine = listFalEngines().find((candidate) => candidate.id === engineId)?.engine;
    assert.ok(engine);

    assert.deepEqual(getImageInputField(engine, 'quality', 't2i')?.values, [
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    assert.deepEqual(getImageInputField(engine, 'background', 't2i')?.values, [
      'auto',
      'transparent',
      'opaque',
    ]);
    assert.equal(getReferenceConstraints(engine, 'i2i').max, 16);
  });
}

test('GPT Image family detection includes 2.5 without changing legacy GPT Image 2 quality normalization', () => {
  assert.equal(isGptImageFamilyEngineId('gpt-image-2'), true);
  assert.equal(isGptImageFamilyEngineId('gpt-image-2-5-flare'), true);
  assert.equal(isGptImageFamilyEngineId('gpt-image-2-5-sunburst'), true);
  assert.equal(isGptImageFamilyEngineId('seedream'), false);
  assert.equal(normalizeGptImageQuality('MAX', 'gpt-image-2-5-flare'), 'max');
  assert.equal(normalizeGptImageQuality('max', 'gpt-image-2'), 'high');
});

test('GPT Image 2.5 pricing preserves fal.ai fractional provider cents', () => {
  const hd = resolveGptImage25PricingTier('1024x768');
  const fourK = resolveGptImage25PricingTier('3840x2160');

  assert.equal(hd.prices.high, 3.612);
  assert.equal(hd.prices.max, 14.445);
  assert.equal(fourK.prices.low, 1.113);
  assert.equal(fourK.prices.max, 40.026);
});

test('GPT Image 2.5 edit pricing includes only references beyond the first included image', () => {
  const price = calculateGptImage25ProviderPrice({
    mode: 'i2i',
    imageSize: '1024x1024',
    quality: 'high',
    outputCount: 1,
    referenceImageCount: 3,
  });

  assert.equal(price.outputSubtotalExactCents, 5.268);
  assert.equal(price.paidReferenceImageCount, 2);
  assert.equal(price.referenceSubtotalExactCents, 1.6);
  assert.equal(price.providerSubtotalExactCents, 6.868);
});

test('GPT Image 2.5 billing facts use the exact quality-and-size vendor subtotal', () => {
  const engine = listFalEngines().find((candidate) => candidate.id === 'gpt-image-2-5-flare')?.engine;
  assert.ok(engine);

  const result = buildBillingPricingFacts({
    engine,
    durationSec: 2,
    resolution: '1024x768',
    mode: 't2i',
    quality: 'high',
  }, engine.pricingDetails, 'USD');

  assert.equal(result.facts.vendorSubtotalExactCents, 7.224);
  assert.equal(result.base.amountCents, 8);
  assert.equal(result.meta.pricing_model, 'gpt_image_2_5_quality_size');
});

test('GPT Image 2.5 sub-cent estimator rates preserve exact cents before customer rounding', () => {
  const facts = buildPublicUnitPricingFacts({
    engineId: 'gpt-image-2-5-flare',
    currency: 'USD',
    unitPriceCents: 0.402,
    unit: 'image',
  });
  const quote = quotePublicPricing({
    facts: facts.facts,
    scenario: {
      id: 'test:gpt-image-2-5-flare:low',
      engineId: 'gpt-image-2-5-flare',
      resolution: '1024x768-low',
      membershipTier: 'member',
    },
    compatibilityProfileId: facts.compatibilityProfileId,
  });

  assert.equal(facts.compatibilityProfileId, 'standard');
  assert.equal(facts.facts.vendorSubtotalExactCents, 0.402);
  assert.equal(quote.customerTotalCents, 1);
});

test('GPT Image 2.5 rejects invalid custom dimensions before provider execution', async () => {
  await assert.rejects(
    estimateImageGeneration({
      engineId: 'gpt-image-2-5-flare',
      mode: 't2i',
      numImages: 1,
      resolution: 'custom',
      customImageSize: { width: 1000, height: 1000 },
      quality: 'high',
    }),
    (error: unknown) => error instanceof ImageEstimateError && error.code === 'image_size_invalid'
  );
});

test('fal.ai payload forwards GPT Image 2.5 background control', () => {
  const input = buildFalImageGenerationInput({
    falModelId: 'openai/gpt-image-2.5/flare/text-to-image',
    effectivePrompt: 'transparent product cutout',
    numImages: 1,
    mode: 't2i',
    resolvedReferenceUrls: [],
    falAspectRatio: null,
    providerImageSize: 'square_hd',
    resolutionEngineParam: 'image_size',
    normalizedSeed: null,
    outputFormat: 'png',
    quality: 'high',
    background: 'transparent',
    maskUrl: null,
    enableWebSearch: false,
    thinkingLevel: null,
    limitGenerations: false,
  });

  assert.equal(input.background, 'transparent');
});

for (const slug of ['gpt-image-2-5-flare', 'gpt-image-2-5-sunburst']) {
  test(`${slug} has a public model-page template wired to the image workspace`, () => {
    const template = getModelPageTemplateConfig(slug);
    assert.ok(template);
    assert.equal(template.hero.primaryCtaHref, `/app/image?engine=${slug}`);
    assert.equal(template.pricing.anchorHref, `/pricing#${slug}-pricing`);
  });
}
