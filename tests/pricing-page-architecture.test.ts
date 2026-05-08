import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
const heroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingHeroSection.tsx');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingJsonLdScripts.tsx');
const estimatorPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingEstimatorSection.tsx');
const exampleCostsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingExampleCostsSection.tsx');
const memberTiersPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingMemberTiersSection.tsx');
const relatedLinksPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingRelatedLinksSection.tsx');
const previewPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPreviewSection.tsx');
const priceFactorsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingPriceFactorsSection.tsx');
const refundsFaqPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingRefundsFaqSection.tsx');
const contentPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingPageContent.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const heroSource = readFileSync(heroPath, 'utf8');
const jsonLdSource = readFileSync(jsonLdPath, 'utf8');
const estimatorSource = readFileSync(estimatorPath, 'utf8');
const exampleCostsSource = readFileSync(exampleCostsPath, 'utf8');
const memberTiersSource = readFileSync(memberTiersPath, 'utf8');
const relatedLinksSource = readFileSync(relatedLinksPath, 'utf8');
const previewSource = readFileSync(previewPath, 'utf8');
const priceFactorsSource = readFileSync(priceFactorsPath, 'utf8');
const refundsFaqSource = readFileSync(refundsFaqPath, 'utf8');
const contentSource = readFileSync(contentPath, 'utf8');

test('pricing page delegates hero, sections, content, and JSON-LD rendering', () => {
  assert.ok(existsSync(heroPath), 'pricing hero should live in a route-local component');
  assert.ok(existsSync(jsonLdPath), 'pricing JSON-LD scripts should live in a route-local component');
  assert.ok(existsSync(estimatorPath), 'pricing estimator section should live in a route-local component');
  assert.ok(existsSync(exampleCostsPath), 'pricing example costs should live in a route-local component');
  assert.ok(existsSync(memberTiersPath), 'pricing member tiers should live in a route-local component');
  assert.ok(existsSync(relatedLinksPath), 'pricing related links should live in a route-local component');
  assert.ok(existsSync(previewPath), 'pricing preview CTA should live in a route-local component');
  assert.ok(existsSync(priceFactorsPath), 'pricing price factors should live in a route-local component');
  assert.ok(existsSync(refundsFaqPath), 'pricing refunds and FAQ should live in a route-local component');
  assert.ok(existsSync(contentPath), 'pricing fallback content should live in a route-local lib module');
  assert.match(pageSource, /from '\.\/_components\/PricingHeroSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingJsonLdScripts'/);
  assert.match(pageSource, /from '\.\/_components\/PricingEstimatorSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingExampleCostsSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingMemberTiersSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingRelatedLinksSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingPreviewSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingPriceFactorsSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingRefundsFaqSection'/);
  assert.match(pageSource, /from '\.\/_lib\/pricingPageContent'/);
  assert.match(pageSource, /export default async function PricingPage/);
});

test('pricing page does not regain extracted rendering ownership', () => {
  assert.doesNotMatch(pageSource, /MarketingHeroImage/, 'hero image rendering belongs in PricingHeroSection');
  assert.doesNotMatch(pageSource, /pricing-breadcrumb-jsonld/, 'schema script tags belong in PricingJsonLdScripts');
  assert.doesNotMatch(pageSource, /function isNoSubscriptionCopy/, 'hero copy treatment belongs in PricingHeroSection');
  assert.doesNotMatch(pageSource, /DEFAULT_EXAMPLE_COSTS\s*:/, 'example fallback copy belongs in pricingPageContent');
  assert.doesNotMatch(pageSource, /DEFAULT_PRICE_FACTORS\s*:/, 'price factor fallback copy belongs in pricingPageContent');
  assert.doesNotMatch(pageSource, /function MiniSparkline/, 'example chart primitive belongs in PricingExampleCostsSection');
  assert.doesNotMatch(pageSource, /EXAMPLE_CARD_VISUALS/, 'example visuals belong in PricingExampleCostsSection');
  assert.doesNotMatch(pageSource, /MEMBER_TIER_VISUALS/, 'member tier visuals belong in PricingMemberTiersSection');
  assert.doesNotMatch(pageSource, /PRICE_FACTOR_ICONS/, 'price factor icons belong in PricingPriceFactorsSection');
  assert.doesNotMatch(pageSource, /LazyPriceEstimator/, 'estimator rendering belongs in PricingEstimatorSection');
  assert.doesNotMatch(pageSource, /FlagPill/, 'feature pill rendering belongs in route-local sections');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 420, `pricing page should stay below 420 lines after section extraction, got ${lineCount}`);
});

test('pricing route components expose the expected contract', () => {
  assert.match(heroSource, /export function PricingHeroSection/);
  assert.match(heroSource, /MarketingHeroImage/);
  assert.match(heroSource, /pricing-hero-reference-dark\.webp/);
  assert.match(jsonLdSource, /export function PricingJsonLdScripts/);
  assert.match(jsonLdSource, /pricing-breadcrumb-jsonld/);
  assert.match(jsonLdSource, /serializeJsonLd/);
  assert.match(estimatorSource, /export function PricingEstimatorSection/);
  assert.match(estimatorSource, /LazyPriceEstimator/);
  assert.match(exampleCostsSource, /export function PricingExampleCostsSection/);
  assert.match(exampleCostsSource, /function MiniSparkline/);
  assert.match(memberTiersSource, /export function PricingMemberTiersSection/);
  assert.match(relatedLinksSource, /export function PricingRelatedLinksSection/);
  assert.match(previewSource, /export function PricingPreviewSection/);
  assert.match(priceFactorsSource, /export function PricingPriceFactorsSection/);
  assert.match(refundsFaqSource, /export function PricingRefundsFaqSection/);
  assert.match(contentSource, /export const DEFAULT_EXAMPLE_COSTS/);
  assert.match(contentSource, /export const DEFAULT_PRICE_FACTORS/);
  assert.match(contentSource, /export function formatCurrencyForLocale/);
});
