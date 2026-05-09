import Link from 'next/link';
import type { MetricsRangeLabel } from '@/lib/admin/types';
import { METRIC_RANGE_OPTIONS } from '@/server/admin-metrics';
import type { FocusMetric } from '../_lib/insights-types';
import { buildInsightsHref, FOCUS_OPTIONS } from '../_lib/insights-navigation';

export function InsightsControls({
  current,
  excludeAdmin,
  focus,
}: {
  current: MetricsRangeLabel;
  excludeAdmin: boolean;
  focus: FocusMetric;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-border bg-surface p-1 shadow-card">
        {METRIC_RANGE_OPTIONS.map((option) => {
          const isActive = option === current;
          return (
            <Link
              key={option}
              href={buildInsightsHref({ range: option, excludeAdmin, focus })}
              className={[
                'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                isActive ? 'bg-brand text-on-brand' : 'text-text-secondary hover:bg-bg hover:text-text-primary',
              ].join(' ')}
            >
              {option}
            </Link>
          );
        })}
      </div>
      <Link
        href={buildInsightsHref({ range: current, excludeAdmin: !excludeAdmin, focus })}
        className={[
          'inline-flex rounded-xl border px-3 py-2 text-sm font-medium transition',
          excludeAdmin
            ? 'border-success-border bg-success-bg text-success hover:bg-success-bg/80'
            : 'border-border bg-surface text-text-secondary hover:bg-bg hover:text-text-primary',
        ].join(' ')}
      >
        {excludeAdmin ? 'Admin excluded' : 'Include admin'}
      </Link>
    </div>
  );
}

export function MetricFocusTabs({
  current,
  range,
  excludeAdmin,
}: {
  current: FocusMetric;
  range: MetricsRangeLabel;
  excludeAdmin: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1">
      {FOCUS_OPTIONS.map((option) => {
        const isActive = option.key === current;
        return (
          <Link
            key={option.key}
            href={buildInsightsHref({ range, excludeAdmin, focus: option.key })}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              isActive ? 'bg-bg text-text-primary shadow-card' : 'text-text-secondary hover:bg-bg hover:text-text-primary',
            ].join(' ')}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
