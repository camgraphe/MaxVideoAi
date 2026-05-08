import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/jobs/page.tsx');
const collapsedRailPath = join(root, 'frontend/app/(core)/jobs/_components/jobs-collapsed-rail.tsx');
const skeletonCardsPath = join(root, 'frontend/app/(core)/jobs/_components/jobs-skeleton-cards.tsx');
const copyPath = join(root, 'frontend/app/(core)/jobs/_lib/jobs-copy.ts');
const helpersPath = join(root, 'frontend/app/(core)/jobs/_lib/jobs-page-helpers.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const collapsedRailSource = readFileSync(collapsedRailPath, 'utf8');
const skeletonCardsSource = readFileSync(skeletonCardsPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');

test('jobs page delegates copy, library helpers, and compact rail UI', () => {
  assert.ok(existsSync(collapsedRailPath), 'collapsed jobs rail should live in a route-local component module');
  assert.ok(existsSync(skeletonCardsPath), 'jobs skeleton cards should live in a route-local component module');
  assert.ok(existsSync(copyPath), 'jobs copy fallback should live in a route-local lib module');
  assert.ok(existsSync(helpersPath), 'jobs page helpers should live in a route-local lib module');
  assert.match(pageSource, /from '\.\/_components\/jobs-collapsed-rail'/);
  assert.match(pageSource, /from '\.\/_components\/jobs-skeleton-cards'/);
  assert.match(pageSource, /from '\.\/_lib\/jobs-copy'/);
  assert.match(pageSource, /from '\.\/_lib\/jobs-page-helpers'/);
});

test('jobs page does not regain extracted local ownership', () => {
  assert.doesNotMatch(pageSource, /const DEFAULT_JOBS_COPY =/, 'fallback copy belongs in jobs-copy.ts');
  assert.doesNotMatch(pageSource, /function firstHttpUrl\(/, 'library URL selection belongs in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function resolveGroupLibrarySavePayload\(/, 'group library payloads belong in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function resolveEntryLibrarySavePayload\(/, 'entry library payloads belong in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function RailThumb\(/, 'compact rail thumbnails belong in jobs-collapsed-rail.tsx');
  assert.doesNotMatch(pageSource, /function CollapsedGroupRail\(/, 'compact rail UI belongs in jobs-collapsed-rail.tsx');
  assert.doesNotMatch(pageSource, /function renderSkeletonCards\(/, 'skeleton cards belong in jobs-skeleton-cards.tsx');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 720, `jobs page should stay below 720 lines after route-local extraction, got ${lineCount}`);
});

test('jobs route-local modules expose expected contracts', () => {
  assert.match(collapsedRailSource, /export function CollapsedGroupRailSkeleton/);
  assert.match(collapsedRailSource, /export function CollapsedGroupRail/);
  assert.match(skeletonCardsSource, /export function renderSkeletonCards/);
  assert.match(copySource, /export const DEFAULT_JOBS_COPY/);
  assert.match(copySource, /export type JobsCopy/);
  assert.match(helpersSource, /export function resolveClientJobSurface/);
  assert.match(helpersSource, /export function resolveWorkspaceJobHref/);
  assert.match(helpersSource, /export function resolveGroupLibrarySavePayload/);
  assert.match(helpersSource, /export function resolveEntryLibrarySavePayload/);
});
