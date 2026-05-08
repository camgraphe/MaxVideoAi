import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/video-seo/page.tsx');
const tablePath = join(root, 'frontend/app/(core)/admin/video-seo/_components/VideoSeoInventoryTable.tsx');
const helpersPath = join(root, 'frontend/app/(core)/admin/video-seo/_lib/video-seo-admin-helpers.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const tableSource = readFileSync(tablePath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');

test('admin video SEO page delegates helpers and inventory table', () => {
  assert.ok(existsSync(pagePath), 'admin video SEO page should exist');
  assert.ok(existsSync(tablePath), 'video SEO inventory table should exist');
  assert.ok(existsSync(helpersPath), 'video SEO helpers should exist');

  assert.match(pageSource, /from '\.\/_components\/VideoSeoInventoryTable'/, 'page should import inventory table');
  assert.match(pageSource, /from '\.\/_lib\/video-seo-admin-helpers'/, 'page should import helper builders');
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/, 'page should stay dynamic');
  assert.match(pageSource, /listSeoWatchVideoRows/, 'page should own server data fetch orchestration');

  assert.doesNotMatch(pageSource, /function buildWatchRow/, 'watch row shaping belongs in helper module');
  assert.doesNotMatch(pageSource, /function buildOverviewItems/, 'overview metrics belong in helper module');
  assert.doesNotMatch(pageSource, /function StatusPill/, 'status pills belong in table module');
  assert.doesNotMatch(pageSource, /function ScoreMeter/, 'score meter belongs in table module');
  assert.doesNotMatch(pageSource, /VideoThumbnailEditor/, 'thumbnail editor wiring belongs in table module');
  assert.doesNotMatch(pageSource, /AdminDataTable/, 'inventory table rendering belongs in table module');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 120, `admin video SEO page should stay below 120 lines, got ${lineCount}`);
});

test('admin video SEO helpers expose row, summary, and formatting contracts', () => {
  assert.match(helpersSource, /export type WatchRow/, 'WatchRow should be exported');
  for (const exportName of [
    'buildWatchRows',
    'buildWatchRow',
    'compareWatchRows',
    'buildOverviewItems',
    'buildVideoSeoSummary',
    'buildWatchPath',
    'formatDate',
    'formatDateTime',
    'formatDuration',
  ]) {
    assert.match(helpersSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(helpersSource, /Number\(a\.isReady\) - Number\(b\.isReady\)/, 'sorting should keep blockers first');
  assert.match(helpersSource, /encodeURIComponent\(entry\.id\)/, 'audit path should URL-encode IDs');
  assert.match(helpersSource, /SITE_ORIGIN/, 'watch URLs should keep the site origin helper');
});

test('admin video SEO inventory table owns row rendering surfaces', () => {
  assert.match(tableSource, /export function VideoSeoInventoryTable/, 'inventory table should be exported');
  assert.match(tableSource, /function WatchPreview/, 'table should own preview rendering');
  assert.match(tableSource, /function StatusPill/, 'table should own status pills');
  assert.match(tableSource, /function ScoreMeter/, 'table should own score meter');
  assert.match(tableSource, /VideoThumbnailEditor/, 'table should own thumbnail editor wiring');
  assert.match(tableSource, /AdminDataTable/, 'table should own data table rendering');
});
