import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx');
const routeDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data.ts');
const routeDataDir = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data');
const jsonLdPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-jsonld.ts');
const routeDataModules = [
  'best-for.ts',
  'comparisons.ts',
  'constants.ts',
  'engine-stats.ts',
  'examples.ts',
  'filters.ts',
  'formatting.ts',
  'hero.ts',
  'types.ts',
];

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
    assert.doesNotMatch(routeDataSource, new RegExp(owner), `${owner} should not be owned by the home-route-data facade`);
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
      new RegExp(`export \\{[\\s\\S]*${exportedName}`),
      `${exportedName} should be exported for the home route orchestrator`
    );
  }

  assert.match(routeDataSource, /export type \{ EngineStats, RedesignContent \}/);

  const facadeLineCount = routeDataSource.split('\n').length;
  assert.ok(facadeLineCount <= 40, `home-route-data.ts should stay a thin facade, got ${facadeLineCount}`);
});

test('home route data responsibilities are split into focused modules', () => {
  for (const moduleName of routeDataModules) {
    const modulePath = join(routeDataDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under home-route-data`);
    const moduleSource = readFileSync(modulePath, 'utf8');
    const lineCount = moduleSource.split('\n').length;
    assert.ok(lineCount <= 240, `${moduleName} should stay below 240 lines, got ${lineCount}`);
  }

  const typesSource = readFileSync(join(routeDataDir, 'types.ts'), 'utf8');
  const engineStatsSource = readFileSync(join(routeDataDir, 'engine-stats.ts'), 'utf8');
  const heroSource = readFileSync(join(routeDataDir, 'hero.ts'), 'utf8');
  const examplesSource = readFileSync(join(routeDataDir, 'examples.ts'), 'utf8');
  const comparisonsSource = readFileSync(join(routeDataDir, 'comparisons.ts'), 'utf8');
  const constantsSource = readFileSync(join(routeDataDir, 'constants.ts'), 'utf8');

  assert.match(typesSource, /export type RedesignContent =/);
  assert.match(engineStatsSource, /export function computeEngineStats/);
  assert.match(examplesSource, /export async function loadHomepageExamples/);
  assert.match(comparisonsSource, /export async function buildComparisonCardsWithExampleMedia/);
  assert.match(heroSource, /export function buildProgrammedHeroItems/);
  assert.match(constantsSource, /export const HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES/);
});

test('home JSON-LD module owns schema serialization helpers', () => {
  for (const exportedName of [
    'buildFaqSchema',
    'buildItemListSchema',
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
