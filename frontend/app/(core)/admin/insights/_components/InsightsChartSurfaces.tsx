import type { CSSProperties, ReactNode } from 'react';
import { buildChartTicks } from '../_lib/insights-helpers';
import type { ChartPoint, ChartTheme } from '../_lib/insights-types';
import { formatCompactNumber } from '../_lib/insights-formatters';

export function ComparisonChart({
  currentPoints,
  previousPoints,
  theme,
  ariaLabel = 'comparison chart',
  axisFormatter = formatCompactNumber,
  tooltipFormatter = formatCompactNumber,
}: {
  currentPoints: ChartPoint[];
  previousPoints: ChartPoint[];
  theme: ChartTheme;
  ariaLabel?: string;
  axisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
}) {
  const values = [...currentPoints.map((point) => point.value), ...previousPoints.map((point) => point.value)];

  if (!values.length || values.every((value) => value <= 0)) {
    return <EmptyStateCard>No data available for this range.</EmptyStateCard>;
  }

  const width = 820;
  const height = 268;
  const padding = { top: 18, right: 16, bottom: 34, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values);
  const ticks = buildChartTicks(maxValue);
  const maxTick = ticks[ticks.length - 1] || 1;
  const totalPoints = Math.max(currentPoints.length, previousPoints.length);
  const step = chartWidth / Math.max(1, totalPoints);
  const barWidth = Math.max(6, step * 0.56);
  const labelEvery = Math.max(1, Math.ceil(totalPoints / 7));

  const previousLinePoints = Array.from({ length: totalPoints }, (_, index) => {
    const value = previousPoints[index]?.value ?? 0;
    return {
      x: padding.left + step * index + step / 2,
      y: padding.top + chartHeight - (value / maxTick) * chartHeight,
    };
  });

  const previousPath = previousLinePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-64 w-full">
      {ticks.map((tick) => {
        const y = padding.top + chartHeight - (tick / maxTick) * chartHeight;
        return (
          <g key={`tick-${tick}`}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="var(--hairline)" />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">
              {axisFormatter(tick)}
            </text>
          </g>
        );
      })}

      <line
        x1={padding.left}
        x2={width - padding.right}
        y1={padding.top + chartHeight}
        y2={padding.top + chartHeight}
        stroke="var(--border)"
      />

      {previousLinePoints.length > 1 ? (
        <path d={previousPath} fill="none" stroke={theme.line} strokeWidth="2" strokeDasharray="5 5" />
      ) : null}

      {previousLinePoints.map((point, index) => (
        <circle key={`previous-${index}`} cx={point.x} cy={point.y} r="2.5" fill={theme.line} />
      ))}

      {currentPoints.map((point, index) => {
        const xCenter = padding.left + step * index + step / 2;
        const barHeight = (point.value / maxTick) * chartHeight;
        const x = xCenter - barWidth / 2;
        const y = padding.top + chartHeight - barHeight;
        const previousValue = previousPoints[index]?.value ?? 0;
        const showLabel = index === 0 || index === currentPoints.length - 1 || index % labelEvery === 0;

        return (
          <g key={`${point.label}-${index}`}>
            <title>{`${point.label} | Current: ${tooltipFormatter(point.value)} | Previous: ${tooltipFormatter(previousValue)}`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} rx={4} fill={theme.bar} />
            {showLabel ? (
              <text x={xCenter} y={height - 12} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
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
