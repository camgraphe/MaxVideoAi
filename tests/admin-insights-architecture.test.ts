import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const pagePath = 'frontend/app/(core)/admin/insights/page.tsx';
const helpersPath = 'frontend/app/(core)/admin/insights/_lib/insights-helpers.ts';
const typesPath = 'frontend/app/(core)/admin/insights/_lib/insights-types.ts';
const panelsPath = 'frontend/app/(core)/admin/insights/_components/InsightsPanels.tsx';

test('admin insights page stays a route orchestrator', () => {
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(helpersPath), true);
  assert.equal(existsSync(typesPath), true);
  assert.equal(existsSync(panelsPath), true);

  const pageSource = readFileSync(pagePath, 'utf8');
  const pageLines = pageSource.split('\n').length;

  assert.ok(pageLines < 260, `expected admin insights page to stay under 260 lines, got ${pageLines}`);
  assert.match(pageSource, /from '\.\/_lib\/insights-types';/);
  assert.match(pageSource, /from '\.\/_lib\/insights-helpers';/);
  assert.match(pageSource, /from '\.\/_components\/InsightsPanels';/);
  assert.match(pageSource, /fetchAdminMetrics\(/);
  assert.match(pageSource, /fetchAdminMetricsComparison\(/);
  assert.match(pageSource, /requireAdmin\(\)/);

  assert.doesNotMatch(pageSource, /function buildExecutiveMetrics/);
  assert.doesNotMatch(pageSource, /function buildFocusMetricData/);
  assert.doesNotMatch(pageSource, /function ComparisonChart/);
  assert.doesNotMatch(pageSource, /new Intl\./);
});

test('admin insights helpers own data shaping and formatting', () => {
  const helpersSource = readFileSync(helpersPath, 'utf8');

  assert.match(helpersSource, /export function buildExecutiveMetrics/);
  assert.match(helpersSource, /export function buildFocusMetricData/);
  assert.match(helpersSource, /export function buildRevenueBoardRows/);
  assert.match(helpersSource, /export function buildMonthlyRows/);
  assert.match(helpersSource, /export function describeRange/);
  assert.match(helpersSource, /const currencyFormatter = new Intl\.NumberFormat/);
});

test('admin insights panels own route-local JSX surfaces', () => {
  const panelsSource = readFileSync(panelsPath, 'utf8');

  assert.ok(statSync(panelsPath).size > 0);
  assert.match(panelsSource, /export function ComparisonChart/);
  assert.match(panelsSource, /export function RevenueBoardTable/);
  assert.match(panelsSource, /export function HealthPanel/);
  assert.match(panelsSource, /export function InsightsControls/);
  assert.match(panelsSource, /export function DailyLedgerTable/);
});
