import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/audit/page.tsx';
const viewPath = 'frontend/app/(core)/admin/audit/_components/AdminAuditView.tsx';
const actionRailPath = 'frontend/app/(core)/admin/audit/_components/AuditActionRail.tsx';
const filtersPath = 'frontend/app/(core)/admin/audit/_components/AuditFiltersForm.tsx';
const tablePath = 'frontend/app/(core)/admin/audit/_components/AuditTable.tsx';
const helpersPath = 'frontend/app/(core)/admin/audit/_lib/admin-audit-helpers.ts';

test('admin audit page stays a server route orchestrator', () => {
  for (const file of [pagePath, viewPath, actionRailPath, filtersPath, tablePath, helpersPath]) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.match(pageSource, /requireAdmin/);
  assert.match(pageSource, /fetchAdminAuditLogs/);
  assert.match(pageSource, /normalizeFilters/);
  assert.match(pageSource, /AdminAuditView/);
  assert.match(pageSource, /export const dynamic = 'force-dynamic'/);
  assert.doesNotMatch(pageSource, /AdminDataTable/);
  assert.doesNotMatch(pageSource, /AdminFilterBar/);
  assert.doesNotMatch(pageSource, /buildAuditMetrics/);
  assert.doesNotMatch(pageSource, /new Intl/);
  assert.ok(pageLines <= 70, `expected admin audit page below 70 lines, got ${pageLines}`);
});

test('admin audit modules own view, table, filter, and helper contracts', () => {
  const viewSource = readFileSync(viewPath, 'utf8');
  const actionRailSource = readFileSync(actionRailPath, 'utf8');
  const filtersSource = readFileSync(filtersPath, 'utf8');
  const tableSource = readFileSync(tablePath, 'utf8');
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(viewSource, /export function AdminAuditView/);
  assert.match(viewSource, /export function AdminAuditDatabaseNotice/);
  assert.match(viewSource, /AuditActionRail/);
  assert.match(viewSource, /AuditFiltersForm/);
  assert.match(viewSource, /AuditTable/);

  assert.match(actionRailSource, /export function AuditActionRail/);
  assert.match(actionRailSource, /ACTION_OPTIONS/);
  assert.match(actionRailSource, /buildAuditHref/);
  assert.match(filtersSource, /export function AuditFiltersForm/);
  assert.match(filtersSource, /AdminFilterBar/);
  assert.match(tableSource, /export function AuditTable/);
  assert.match(tableSource, /function AuditContextCell/);
  assert.match(tableSource, /function AuditActionBadge/);

  for (const exportName of [
    'normalizeFilters',
    'buildAuditHref',
    'buildAuditMetrics',
    'describeActiveFilters',
    'formatNumber',
    'formatDateTime',
    'formatActionLabel',
    'truncateId',
  ]) {
    assert.match(helpersSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }
});
