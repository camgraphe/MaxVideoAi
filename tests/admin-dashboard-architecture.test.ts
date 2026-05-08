import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/page.tsx';
const helpersPath = 'frontend/app/(core)/admin/_lib/admin-dashboard-helpers.ts';
const viewPath = 'frontend/app/(core)/admin/_components/AdminDashboardView.tsx';

test('admin dashboard page stays below route bloat threshold', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(helpersPath), true);
  assert.equal(existsSync(viewPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 90, `expected admin dashboard page to stay under 90 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_components\/AdminDashboardView';/);
  assert.match(pageSource, /from '\.\/_lib\/admin-dashboard-helpers';/);
  assert.match(pageSource, /fetchAdminMetrics\(/);
  assert.match(pageSource, /fetchAdminHealth\(/);
  assert.doesNotMatch(pageSource, /new Intl\./);
  assert.doesNotMatch(pageSource, /<header/);
  assert.doesNotMatch(pageSource, /function RangeSelector/);
  assert.doesNotMatch(pageSource, /function buildKpiCards/);
  assert.doesNotMatch(pageSource, /function buildIncidentRows/);
  assert.doesNotMatch(pageSource, /function buildQueueRows/);
});

test('admin dashboard helpers own formatting and data builders', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(helpersSource, /export function buildKpiCards/);
  assert.match(helpersSource, /export function buildRangeStats/);
  assert.match(helpersSource, /export function buildIncidentRows/);
  assert.match(helpersSource, /export function buildQueueRows/);
  assert.match(helpersSource, /export function buildAdminInsightsHref/);
  assert.match(helpersSource, /const numberFormatter = new Intl\.NumberFormat/);
});

test('admin dashboard view owns route-local JSX sections', () => {
  const viewSource = readFileSync(viewPath, 'utf8');

  assert.match(viewSource, /export function AdminDashboardView/);
  assert.match(viewSource, /function RangeSelector/);
  assert.match(viewSource, /function MonthlyStatsChart/);
  assert.match(viewSource, /function MetricCard/);
  assert.match(viewSource, /from '\.\.\/_lib\/admin-dashboard-helpers';/);
});
