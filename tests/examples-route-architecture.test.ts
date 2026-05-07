import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx');
const utilsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-route-utils.ts');
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');

test('examples route delegates URL, filter, and gallery helper logic', () => {
  assert.ok(existsSync(pagePath), 'examples route page should exist');
  assert.ok(existsSync(utilsPath), 'examples route helper module should exist');
  assert.ok(existsSync(copyPath), 'examples route copy helper module should exist');

  assert.match(pageSource, /from '\.\/_lib\/examples-route-utils'/, 'route should import examples helpers');
  assert.match(pageSource, /from '\.\/_lib\/examples-page-copy'/, 'route should import examples copy helpers');
  assert.match(pageSource, /export async function generateMetadata/, 'route should keep metadata orchestration');
  assert.match(pageSource, /export default async function ExamplesPage/, 'route should keep page orchestration');

  assert.doesNotMatch(pageSource, /listFalEngines\(\)/, 'route should not rebuild engine maps inline');
  assert.doesNotMatch(pageSource, /buildSlugMap\('/, 'route should not rebuild localized slug maps inline');
  assert.doesNotMatch(pageSource, /normalizeEngineId\(/, 'route should not own engine alias normalization');
  assert.doesNotMatch(pageSource, /orderExamplesHubFamilyIds/, 'route should not own family ordering maps');
  assert.doesNotMatch(pageSource, /function serializeJsonLd\(/, 'JSON-LD serialization belongs in helper module');
  assert.doesNotMatch(pageSource, /function getSort\(/, 'sort parsing belongs in helper module');
  assert.doesNotMatch(pageSource, /const rawNextStepLinks =/, 'model landing next-step copy belongs in copy helper module');
  assert.doesNotMatch(pageSource, /const galleryUiCopy =\s*locale ===/, 'localized gallery UI copy belongs in copy helper module');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 1000, `examples page should stay below 1000 lines after helper extraction, got ${lineCount}`);
});

test('examples helper module exposes the route contract', () => {
  for (const exportName of [
    'ENGINE_META',
    'SITE',
    'GALLERY_SLUG_MAP',
    'DEFAULT_SORT',
    'EXAMPLES_PAGE_SIZE',
    'HUB_INITIAL_DESKTOP_GALLERY_BATCH',
    'FAMILY_INITIAL_DESKTOP_GALLERY_BATCH',
    'INITIAL_MOBILE_GALLERY_BATCH',
    'HERO_POSTER_OPTIONS',
    'GALLERY_POSTER_OPTIONS',
    'ALLOWED_QUERY_KEYS',
    'PREFERRED_ENGINE_ORDER',
    'ENGINE_MODEL_LINKS_BY_GROUP',
    'CURRENT_ENGINE_MODEL_LINKS_BY_GROUP',
    'ENGINE_MODEL_LINKS',
  ]) {
    assert.match(utilsSource, new RegExp(`export const ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'resolveEngineLinkId',
    'getEngineAccentOutlineStyle',
    'getPlaceholderPoster',
    'buildModelHref',
    'buildCompareHref',
    'buildPricingHref',
    'formatModelSlugLabel',
    'isTrackingParam',
    'appendTrackingParams',
    'toAbsoluteUrl',
    'serializeJsonLd',
    'resolveCanonicalEngineParam',
    'resolveEngineLabel',
    'getSort',
    'formatPromptExcerpt',
    'compactLeadCopy',
    'buildMainVideoHeroLine',
    'buildLocalizedExampleLabel',
    'getAspectRatioStyle',
    'isPortraitAspectRatio',
    'getVideoMimeType',
    'resolveFilterDescriptor',
  ]) {
    assert.match(utilsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(utilsSource, /export const normalizeFilterId/, 'normalizeFilterId should be exported');
  assert.match(utilsSource, /export type EngineFilterOption/, 'EngineFilterOption should be exported');
});

test('examples page copy helper exposes localized route copy builders', () => {
  for (const exportName of [
    'getExamplesBrowseByModelLabel',
    'getExamplesGalleryUiCopy',
    'getExamplesLongDescription',
    'getKlingExamplesSectionTitles',
    'getExamplesModelPageLabels',
    'buildExamplesNextStepLinks',
    'getExamplesMainVideoCopy',
  ]) {
    assert.match(copySource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }
});
