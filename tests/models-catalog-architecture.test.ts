import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx');
const utilsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');

test('models catalog route delegates catalog helper logic', () => {
  assert.ok(existsSync(pagePath), 'models catalog route component should exist');
  assert.ok(existsSync(utilsPath), 'models catalog helper module should exist');

  assert.match(pageSource, /from '\.\/_lib\/models-catalog-utils'/, 'route should import catalog helpers');
  assert.match(pageSource, /export async function generateModelsMetadata/, 'route should keep metadata orchestration');
  assert.match(pageSource, /export default async function ModelsCatalogPage/, 'route should keep page orchestration');

  assert.doesNotMatch(pageSource, /from 'node:path'/, 'route should not own benchmark file path resolution');
  assert.doesNotMatch(pageSource, /promises as fs/, 'route should not read benchmark files directly');
  assert.doesNotMatch(pageSource, /buildSlugMap\('models'\)/, 'route should not rebuild localized slug maps inline');
  assert.doesNotMatch(pageSource, /applyDisplayedPriceMarginCents/, 'route should not own pricing display math');
  assert.doesNotMatch(pageSource, /const MODELS_SCOPE_DEFAULTS =/, 'localized scope defaults belong in the helper module');
  assert.doesNotMatch(pageSource, /const USE_CASE_MAP =/, 'model value sentence maps belong in the helper module');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 1200, `ModelsCatalogPage should stay below 1200 lines after helper extraction, got ${lineCount}`);
});

test('models catalog helper module exposes the route contract', () => {
  for (const exportName of [
    'MODELS_HERO_IMAGE_URL',
    'MODELS_SCOPE_NAV_LABELS',
    'MODELS_SLUG_MAP',
    'DEFAULT_ENGINE_TYPE_LABELS',
    'DEFAULT_SCORE_LABEL_MAP',
    'DEFAULT_VALUE_SENTENCE_BY_LOCALE',
    'MODEL_CARD_DESCRIPTION_OVERRIDES',
    'SCORE_LABEL_KEYS',
    'USE_CASE_MAP',
  ]) {
    assert.match(utilsSource, new RegExp(`export const ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'getModelsScopeEnglishPath',
    'getModelsScopePath',
    'getScopeDefaults',
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

  assert.match(utilsSource, /export type ModelsPageScope/, 'ModelsPageScope should be exported');
  assert.match(utilsSource, /export type EngineScore/, 'EngineScore should be exported');
  assert.match(utilsSource, /export type ScopePageDefaults/, 'ScopePageDefaults should be exported');
});
