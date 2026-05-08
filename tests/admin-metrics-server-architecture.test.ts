import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const metricsPath = join(root, 'frontend/server/admin-metrics.ts');
const helpersPath = join(root, 'frontend/server/admin-metrics/admin-metrics-helpers.ts');

const metricsSource = readFileSync(metricsPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');

test('admin metrics delegates shared row helpers and range logic', () => {
  assert.ok(existsSync(helpersPath), 'admin metrics helpers should live in a focused server module');
  assert.match(metricsSource, /from '@\/server\/admin-metrics\/admin-metrics-helpers'/);
  assert.match(metricsSource, /fetchAdminMetrics\(/);
  assert.match(metricsSource, /fetchAdminMetricsComparison\(/);
  assert.match(metricsSource, /fetchAdminHealth\(/);
});

test('admin metrics fetcher does not regain shared helper ownership', () => {
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
  ]) {
    assert.doesNotMatch(metricsSource, pattern);
  }

  const lineCount = metricsSource.split('\n').length;
  assert.ok(lineCount <= 820, `admin-metrics.ts should stay below 820 lines after helper extraction, got ${lineCount}`);
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
