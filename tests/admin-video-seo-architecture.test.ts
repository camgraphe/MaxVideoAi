import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/admin/video-seo/page.tsx');
const tablePath = join(root, 'frontend/app/(core)/admin/video-seo/_components/VideoSeoInventoryTable.tsx');
const candidateFormPath = join(root, 'frontend/app/(core)/admin/video-seo/_components/VideoSeoCandidateForm.client.tsx');
const editorPath = join(root, 'frontend/app/(core)/admin/video-seo/_components/VideoSeoEditorialEditor.client.tsx');
const helpersPath = join(root, 'frontend/app/(core)/admin/video-seo/_lib/video-seo-admin-helpers.ts');
const apiCreatePath = join(root, 'frontend/app/api/admin/video-seo/route.ts');
const apiEditPath = join(root, 'frontend/app/api/admin/video-seo/[videoId]/route.ts');
const serverEditorialPath = join(root, 'frontend/server/video-seo-editorial.ts');
const migrationPath = join(root, 'neon/migrations/23_video_seo_pages.sql');

const pageSource = readFileSync(pagePath, 'utf8');
const tableSource = readFileSync(tablePath, 'utf8');
const candidateFormSource = existsSync(candidateFormPath) ? readFileSync(candidateFormPath, 'utf8') : '';
const editorSource = existsSync(editorPath) ? readFileSync(editorPath, 'utf8') : '';
const helpersSource = readFileSync(helpersPath, 'utf8');
const apiCreateSource = existsSync(apiCreatePath) ? readFileSync(apiCreatePath, 'utf8') : '';
const apiEditSource = existsSync(apiEditPath) ? readFileSync(apiEditPath, 'utf8') : '';
const serverEditorialSource = existsSync(serverEditorialPath) ? readFileSync(serverEditorialPath, 'utf8') : '';
const migrationSource = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

test('admin video SEO page delegates helpers and inventory table', () => {
  assert.ok(existsSync(pagePath), 'admin video SEO page should exist');
  assert.ok(existsSync(tablePath), 'video SEO inventory table should exist');
  assert.ok(existsSync(candidateFormPath), 'video SEO candidate form should exist');
  assert.ok(existsSync(helpersPath), 'video SEO helpers should exist');

  assert.match(pageSource, /from '\.\/_components\/VideoSeoInventoryTable'/, 'page should import inventory table');
  assert.match(pageSource, /from '\.\/_components\/VideoSeoCandidateForm\.client'/, 'page should import candidate form');
  assert.match(pageSource, /from '\.\/_lib\/video-seo-admin-helpers'/, 'page should import helper builders');
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/, 'page should stay dynamic');
  assert.match(pageSource, /listSeoWatchVideoRows/, 'page should own server data fetch orchestration');
  assert.match(pageSource, /candidateRows/, 'page should expose the candidate/draft rollout lane');
  assert.match(pageSource, /indexedRows/, 'page should expose the indexed watch-page lane');

  assert.doesNotMatch(pageSource, /function buildWatchRow/, 'watch row shaping belongs in helper module');
  assert.doesNotMatch(pageSource, /function buildOverviewItems/, 'overview metrics belong in helper module');
  assert.doesNotMatch(pageSource, /function StatusPill/, 'status pills belong in table module');
  assert.doesNotMatch(pageSource, /function ScoreMeter/, 'score meter belongs in table module');
  assert.doesNotMatch(pageSource, /VideoThumbnailEditor/, 'thumbnail editor wiring belongs in table module');
  assert.doesNotMatch(pageSource, /VideoSeoEditorialEditor/, 'editor form wiring belongs in table module');
  assert.doesNotMatch(pageSource, /AdminDataTable/, 'inventory wall rendering belongs in inventory module');

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
    'splitVideoSeoRows',
    'buildWatchPath',
    'formatDate',
    'formatDateTime',
    'formatDuration',
  ]) {
    assert.match(helpersSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(helpersSource, /Number\(a\.isReady\) - Number\(b\.isReady\)/, 'sorting should keep blockers first');
  assert.match(helpersSource, /encodeURIComponent\(entry\.id\)/, 'audit path should URL-encode IDs');
  assert.match(helpersSource, /buildExpectedVideoCanonicalUrl/, 'watch URLs should use the production watch canonical helper');
  assert.match(helpersSource, /inVideoSitemap/, 'rows should expose computed sitemap presence');
  assert.match(helpersSource, /robots/, 'rows should expose effective robots state');
  assert.match(helpersSource, /promptWordCount/, 'rows should expose prompt length');
  assert.match(helpersSource, /previewSerpTitle/, 'rows should expose SERP title preview');
  assert.match(helpersSource, /modelPath/, 'rows should expose model links');
  assert.match(helpersSource, /examplesPath/, 'rows should expose examples links');
  assert.match(helpersSource, /stableVideoAsset/, 'rows should expose stable media eligibility');
  assert.match(helpersSource, /internalLinkTargets/, 'rows should expose internal link eligibility');
  assert.match(helpersSource, /editorialSourceLabel/, 'rows should expose editorial source labels');
  assert.match(helpersSource, /technicalEligibilityBlockers/, 'rows should separate technical blockers from editorial QA');
  assert.match(helpersSource, /sitemapEligibilityReasons/, 'rows should expose sitemap eligibility reasons');
  assert.match(helpersSource, /canonicalUrl/, 'rows should expose generated canonical URLs');
  assert.match(helpersSource, /expectedCanonicalUrl/, 'rows should expose expected canonical URLs');
  assert.match(helpersSource, /canonicalBlockers/, 'rows should expose canonical blockers');
});

test('admin video SEO inventory wall owns card and modal rendering surfaces', () => {
  assert.match(tableSource, /'use client'/, 'inventory wall should be a client component for modal selection');
  assert.match(tableSource, /export function VideoSeoInventoryTable/, 'inventory wall should keep the public export stable');
  assert.match(tableSource, /function VideoSeoVideoCard/, 'inventory wall should own compact video cards');
  assert.match(tableSource, /function VideoSeoDetailModal/, 'inventory wall should own the focused detail modal');
  assert.match(tableSource, /role="dialog"/, 'detail modal should expose dialog semantics');
  assert.match(tableSource, /aria-modal="true"/, 'detail modal should be modal for assistive tech');
  assert.match(tableSource, /function WatchPreview/, 'table should own preview rendering');
  assert.match(tableSource, /function StatusPill/, 'table should own status pills');
  assert.match(tableSource, /function ScoreMeter/, 'table should own score meter');
  assert.match(tableSource, /VideoThumbnailEditor/, 'table should own thumbnail editor wiring');
  assert.match(tableSource, /VideoSeoEditorialEditor/, 'table should own editorial editor wiring');
  assert.doesNotMatch(tableSource, /AdminDataTable/, 'video SEO inventory should no longer render a dense data table');
  assert.match(tableSource, /grid-cols-\[repeat\(auto-fill,minmax\(180px,1fr\)\)\]/, 'inventory wall should use a scannable responsive video grid');
  assert.match(tableSource, /Preview SERP/, 'table should render the SERP preview');
  assert.match(tableSource, /QA errors/, 'table should render editorial QA errors');
  assert.match(tableSource, /Sitemap/, 'table should render computed sitemap presence');
  assert.match(tableSource, /Robots/, 'table should render effective robots state');
  assert.match(tableSource, /Prompt words/, 'table should render prompt length');
  assert.match(tableSource, /DB override/, 'table should render database override source badges');
  assert.match(tableSource, /Config fallback/, 'table should render config fallback source badges');
  assert.match(tableSource, /Editorial QA errors/, 'table should label editorial QA separately');
  assert.match(tableSource, /Technical \/ eligibility blockers/, 'table should label technical blockers separately');
  assert.match(tableSource, /Sitemap eligibility:/, 'table should render sitemap eligibility summary');
  assert.match(tableSource, /Stable video URL/, 'table should show stable video URL eligibility');
  assert.match(tableSource, /Internal links/, 'table should show internal link eligibility');
  assert.match(tableSource, /Canonical/, 'table should show generated canonical URL state');
  assert.match(tableSource, /Missing canonical/, 'table should show missing canonical blockers');
  assert.match(tableSource, /Canonical mismatch/, 'table should show canonical mismatch blockers');
  assert.match(tableSource, /Canonical conflict/, 'table should show canonical conflict blockers');
  assert.match(tableSource, /Canonical target not indexable/, 'table should show noindex canonical target blockers');
});

test('admin video SEO editing uses a dedicated table and guarded API', () => {
  assert.ok(existsSync(migrationPath), 'video SEO page edits should have a dedicated migration');
  assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS video_seo_pages/, 'migration should create video_seo_pages');
  assert.match(migrationSource, /seo_status TEXT NOT NULL/, 'migration should persist explicit SEO status');
  assert.match(migrationSource, /CHECK \(seo_status IN \(/, 'migration should constrain SEO statuses');
  assert.doesNotMatch(migrationSource, /include_?in_?sitemap/i, 'migration should not add a dangerous sitemap toggle');

  assert.ok(existsSync(serverEditorialPath), 'server editorial persistence module should exist');
  assert.match(serverEditorialSource, /listVideoSeoEditorialEntries/, 'server module should list editorial entries');
  assert.match(serverEditorialSource, /upsertVideoSeoEditorialEntry/, 'server module should save editorial entries');
  assert.match(serverEditorialSource, /validateVideoSeoEditorialUpdatePayload/, 'server module should validate editorial update payloads');
  assert.match(serverEditorialSource, /INSERT INTO video_seo_pages/, 'server module should persist to video_seo_pages');
  assert.match(serverEditorialSource, /buildDraftVideoSeoEditorialEntry/, 'server module should build safe draft candidates');

  assert.ok(existsSync(apiCreatePath), 'candidate creation API should exist');
  assert.ok(existsSync(apiEditPath), 'editor update API should exist');
  assert.match(apiCreateSource, /requireAdmin/, 'candidate API should require admin access');
  assert.match(apiCreateSource, /buildDraftVideoSeoEditorialEntry/, 'candidate API should create draft entries');
  assert.match(apiEditSource, /requireAdmin/, 'editor API should require admin access');
  assert.match(apiEditSource, /validateVideoSeoEditorialUpdatePayload/, 'editor API should use strict server-side validation');
  assert.match(apiEditSource, /upsertVideoSeoEditorialEntry/, 'editor API should save editorial entries');
});

test('admin video SEO client forms expose status-based editing without sitemap toggles', () => {
  assert.ok(existsSync(candidateFormPath), 'candidate form should exist');
  assert.ok(existsSync(editorPath), 'editor form should exist');
  assert.match(candidateFormSource, /authFetch\('\/api\/admin\/video-seo'/, 'candidate form should call the candidate API');
  assert.match(editorSource, /seoStatus/, 'editor should expose SEO status');
  assert.match(editorSource, /targetKeyword/, 'editor should expose target keyword');
  assert.match(editorSource, /videoObjectName/, 'editor should expose VideoObject.name');
  assert.match(editorSource, /authFetch\(`\/api\/admin\/video-seo\/\$\{encodeURIComponent\(draft\.id\)\}`/, 'editor should call the update API');
  assert.doesNotMatch(candidateFormSource, /Include in sitemap/i, 'candidate form should not expose sitemap toggles');
  assert.doesNotMatch(editorSource, /Include in sitemap/i, 'editor form should not expose sitemap toggles');
});
