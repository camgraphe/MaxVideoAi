import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routePath = 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/best-for/[usecase]/page.tsx';
const pageSource = readFileSync(routePath, 'utf8');
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

  assert.ok(lineCount < 800, `best-for detail page should stay under 800 lines after split, got ${lineCount}`);
  assert.ok(pageSource.includes("from './_lib/best-for-detail-config'"));
  assert.ok(pageSource.includes("from './_lib/best-for-detail-helpers'"));
  assert.doesNotMatch(pageSource, /const DETAIL_COPY/);
  assert.doesNotMatch(pageSource, /const USECASE_CRITERIA/);
  assert.doesNotMatch(pageSource, /async function loadEngineScores/);
});

test('best-for detail helper modules own config, rankings, related guides, and schema builders', () => {
  assert.match(configSource, /export const DETAIL_COPY/);
  assert.match(configSource, /export const USECASE_CRITERIA/);
  assert.match(helperSource, /export function resolveTopPicks/);
  assert.match(helperSource, /export function buildRankedPick/);
  assert.match(helperSource, /export async function resolveRelatedBestForGuides/);
  assert.match(helperSource, /export function buildBestForItemListJsonLd/);
});
