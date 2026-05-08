import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx');
const routeDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data.ts');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const routeDataSource = readFileSync(routeDataPath, 'utf8');
const jsonLdSource = readFileSync(jsonLdPath, 'utf8');

test('home route keeps page.tsx as a thin orchestrator', () => {
  assert.ok(existsSync(routeDataPath), 'home data, media, and schema builders should live in a route-local _lib module');
  assert.ok(existsSync(jsonLdPath), 'home JSON-LD builders should live in a route-local SEO module');
  assert.match(
    pageSource,
    /from '\.\/_lib\/home-route-data'/,
    'home page should import route builders from the route-local data module'
  );
  assert.match(
    pageSource,
    /from '\.\/_lib\/home-jsonld'/,
    'home page should import JSON-LD builders from the route-local SEO module'
  );

  const pageLineCount = pageSource.split('\n').length;
  assert.ok(pageLineCount <= 180, `home page.tsx should stay below 180 lines, got ${pageLineCount}`);

  for (const owner of [
    'export type RedesignContent',
    'function computeEngineStats',
    'function loadHomepageExamples',
    'function buildComparisonCardsWithExampleMedia',
    'const HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES',
  ]) {
    assert.doesNotMatch(pageSource, new RegExp(owner), `${owner} should not be owned by home/page.tsx`);
    assert.match(routeDataSource, new RegExp(owner), `${owner} should live in the route-local data module`);
  }

  for (const owner of ['function buildSoftwareSchema', 'function buildFaqSchema', 'function serializeJsonLd']) {
    assert.doesNotMatch(pageSource, new RegExp(owner), `${owner} should not be owned by home/page.tsx`);
    assert.match(jsonLdSource, new RegExp(owner), `${owner} should live in the route-local JSON-LD module`);
  }
});

test('home route data module exposes the orchestration contract explicitly', () => {
  for (const exportedName of [
    'BEST_FOR_MAIN_SLUGS',
    'buildBestForGuideCards',
    'buildComparisonCardsWithExampleMedia',
    'buildHeroContent',
    'buildProgrammedHeroItems',
    'buildProofStats',
    'computeEngineStats',
    'filterProviderItems',
    'filterToolCards',
    'loadHomepageExamples',
    'loadProgrammedHomepageHeroSlots',
    'loadSuccessfulGenerationCount',
  ]) {
    assert.match(
      routeDataSource,
      new RegExp(`export (?:async )?(?:function|const) ${exportedName}\\b`),
      `${exportedName} should be exported for the home route orchestrator`
    );
  }
});

test('home JSON-LD module owns schema serialization helpers', () => {
  for (const exportedName of [
    'buildFaqSchema',
    'buildItemListSchema',
    'buildOrganizationSchema',
    'buildSoftwareSchema',
    'serializeJsonLd',
  ]) {
    assert.match(
      jsonLdSource,
      new RegExp(`export (?:function|const) ${exportedName}\\b`),
      `${exportedName} should be exported by the JSON-LD module`
    );
    assert.doesNotMatch(
      routeDataSource,
      new RegExp(`export (?:function|const) ${exportedName}\\b`),
      `${exportedName} should not drift back into home-route-data.ts`
    );
  }
});
