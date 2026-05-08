import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/insights/page.tsx';
const helpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-helpers.ts';
const formattersPath = 'frontend/app/(core)/admin/insights/_lib/insights-formatters.ts';
const navigationPath = 'frontend/app/(core)/admin/insights/_lib/insights-navigation.ts';
const typesPath = 'frontend/app/(core)/admin/insights/_lib/insights-types.ts';
const panelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsPanels.tsx';
const chartSurfacesPath = 'frontend/app/(core)/admin/insights/_components/InsightsChartSurfaces.tsx';

test('admin insights page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(helpersPath), true);
  assert.equal(existsSync(formattersPath), true);
  assert.equal(existsSync(navigationPath), true);
  assert.equal(existsSync(typesPath), true);
  assert.equal(existsSync(panelsPath), true);
  assert.equal(existsSync(chartSurfacesPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 260, `expected admin insights page to stay under 260 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_lib\/insights-types';/);
  assert.match(pageSource, /from '\.\/_lib\/insights-helpers';/);
  assert.match(pageSource, /from '\.\/_lib\/insights-navigation';/);
  assert.match(pageSource, /from '\.\/_components\/InsightsPanels';/);
  assert.match(pageSource, /from '\.\/_components\/InsightsChartSurfaces';/);
  assert.match(pageSource, /fetchAdminMetrics\(/);
  assert.match(pageSource, /fetchAdminMetricsComparison\(/);
  assert.match(pageSource, /requireAdmin\(\)/);

  assert.doesNotMatch(pageSource, /function buildExecutiveMetrics/);
  assert.doesNotMatch(pageSource, /function buildFocusMetricData/);
  assert.doesNotMatch(pageSource, /function ComparisonChart/);
  assert.doesNotMatch(pageSource, /new Intl\./);
});

test('admin insights helpers own data shaping', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(helpersSource, /export function buildExecutiveMetrics/);
  assert.match(helpersSource, /export function buildFocusMetricData/);
  assert.match(helpersSource, /export function buildRevenueBoardRows/);
  assert.match(helpersSource, /export function buildMonthlyRows/);
  assert.match(helpersSource, /from '\.\/insights-formatters';/);
  assert.match(helpersSource, /from '\.\/insights-navigation';/);
  assert.doesNotMatch(helpersSource, /const currencyFormatter = new Intl\.NumberFormat/);
  assert.doesNotMatch(helpersSource, /export function buildInsightsHref/);
  assert.doesNotMatch(helpersSource, /export function resolveFocusParam/);
});

test('admin insights formatting and navigation helpers stay split', () => {
  const formattersSource = readFileSync(formattersPath, 'utf8');
  const navigationSource = readFileSync(navigationPath, 'utf8');

  assert.match(formattersSource, /const currencyFormatter = new Intl\.NumberFormat/);
  assert.match(formattersSource, /export function formatCurrency/);
  assert.match(formattersSource, /export function formatCompactNumber/);
  assert.match(formattersSource, /export function toneBadgeClass/);
  assert.match(formattersSource, /export function resolveDeltaTone/);
  assert.match(navigationSource, /export const FOCUS_OPTIONS/);
  assert.match(navigationSource, /export function buildInsightsHref/);
  assert.match(navigationSource, /export function resolveFocusParam/);
  assert.match(navigationSource, /export function describeRange/);
});

test('admin insights panels own route-local JSX surfaces', () => {
  const panelsSource = readFileSync(panelsPath, 'utf8');

  assert.ok(statSync(panelsPath).size > 0);
  assert.match(panelsSource, /export function RevenueBoardTable/);
  assert.match(panelsSource, /export function HealthPanel/);
  assert.match(panelsSource, /export function InsightsControls/);
  assert.match(panelsSource, /export function DailyLedgerTable/);
  assert.match(panelsSource, /from '\.\.\/_lib\/insights-formatters';/);
  assert.match(panelsSource, /from '\.\.\/_lib\/insights-navigation';/);
  assert.match(panelsSource, /from '\.\/InsightsChartSurfaces';/);
  assert.doesNotMatch(panelsSource, /buildChartTicks/);
  assert.doesNotMatch(panelsSource, /export function ComparisonChart/);
});

test('admin insights chart surfaces own chart primitives', () => {
  const chartSurfacesSource = readFileSync(chartSurfacesPath, 'utf8');

  assert.match(chartSurfacesSource, /export function ComparisonChart/);
  assert.match(chartSurfacesSource, /export function ShareBar/);
  assert.match(chartSurfacesSource, /export function EmptyStateCard/);
  assert.match(chartSurfacesSource, /buildChartTicks/);
});
