import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>;
};

test('public pricing has an explicit read-only baseline and intentional generation command', () => {
  assert.equal(
    existsSync('frontend/scripts/pricing-public-baseline.ts'),
    true,
    'the exhaustive public pricing baseline collector should exist'
  );
  assert.equal(
    existsSync('tests/fixtures/pricing-public-projections.v1.json'),
    true,
    'the exhaustive public pricing fixture should exist'
  );
  assert.equal(
    packageJson.scripts?.['pricing:public-baseline'],
    'tsx --tsconfig frontend/tsconfig.json frontend/scripts/pricing-public-baseline.ts'
  );
  assert.equal(
    packageJson.scripts?.['pricing:public-baseline:generate'],
    'tsx --tsconfig frontend/tsconfig.json frontend/scripts/pricing-public-baseline.ts --write'
  );
});

type PublicProjectionFixture = {
  version: number;
  generatedFrom?: string;
  rows: Array<{
    id: string;
    surface: string;
    engineId: string;
    status: 'exact' | 'unavailable';
    currency?: string;
    customerTotalCents?: number;
    quantity?: number;
    structuredDataAmount?: string;
    compatibilityProfile?: string;
  }>;
};

test('public pricing baseline exhaustively covers eligible catalog and public surfaces', () => {
  const fixture = JSON.parse(
    readFileSync('tests/fixtures/pricing-public-projections.v1.json', 'utf8')
  ) as PublicProjectionFixture;
  assert.equal(fixture.version, 1);
  assert.equal(fixture.generatedFrom, 'canonical-public-pricing-paths');
  assert.ok(fixture.rows.length >= 250, `expected at least 250 public projection rows, got ${fixture.rows.length}`);

  const ids = fixture.rows.map((row) => row.id);
  assert.equal(new Set(ids).size, ids.length, 'public projection scenario ids must be unique');

  const requiredSurfaces = new Set([
    'pricing-hub-video',
    'pricing-hub-image',
    'pricing-hub-audio',
    'pricing-hub-tool',
    'model-page',
    'estimator',
    'price-chip',
    'json-ld',
    'workspace-preflight',
    'image-estimate',
  ]);
  const actualSurfaces = new Set(fixture.rows.map((row) => row.surface));
  for (const surface of requiredSurfaces) {
    assert.equal(actualSurfaces.has(surface), true, `missing public pricing surface ${surface}`);
  }

  for (const row of fixture.rows) {
    assert.ok(row.id.trim(), 'scenario id should not be empty');
    assert.ok(row.engineId.trim(), `${row.id}.engineId should not be empty`);
    if (row.status === 'exact') {
      assert.equal(Number.isInteger(row.customerTotalCents), true, `${row.id}.customerTotalCents`);
      assert.ok((row.customerTotalCents ?? -1) >= 0, `${row.id}.customerTotalCents should be non-negative`);
      assert.equal(row.currency, 'USD', `${row.id}.currency should stay USD`);
      assert.equal(typeof row.quantity === 'number' && Number.isFinite(row.quantity) && row.quantity! > 0, true);
      assert.ok(row.compatibilityProfile?.trim(), `${row.id}.compatibilityProfile should be explicit`);
    }
    if (row.structuredDataAmount != null) {
      assert.match(row.structuredDataAmount, /^\d+\.\d{2}$/);
    }
  }

  const estimatorEngineIds = new Set(
    fixture.rows.filter((row) => row.surface === 'estimator').map((row) => row.engineId)
  );
  const modelEngineIds = new Set(
    fixture.rows.filter((row) => row.surface === 'model-page').map((row) => row.engineId)
  );
  for (const entry of listFalEngines()) {
    if (entry.surfaces.pricing.includeInEstimator) {
      assert.equal(estimatorEngineIds.has(entry.id), true, `missing estimator baseline for ${entry.id}`);
    }
    if (entry.surfaces.modelPage.indexable) {
      assert.equal(modelEngineIds.has(entry.id), true, `missing model-page baseline for ${entry.id}`);
    }
  }
});

test('public pricing baseline freezes the estimator per-image branch actually rendered in the browser', () => {
  const fixture = JSON.parse(
    readFileSync('tests/fixtures/pricing-public-projections.v1.json', 'utf8')
  ) as PublicProjectionFixture;
  const nanoBanana = fixture.rows.find(
    (row) => row.id === 'estimator:nano-banana:member:default'
  );
  assert.equal(nanoBanana?.customerTotalCents, 7);
});

test('public pricing baseline ignores machine-specific pricing environment overrides', () => {
  const result = spawnSync('pnpm', ['--silent', 'pricing:public-baseline'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://baseline-must-not-connect.invalid/maxvideoai',
      LUMARAY2_BASE_5S_540P_USD: '99.99',
      LUMARAY2_FLASH_BASE_5S_540P_USD: '88.88',
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /current \(492 rows\)/);
});

test('canonical public pricing adapters exist and stay browser safe', () => {
  const browserModules = [
    'frontend/src/lib/pricing-public-facts.ts',
    'frontend/src/lib/pricing-public-quote.ts',
  ];
  for (const path of browserModules) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    const source = readFileSync(path, 'utf8');
    for (const forbidden of [
      "@/server",
      'pricing-rule-store',
      "@/lib/db",
      "@/lib/schema",
      "@/lib/env",
      'node:',
      'next/headers',
      'quote-billing',
      '/admin/',
    ]) {
      assert.equal(source.includes(forbidden), false, `${path} should not import ${forbidden}`);
    }
  }
  assert.equal(existsSync('frontend/server/pricing/quote-public.ts'), true);
});

test('canonical public quote owns policy, override precedence, discount, and snapshot projection', async () => {
  const publicQuote = await import('../frontend/src/lib/pricing-public-quote');
  assert.equal(typeof publicQuote.quotePublicPricing, 'function');
  assert.equal(typeof publicQuote.projectPublicPricingSnapshot, 'function');

  const facts = {
    engineId: 'public-test-engine',
    currency: 'USD',
    vendorSubtotalExactCents: 42.5,
    unit: 'sec',
    quantity: 5,
  };
  const standard = publicQuote.quotePublicPricing({
    facts,
    scenario: {
      id: 'public:test:standard',
      engineId: facts.engineId,
      resolution: '1080p',
      membershipTier: 'plus',
    },
    compatibilityProfileId: 'standard',
  });
  assert.equal(standard.marginCents, 13);
  assert.equal(standard.discountCents, 3);
  assert.equal(standard.customerTotalCents, 53);
  assert.equal(standard.policyProvenance.source, 'versioned');

  const overridden = publicQuote.quotePublicPricing({
    facts,
    scenario: {
      id: 'public:test:override',
      engineId: facts.engineId,
      resolution: '1080p',
      membershipTier: 'member',
    },
    compatibilityProfileId: 'standard',
    pricingRules: [
      { id: 'global-public', marginPercent: 0.4, marginFlatCents: 0, currency: 'USD' },
      { id: 'engine-public', engineId: facts.engineId, marginPercent: 0.45, marginFlatCents: 0, currency: 'USD' },
      {
        id: 'exact-public',
        engineId: facts.engineId,
        resolution: '1080p',
        marginPercent: 0.5,
        marginFlatCents: 0,
        currency: 'USD',
      },
    ],
  });
  assert.equal(overridden.marginCents, 22);
  assert.equal(overridden.customerTotalCents, 65);
  assert.equal(overridden.policyProvenance.source, 'database');
  assert.equal(overridden.policyProvenance.sourceRuleId, 'exact-public');

  const snapshot = publicQuote.projectPublicPricingSnapshot({
    quote: standard,
    base: { seconds: 5, rate: 0.085, unit: 'sec', amountCents: 42.5 },
    addons: [],
    meta: { surface: 'public-test' },
  });
  assert.equal(snapshot.totalCents, standard.customerTotalCents);
  assert.equal(snapshot.margin.amountCents, standard.marginCents);
  assert.deepEqual(snapshot.meta?.pricingPolicy, standard.policyProvenance);
});

test('public factual adapters expose provider costs without commercial fields', async () => {
  const publicFacts = await import('../frontend/src/lib/pricing-public-facts');
  assert.equal(typeof publicFacts.buildPublicPricingFacts, 'function');
  assert.equal(typeof publicFacts.buildAuthoredPublicOfferFacts, 'function');
  assert.equal(typeof publicFacts.buildFixedPublicProductFacts, 'function');

  const entries = listFalEngines();
  const standardEntry = entries.find((entry) => entry.id === 'veo-3-1-fast');
  assert.ok(standardEntry);
  const standard = publicFacts.buildPublicPricingFacts({
    engine: standardEntry.engine,
    durationSec: 8,
    resolution: '1080p',
    mode: 't2v',
  });
  assert.equal(standard.compatibilityProfileId, 'standard');
  assert.ok(standard.facts.vendorSubtotalExactCents > 0);
  assert.equal(standard.facts.engineId, standardEntry.engine.id);
  assert.equal('marginCents' in standard.facts, false);
  assert.equal('customerTotalCents' in standard.facts, false);

  const seedanceEntry = entries.find((entry) => entry.id === 'seedance-2-0');
  assert.ok(seedanceEntry);
  const providerReference = publicFacts.buildPublicPricingFacts({
    engine: seedanceEntry.engine,
    durationSec: 5,
    resolution: '720p',
    mode: 't2v',
  });
  assert.equal(providerReference.compatibilityProfileId, 'provider-reference-current');
  assert.ok(providerReference.facts.vendorSubtotalExactCents > 0);

  const authored = publicFacts.buildAuthoredPublicOfferFacts({
    engineId: standardEntry.id,
    currency: 'USD',
    amountCents: 168,
  });
  assert.equal(authored.compatibilityProfileId, 'schema-current');
  assert.equal(authored.facts.vendorSubtotalExactCents, 168);

  const fixed = publicFacts.buildFixedPublicProductFacts({
    engineId: 'upscale-video-topaz',
    currency: 'USD',
    amountCents: 80,
    quantity: 1,
    unit: 'run',
  });
  assert.equal(fixed.compatibilityProfileId, 'fixed-product-current');
  assert.equal(fixed.facts.vendorSubtotalExactCents, 80);
});

test('pricing audit reuses production public provider facts', () => {
  const source = readFileSync('frontend/src/lib/pricing-audit/canonical-facts.ts', 'utf8');
  assert.match(source, /from '@\/lib\/pricing-public-facts'/);
  assert.match(source, /buildPublicPricingFacts/);
  assert.doesNotMatch(source, /function standardFacts\(/);
  assert.doesNotMatch(source, /function engineFacts\(/);
});

test('pricing hub delegates every customer total to canonical public pricing', () => {
  const source = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
    'utf8'
  );
  assert.match(source, /pricing-public-facts/);
  assert.match(source, /pricing-public-quote/);
  assert.match(source, /quotePublicPricing/);
  assert.doesNotMatch(source, /applyDisplayedPriceMarginCents/);
  assert.doesNotMatch(source, /DISPLAY_PRICE_MARGIN_PERCENT/);
  assert.doesNotMatch(source, /applyFalReferenceDisplayMarginCents/);
  assert.doesNotMatch(source, /function displayedScenarioCents\(/);
});

test('canonical quote scaling preserves historical per-unit rounding for public batches', async () => {
  const publicQuote = await import('../frontend/src/lib/pricing-public-quote');
  assert.equal(typeof publicQuote.scalePublicPricingQuote, 'function');
  const unit = publicQuote.quotePublicPricing({
    facts: {
      engineId: 'public-image-unit',
      currency: 'USD',
      vendorSubtotalExactCents: 4,
      unit: 'image',
      quantity: 1,
    },
    scenario: {
      id: 'public:image:unit',
      engineId: 'public-image-unit',
      membershipTier: 'member',
    },
    compatibilityProfileId: 'standard',
  });
  assert.equal(unit.customerTotalCents, 6);
  const batch = publicQuote.scalePublicPricingQuote(unit, 4);
  assert.equal(batch.vendorSubtotalCents, 16);
  assert.equal(batch.marginCents, 8);
  assert.equal(batch.customerTotalCents, 24);
  assert.equal(batch.quantity, 4);
});

test('browser estimator and price chip delegate commercial totals to the public canonical adapter', () => {
  const estimator = readFileSync('frontend/components/marketing/PriceEstimator.tsx', 'utf8');
  const chip = readFileSync('frontend/components/marketing/PriceChip.tsx', 'utf8');
  const options = readFileSync(
    'frontend/components/marketing/price-estimator/price-estimator-options.ts',
    'utf8'
  );
  for (const [path, source] of [
    ['PriceEstimator.tsx', estimator],
    ['PriceChip.tsx', chip],
  ] as const) {
    assert.match(source, /pricing-public-facts/, `${path} should build provider facts`);
    assert.match(source, /pricing-public-quote/, `${path} should quote canonically`);
    assert.doesNotMatch(source, /computePricingSnapshot/, `${path} should not call the legacy client kernel`);
    assert.doesNotMatch(source, /platformFeePct:/, `${path} should not mutate commercial policy`);
  }
  assert.doesNotMatch(options, /applyPerImageDisplayMargin/);
  assert.doesNotMatch(options, /defaultMultiplier/);
  assert.doesNotMatch(options, /platformMultiplier/);
});

test('model price rows and Product Offer JSON-LD use canonical public owners', () => {
  const modelPricing = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
    'utf8'
  );
  const modelSchema = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts',
    'utf8'
  );
  assert.match(modelPricing, /server\/pricing\/quote-public/);
  assert.match(modelPricing, /computeCanonicalPublicSnapshot/);
  assert.doesNotMatch(modelPricing, /from '@\/lib\/pricing'/);
  assert.match(modelSchema, /pricing-public-facts/);
  assert.match(modelSchema, /pricing-public-quote/);
  assert.doesNotMatch(modelSchema, /DEFAULT_SCHEMA_MARGIN_PERCENT/);
  assert.doesNotMatch(modelSchema, /roundUsdUpToCents/);
});
