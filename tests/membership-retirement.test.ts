import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
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

test('active public pricing copy cannot advertise the retired membership program', async () => {
  const { pricing: fallbackPricing } = await import('../frontend/lib/i18n/dictionary-data/en-pricing');
  assert.equal('member' in fallbackPricing, false);
  assert.equal('memberStatus' in fallbackPricing.estimator.fields, false);
  assert.equal('memberChipPrefix' in fallbackPricing.estimator.estimateLabels, false);

  for (const locale of ['en', 'fr', 'es']) {
    const dictionary = JSON.parse(readFileSync(`frontend/messages/${locale}.json`, 'utf8'));
    assert.equal('member' in dictionary.pricing, false, `${locale} pricing copy should not expose retired member tiers`);
    assert.equal('memberStatus' in dictionary.pricing.estimator.fields, false, `${locale} estimator fields should not expose member status`);
    assert.equal('memberChipPrefix' in dictionary.pricing.estimator.estimateLabels, false, `${locale} estimator labels should not expose member savings`);
  }

  const estimatorSource = readFileSync('frontend/components/marketing/PriceEstimator.tsx', 'utf8');
  assert.doesNotMatch(estimatorSource, /memberStatus|memberChipPrefix|Member price|You save/);

  const featureFlags = readFileSync('frontend/content/feature-flags.ts', 'utf8');
  assert.doesNotMatch(featureFlags, /memberTiers/);

  const translationSource = readFileSync('fr-strings-to-translate.json', 'utf8');
  assert.doesNotMatch(translationSource, /member discounts|save 5%|save 10%/i);
});

test('the deterministic mock server also ignores legacy membership tiers', async () => {
  const port = await new Promise<number>((resolve, reject) => {
    const reservation = createServer();
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', () => {
      const address = reservation.address();
      assert.ok(address && typeof address === 'object');
      reservation.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
  const child = spawn(process.execPath, ['mock-server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
    assert.equal(ready, true, 'mock server should become ready');

    for (const memberTier of ['Plus', 'Pro']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: 'veo-3-1',
          mode: 't2v',
          durationSec: 8,
          resolution: '1080p',
          aspectRatio: '16:9',
          fps: 24,
          prompt: 'A quiet cinematic test shot.',
          addons: { audio: true },
          user: { memberTier },
        }),
      });
      const quote = await response.json() as { itemization: { base: { subtotal: number }; addons: Array<{ subtotal: number }>; discounts: unknown[] }; total: number };
      const subtotal = quote.itemization.base.subtotal + quote.itemization.addons.reduce((sum, addon) => sum + addon.subtotal, 0);
      assert.deepEqual(quote.itemization.discounts, []);
      assert.equal(quote.total, subtotal);
    }
  } finally {
    child.kill('SIGTERM');
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
