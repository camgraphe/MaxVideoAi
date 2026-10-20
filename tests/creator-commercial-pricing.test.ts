import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { CREATOR_TOOL_IDS } from '../frontend/src/lib/toolbox/catalogue';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalCreatorBillingSnapshot, CREATOR_COMMERCIAL_POLICY_ID, quoteCreatorProviderBillingSnapshot } from '../frontend/server/pricing/quote-creator';
import { quoteCreatorLipSync } from '../frontend/src/server/tools/creator-profiles-lipsync';
import { quoteCreatorMotion } from '../frontend/src/server/tools/creator-profiles-motion';
import type { PricingContext } from '../frontend/src/lib/pricing-context';

const pricingPolicy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [{
  id: 'expensive-model-policy', marginPercent: 4, marginFlatCents: 55,
  surchargeAudioPercent: 0.9, surchargeUpscalePercent: 0.9, currency: 'USD',
}], routingRules: [{ id: 'routing', marginPercent: 4, marginFlatCents: 55, surchargeAudioPercent: 0.9,
  surchargeUpscalePercent: 0.9, currency: 'USD', vendorAccountId: 'acct_existing_vendor' }] }) };

test('all five creator products apply 120% markup to provider facts and retain settlement routing', () => {
  for (const toolId of CREATOR_TOOL_IDS) {
    const quote = quoteCreatorProviderBillingSnapshot({ toolId,
      facts: { engineId: 'supplier-fact', currency: 'USD', vendorSubtotalExactCents: 100, unit: 'operation', quantity: 1 },
      base: { seconds: 1, rate: 1, amountCents: 100, unit: 'operation' }, vendorAccountId: 'acct_vendor',
    });
    assert.equal(quote.totalCents, 220); // $1 supplier cost -> $2.20 before settlement FX/taxes.
    assert.equal(quote.margin.percentApplied, 1.2);
    assert.equal(quote.margin.flatCents, 0);
    assert.equal(quote.platformFeeCents, 120);
    assert.equal(quote.vendorShareCents, 100);
    assert.equal(quote.vendorAccountId, 'acct_vendor');
    assert.equal(quote.meta?.creatorPricingPolicy, CREATOR_COMMERCIAL_POLICY_ID);
  }
});

test('fractional supplier cents enter the unchanged standard rounding exactly once', () => {
  for (const [providerCents, customerCents] of [[0.8, 2], [1.04, 3], [3.2, 7], [4.16, 9], [100.01, 221]]) {
    const quote = quoteCreatorProviderBillingSnapshot({ toolId: 'subtitles',
      facts: { engineId: 'toolbox-subtitles', currency: 'USD', vendorSubtotalExactCents: providerCents!, unit: 'audio', quantity: 1 },
      base: { seconds: 60, rate: providerCents! / 100, amountCents: providerCents!, unit: 'audio' },
    });
    assert.equal(quote.totalCents, customerCents);
    assert.equal(quote.meta?.providerCostExactCents, providerCents);
    assert.equal(quote.vendorShareCents! + quote.platformFeeCents!, quote.totalCents);
  }
});

test('creator image prices replace ordinary retail policy and include supplier reference costs', async () => {
  for (const engineId of ['gpt-image-2-5-flare', 'nano-banana-2']) {
    const context: PricingContext = { engine: getFalEngineById(engineId)!.engine, durationSec: 1,
      mode: 'i2i', resolution: engineId === 'nano-banana-2' ? '1k' : 'square_hd',
      referenceImageCount: 2, quality: 'medium', aspectRatio: '1:1', membershipTier: 'member' };
    const deps = { pricingPolicy, loadCustomerTariffState: async () => ({ status: 'loaded' as const, active: false, revision: 0, databaseCells: [], versionedCells: [] }) };
    const ordinaryBefore = await computeCanonicalBillingSnapshot(context, deps);
    const creator = await computeCanonicalCreatorBillingSnapshot('product-photo-editor', context, { pricingPolicy });
    const ordinaryAfter = await computeCanonicalBillingSnapshot(context, deps);
    assert.deepEqual(ordinaryAfter, ordinaryBefore);
    assert.equal(ordinaryAfter.margin.percentApplied, 4);
    assert.equal(ordinaryAfter.meta?.creatorPricingPolicy, undefined);
    assert.equal(creator.margin.percentApplied, 1.2);
    assert.equal(creator.margin.flatCents, 0);
    assert.equal(creator.vendorAccountId, 'acct_existing_vendor');
    assert.notEqual(creator.totalCents, ordinaryBefore.totalCents);
    assert.deepEqual(creator.base, ordinaryBefore.base);
    assert.deepEqual(creator.addons, ordinaryBefore.addons);
    if (engineId === 'gpt-image-2-5-flare') {
      assert.ok(Number(creator.meta?.reference_image_subtotal_exact_cents) > 0);
      assert.equal(creator.meta?.minimum_edit_customer_cents, undefined);
      assert.equal(creator.meta?.additional_reference_customer_cents, undefined);
    }
  }
});

test('Wan tools price both input and output supplier seconds, including audio model cost', async () => {
  const context: PricingContext = { engine: getFalEngineById('wan-3')!.engine, mode: 'v2v', durationSec: 5,
    inputVideoDurationSec: 4.2, resolution: '720p', aspectRatio: '16:9', membershipTier: 'member', addons: { audio: true } };
  for (const toolId of ['lip-sync', 'product-video-editor', 'motion-transfer'] as const) {
    const quote = await computeCanonicalCreatorBillingSnapshot(toolId, context, { pricingPolicy });
    assert.equal(quote.meta?.input_video_duration_sec, 4.2);
    assert.equal(quote.meta?.output_duration_sec, 5);
    assert.equal(quote.meta?.billable_duration_sec, 9.2);
    assert.equal(quote.margin.percentApplied, 1.2);
    assert.ok(quote.addons.some(addon => addon.type === 'input_video_duration' && addon.amountCents > 0));
  }
  await assert.rejects(computeCanonicalCreatorBillingSnapshot('product-photo-editor', context, { pricingPolicy }), /CREATOR_PRICING_UNAVAILABLE/);
});

test('gated specialist quotes replace their former 150% markup without changing supplier list facts', async () => {
  const policy = (engineId: string) => ({ pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const,
    rules: [{ id: engineId, engineId, marginPercent: 1.5, marginFlatCents: 0, surchargeAudioPercent: 0,
      surchargeUpscalePercent: 0, currency: 'USD' }] }) } });
  const lip = await quoteCreatorLipSync(7.4, policy('toolbox-lip-sync'));
  assert.equal(lip.totalCents, 44); assert.equal(lip.meta?.providerCostListUsd, 0.2);
  const motion = await quoteCreatorMotion(25.4, policy('toolbox-motion-control'));
  assert.equal(motion.totalCents, 705); assert.equal(motion.meta?.providerCostListUsd, 3.2004);
});
