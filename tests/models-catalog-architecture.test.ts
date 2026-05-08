import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx');
const cardsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts');
const utilsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils.ts');
const copyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-copy.ts');
const valueCopyPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-value-copy.ts');
const sectionsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-sections.ts');
const heroPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogHero.tsx');
const gallerySectionPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogGallerySection.tsx');
const jsonLdScriptsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_components/ModelsCatalogJsonLdScripts.tsx');

const pageSource = readFileSync(pagePath, 'utf8');
const cardsSource = readFileSync(cardsPath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const valueCopySource = readFileSync(valueCopyPath, 'utf8');
const sectionsSource = readFileSync(sectionsPath, 'utf8');
const heroSource = readFileSync(heroPath, 'utf8');
const gallerySectionSource = readFileSync(gallerySectionPath, 'utf8');
const jsonLdScriptsSource = readFileSync(jsonLdScriptsPath, 'utf8');

test('models catalog route delegates catalog helper logic', () => {
  assert.ok(existsSync(pagePath), 'models catalog route component should exist');
  assert.ok(existsSync(cardsPath), 'models catalog card data module should exist');
  assert.ok(existsSync(utilsPath), 'models catalog helper module should exist');
  assert.ok(existsSync(copyPath), 'models catalog localized copy module should exist');
  assert.ok(existsSync(valueCopyPath), 'models catalog value copy module should exist');
  assert.ok(existsSync(sectionsPath), 'models catalog section data module should exist');
  assert.ok(existsSync(heroPath), 'models catalog hero should live in a route-local component');
  assert.ok(existsSync(gallerySectionPath), 'models catalog gallery section should live in a route-local component');
  assert.ok(existsSync(jsonLdScriptsPath), 'models catalog JSON-LD scripts should live in a route-local component');

  assert.match(pageSource, /from '\.\/_lib\/models-catalog-utils'/, 'route should import catalog helpers');
  assert.match(pageSource, /from '\.\/_lib\/models-catalog-cards'/, 'route should import catalog card builder');
  assert.match(pageSource, /from '\.\/_lib\/models-catalog-sections'/, 'route should import section builders');
  assert.match(pageSource, /from '\.\/_components\/ModelsCatalogHero'/, 'route should import the hero component');
  assert.match(pageSource, /from '\.\/_components\/ModelsCatalogGallerySection'/, 'route should import the gallery section component');
  assert.match(pageSource, /from '\.\/_components\/ModelsCatalogJsonLdScripts'/, 'route should import the JSON-LD script component');
  assert.match(pageSource, /export async function generateModelsMetadata/, 'route should keep metadata orchestration');
  assert.match(pageSource, /export default async function ModelsCatalogPage/, 'route should keep page orchestration');

  assert.doesNotMatch(pageSource, /from 'node:path'/, 'route should not own benchmark file path resolution');
  assert.doesNotMatch(pageSource, /promises as fs/, 'route should not read benchmark files directly');
  assert.doesNotMatch(pageSource, /listFalEngines/, 'route should not own raw engine catalog iteration');
  assert.doesNotMatch(pageSource, /computeMarketingPriceRange/, 'route should not own card pricing projections');
  assert.doesNotMatch(pageSource, /getEngineLocalized/, 'route should not own per-card model localization');
  assert.doesNotMatch(pageSource, /getEnginePictogram/, 'route should not own card pictogram derivation');
  assert.doesNotMatch(pageSource, /loadEngineScores/, 'route should not own model score loading');
  assert.doesNotMatch(pageSource, /buildSlugMap\('models'\)/, 'route should not rebuild localized slug maps inline');
  assert.doesNotMatch(pageSource, /applyDisplayedPriceMarginCents/, 'route should not own pricing display math');
  assert.doesNotMatch(pageSource, /const MODELS_SCOPE_DEFAULTS =/, 'localized scope defaults belong in the helper module');
  assert.doesNotMatch(pageSource, /const USE_CASE_MAP =/, 'model value sentence maps belong in the helper module');
  assert.doesNotMatch(pageSource, /Texte→image/, 'localized outcome tiles belong in the section data module');
  assert.doesNotMatch(pageSource, /const fallbackFaqItemsByScope =/, 'fallback FAQ data belongs in the section data module');
  assert.doesNotMatch(pageSource, /const fallbackReliabilityItemsByScope =/, 'fallback reliability data belongs in the section data module');
  assert.doesNotMatch(pageSource, /lg:min-h-\[520px\]/, 'hero layout belongs in ModelsCatalogHero.tsx');
  assert.doesNotMatch(pageSource, /id="models-grid"/, 'gallery section markup belongs in ModelsCatalogGallerySection.tsx');
  assert.doesNotMatch(pageSource, /models-breadcrumb-jsonld/, 'JSON-LD script tags belong in ModelsCatalogJsonLdScripts.tsx');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 500, `ModelsCatalogPage should stay below 500 lines after card data extraction, got ${lineCount}`);

  const utilsLineCount = utilsSource.split('\n').length;
  assert.ok(utilsLineCount <= 500, `models-catalog-utils should stay below 500 lines after copy split, got ${utilsLineCount}`);
});

test('models catalog helper module exposes the route contract', () => {
  assert.match(cardsSource, /export async function buildModelsCatalogCards/, 'card module should export catalog card builder');
  assert.match(cardsSource, /MODELS_CATALOG_PRIORITY_ORDER/, 'card module should own featured model ordering');
  assert.match(cardsSource, /listFalEngines/, 'card module should own raw engine catalog iteration');
  assert.match(cardsSource, /computeMarketingPriceRange/, 'card module should own card pricing projections');
  assert.match(cardsSource, /getEngineLocalized/, 'card module should own per-card localization');
  assert.match(cardsSource, /getEnginePictogram/, 'card module should own pictogram derivation');

  assert.match(utilsSource, /from '\.\/models-catalog-copy'/, 'utils should re-export localized page copy');
  assert.match(utilsSource, /from '\.\/models-catalog-value-copy'/, 'utils should re-export value sentence copy');

  for (const exportName of [
    'MODELS_HERO_IMAGE_URL',
    'MODELS_SCOPE_NAV_LABELS',
    'MODELS_SLUG_MAP',
    'DEFAULT_ENGINE_TYPE_LABELS',
  ]) {
    assert.match(copySource, new RegExp(`export const ${exportName}`), `${exportName} should be exported from copy module`);
  }

  for (const exportName of [
    'DEFAULT_VALUE_SENTENCE_BY_LOCALE',
    'MODEL_CARD_DESCRIPTION_OVERRIDES',
    'USE_CASE_MAP',
  ]) {
    assert.match(valueCopySource, new RegExp(`export const ${exportName}`), `${exportName} should be exported from value copy module`);
  }

  for (const exportName of [
    'DEFAULT_SCORE_LABEL_MAP',
    'SCORE_LABEL_KEYS',
  ]) {
    assert.match(utilsSource, new RegExp(`export const ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'getModelsScopeEnglishPath',
    'getModelsScopePath',
    'getScopeDefaults',
  ]) {
    assert.match(copySource, new RegExp(`export function ${exportName}`), `${exportName} should be exported from copy module`);
  }

  for (const exportName of [
    'loadEngineKeySpecs',
    'loadEngineScores',
    'getCatalogBySlug',
    'resolveSupported',
    'extractMaxResolution',
    'extractMaxDuration',
    'getMinPricePerSecond',
    'computeOverall',
    'deriveStrengths',
    'buildValueSentence',
    'getEngineTypeKey',
    'getEngineDisplayName',
    'splitModelsHeroTitle',
    'splitHeroAccentTitle',
  ]) {
    assert.match(utilsSource, new RegExp(`export (async )?function ${exportName}`), `${exportName} should be exported`);
  }

  assert.match(utilsSource, /export type \{ ModelsPageScope, ScopePageDefaults \} from '\.\/models-catalog-copy';/, 'utils should re-export copy types');
  assert.match(copySource, /export type ModelsPageScope/, 'ModelsPageScope should be owned by copy module');
  assert.match(utilsSource, /export type EngineScore/, 'EngineScore should be exported');
  assert.match(copySource, /export type ScopePageDefaults/, 'ScopePageDefaults should be owned by copy module');
  assert.match(copySource, /const MODELS_SCOPE_DEFAULTS/, 'copy module should own localized scope defaults');
  assert.match(valueCopySource, /export const USE_CASE_MAP/, 'value copy module should own model use-case copy');

  for (const exportName of [
    'buildModelsOutcomeTiles',
    'buildModelsFaqItems',
    'buildModelsReliabilityItems',
  ]) {
    assert.match(sectionsSource, new RegExp(`export function ${exportName}`), `${exportName} should be exported`);
  }
  assert.match(sectionsSource, /export type ModelsOutcomeTile/, 'ModelsOutcomeTile should be exported');
  assert.match(sectionsSource, /Texte→image/, 'section module should own localized outcome fallback data');
  assert.match(sectionsSource, /FALLBACK_FAQ_ITEMS_BY_SCOPE/, 'section module should own fallback FAQ data');
  assert.match(heroSource, /export function ModelsCatalogHero/, 'hero component should be exported');
  assert.match(heroSource, /MODELS_HERO_IMAGE_URL/, 'hero component should own hero image rendering');
  assert.match(heroSource, /lg:min-h-\[520px\]/, 'hero component should own hero layout');
  assert.match(gallerySectionSource, /export function ModelsCatalogGallerySection/, 'gallery section should be exported');
  assert.match(gallerySectionSource, /id="models-grid"/, 'gallery section should own gallery markup');
  assert.match(gallerySectionSource, /ModelsGallery/, 'gallery section should compose ModelsGallery');
  assert.match(jsonLdScriptsSource, /export function ModelsCatalogJsonLdScripts/, 'JSON-LD script component should be exported');
  assert.match(jsonLdScriptsSource, /models-breadcrumb-jsonld/, 'JSON-LD script component should own breadcrumb schema script');
});
