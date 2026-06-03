import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(core)/jobs/page.tsx');
const shellPath = join(root, 'frontend/app/(core)/jobs/_components/JobsPageShell.tsx');
const collapsedRailPath = join(root, 'frontend/app/(core)/jobs/_components/jobs-collapsed-rail.tsx');
const skeletonCardsPath = join(root, 'frontend/app/(core)/jobs/_components/jobs-skeleton-cards.tsx');
const copyHookPath = join(root, 'frontend/app/(core)/jobs/_hooks/useJobsCopy.ts');
const controllerHookPath = join(root, 'frontend/app/(core)/jobs/_hooks/useJobsPageController.ts');
const copyPath = join(root, 'frontend/app/(core)/jobs/_lib/jobs-copy.ts');
const helpersPath = join(root, 'frontend/app/(core)/jobs/_lib/jobs-page-helpers.ts');
const typesPath = join(root, 'frontend/app/(core)/jobs/_lib/jobs-page-types.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const shellSource = readFileSync(shellPath, 'utf8');
const collapsedRailSource = readFileSync(collapsedRailPath, 'utf8');
const skeletonCardsSource = readFileSync(skeletonCardsPath, 'utf8');
const copyHookSource = readFileSync(copyHookPath, 'utf8');
const controllerHookSource = readFileSync(controllerHookPath, 'utf8');
const copySource = readFileSync(copyPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('jobs page delegates copy, library helpers, and compact rail UI', () => {
  assert.ok(existsSync(shellPath), 'jobs page shell should live in a route-local component module');
  assert.ok(existsSync(collapsedRailPath), 'collapsed jobs rail should live in a route-local component module');
  assert.ok(existsSync(skeletonCardsPath), 'jobs skeleton cards should live in a route-local component module');
  assert.ok(existsSync(copyHookPath), 'jobs copy merge should live in a route-local hook');
  assert.ok(existsSync(controllerHookPath), 'jobs page controller should live in a route-local hook');
  assert.ok(existsSync(copyPath), 'jobs copy fallback should live in a route-local lib module');
  assert.ok(existsSync(helpersPath), 'jobs page helpers should live in a route-local lib module');
  assert.ok(existsSync(typesPath), 'jobs page types should live in a route-local lib module');
  assert.match(pageSource, /from '\.\/_components\/JobsPageShell'/);
  assert.match(pageSource, /from '\.\/_hooks\/useJobsPageController'/);
  assert.match(copyHookSource, /from '\.\.\/_lib\/jobs-copy'/);
});

test('jobs page does not regain extracted local ownership', () => {
  assert.doesNotMatch(pageSource, /const DEFAULT_JOBS_COPY =/, 'fallback copy belongs in jobs-copy.ts');
  assert.doesNotMatch(pageSource, /function firstHttpUrl\(/, 'library URL selection belongs in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function resolveGroupLibrarySavePayload\(/, 'group library payloads belong in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function resolveEntryLibrarySavePayload\(/, 'entry library payloads belong in jobs-page-helpers.ts');
  assert.doesNotMatch(pageSource, /function RailThumb\(/, 'compact rail thumbnails belong in jobs-collapsed-rail.tsx');
  assert.doesNotMatch(pageSource, /function CollapsedGroupRail\(/, 'compact rail UI belongs in jobs-collapsed-rail.tsx');
  assert.doesNotMatch(pageSource, /function renderSkeletonCards\(/, 'skeleton cards belong in jobs-skeleton-cards.tsx');
  assert.doesNotMatch(pageSource, /HeaderBar|AppSidebar/, 'jobs page shell owns app chrome');
  assert.doesNotMatch(pageSource, /GroupedJobCard/, 'jobs page shell owns grouped job card rendering');
  assert.doesNotMatch(pageSource, /GroupViewerModal/, 'jobs page shell owns viewer modal rendering');
  assert.doesNotMatch(pageSource, /ChevronDown/, 'jobs page shell owns section disclosure rendering');
  assert.doesNotMatch(pageSource, /rawCopy|DEFAULT_JOBS_COPY\.sections/, 'jobs copy hook owns fallback copy merging');
  assert.doesNotMatch(pageSource, /useInfiniteJobs/, 'jobs page controller owns feed orchestration');
  assert.doesNotMatch(pageSource, /saveAssetToLibrary/, 'jobs page controller owns library saves');
  assert.doesNotMatch(pageSource, /getJobStatus/, 'jobs page controller owns refresh actions');
  assert.doesNotMatch(pageSource, /groupJobsIntoSummaries/, 'jobs page controller owns grouping');
  assert.doesNotMatch(pageSource, /normalizeGroupSummaries/, 'jobs page controller owns normalized group state');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 30, `jobs page should stay below 30 lines after controller extraction, got ${lineCount}`);
});

test('jobs route-local modules expose expected contracts', () => {
  assert.match(shellSource, /export function JobsPageShell/);
  assert.match(shellSource, /HeaderBar/);
  assert.match(shellSource, /AppSidebar/);
  assert.match(shellSource, /GroupedJobCard/);
  assert.match(shellSource, /GroupViewerModal/);
  assert.match(shellSource, /renderGroupGrid/);
  assert.match(shellSource, /renderCollapsedRail/);
  assert.match(collapsedRailSource, /export function CollapsedGroupRailSkeleton/);
  assert.match(collapsedRailSource, /export function CollapsedGroupRail/);
  assert.match(skeletonCardsSource, /export function renderSkeletonCards/);
  assert.match(copyHookSource, /export function useJobsCopy/);
  assert.match(copyHookSource, /DEFAULT_JOBS_COPY\.sections/);
  assert.match(controllerHookSource, /export function useJobsPageController/);
  assert.match(controllerHookSource, /useInfiniteJobs/);
  assert.match(controllerHookSource, /useInfiniteJobs\(JOBS_PAGE_SIZE, \{ surface: 'storyboard' \}\)/);
  assert.match(controllerHookSource, /key: 'storyboard'/);
  assert.match(controllerHookSource, /saveAssetToLibrary/);
  assert.match(controllerHookSource, /getJobStatus/);
  assert.match(controllerHookSource, /window\.addEventListener\('jobs:hidden'/);
  assert.match(copySource, /export const DEFAULT_JOBS_COPY/);
  assert.match(copySource, /export type JobsCopy/);
  assert.match(copySource, /storyboard: 'Storyboard history'/);
  assert.match(copySource, /storyboardEmpty: 'No storyboard renders yet.'/);
  assert.match(readFileSync(join(root, 'frontend/components/GroupedJobCardMenu.tsx'), 'utf8'), /Remove from history/);
  assert.match(helpersSource, /export function resolveClientJobSurface/);
  assert.match(helpersSource, /export function resolveWorkspaceJobHref/);
  assert.match(helpersSource, /\/app\/tools\/storyboard\?job=/);
  assert.match(helpersSource, /export function resolveGroupLibrarySavePayload/);
  assert.match(helpersSource, /export function resolveEntryLibrarySavePayload/);
  assert.match(typesSource, /export type JobsSectionKey/);
  assert.match(typesSource, /'storyboard'/);
  assert.match(typesSource, /export interface JobsPageSection/);
  assert.match(typesSource, /export type \{ GroupedJobAction \}/);
});
