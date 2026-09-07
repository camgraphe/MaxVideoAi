import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getMembershipDiscountMap } from '../frontend/src/lib/membership';
import { buildCanonicalFixedProductSnapshot } from '../frontend/src/lib/billing-products';
import { buildPublicPricingFacts, buildFixedPublicProductFacts } from '../frontend/src/lib/pricing-public-facts';
import { quotePublicPricing } from '../frontend/src/lib/pricing-public-quote';
import { computeCanonicalBillingSnapshot, computeCanonicalStoryboardBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { resolveGenerateBillingPreflight } from '../frontend/app/api/generate/_lib/billing-preflight';
import { executeImageGeneration } from '../frontend/src/server/images/execute-image-generation';

const dependencies = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [], routingRules: [], warnings: [] }), warn: () => undefined } };

for (const engineId of ['seedance-2-5', 'gpt-image-2']) {
  test(`live ${engineId} billing and public quotes ignore every legacy tier and injected discount`, async () => {
    const engine = listFalEngines().find((entry) => entry.id === engineId)?.engine;
    assert.ok(engine);
    const context = engineId === 'gpt-image-2'
      ? { engine, durationSec: 1, resolution: '1024x1024', mode: 't2i', quality: 'high' }
      : { engine, durationSec: 4, resolution: '480p', mode: 't2v', aspectRatio: '21:9', addons: { generate_audio: true } };
    const standard = await computeCanonicalBillingSnapshot({ ...context, membershipTier: 'member' }, dependencies);
    for (const membershipTier of ['member', 'plus', 'pro', ' PRO ']) {
      const actual = await computeCanonicalBillingSnapshot({ ...context, membershipTier }, {
        ...dependencies, membershipDiscounts: { member: 0.8, plus: 0.9, pro: 1 },
      });
      assert.deepEqual(actual, standard);
      assert.equal(actual.membershipTier, 'member');
      assert.equal(actual.discount?.amountCents ?? 0, 0);
      const facts = buildPublicPricingFacts(context);
      const quote = quotePublicPricing({ ...facts, scenario: { id: 'retired-test', engineId, membershipTier, discountPercent: 1 } });
      const publicStandard = quotePublicPricing({ ...facts, scenario: { id: 'retired-test', engineId, membershipTier: 'member' } });
      assert.deepEqual(quote, publicStandard);
      assert.equal(quote.customerTotalCents, standard.totalCents);
    }
  });
}

test('fixed-product public and charged quotes retain the standard authored amount for stale tiers', () => {
  for (const memberTier of ['member', 'plus', 'pro'] as const) {
    const snapshot = buildCanonicalFixedProductSnapshot({ engineId: 'tool', currency: 'USD', amountCents: 125, quantity: 1, unit: 'run', unitRate: 1.25, memberTier, discountPercent: 0.9, meta: {} });
    const publicQuote = quotePublicPricing({ ...buildFixedPublicProductFacts({ engineId: 'tool', currency: 'USD', amountCents: 125, quantity: 1, unit: 'run' }), scenario: { id: 'tool', engineId: 'tool', membershipTier: memberTier, discountPercent: 0.9 } });
    assert.equal(snapshot.totalCents, 125);
    assert.equal(snapshot.membershipTier, 'member');
    assert.equal(snapshot.discount?.amountCents ?? 0, 0);
    assert.equal(publicQuote.customerTotalCents, snapshot.totalCents);
  }
});

test('new storyboard pricing drops historical membership while leaving its input snapshot untouched', async () => {
  const historical = { currency: 'USD', totalCents: 90, subtotalBeforeDiscountCents: 100, membershipTier: 'pro', discount: { tier: 'pro', percentApplied: 0.1, amountCents: 10 }, base: { seconds: 1, rate: 0.25, unit: 'image', amountCents: 25 }, addons: [], margin: { amountCents: 75, flatCents: 0 } };
  const before = structuredClone(historical);
  const result = await computeCanonicalStoryboardBillingSnapshot({ snapshot: historical, operation: 'storyboard' }, dependencies);
  assert.deepEqual(historical, before);
  assert.equal(result.membershipTier, 'member');
  assert.equal(result.discount?.amountCents ?? 0, 0);
  assert.equal(result.totalCents, 75);
  assert.deepEqual(await getMembershipDiscountMap(), { member: 0, plus: 0, pro: 0 });
});

test('old discounted web video/image requests require review before any database or charging work', async () => {
  for (const membershipTier of ['Plus', 'Pro', ' pro ']) {
    const result = await resolveGenerateBillingPreflight({ membershipTier } as never);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 409);
      assert.equal(result.body.error, 'PRICING_REFRESH_REQUIRED');
    }
    await assert.rejects(executeImageGeneration({ body: { membershipTier }, userId: 'test', walletReservation: 'reserve' } as never), (error: unknown) => {
      assert.match(String(error), /Refresh the page/);
      return true;
    });
  }
});

test('membership UI and pricing policy remain separate from historical receipt itemization', () => {
  const sources = [
    'frontend/components/marketing/PriceEstimator.tsx',
    'frontend/components/marketing/price-estimator/PriceEstimatorSummaryPanel.tsx',
    'frontend/components/marketing/PriceChip.tsx',
    'frontend/app/(core)/billing/_components/BillingInfoAside.tsx',
  ].map((path) => readFileSync(path, 'utf8')).join('\n');
  assert.doesNotMatch(sources, /setMemberTier|copy\.membership|memberBenefitCopy|pricing\.memberDiscount/);
  const admin = readFileSync('frontend/app/(core)/admin/membership/_hooks/useAdminMembershipController.ts', 'utf8');
  assert.doesNotMatch(admin, /\/preview|\/confirm|method: 'POST'/);
  const pricingFallback = readFileSync('frontend/lib/i18n/dictionary-data/en-pricing.ts', 'utf8');
  assert.doesNotMatch(pricingFallback, /member discounts|save 5%|save 10%/i);
  for (const locale of ['en', 'fr', 'es']) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    const faq = dictionary.workspace.billing.faq.entries;
    assert.doesNotMatch(JSON.stringify(faq), /applies automatically|s’applique automatiquement|se aplica automáticamente/);
    assert.ok(dictionary.videoPage.details.discountAppliedLabel);
  }
});


test('the web policy revision rejects every pre-retirement tab, including custom discounted Member, before charging', async () => {
  const { requireCurrentWebPricingPolicy } = await import('../frontend/server/pricing/web-pricing-policy');
  const { LIVE_PRICING_POLICY_REVISION } = await import('../frontend/src/lib/membership-policy');
  for (const revision of [null, 'old-policy']) {
    for (const shape of ['video', 'image', 'tool'] as const) {
      const response = requireCurrentWebPricingPolicy({ headers: { get: () => revision } }, shape);
      assert.equal(response?.status, 409);
      const body = await response!.json();
      assert.equal(shape === 'video' ? body.error : body.error.code, 'PRICING_REFRESH_REQUIRED');
    }
  }
  assert.equal(requireCurrentWebPricingPolicy({ headers: { get: () => LIVE_PRICING_POLICY_REVISION } }), null);
  for (const route of ['generate/route.ts', 'images/generate/route.ts', 'tools/angle/route.ts', 'tools/character-builder/route.ts', 'tools/background-removal/route.ts', 'tools/upscale/_shared.ts']) {
    assert.match(readFileSync(`frontend/app/api/${route}`, 'utf8'), /requireCurrentWebPricingPolicy\(req/);
  }
  assert.match(readFileSync('frontend/app/api/wallet/route.ts', 'utf8'), /requireCurrentWalletDirectPricingPolicy\(req/);
});
