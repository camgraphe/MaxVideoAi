import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const deferredContentPath = join(root, 'frontend/components/marketing/DeferredMarketingContent.tsx');
const homePagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx');
const pricingPagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
const modelLayoutPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx');
const modelContentPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/ModelPageContentSections.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');

test('below-fold marketing content uses browser rendering containment without a client boundary', () => {
  assert.ok(existsSync(deferredContentPath), 'marketing routes should share a below-fold rendering wrapper');

  const source = readSource(deferredContentPath);
  assert.doesNotMatch(source, /'use client'/, 'the rendering wrapper must not add client JavaScript');
  assert.match(source, /content-visibility:auto/, 'offscreen marketing content should skip initial rendering work');
  assert.match(source, /contain-intrinsic-size:auto/, 'offscreen content should reserve a stable scroll footprint');
});

test('marketing heroes remain outside deferred rendering while long content is contained section by section', () => {
  const homeSource = readSource(homePagePath);
  const pricingSource = readSource(pricingPagePath);
  const modelSource = readSource(modelLayoutPath);
  const modelContentSource = readSource(modelContentPath);

  assert.match(homeSource, /<HomeHero[\s\S]*?<\/HomeHero>|<HomeHero[\s\S]*?\/>[\s\S]*?<DeferredMarketingContent/);
  assert.equal((homeSource.match(/<DeferredMarketingContent>/g) ?? []).length, 7, 'home should contain each long section independently');
  assert.equal((pricingSource.match(/<DeferredMarketingContent>/g) ?? []).length, 5, 'pricing should contain each long section independently');
  assert.doesNotMatch(modelSource, /<DeferredMarketingContent>[\s\S]*?<ModelPageContentSections/, 'model layout should not reserve one inaccurate page-height placeholder');
  assert.ok((modelContentSource.match(/<DeferredMarketingContent>/g) ?? []).length >= 5, 'model content should contain long sections independently');
});
