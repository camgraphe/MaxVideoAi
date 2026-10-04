import type { ChartGranularity, ChartPoint } from './insights-types';

export function aggregateChartPoints(points: ChartPoint[], granularity: ChartGranularity): ChartPoint[] {
  if (granularity === 'daily') return points;

  const buckets: ChartPoint[] = [];
  const firstBucketDays = points.length % 7 || 7;
  for (let index = 0; index < points.length;) {
    const bucketDays = index === 0 ? firstBucketDays : 7;
    const group = points.slice(index, index + bucketDays);
    index += bucketDays;
    const first = group[0];
    const last = group[group.length - 1];
    if (!first || !last) continue;
    buckets.push({
      date: last.date,
      label: first.label === last.label ? first.label : `${first.label}–${last.label}`,
      value: group.reduce((sum, point) => sum + point.value, 0),
      bucketDays: group.length,
    });
  }
  return buckets;
}

export function chartLabelIndices(length: number, maxLabels = 5): number[] {
  if (length <= 0) return [];
  const count = Math.min(length, Math.max(2, maxLabels));
  return Array.from(new Set(Array.from({ length: count }, (_, step) => Math.round((step * (length - 1)) / (count - 1)))));
}
