import type { MetricsRangeLabel } from '@/lib/admin/types';
import type { ChartGranularity, FocusMetric } from './insights-types';

export const FOCUS_OPTIONS: Array<{ key: FocusMetric; label: string }> = [
  { key: 'signups', label: 'Signups' },
  { key: 'active', label: 'Active' },
  { key: 'topups', label: 'Top-ups' },
  { key: 'charges', label: 'Gross charges' },
];

export function resolveFocusParam(value: string | string[] | undefined): FocusMetric {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved === 'active' || resolved === 'topups' || resolved === 'charges') {
    return resolved;
  }
  return 'signups';
}

function lastValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[value.length - 1] : value;
}

export function resolveCustomDays(value: string | string[] | undefined): number {
  const candidate = lastValue(value);
  if (!candidate || !/^\d{1,2}$/.test(candidate)) return 30;
  const days = Number(candidate);
  return days >= 2 && days <= 90 ? days : 30;
}

export function resolveGranularity(value: string | string[] | undefined): ChartGranularity {
  return lastValue(value) === 'weekly' ? 'weekly' : 'daily';
}

export function resolveComparison(value: string | string[] | undefined): boolean {
  return lastValue(value) !== '0';
}

export function buildInsightsHref({
  range,
  excludeAdmin,
  focus,
  days,
  grain = 'daily',
  compare = true,
}: {
  range: MetricsRangeLabel;
  excludeAdmin: boolean;
  focus: FocusMetric;
  days?: number;
  grain?: ChartGranularity;
  compare?: boolean;
}) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
  params.set('focus', focus);
  if (range === 'custom') params.set('days', String(days ?? 30));
  if (grain !== 'daily') params.set('grain', grain);
  if (!compare) params.set('compare', '0');
  return `/admin/insights?${params.toString()}`;
}

export function describeRange(label: MetricsRangeLabel, days?: number) {
  switch (label) {
    case '24h':
      return '24 hours';
    case '7d':
      return '7 days';
    case '90d':
      return '90 days';
    case 'custom':
      return `${days ?? 30} days`;
    default:
      return '30 days';
  }
}
