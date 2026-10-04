import type { FocusMetricData } from '../_lib/insights-types';
import { compareValues } from '../_lib/insights-series-helpers';
import { formatCurrency, formatDeltaLabel, formatNumber, resolveDeltaTone, toneValueClass } from '../_lib/insights-formatters';

export function InsightsTrendSummary({
  metric,
  humanRange,
  showComparison,
}: {
  metric: FocusMetricData;
  humanRange: string;
  showComparison: boolean;
}) {
  const current = metric.currentPoints.reduce((sum, point) => sum + point.value, 0);
  const previous = metric.previousPoints.reduce((sum, point) => sum + point.value, 0);
  const delta = compareValues(current, previous);
  const format = metric.valueKind === 'currency' ? formatCurrency : formatNumber;
  const average = metric.currentPoints.length ? current / metric.currentPoints.length : 0;
  const activeDays = metric.currentPoints.filter((point) => point.value > 0).length;
  const currentLabel = metric.key === 'signups' ? 'Signups' : metric.label;
  const items = showComparison
    ? [
        { label: currentLabel, value: format(current), detail: `Across ${humanRange}` },
        { label: 'Previous period', value: format(previous), detail: `Previous ${humanRange}` },
        { label: 'Change', value: formatDeltaLabel(delta), detail: 'Compared with previous period', tone: resolveDeltaTone(delta) },
      ]
    : [
        { label: currentLabel, value: format(current), detail: `Across ${humanRange}` },
        { label: 'Daily average', value: metric.valueKind === 'currency' ? formatCurrency(average) : average.toFixed(1), detail: 'Within the selected window' },
        { label: 'Active days', value: formatNumber(activeDays), detail: `Out of ${metric.currentPoints.length} days` },
      ];

  return (
    <dl className="grid border-y border-hairline sm:grid-cols-3">
      {items.map((item, index) => (
        <div key={item.label} className={`min-w-0 py-3 sm:px-5 ${index > 0 ? 'border-t border-hairline sm:border-l sm:border-t-0' : ''} ${index === 0 ? 'sm:pl-0' : ''}`}>
          <dt className="text-sm text-text-secondary">{item.label}</dt>
          <dd className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${toneValueClass(item.tone)}`}>{item.value}</dd>
          <p className="mt-1 text-xs text-text-muted">{item.detail}</p>
        </div>
      ))}
    </dl>
  );
}
