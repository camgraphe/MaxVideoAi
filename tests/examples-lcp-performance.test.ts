import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const galleryCardPath = join(root, 'frontend/components/examples/ExampleGalleryCard.tsx');
const examplesHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/head.tsx');

const readSource = (path: string) => readFileSync(path, 'utf8');

test('examples gallery cards do not compete with the hero LCP image', () => {
  const cardSource = readSource(galleryCardPath);

  assert.doesNotMatch(cardSource, /priority=\{isFirst\}/);
});

test('examples head leaves image selection to the route hero', () => {
  const headSource = readSource(examplesHeadPath);

  assert.match(headSource, /rel="preconnect" href="https:\/\/media\.maxvideoai\.com"/);
  assert.doesNotMatch(headSource, /listExamplesPage|buildOptimizedPosterUrl|rel="preload"|fetchPriority/);
});
