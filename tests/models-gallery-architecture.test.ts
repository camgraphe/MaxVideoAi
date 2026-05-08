import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const galleryPath = join(root, 'frontend/components/marketing/ModelsGallery.tsx');
const cardPath = join(root, 'frontend/components/marketing/ModelsGalleryCard.tsx');
const utilsPath = join(root, 'frontend/components/marketing/models-gallery-utils.ts');

const gallerySource = readFileSync(galleryPath, 'utf8');
const cardSource = readFileSync(cardPath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');

test('models gallery delegates card rendering and visual helpers', () => {
  assert.ok(existsSync(galleryPath), 'models gallery should exist');
  assert.ok(existsSync(cardPath), 'models gallery card should live in a focused component');
  assert.ok(existsSync(utilsPath), 'models gallery visual helpers should live in a focused module');
  assert.match(gallerySource, /from '@\/components\/marketing\/ModelsGalleryCard'/);
  assert.match(gallerySource, /from '@\/components\/marketing\/models-gallery-utils'/);
});

test('models gallery does not regain card rendering ownership', () => {
  assert.doesNotMatch(gallerySource, /function ModelCard\(/, 'card JSX belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /useRouter\(\)/, 'card navigation belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /EngineIcon/, 'card provider badge belongs in ModelsGalleryCard.tsx');
  assert.doesNotMatch(gallerySource, /normalizeCtaLabel/, 'CTA normalization belongs in models-gallery-utils.ts');
  assert.doesNotMatch(gallerySource, /getCapabilityIcon/, 'capability icon mapping belongs in models-gallery-utils.ts');
  assert.doesNotMatch(gallerySource, /ArrowRight/, 'card CTA icon belongs in ModelsGalleryCard.tsx');

  const lineCount = gallerySource.split('\n').length;
  assert.ok(lineCount <= 750, `ModelsGallery should stay below 750 lines after card extraction, got ${lineCount}`);
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
});
