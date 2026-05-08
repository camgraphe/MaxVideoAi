import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function countLines(source: string) {
  return source.split(/\r?\n/).length;
}

test('gallery rail delegates cards, snackbar, status blocks, scrollbar, and pure helpers', () => {
  const railSource = readSource('frontend/components/GalleryRail.tsx');

  assert.ok(countLines(railSource) <= 500, `GalleryRail.tsx should stay under 500 lines, found ${countLines(railSource)}`);
  assert.match(railSource, /GalleryRailCards/);
  assert.match(railSource, /GalleryRailSnackbar/);
  assert.match(railSource, /GalleryRailHeader/);
  assert.match(railSource, /useGalleryRailScrollbar/);
  assert.match(railSource, /from '\.\/gallery-rail-utils';/);
  assert.doesNotMatch(railSource, /function resolveBackgroundWarmPreviewLimit/);
  assert.doesNotMatch(railSource, /function Snackbar/);
  assert.doesNotMatch(railSource, /createPortal/);
});

test('grouped job card delegates media, preview grid, menu, and action types', () => {
  const cardSource = readSource('frontend/components/GroupedJobCard.tsx');
  const mediaSource = readSource('frontend/components/GroupedJobCardMedia.tsx');
  const gridSource = readSource('frontend/components/GroupedJobCardPreviewGrid.tsx');
  const menuSource = readSource('frontend/components/GroupedJobCardMenu.tsx');
  const typesSource = readSource('frontend/components/grouped-job-card-types.ts');

  assert.ok(countLines(cardSource) <= 500, `GroupedJobCard.tsx should stay under 500 lines, found ${countLines(cardSource)}`);
  assert.match(cardSource, /GroupedJobCardPreviewGrid/);
  assert.match(cardSource, /GroupedJobCardMenu/);
  assert.match(cardSource, /shouldWarmVisiblePreview/);
  assert.match(mediaSource, /export function GroupPreviewMedia/);
  assert.match(gridSource, /export function GroupedJobCardPreviewGrid/);
  assert.match(menuSource, /export function GroupedJobCardMenu/);
  assert.match(typesSource, /export type GroupedJobAction/);
  assert.doesNotMatch(cardSource, /export function GroupPreviewMedia/);
  assert.doesNotMatch(cardSource, /const GROUPED_JOB_THUMB_SIZES/);
});
