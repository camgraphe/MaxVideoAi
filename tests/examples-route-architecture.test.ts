import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/page.tsx');
const utilsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-route-utils.ts');
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy.ts');
const pageDataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data.ts');
const mainVideoFeaturePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-main-video-feature.tsx');
const engineFilterNavPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-engine-filter-nav.tsx');
const jsonLdScriptsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-jsonld-scripts.tsx');
const routeSectionsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx');

const pageSource = readFileSync(pagePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const pageDataSource = readFileSync(pageDataPath, 'utf8');
const mainVideoFeatureSource = readFileSync(mainVideoFeaturePath, 'utf8');
const engineFilterNavSource = readFileSync(engineFilterNavPath, 'utf8');
const jsonLdScriptsSource = readFileSync(jsonLdScriptsPath, 'utf8');
const routeSectionsSource = readFileSync(routeSectionsPath, 'utf8');

test('examples route delegates URL, filter, and gallery helper logic', () => {
  assert.ok(existsSync(pagePath), 'examples route page should exist');
  assert.ok(existsSync(utilsPath), 'examples route helper module should exist');
  assert.ok(existsSync(copyPath), 'examples route copy helper module should exist');
  assert.ok(existsSync(pageDataPath), 'examples page data helper module should exist');
  assert.ok(existsSync(mainVideoFeaturePath), 'examples main video feature should exist');
  assert.ok(existsSync(engineFilterNavPath), 'examples engine filter nav should exist');
  assert.ok(existsSync(jsonLdScriptsPath), 'examples JSON-LD scripts should exist');
  assert.ok(existsSync(routeSectionsPath), 'examples route sections should exist');

  assert.match(pageSource, /from '\.\/_components\/examples-main-video-feature'/, 'route should import main video feature');
  assert.match(pageSource, /from '\.\/_components\/examples-engine-filter-nav'/, 'route should import engine filter nav');
  assert.match(pageSource, /from '\.\/_components\/examples-jsonld-scripts'/, 'route should import JSON-LD scripts');
  assert.match(pageSource, /from '\.\/_components\/examples-route-sections'/, 'route should import route sections');
  assert.match(pageSource, /from '\.\/_lib\/examples-route-utils'/, 'route should import examples helpers');
  assert.match(pageSource, /from '\.\/_lib\/examples-page-copy'/, 'route should import examples copy helpers');
  assert.match(pageSource, /from '\.\/_lib\/examples-page-data'/, 'route should import examples data builders');
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
  assert.doesNotMatch(pageSource, /ExamplesHeroVideo/, 'main video hero rendering belongs in ExamplesMainVideoFeature');
  assert.doesNotMatch(pageSource, /DeferredSourcePrompt/, 'main video prompt disclosure belongs in ExamplesMainVideoFeature');
  assert.doesNotMatch(pageSource, /mainVideoCopy\.openExample/, 'main video CTAs belong in ExamplesMainVideoFeature');
  assert.doesNotMatch(pageSource, /sticky top-16 z-\[35\]/, 'engine filter nav markup belongs in ExamplesEngineFilterNav');
  assert.doesNotMatch(pageSource, /dangerouslySetInnerHTML/, 'JSON-LD script rendering belongs in ExamplesJsonLdScripts');
  assert.doesNotMatch(pageSource, /halo-hero stack-gap-sm/, 'intro hero markup belongs in ExamplesIntroHero');
  assert.doesNotMatch(pageSource, /Aller plus loin/, 'next-step section markup belongs in ExamplesNextStepsSection');
  assert.doesNotMatch(pageSource, /<ExamplesGalleryGrid/, 'gallery section rendering belongs in ExamplesGallerySection');
  assert.doesNotMatch(pageSource, /usesCurrentAndSupportedBlocks \? currentModelPagesLabel : modelPagesLabel/, 'model link section copy belongs in ExamplesModelLinksSection');
  assert.doesNotMatch(pageSource, /rel="prev"/, 'pagination previous link markup belongs in ExamplesPaginationNav');
  assert.doesNotMatch(pageSource, /rel="next"/, 'pagination next link markup belongs in ExamplesPaginationNav');
  assert.doesNotMatch(pageSource, /<details key=\{item\.question\}/, 'FAQ disclosure markup belongs in ExamplesFaqSection');
  assert.doesNotMatch(pageSource, /const engineFilterMap =/, 'engine filter state belongs in examples page data helpers');
  assert.doesNotMatch(pageSource, /const filteredEntries =/, 'gallery entry projection belongs in examples page data helpers');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 620, `examples page should stay below 620 lines after route section and data extraction, got ${lineCount}`);
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

test('examples page data helper owns filter, model link, and gallery projections', () => {
  for (const exportName of [
    'buildExamplesEngineFilterState',
    'buildExamplesModelLinks',
    'buildExamplesGalleryData',
  ]) {
    assert.match(pageDataSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(pageDataSource, /const engineFilterMap =/, 'page data helper should own engine filter state');
  assert.match(pageDataSource, /PREFERRED_ENGINE_ORDER/, 'page data helper should own preferred family ordering');
  assert.match(pageDataSource, /buildOptimizedPosterUrl/, 'page data helper should own gallery poster optimization');
  assert.match(pageDataSource, /formatPromptExcerpt/, 'page data helper should own client prompt display shaping');
  assert.match(pageDataSource, /export type ExamplesModelLink/, 'page data helper should export model link shape');
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

test('examples main video feature owns the hero media card', () => {
  assert.match(mainVideoFeatureSource, /export function ExamplesMainVideoFeature/, 'main video feature should be exported');
  assert.match(mainVideoFeatureSource, /ExamplesHeroVideo/, 'main video feature should own hero video rendering');
  assert.match(mainVideoFeatureSource, /AudioEqualizerBadge/, 'main video feature should own audio badge rendering');
  assert.match(mainVideoFeatureSource, /DeferredSourcePrompt/, 'main video feature should own prompt disclosure');
});

test('examples route components own nav and JSON-LD rendering', () => {
  assert.match(engineFilterNavSource, /export function ExamplesEngineFilterNav/, 'engine filter nav should be exported');
  assert.match(engineFilterNavSource, /sticky top-16 z-\[35\]/, 'engine filter nav should own sticky filter markup');
  assert.match(engineFilterNavSource, /getEngineAccentOutlineStyle/, 'engine filter nav should own active brand outline styling');
  assert.match(jsonLdScriptsSource, /export function ExamplesJsonLdScripts/, 'JSON-LD scripts component should be exported');
  assert.match(jsonLdScriptsSource, /dangerouslySetInnerHTML/, 'JSON-LD scripts component should own JSON-LD script rendering');
  assert.match(jsonLdScriptsSource, /serializeJsonLd/, 'JSON-LD scripts component should serialize via route helper');
  assert.match(routeSectionsSource, /export function ExamplesIntroHero/, 'intro hero section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesNextStepsSection/, 'next steps section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesModelLinksSection/, 'model links section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesModelLandingCardsSection/, 'model landing cards section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesGallerySection/, 'gallery section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesPaginationNav/, 'pagination nav should be exported');
  assert.match(routeSectionsSource, /export function ExamplesSummarySection/, 'summary section should be exported');
  assert.match(routeSectionsSource, /export function ExamplesFaqSection/, 'FAQ section should be exported');
  assert.match(routeSectionsSource, /Aller plus loin/, 'next steps section should own localized heading fallback');
  assert.match(routeSectionsSource, /<ExamplesGalleryGrid/, 'gallery section should own gallery grid rendering');
  assert.match(routeSectionsSource, /rel="prev"/, 'pagination nav should own previous link markup');
  assert.match(routeSectionsSource, /rel="next"/, 'pagination nav should own next link markup');
  assert.match(routeSectionsSource, /<details key=\{item\.question\}/, 'FAQ section should own FAQ disclosure markup');
});
