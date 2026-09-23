import type { CSSProperties, ReactNode } from 'react';
import { aggregateChartPoints } from '../_lib/insights-chart-model';
import { buildChartTicks } from '../_lib/insights-series-helpers';
import type { ChartGranularity, ChartPoint, ChartTheme } from '../_lib/insights-types';
import { InsightsLineChart } from './InsightsLineChart.client';

export function ComparisonChart({
  currentPoints,
  previousPoints,
  theme,
  ariaLabel = 'comparison chart',
  granularity = 'daily',
  showComparison = true,
  valueKind = 'count',
  tabs,
  currentDayKey,
}: {
  currentPoints: ChartPoint[];
  previousPoints: ChartPoint[];
  theme: ChartTheme;
  ariaLabel?: string;
  granularity?: ChartGranularity;
  showComparison?: boolean;
  valueKind?: 'count' | 'currency';
  tabs: ReactNode;
  currentDayKey: string;
}) {
  const current = aggregateChartPoints(currentPoints, granularity);
  const previous = aggregateChartPoints(previousPoints, granularity);
  const lastPointIsPartial = current.at(-1)?.date.slice(0, 10) === currentDayKey;
  const values = [...current.map((point) => point.value), ...(showComparison ? previous.map((point) => point.value) : [])];
  const ticks = buildChartTicks(Math.max(0, ...values));

  return (
    <InsightsLineChart
      ariaLabel={ariaLabel}
      currentPoints={current}
      previousPoints={previous}
      showComparison={showComparison}
      theme={theme}
      valueKind={valueKind}
      ticks={ticks}
      tabs={tabs}
      lastPointIsPartial={lastPointIsPartial}
    />
  );
}

export function ShareBar({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: string;
}) {
  const style: CSSProperties = {
    width: `${Math.min(100, Math.max(0, value * 100))}%`,
    backgroundColor: accent,
  };

  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-hairline">
        <div className="h-2.5 rounded-full" style={style} />
      </div>
      <span className="shrink-0 text-xs text-text-secondary">{label}</span>
    </div>
  );
}

export function EmptyStateCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-bg/40 px-4 py-5 text-sm text-text-secondary">
      {children}
    </div>
  );
}
