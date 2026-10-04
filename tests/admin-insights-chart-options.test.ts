import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRange } from '../frontend/server/admin-metrics/admin-metrics-helpers';
import { aggregateChartPoints, chartLabelIndices } from '../frontend/app/(core)/admin/insights/_lib/insights-chart-model';
import { buildInsightsHref, resolveComparison, resolveCustomDays, resolveGranularity } from '../frontend/app/(core)/admin/insights/_lib/insights-navigation';
import type { ChartPoint } from '../frontend/app/(core)/admin/insights/_lib/insights-types';

test('custom insights periods remain bounded before they reach metric queries', () => {
  assert.equal(resolveCustomDays('45'), 45);
  for (const value of ['1', '91', '45.5', '45days', '-7', '999999']) {
    assert.equal(resolveCustomDays(value), 30, value);
  }
  assert.equal(resolveRange('custom', 45).days, 45);
  assert.equal(resolveRange('custom', 999).days, 30);
  assert.equal(resolveRange('7d', 45).days, 7);
});

test('7-day totals preserve counts and alignment including a partial final bucket', () => {
  const points: ChartPoint[] = Array.from({ length: 16 }, (_, index) => ({
    date: `2026-09-${String(index + 1).padStart(2, '0')}`,
    label: `Sep ${index + 1}`,
    value: index + 1,
  }));
  const groups = aggregateChartPoints(points, 'weekly');
  assert.deepEqual(groups.map((point) => point.value), [3, 42, 91]);
  assert.deepEqual(groups.map((point) => point.date), [points[1].date, points[8].date, points[15].date]);
  assert.deepEqual(groups.map((point) => point.bucketDays), [2, 7, 7]);
  assert.equal(groups.reduce((sum, point) => sum + point.value, 0), points.reduce((sum, point) => sum + point.value, 0));
  assert.equal(aggregateChartPoints(points, 'daily'), points);
  assert.deepEqual(chartLabelIndices(30), [0, 7, 15, 22, 29]);
  assert.deepEqual(chartLabelIndices(30, 3), [0, 15, 29]);
});

test('chart choices survive metric and period navigation', () => {
  const href = buildInsightsHref({
    range: 'custom', days: 45, excludeAdmin: true, focus: 'charges', grain: 'weekly', compare: false,
  });
  const params = new URL(href, 'https://maxvideoai.com').searchParams;
  assert.equal(params.get('days'), '45');
  assert.equal(params.get('grain'), 'weekly');
  assert.equal(params.get('compare'), '0');
  assert.equal(resolveGranularity(params.get('grain') ?? undefined), 'weekly');
  assert.equal(resolveComparison(params.get('compare') ?? undefined), false);
  assert.equal(params.get('focus'), 'charges');
  assert.equal(params.get('excludeAdmin'), '1');
});
