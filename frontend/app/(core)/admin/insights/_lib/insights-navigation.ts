import type { MetricsRangeLabel } from '@/lib/admin/types';
import type { FocusMetric } from './insights-types';

export const FOCUS_OPTIONS: Array<{ key: FocusMetric; label: string }> = [
  { key: 'signups', label: 'Signups' },
  { key: 'active', label: 'Active' },
  { key: 'topups', label: 'Top-ups' },
  { key: 'charges', label: 'Charges' },
];

export function resolveFocusParam(value: string | string[] | undefined): FocusMetric {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved === 'active' || resolved === 'topups' || resolved === 'charges') {
    return resolved;
  }
  return 'signups';
}

export function buildInsightsHref({
  range,
  excludeAdmin,
  focus,
}: {
  range: MetricsRangeLabel;
  excludeAdmin: boolean;
  focus: FocusMetric;
}) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
  params.set('focus', focus);
  return `/admin/insights?${params.toString()}`;
}

export function describeRange(label: MetricsRangeLabel) {
  switch (label) {
    case '24h':
      return '24 hours';
    case '7d':
      return '7 days';
    case '90d':
      return '90 days';
    default:
      return '30 days';
  }
}
