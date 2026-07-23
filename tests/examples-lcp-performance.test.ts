import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const galleryCardPath = join(root, 'frontend/components/examples/ExampleGalleryCard.tsx');
const galleryClientPath = join(root, 'frontend/components/examples/ExamplesGalleryGrid.client.tsx');
const galleryGridPath = join(root, 'frontend/components/examples/ExamplesGalleryGrid.tsx');
const examplesHeadPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/examples/head.tsx');
const examplesPageViewPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-page-view.tsx'
);
const examplesRouteSectionsPath = join(
  root,
  'frontend/app/(localized)/[locale]/(marketing)/examples/_components/examples-route-sections.tsx'
);

const readSource = (path: string) => readFileSync(path, 'utf8');

test('examples gallery prioritizes its first poster only when no route hero is rendered', () => {
  const cardSource = readSource(galleryCardPath);
  const clientSource = readSource(galleryClientPath);
  const gridSource = readSource(galleryGridPath);
  const pageViewSource = readSource(examplesPageViewPath);
  const routeSectionsSource = readSource(examplesRouteSectionsPath);

  assert.match(pageViewSource, /const hasRouteHero = Boolean\(mainVideo && mainVideoFeature\.contentUrl\)/);
  assert.match(pageViewSource, /prioritizeFirstPoster=\{!hasRouteHero\}/);
  assert.match(routeSectionsSource, /prioritizeFirstPoster=\{prioritizeFirstPoster\}/);
  assert.match(gridSource, /prioritizeFirstPoster=\{prioritizeFirstPoster\}/);
  assert.match(clientSource, /prioritizePoster=\{prioritizeFirstPoster && video\.id === firstVisibleId\}/);
  assert.match(cardSource, /priority=\{prioritizePoster\}/);
  assert.match(cardSource, /fetchPriority=\{prioritizePoster \? 'high' : undefined\}/);
  assert.doesNotMatch(cardSource, /priority=\{isFirst\}/);
});

test('examples head leaves image selection to the route hero', () => {
  const headSource = readSource(examplesHeadPath);

  assert.match(headSource, /rel="preconnect" href="https:\/\/media\.maxvideoai\.com"/);
  assert.doesNotMatch(headSource, /listExamplesPage|buildOptimizedPosterUrl|rel="preload"|fetchPriority/);
});
