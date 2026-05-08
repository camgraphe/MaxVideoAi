import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx';
const viewPath =
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_components/BestForDetailView.tsx';
const pageSource = readFileSync(routePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const configSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-config.ts',
  'utf8'
);
const helperSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/_lib/best-for-detail-helpers.ts',
  'utf8'
);

test('best-for detail page delegates editorial config and data helpers', () => {
  const lineCount = pageSource.split('\n').length;

  assert.ok(lineCount < 300, `best-for detail page should stay under 300 lines after view split, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/best-for-detail-config'"));
  assert.ok(pageSource.includes("from './_lib/best-for-detail-helpers'"));
  assert.ok(pageSource.includes("from './_components/BestForDetailView'"));
  assert.doesNotMatch(pageSource, /const DETAIL_COPY/);
  assert.doesNotMatch(pageSource, /const USECASE_CRITERIA/);
  assert.doesNotMatch(pageSource, /async function loadEngineScores/);
  assert.doesNotMatch(pageSource, /function TopPicksPanel/);
  assert.doesNotMatch(pageSource, /function RankedShortlistCard/);
  assert.doesNotMatch(pageSource, /function ExamplesPreview/);
  assert.doesNotMatch(pageSource, /function BestForContent/);
});

test('best-for detail helper modules own config, rankings, related guides, and schema builders', () => {
  assert.match(configSource, /export const DETAIL_COPY/);
  assert.match(configSource, /export const USECASE_CRITERIA/);
  assert.match(helperSource, /export function resolveTopPicks/);
  assert.match(helperSource, /export function buildRankedPick/);
  assert.match(helperSource, /export async function resolveRelatedBestForGuides/);
  assert.match(helperSource, /export function buildBestForItemListJsonLd/);
});

test('best-for detail route-local view owns page sections and cards', () => {
  assert.ok(existsSync(viewPath), 'best-for detail view should live in a route-local component');
  assert.match(viewSource, /export function BestForDetailView/);
  assert.match(viewSource, /function TopPicksPanel/);
  assert.match(viewSource, /function RankedShortlistCard/);
  assert.match(viewSource, /function ExamplesPreview/);
  assert.match(viewSource, /function EditorialReasonCard/);
  assert.match(viewSource, /function BestForContent/);
  assert.match(viewSource, /EngineIcon/);
  assert.match(viewSource, /Image/);
});
