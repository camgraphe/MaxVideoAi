import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pureModules = [
  'packages/pricing/src/canonical.ts',
  'packages/pricing/src/policy.ts',
  'packages/pricing/src/projection.ts',
  'packages/pricing/src/shadow.ts',
] as const;
const publicProjectionOwners = [
  'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData.ts',
  'frontend/components/marketing/PriceEstimator.tsx',
  'frontend/components/marketing/PriceChip.tsx',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-schema.ts',
] as const;

test('canonical pricing package stays pure and framework independent', () => {
  for (const path of pureModules) {
    assert.equal(existsSync(path), true, `${path} should exist`);
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /from ['"](?:@\/|next|react|node:|pg|\.\.\/\.\.\/frontend)/);
    assert.doesNotMatch(source, /process\.env|console\.|localStorage|sessionStorage|fetch\(/);
  }
});

test('versioned pricing policy contains commercial policy but no provider facts or credentials', () => {
  const source = readFileSync('frontend/config/pricing-policy.json', 'utf8');
  for (const forbidden of [
    'baseUnitPriceCents',
    'perSecondCents',
    'tokenPricing',
    'falModelId',
    'vendorAccountId',
    'apiKey',
    'secret',
  ]) {
    assert.equal(source.includes(forbidden), false, `pricing policy should not contain ${forbidden}`);
  }
});

test('public pricing consumers are canonical-authoritative while the compatibility facade remains', () => {
  for (const path of publicProjectionOwners) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /pricing-public|quote-public/);
    assert.doesNotMatch(source, /canonical-collectors|pricing-audit/);
  }
  const decisionPricing = readFileSync(
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-pricing.ts',
    'utf8'
  );
  assert.match(decisionPricing, /get(?:Image)?PresetQuote/);
  const pricingSource = readFileSync('frontend/src/lib/pricing.ts', 'utf8');
  assert.match(pricingSource, /export async function computePricingSnapshot/);
  assert.match(pricingSource, /selectPricingRuleForBilling/);
});

test('billing quote owners are canonical-authoritative after migration', () => {
  const serverBilling = readFileSync('frontend/server/pricing/quote-billing.ts', 'utf8');
  const fixedProducts = readFileSync('frontend/src/lib/billing-products.ts', 'utf8');
  assert.match(serverBilling, /quoteCanonicalPricing/);
  assert.match(serverBilling, /projectCanonicalQuoteToSnapshot/);
  assert.match(fixedProducts, /quoteCanonicalPricing/);
  assert.match(fixedProducts, /fixed-product-current/);
});

test('only the server resolver combines database overrides with versioned defaults', () => {
  const resolverPath = 'frontend/server/pricing/resolve-pricing-policy.ts';
  const resolver = readFileSync(resolverPath, 'utf8');
  assert.match(resolver, /pricing-policy-defaults/);
  assert.match(resolver, /pricing-rule-store/);

  for (const path of [...publicProjectionOwners, 'frontend/src/lib/pricing-audit/canonical-collectors.ts']) {
    const source = readFileSync(path, 'utf8');
    assert.equal(
      source.includes('pricing-policy-defaults') && source.includes('pricing-rule-store'),
      false,
      `${path} should not combine both policy sources`
    );
  }
});

test('pricing baseline ids are unique and all cent fields are non-negative integers', () => {
  const fixture = JSON.parse(readFileSync('tests/fixtures/pricing-parity.v1.json', 'utf8')) as {
    rows: Array<Record<string, unknown>>;
  };
  const ids = fixture.rows.map((row) => row.scenarioId);
  assert.equal(new Set(ids).size, ids.length);
  for (const row of fixture.rows) {
    for (const field of ['vendorSubtotalCents', 'marginCents', 'surchargeCents', 'customerTotalCents']) {
      assert.equal(Number.isInteger(row[field]) && Number(row[field]) >= 0, true, `${String(row.scenarioId)}.${field}`);
    }
  }
});

test('pricing engineering guide records completed billing and public authority', () => {
  const guide = readFileSync('docs/engineering/pricing-engine.md', 'utf8');
  assert.match(guide, /178 scenarios/);
  assert.match(guide, /178 matches/);
  assert.match(guide, /0 mismatches/);
  assert.match(guide, /492 unchanged rows/i);
  assert.match(guide, /billing migration, and public projection migration are complete/i);
  assert.match(guide, /public pricing pages.*canonical-authoritative/i);
});
