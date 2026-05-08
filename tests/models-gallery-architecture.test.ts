import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const galleryPath = join(root, 'frontend/components/marketing/ModelsGallery.tsx');
const cardPath = join(root, 'frontend/components/marketing/ModelsGalleryCard.tsx');
const utilsPath = join(root, 'frontend/components/marketing/models-gallery-utils.ts');
const filtersPath = join(root, 'frontend/components/marketing/models-gallery/ModelsGalleryFilters.tsx');
const compareBarPath = join(root, 'frontend/components/marketing/models-gallery/ModelsGalleryCompareBar.tsx');
const copyPath = join(root, 'frontend/components/marketing/models-gallery/models-gallery-copy.ts');
const filteringPath = join(root, 'frontend/components/marketing/models-gallery/models-gallery-filtering.ts');
const typesPath = join(root, 'frontend/components/marketing/models-gallery/models-gallery-types.ts');

const gallerySource = readFileSync(galleryPath, 'utf8');
const cardSource = readFileSync(cardPath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const filtersSource = readFileSync(filtersPath, 'utf8');
const compareBarSource = readFileSync(compareBarPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const filteringSource = readFileSync(filteringPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('models gallery delegates card rendering and visual helpers', () => {
  assert.ok(existsSync(galleryPath), 'models gallery should exist');
  assert.ok(existsSync(cardPath), 'models gallery card should live in a focused component');
  assert.ok(existsSync(utilsPath), 'models gallery visual helpers should live in a focused module');
  assert.ok(existsSync(filtersPath), 'models gallery filters should live in a focused component');
  assert.ok(existsSync(compareBarPath), 'models gallery compare bar should live in a focused component');
  assert.ok(existsSync(copyPath), 'models gallery copy should live in a focused module');
  assert.ok(existsSync(filteringPath), 'models gallery filtering should live in a focused module');
  assert.ok(existsSync(typesPath), 'models gallery contracts should live in a focused module');
  assert.match(gallerySource, /from '@\/components\/marketing\/ModelsGalleryCard'/);
  assert.match(gallerySource, /ModelsGalleryFilters/);
  assert.match(gallerySource, /ModelsGalleryCompareBar/);
  assert.match(compareBarSource, /from '@\/components\/marketing\/models-gallery-utils'/);
});

test('models gallery does not regain card rendering ownership', () => {
  assert.doesNotMatch(gallerySource, /function ModelCard\(/, 'card JSX belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /useRouter\(\)/, 'card navigation belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /EngineIcon/, 'card provider badge belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /normalizeCtaLabel/, 'CTA normalization belongs in models-gallery-utils.ts');
  assert.doesNotMatch(gallerySource, /getCapabilityIcon/, 'capability icon mapping belongs in models-gallery-utils.ts');
  assert.doesNotMatch(gallerySource, /ArrowRight/, 'card CTA icon belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /const DEFAULT_COPY|function FilterControl/, 'copy and filter rendering belong in split modules');
  assert.doesNotMatch(gallerySource, /compareNumbers|normalizedQuery/, 'filtering and sorting logic belongs in models-gallery-filtering.ts');

  const lineCount = gallerySource.split('\n').length;
  assert.ok(lineCount <= 300, `ModelsGallery should stay below 300 lines after gallery surface extraction, got ${lineCount}`);
});

test('models gallery card modules expose the expected contract', () => {
  assert.match(cardSource, /export function ModelCard/);
  assert.match(cardSource, /EngineIcon/);
  assert.match(cardSource, /useRouter\(\)/);
  assert.match(cardSource, /normalizeCtaLabel/);
  assert.match(cardSource, /getCapabilityIcon/);
  assert.match(utilsSource, /export function formatTemplate/);
  assert.match(utilsSource, /export function normalizeCtaLabel/);
  assert.match(utilsSource, /export function getCapabilityIcon/);
  assert.match(filtersSource, /export function ModelsGalleryFilters/);
  assert.match(compareBarSource, /export function ModelsGalleryCompareBar/);
  assert.match(copySource, /export function resolveModelsGalleryCopy/);
  assert.match(filteringSource, /export function filterModelGalleryCards/);
  assert.match(filteringSource, /export function sortModelGalleryCards/);
  assert.match(typesSource, /export type ModelGalleryCard/);
});
