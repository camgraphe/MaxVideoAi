import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const metricsPath = join(root, 'frontend/server/admin-metrics.ts');
const metricsDir = join(root, 'frontend/server/admin-metrics');
const helpersPath = join(root, 'frontend/server/admin-metrics/admin-metrics-helpers.ts');
const mainPath = join(metricsDir, 'admin-metrics-main.ts');
const comparisonPath = join(metricsDir, 'admin-metrics-comparison.ts');
const healthPath = join(metricsDir, 'admin-health.ts');
const engineUsagePath = join(metricsDir, 'admin-metrics-engine-usage.ts');
const shapingPath = join(metricsDir, 'admin-metrics-shaping.ts');
const focusedModules = [
  'admin-health.ts',
  'admin-metrics-comparison.ts',
  'admin-metrics-engine-usage.ts',
  'admin-metrics-helpers.ts',
  'admin-metrics-main.ts',
  'admin-metrics-shaping.ts',
];

const metricsSource = readFileSync(metricsPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const mainSource = readFileSync(mainPath, 'utf8');
const comparisonSource = readFileSync(comparisonPath, 'utf8');
const healthSource = readFileSync(healthPath, 'utf8');
const engineUsageSource = readFileSync(engineUsagePath, 'utf8');
const shapingSource = readFileSync(shapingPath, 'utf8');

test('admin metrics public module delegates to focused server modules', () => {
  assert.ok(existsSync(helpersPath), 'admin metrics helpers should live in a focused server module');
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-metrics-main'/);
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-metrics-comparison'/);
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-health'/);
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-metrics-engine-usage'/);
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-metrics-helpers'/);

  const lineCount = metricsSource.split('\n').length;
  assert.ok(lineCount <= 40, `admin-metrics.ts should stay a thin facade, got ${lineCount} lines`);
});

test('admin metrics modules stay focused and under the large-file threshold', () => {
  for (const moduleName of focusedModules) {
    const modulePath = join(metricsDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under admin-metrics`);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 500, `${moduleName} should stay below 500 lines, got ${lineCount}`);
  }
});

test('admin metrics facade does not regain query or helper ownership', () => {
  for (const pattern of [
    /type CountRow =/,
    /type AmountRow =/,
    /function unresolvedFailedCondition\(/,
    /function refundedFailedCondition\(/,
    /function completedCondition\(/,
    /function normalizeMetricsRange\(/,
    /function buildRange\(/,
    /function coerceNumber\(/,
    /async function safeQuery\(/,
    /function mapCountRows\(/,
    /function mapAmountRows\(/,
    /function fillDailySeries\(/,
    /function fillAmountSeries\(/,
    /function buildEmptyMetrics\(/,
    /function mapEngineUsage\(/,
    /safeQuery</,
    /SELECT\s+/,
    /WITH\s+/,
  ]) {
    assert.doesNotMatch(metricsSource, pattern);
  }
});

test('admin metrics helper module exposes the expected contract', () => {
  for (const exportName of [
    'AdminMetricsOptions',
    'CountRow',
    'AmountRow',
    'EngineAggRow',
    'FailedEngineRow',
    'HEALTH_WINDOW_HOURS',
    'PENDING_STALE_MINUTES',
    'ENGINE_USAGE_WINDOW_DAYS',
    'METRIC_RANGE_OPTIONS',
    'DEFAULT_METRIC_RANGE',
    'unresolvedFailedCondition',
    'refundedFailedCondition',
    'completedCondition',
    'normalizeMetricsRange',
    'resolveRange',
    'buildRange',
    'toISO',
    'coerceNumber',
    'safeQuery',
    'mapCountRows',
    'mapAmountRows',
    'fillDailySeries',
    'fillAmountSeries',
    'buildEmptyMetrics',
    'mapEngineUsage',
  ]) {
    assert.match(helpersSource, new RegExp(`export (type |const |function |async function )${exportName}`));
  }
});

test('admin metrics focused modules expose the expected route contracts', () => {
  assert.match(mainSource, /export async function fetchAdminMetrics/);
  assert.match(comparisonSource, /export async function fetchAdminMetricsComparison/);
  assert.match(healthSource, /export async function fetchAdminHealth/);
  assert.match(engineUsageSource, /export async function fetchEngineUsageMetrics/);
  assert.match(engineUsageSource, /export async function loadEngineUsageRows/);
  assert.match(shapingSource, /export function buildFunnelMetrics/);
  assert.match(shapingSource, /export function buildBehaviorMetrics/);
  assert.match(shapingSource, /export function buildHealthMetrics/);
});
