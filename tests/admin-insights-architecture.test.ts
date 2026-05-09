import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/insights/page.tsx';
const helpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-helpers.ts';
const executiveHelpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-executive-helpers.ts';
const revenueHelpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-revenue-helpers.ts';
const funnelHelpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-funnel-helpers.ts';
const seriesHelpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-series-helpers.ts';
const formattersPath = 'frontend/app/(core)/admin/insights/_lib/insights-formatters.ts';
const navigationPath = 'frontend/app/(core)/admin/insights/_lib/insights-navigation.ts';
const typesPath = 'frontend/app/(core)/admin/insights/_lib/insights-types.ts';
const panelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsPanels.tsx';
const controlsPanelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsControlsPanels.tsx';
const healthPanelPath = 'frontend/app/(core)/admin/insights/_components/InsightsHealthPanel.tsx';
const summaryPanelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsSummaryPanels.tsx';
const tablePanelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsTablePanels.tsx';
const chartSurfacesPath = 'frontend/app/(core)/admin/insights/_components/InsightsChartSurfaces.tsx';

test('admin insights page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(helpersPath), true);
  assert.equal(existsSync(executiveHelpersPath), true);
  assert.equal(existsSync(revenueHelpersPath), true);
  assert.equal(existsSync(funnelHelpersPath), true);
  assert.equal(existsSync(seriesHelpersPath), true);
  assert.equal(existsSync(formattersPath), true);
  assert.equal(existsSync(navigationPath), true);
  assert.equal(existsSync(typesPath), true);
  assert.equal(existsSync(panelsPath), true);
  assert.equal(existsSync(controlsPanelsPath), true);
  assert.equal(existsSync(healthPanelPath), true);
  assert.equal(existsSync(summaryPanelsPath), true);
  assert.equal(existsSync(tablePanelsPath), true);
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
  const executiveSource = readFileSync(executiveHelpersPath, 'utf8');
  const revenueSource = readFileSync(revenueHelpersPath, 'utf8');
  const funnelSource = readFileSync(funnelHelpersPath, 'utf8');
  const seriesSource = readFileSync(seriesHelpersPath, 'utf8');

  assert.match(helpersSource, /export \* from '\.\/insights-executive-helpers';/);
  assert.match(helpersSource, /export \* from '\.\/insights-revenue-helpers';/);
  assert.match(helpersSource, /export \* from '\.\/insights-funnel-helpers';/);
  assert.match(helpersSource, /export \* from '\.\/insights-series-helpers';/);
  assert.match(executiveSource, /export function buildExecutiveMetrics/);
  assert.match(executiveSource, /export function buildPrioritySignals/);
  assert.match(executiveSource, /export function buildQuickInsights/);
  assert.match(revenueSource, /export function buildRevenueBoardRows/);
  assert.match(revenueSource, /export function buildMonthlyRows/);
  assert.match(revenueSource, /export function buildPulseCards/);
  assert.match(funnelSource, /export function buildBehaviorStats/);
  assert.match(funnelSource, /export function buildFunnelSteps/);
  assert.match(seriesSource, /export function buildFocusMetricData/);
  assert.match(seriesSource, /export function buildChartTicks/);
  assert.ok(helpersSource.split('\n').length < 80, 'insights-helpers should stay as a small public aggregator');
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
  const controlsSource = readFileSync(controlsPanelsPath, 'utf8');
  const healthSource = readFileSync(healthPanelPath, 'utf8');
  const summarySource = readFileSync(summaryPanelsPath, 'utf8');
  const tableSource = readFileSync(tablePanelsPath, 'utf8');

  assert.ok(statSync(panelsPath).size > 0);
  assert.match(panelsSource, /export \* from '\.\/InsightsControlsPanels';/);
  assert.match(panelsSource, /export \* from '\.\/InsightsHealthPanel';/);
  assert.match(panelsSource, /export \* from '\.\/InsightsSummaryPanels';/);
  assert.match(panelsSource, /export \* from '\.\/InsightsTablePanels';/);
  assert.match(controlsSource, /export function InsightsControls/);
  assert.match(controlsSource, /export function MetricFocusTabs/);
  assert.match(healthSource, /export function HealthPanel/);
  assert.match(summarySource, /export function PrioritySignalPanel/);
  assert.match(summarySource, /export function SummaryCell/);
  assert.match(tableSource, /export function RevenueBoardTable/);
  assert.match(tableSource, /export function DailyLedgerTable/);
  assert.match(tableSource, /from '\.\.\/_lib\/insights-formatters';/);
  assert.match(controlsSource, /from '\.\.\/_lib\/insights-navigation';/);
  assert.match(tableSource, /from '\.\/InsightsChartSurfaces';/);
  assert.ok(panelsSource.split('\n').length < 80, 'InsightsPanels should stay as a small public aggregator');
  assert.doesNotMatch(panelsSource, /buildChartTicks/);
  assert.doesNotMatch(panelsSource, /export function ComparisonChart/);
});

test('admin insights chart surfaces own chart primitives', () => {
  const chartSurfacesSource = readFileSync(chartSurfacesPath, 'utf8');

  assert.match(chartSurfacesSource, /export function ComparisonChart/);
  assert.match(chartSurfacesSource, /export function ShareBar/);
  assert.match(chartSurfacesSource, /export function EmptyStateCard/);
  assert.match(chartSurfacesSource, /from '\.\.\/_lib\/insights-series-helpers';/);
  assert.match(chartSurfacesSource, /buildChartTicks/);
});
