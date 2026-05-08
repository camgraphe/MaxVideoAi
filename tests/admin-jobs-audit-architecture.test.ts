import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/jobs/page.tsx';
const viewPath = 'frontend/app/(core)/admin/jobs/_components/AdminJobsAuditView.tsx';
const filtersPath = 'frontend/app/(core)/admin/jobs/_components/JobFilters.tsx';
const helpersPath = 'frontend/app/(core)/admin/jobs/_lib/admin-jobs-helpers.ts';

test('admin jobs page stays a server route orchestrator', () => {
  for (const file of [pagePath, viewPath, filtersPath, helpersPath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.match(pageSource, /fetchRecentJobAudits/);
  assert.match(pageSource, /normalizeFilters/);
  assert.match(pageSource, /AdminJobsAuditView/);
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
  assert.doesNotMatch(pageSource, /AdminFilterBar/);
  assert.doesNotMatch(pageSource, /AdminMetricGrid/);
  assert.doesNotMatch(pageSource, /buildOverviewCards/);
  assert.doesNotMatch(pageSource, /buildOutcomeShortcuts/);
  assert.doesNotMatch(pageSource, /new Intl/);
  assert.ok(pageLines <= 60, `expected admin jobs page below 60 lines, got ${pageLines}`);
});

test('admin jobs modules own view, filter, and helper contracts', () => {
  const viewSource = readFileSync(viewPath, 'utf8');
  const filtersSource = readFileSync(filtersPath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(viewSource, /export function AdminJobsAuditView/);
  assert.match(viewSource, /export function AdminJobsDatabaseNotice/);
  assert.match(viewSource, /AdminShortcutRail/);
  assert.match(viewSource, /AdminJobAuditTable/);
  assert.match(viewSource, /JobFilters/);
  assert.match(filtersSource, /export function JobFilters/);
  assert.match(filtersSource, /STATUS_OPTIONS/);
  assert.match(filtersSource, /OUTCOME_OPTIONS/);

  for (const exportName of [
    'normalizeFilters',
    'parseDate',
    'buildFiltersQuery',
    'buildJobsHref',
    'buildOverviewCards',
    'buildOutcomeShortcuts',
    'describeActiveFilters',
    'formatNumber',
  ]) {
    assert.match(helpersSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }
});
