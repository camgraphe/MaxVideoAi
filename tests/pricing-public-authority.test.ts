import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';

const read = (path: string) => readFileSync(path, 'utf8');

test('all customer-visible pricing surfaces delegate to canonical public owners', () => {
  const canonicalConsumers = new Map<string, string>([
    [
      'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
      'quotePublicPricing',
    ],
    ['frontend/components/marketing/PriceEstimator.tsx', 'quotePublicPricing'],
    ['frontend/components/marketing/PriceChip.tsx', 'quotePublicPricing'],
    [
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
      'computeCanonicalPublicSnapshot',
    ],
    [
      'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts',
      'quotePublicPricing',
    ],
    ['frontend/src/server/engines.ts', 'computeCanonicalPublicSnapshot'],
    ['frontend/app/api/images/estimate/route.ts', 'computeCanonicalPublicSnapshot'],
    [
      'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options.ts',
      'quotePublicPricing',
    ],
  ]);
  for (const [path, symbol] of canonicalConsumers) {
    const source = read(path);
    assert.match(source, new RegExp(symbol), `${path} should use ${symbol}`);
    assert.doesNotMatch(source, /from ['"]@\/lib\/pricing['"]/, `${path} should not import the legacy facade`);
  }
});

test('MCP budget options use public catalog, roster, pricing, and localized-route authorities', () => {
  const source = read(
    'frontend/app/(localized)/[locale]/(marketing)/mcp/_lib/mcp-budget-options.ts'
  );

  for (const symbol of [
    'listFalEngines',
    'getModelByEngineId',
    'getRuntimeModelById',
    'buildPublicPricingFacts',
    'quotePublicPricing',
    'buildLocalizedModelPath',
  ]) {
    assert.match(source, new RegExp(symbol), `MCP budget options should use ${symbol}`);
  }
  assert.doesNotMatch(source, /pricingHint|providerMeta|vendorSubtotal|marginPercent/);
  assert.doesNotMatch(source, /\$0\.31|\$0\.65|amountCents:\s*\d/);
});

test('browser canonical pricing modules cannot cross server or admin boundaries', () => {
  for (const path of [
    'frontend/src/lib/pricing-public-facts.ts',
    'frontend/src/lib/pricing-public-quote.ts',
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /@\/server|pricing-rule-store|@\/lib\/(?:db|schema|env)|node:|next\/headers|\/admin\//);
  }
});

test('legacy pricing facade is deleted after public and billing migration', () => {
  assert.equal(existsSync('frontend/src/lib/pricing.ts'), false);
  assert.equal(existsSync('frontend/src/lib/pricing-specialized-snapshots.ts'), false);
  assert.doesNotMatch(read('frontend/app/(core)/admin/pricing/page.tsx'), /pricing-public-quote/);
});

test('public server quote keeps expected database fallback silent', async () => {
  const entry = listFalEngines().find((candidate) => candidate.id === 'veo-3-1-fast');
  assert.ok(entry);
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const snapshot = await computeCanonicalPublicSnapshot({
      engine: entry.engine,
      durationSec: 8,
      resolution: '1080p',
      mode: 't2v',
      membershipTier: 'member',
    });
    assert.ok(snapshot.totalCents > 0);
  } finally {
    console.warn = originalWarn;
  }
  assert.deepEqual(warnings, []);
});
