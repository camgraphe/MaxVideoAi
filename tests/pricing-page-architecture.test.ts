import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
const heroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingHeroSection.tsx');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/_components/PricingJsonLdScripts.tsx');

const pageSource = readFileSync(pagePath, 'utf8');
const heroSource = readFileSync(heroPath, 'utf8');
const jsonLdSource = readFileSync(jsonLdPath, 'utf8');

test('pricing page delegates hero and JSON-LD rendering', () => {
  assert.ok(existsSync(heroPath), 'pricing hero should live in a route-local component');
  assert.ok(existsSync(jsonLdPath), 'pricing JSON-LD scripts should live in a route-local component');
  assert.match(pageSource, /from '\.\/_components\/PricingHeroSection'/);
  assert.match(pageSource, /from '\.\/_components\/PricingJsonLdScripts'/);
  assert.match(pageSource, /export default async function PricingPage/);
});

test('pricing page does not regain extracted rendering ownership', () => {
  assert.doesNotMatch(pageSource, /MarketingHeroImage/, 'hero image rendering belongs in PricingHeroSection');
  assert.doesNotMatch(pageSource, /pricing-breadcrumb-jsonld/, 'schema script tags belong in PricingJsonLdScripts');
  assert.doesNotMatch(pageSource, /function isNoSubscriptionCopy/, 'hero copy treatment belongs in PricingHeroSection');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 790, `pricing page should stay below 790 lines after hero extraction, got ${lineCount}`);
});

test('pricing route components expose the expected contract', () => {
  assert.match(heroSource, /export function PricingHeroSection/);
  assert.match(heroSource, /MarketingHeroImage/);
  assert.match(heroSource, /pricing-hero-reference-dark\.webp/);
  assert.match(jsonLdSource, /export function PricingJsonLdScripts/);
  assert.match(jsonLdSource, /pricing-breadcrumb-jsonld/);
  assert.match(jsonLdSource, /serializeJsonLd/);
});
