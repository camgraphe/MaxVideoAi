import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('new generation charges enter through canonical server pricing owners', () => {
  const canonicalConsumers = new Map<string, string>([
    ['frontend/app/api/generate/_lib/billing-preflight.ts', 'computeCanonicalBillingSnapshot'],
    ['frontend/app/api/wallet/route.ts', 'computeCanonicalBillingSnapshot'],
    ['frontend/src/server/images/execute-image-generation.ts', 'computeCanonicalBillingSnapshot'],
    ['frontend/src/server/images/storyboard-image-billing.ts', 'computeCanonicalBillingSnapshot'],
    ['frontend/src/server/audio/generate-audio.ts', 'computeCanonicalAudioBillingSnapshot'],
  ]);
  for (const [path, symbol] of canonicalConsumers) {
    const source = read(path);
    assert.match(source, new RegExp(symbol), `${path} should use ${symbol}`);
    assert.match(source, /quote-billing/, `${path} should import the server billing owner`);
  }
});

test('tool charges use canonical fixed-product quotes and canonical dynamic repricing', () => {
  const productSource = read('frontend/src/lib/billing-products.ts');
  assert.match(productSource, /quoteCanonicalPricing/);
  assert.match(productSource, /fixed-product-current/);
  assert.match(productSource, /repriceCanonicalFixedProductSnapshot/);

  const angle = read('frontend/src/server/tools/angle.ts');
  assert.match(angle, /computeBillingProductSnapshot/);
  for (const path of [
    'frontend/src/server/tools/background-removal-pricing-context.ts',
    'frontend/src/server/tools/upscale-pricing-context.ts',
  ]) {
    const source = read(path);
    assert.match(source, /repriceCanonicalFixedProductSnapshot/);
    assert.doesNotMatch(source, /clone(?:BackgroundRemoval|Upscale)PricingWithDynamicTotal/);
  }
});

test('API routes and tool runners never call the pure canonical kernel directly', () => {
  const forbiddenDirectOwners = [
    'frontend/app/api/generate/_lib/billing-preflight.ts',
    'frontend/app/api/wallet/route.ts',
    'frontend/src/server/images/execute-image-generation.ts',
    'frontend/src/server/images/storyboard-image-billing.ts',
    'frontend/src/server/audio/generate-audio.ts',
    'frontend/src/server/tools/angle.ts',
    'frontend/src/server/tools/background-removal-pricing-context.ts',
    'frontend/src/server/tools/upscale-pricing-context.ts',
  ];
  for (const path of forbiddenDirectOwners) {
    assert.doesNotMatch(read(path), /quoteCanonicalPricing/, `${path} should delegate canonical calculation`);
  }
});

test('public projections use their canonical owner without importing billing internals directly', () => {
  const owners = new Map([
    ['frontend/src/server/engines.ts', 'computeCanonicalPublicSnapshot'],
    ['frontend/app/api/images/estimate/route.ts', 'computeCanonicalPublicSnapshot'],
    ['frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts', 'computeCanonicalPublicSnapshot'],
    ['frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts', 'quotePublicPricing'],
    ['frontend/components/marketing/PriceEstimator.tsx', 'quotePublicPricing'],
    ['frontend/components/marketing/PriceChip.tsx', 'quotePublicPricing'],
  ]);
  for (const [path, symbol] of owners) {
    assert.match(read(path), new RegExp(symbol), `${path} should use ${symbol}`);
    assert.doesNotMatch(read(path), /quote-billing/, `${path} should not import billing internals directly`);
  }
  assert.doesNotMatch(read('frontend/src/lib/pricing.ts'), /quoteCanonicalPricing/);
});

test('refund paths use persisted charged amounts and never recompute pricing', () => {
  for (const path of [
    'frontend/server/fal-webhook-refunds.ts',
    'frontend/server/byteplus-poll.ts',
    'frontend/src/server/audio/audio-generate-receipts.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /computeCanonical(?:Audio)?BillingSnapshot|computePricingSnapshot|quoteCanonicalPricing/);
    assert.match(source, /final_price_cents|amountCents|amount_cents|pricing_snapshot/);
  }
});

test('pricing guide records canonical billing authority as complete', () => {
  const guide = read('docs/engineering/pricing-engine.md');
  assert.match(guide, /billing migration, and public projection migration are complete/i);
  assert.match(guide, /## Billing authority/i);
  assert.match(guide, /## Public authority/i);
});
