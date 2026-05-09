import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const serverPath = 'frontend/server/videos.ts';
const normalizationPath = 'frontend/server/videos-normalization.ts';
const examplesPath = 'frontend/server/videos-examples.ts';

test('server videos module keeps row normalization and examples helpers focused', () => {
  assert.equal(existsSync(serverPath), true);
  assert.equal(existsSync(normalizationPath), true);
  assert.equal(existsSync(examplesPath), true);

  const serverSource = readFileSync(serverPath, 'utf8');
  const normalizationSource = readFileSync(normalizationPath, 'utf8');
  const examplesSource = readFileSync(examplesPath, 'utf8');

  assert.ok(serverSource.split('\n').length < 420, 'videos.ts should stay under 420 lines after helper extraction');
  assert.match(serverSource, /from '\.\/videos-normalization'/);
  assert.match(serverSource, /from '\.\/videos-examples'/);
  assert.doesNotMatch(serverSource, /function formatPromptExcerpt/);
  assert.doesNotMatch(serverSource, /function sortVideosByPreference/);
  assert.doesNotMatch(serverSource, /function paginateGalleryVideos/);

  assert.match(normalizationSource, /export type VideoRow/);
  assert.match(normalizationSource, /export type GalleryVideo/);
  assert.match(normalizationSource, /export function mapGalleryVideoRow/);
  assert.match(normalizationSource, /normalizeJobKeyframeUrls/);

  assert.match(examplesSource, /export function mergeUniqueGalleryVideos/);
  assert.match(examplesSource, /export function sortVideosByPreference/);
  assert.match(examplesSource, /export function paginateGalleryVideos/);
  assert.match(examplesSource, /export function resolveExampleGroupId/);
});

test('server videos facade keeps public gallery and SEO contracts available', () => {
  const serverSource = readFileSync(serverPath, 'utf8');

  for (const exportName of [
    'getVideoById',
    'getSeoVideoById',
    'getVideosByIds',
    'getSeoVideosByIds',
    'getPublicVideosByIds',
    'getLatestPublicVideoByPromptAndEngine',
    'listGalleryVideos',
    'listPlaylistVideos',
    'listStarterPlaylistVideos',
    'listExampleFamilyPage',
    'listExamplesPage',
    'listExamples',
    'getPlaylistExamples',
    'updateVideoIndexableForUser',
  ]) {
    assert.match(serverSource, new RegExp(`export async function ${exportName}`));
  }

  assert.match(serverSource, /visibility = 'public'/);
  assert.match(serverSource, /COALESCE\(indexable, TRUE\)/);
});
