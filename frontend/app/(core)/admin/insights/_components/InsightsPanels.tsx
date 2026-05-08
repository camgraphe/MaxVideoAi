import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { AdminMetrics, MetricsRangeLabel } from '@/lib/admin/types';
import { METRIC_RANGE_OPTIONS } from '@/server/admin-metrics';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import type {
  ChartPoint,
  ChartTheme,
  FocusMetric,
  FunnelStep,
  LedgerRow,
  PrioritySignal,
  PulseCard,
  RevenueBoardRow,
  SmallStat,
} from '../_lib/insights-types';
import {
  buildChartTicks,
} from '../_lib/insights-helpers';
import {
  formatCompactNumber,
  formatCurrency,
  formatDay,
  formatFullDate,
  formatMonth,
  formatNumber,
  formatPercent,
  toneBadgeClass,
  toneValueClass,
} from '../_lib/insights-formatters';
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

export function PrioritySignalPanel({
  signals,
  humanRange,
}: {
  signals: PrioritySignal[];
  humanRange: string;
}) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Priority queue</p>
        <p className="mt-1 text-sm text-text-secondary">What needs attention in the current {humanRange} before drilling into users, jobs or billing.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
        <div className="divide-y divide-hairline">
          {signals.map((signal) => (
            <Link key={signal.label} href={signal.href} className="flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-bg">
              <div>
                <p className="text-sm font-medium text-text-primary">{signal.label}</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{signal.helper}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${toneValueClass(signal.tone)}`}>{signal.value}</p>
                <p className="mt-1 text-[11px] text-text-muted">Open</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WindowPulseGrid({
  cards,
  humanRange,
  className = '',
}: {
  cards: PulseCard[];
  humanRange: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-hairline bg-bg/40 ${className}`}>
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Window pulse</p>
        <p className="mt-1 text-sm text-text-secondary">Current {humanRange} compared to the previous {humanRange}.</p>
      </div>
      <div className="grid gap-px bg-hairline sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-surface px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{card.label}</p>
                <p className="mt-1 text-xs text-text-secondary">Previous {card.previousValue}</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${toneBadgeClass(card.tone)}`}>{card.delta}</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-text-primary">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricSnapshotPanel({
  title,
  items,
}: {
  title: string;
  items: SmallStat[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">Current window, previous window and the most useful reading cues for the selected metric.</p>
      </div>
      <div className="divide-y divide-hairline">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
              </div>
              <p className={`text-sm font-semibold ${toneValueClass(item.tone)}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NarrativePanel({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">Short narrative cues extracted from the current window to reduce scanning time.</p>
      </div>
      <ul className="space-y-3 px-4 py-4 text-sm text-text-secondary">
        {lines.map((line, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatStrip({ items, className = '' }: { items: SmallStat[]; className?: string }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{item.label}</p>
          <p className={`mt-1 text-sm font-semibold ${toneValueClass(item.tone)}`}>{item.value}</p>
          {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function RevenueBoardTable({ rows }: { rows: RevenueBoardRow[] }) {
  const columns: AdminStatColumn<RevenueBoardRow>[] = [
    {
      key: 'metric',
      header: 'Metric',
      render: (row) => (
        <>
          <p className="font-medium text-text-primary">{row.label}</p>
          <p className="mt-1 text-xs text-text-secondary">{row.helper}</p>
        </>
      ),
    },
    {
      key: 'current',
      header: 'Current',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => row.current,
    },
    {
      key: 'previous',
      header: 'Previous',
      cellClassName: 'text-text-secondary',
      render: (row) => row.previous,
    },
    {
      key: 'delta',
      header: 'Delta',
      cellClassName: (row) => `font-medium ${toneValueClass(row.tone)}`,
      render: (row) => row.delta,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Revenue board</p>
        <p className="mt-1 text-sm text-text-secondary">Current window vs previous window, organized like a decision table rather than four isolated cards.</p>
      </div>
      <AdminStatTable
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.label}
        empty={null}
        className="rounded-none border-0"
        tableClassName="min-w-[620px]"
        headerClassName="bg-surface"
        bodyClassName="divide-y divide-hairline"
      />
    </div>
  );
}

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

export function FunnelRows({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) {
    return <EmptyStateCard>No funnel data available yet.</EmptyStateCard>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Funnel</p>
        <p className="mt-1 text-sm text-text-secondary">Lecture en lignes compactes, plus proche d’un admin que d’un composant marketing.</p>
      </div>
      <div className="divide-y divide-hairline">
        {steps.map((step, index) => (
          <div key={step.label} className="grid gap-4 px-4 py-4 lg:grid-cols-[200px_minmax(0,1fr)_132px] lg:items-center">
            <div>
              <p className="text-sm font-medium text-text-primary">{step.label}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">{step.helper}</p>
            </div>
            <div>
              <ShareBar value={step.shareOfStart} label={formatPercent(step.shareOfStart)} accent={step.accent} />
              <p className="mt-2 text-xs text-text-secondary">
                {step.conversionFromPrevious == null ? 'Baseline stage' : `${formatPercent(step.conversionFromPrevious)} from previous stage`}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-lg font-semibold text-text-primary">{formatNumber(step.value)}</p>
              <p className="mt-1 text-xs text-text-secondary">Stage {index + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BehaviorGrid({ stats }: { stats: SmallStat[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{stat.label}</p>
          <p className={`mt-2 text-base font-semibold ${toneValueClass(stat.tone)}`}>{stat.value}</p>
          {stat.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{stat.helper}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function TopSpendersTable({ whales }: { whales: AdminMetrics['behavior']['whalesTop10'] }) {
  if (!whales.length) {
    return <EmptyStateCard>No paying users yet.</EmptyStateCard>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Top spenders</p>
        <p className="mt-1 text-sm text-text-secondary">Entrées directement actionnables vers les fiches user admin.</p>
      </div>
      <div className="divide-y divide-hairline">
        {whales.map((whale) => (
          <Link
            key={whale.userId}
            href={`/admin/users/${whale.userId}`}
            className="grid gap-3 px-4 py-4 transition hover:bg-bg lg:grid-cols-[minmax(0,1fr)_110px_80px]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{whale.identifier}</p>
              <p className="mt-1 text-xs text-text-secondary">
                Last active {formatFullDate(whale.lastActiveAt)} · First seen {formatFullDate(whale.firstSeenAt)}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(whale.lifetimeTopupUsd)}</p>
              <p className="mt-1 text-[11px] text-text-muted">top-ups</p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-sm font-semibold text-text-primary">{formatNumber(whale.renderCount)}</p>
              <p className="mt-1 text-[11px] text-text-muted">renders</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function EngineMixTable({ engines }: { engines: AdminMetrics['engines'] }) {
  if (!engines.length) {
    return <EmptyStateCard>No engine activity recorded in the last 30 days.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<AdminMetrics['engines'][number]>[] = [
    {
      key: 'engine',
      header: 'Engine',
      render: (engine) => (
        <>
          <p className="font-medium text-text-primary">{engine.engineLabel}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {formatCurrency(engine.avgSpendPerUser30d, { precise: true })} avg / user
          </p>
        </>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      cellClassName: 'font-medium text-text-primary',
      render: (engine) => formatCurrency(engine.rendersAmount30dUsd),
    },
    {
      key: 'renders',
      header: 'Renders',
      cellClassName: 'text-text-secondary',
      render: (engine) => formatNumber(engine.rendersCount30d),
    },
    {
      key: 'users',
      header: 'Users',
      cellClassName: 'text-text-secondary',
      render: (engine) => formatNumber(engine.distinctUsers30d),
    },
    {
      key: 'renderShare',
      header: 'Render share',
      render: (engine) => (
        <ShareBar value={engine.shareOfTotalRenders30d} label={formatPercent(engine.shareOfTotalRenders30d)} accent="#0F766E" />
      ),
    },
    {
      key: 'revenueShare',
      header: 'Revenue share',
      render: (engine) => (
        <ShareBar value={engine.shareOfTotalRevenue30d} label={formatPercent(engine.shareOfTotalRevenue30d)} accent="#2563EB" />
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Engine mix</p>
        <p className="mt-1 text-sm text-text-secondary">Table-first reading of revenue, render share and distinct usage.</p>
      </div>
      <AdminStatTable columns={columns} rows={engines} getRowKey={(engine) => engine.engineId} empty={null} className="rounded-none border-0" tableClassName="min-w-[760px]" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
  );
}

export function HealthPanel({
  failedRenders,
  failureRate,
  flaggedRows,
  metrics,
}: {
  failedRenders: number;
  failureRate: number;
  flaggedRows: AdminMetrics['health']['failedByEngine30d'];
  metrics: AdminMetrics;
}) {
  const topEngine = metrics.engines[0];
  const activationGap = Math.max(0, metrics.funnels.totalTopupUsers - metrics.funnels.convertedWithin30dUsers);
  const riskSignals: PrioritySignal[] = [
    {
      label: 'Open failure backlog',
      value: failedRenders ? formatNumber(failedRenders) : 'Clear',
      helper: failedRenders
        ? `${formatNumber(flaggedRows.length)} engine${flaggedRows.length > 1 ? 's' : ''} still show unresolved failures.`
        : 'No unresolved failure recorded in the last 30 days.',
      href: '/admin/jobs',
      tone: failedRenders ? 'warning' : 'success',
    },
    {
      label: 'Activation leak',
      value: formatNumber(activationGap),
      helper: activationGap
        ? 'Wallet users who still have not reached a first completed render within 30 days.'
        : 'All wallet users in this window reached a first render within 30 days.',
      href: '/admin/users',
      tone: activationGap ? 'warning' : 'success',
    },
    {
      label: 'Engine concentration',
      value: topEngine ? formatPercent(topEngine.shareOfTotalRevenue30d) : '—',
      helper: topEngine
        ? `${topEngine.engineLabel} currently carries the largest share of 30-day charge volume.`
        : 'No engine demand recorded in this range.',
      href: '/admin/engines',
      tone: topEngine && topEngine.shareOfTotalRevenue30d > 0.55 ? 'warning' : 'default',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-3">
        <SummaryCell label="Failed renders" value={formatNumber(failedRenders)} helper="Unresolved failures" tone={failedRenders ? 'warning' : 'success'} />
        <SummaryCell label="Failure rate" value={formatPercent(failureRate)} helper="Failed / completed" tone={failureRate ? 'warning' : 'success'} />
        <SummaryCell
          label="Engines impacted"
          value={formatNumber(flaggedRows.length)}
          helper="At least one unresolved failure"
          tone={flaggedRows.length ? 'warning' : 'success'}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
        <div className="border-b border-hairline px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Risk desk</p>
          <p className="mt-1 text-sm text-text-secondary">Fast operator read of what could distort conversion, revenue quality or reliability next.</p>
        </div>
        <div className="divide-y divide-hairline">
          {riskSignals.map((signal) => (
            <Link key={signal.label} href={signal.href} className="flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-bg">
              <div>
                <p className="text-sm font-medium text-text-primary">{signal.label}</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{signal.helper}</p>
              </div>
              <p className={`shrink-0 text-sm font-semibold ${toneValueClass(signal.tone)}`}>{signal.value}</p>
            </Link>
          ))}
        </div>
      </div>

      {flaggedRows.length ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
          <div className="border-b border-hairline px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Open incidents</p>
            <p className="mt-1 text-sm text-text-secondary">Seuls les moteurs avec un vrai signal restent visibles.</p>
          </div>
          <div className="divide-y divide-hairline">
            {flaggedRows.map((row) => (
              <div key={row.engineId} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{row.engineLabel}</p>
                    <p className="mt-1 text-xs text-text-secondary">Unresolved failures still need follow-up on jobs or billing.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-error">{formatPercent(row.failureRate30d)}</p>
                    <p className="mt-1 text-[11px] text-text-muted">{formatNumber(row.failedCount30d)} failed renders</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyStateCard>No unresolved failures recorded in the past 30 days.</EmptyStateCard>
      )}
    </div>
  );
}

export function SummaryCell({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: SmallStat['tone'];
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneValueClass(tone)}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
    </div>
  );
}

export function DailyLedgerTable({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) {
    return <EmptyStateCard>No recent daily entries.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<LedgerRow>[] = [
    {
      key: 'date',
      header: 'Date',
      cellClassName: 'text-text-secondary',
      render: (row) => formatDay(row.date),
    },
    {
      key: 'signups',
      header: 'Signups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.signups),
    },
    {
      key: 'active',
      header: 'Active',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.active),
    },
    {
      key: 'topups',
      header: 'Top-ups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.topupsUsd),
    },
    {
      key: 'charges',
      header: 'Charges',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.chargesUsd),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Latest 7 days</p>
        <p className="mt-1 text-sm text-text-secondary">Lecture condensée des dernières journées utiles, sans séparer croissance et revenu dans deux cartes différentes.</p>
      </div>
      <AdminStatTable columns={columns} rows={rows} getRowKey={(row) => row.date} empty={null} className="rounded-none border-0" tableClassName="min-w-[640px]" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
  );
}

export function MonthlyRollupTable({
  rows,
}: {
  rows: Array<{ month: string; signups: number; topupsUsd: number; chargesUsd: number }>;
}) {
  if (!rows.length) {
    return <EmptyStateCard>No monthly aggregates yet.</EmptyStateCard>;
  }

  const columns: AdminStatColumn<(typeof rows)[number]>[] = [
    {
      key: 'month',
      header: 'Month',
      cellClassName: 'text-text-secondary',
      render: (row) => formatMonth(row.month),
    },
    {
      key: 'signups',
      header: 'Signups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatNumber(row.signups),
    },
    {
      key: 'topups',
      header: 'Top-ups',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.topupsUsd),
    },
    {
      key: 'charges',
      header: 'Charges',
      cellClassName: 'font-medium text-text-primary',
      render: (row) => formatCurrency(row.chargesUsd),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Monthly rollup</p>
        <p className="mt-1 text-sm text-text-secondary">Six derniers mois, gardés séparés des lignes journalières.</p>
      </div>
      <AdminStatTable columns={columns} rows={rows} getRowKey={(row) => row.month} empty={null} className="rounded-none border-0" headerClassName="bg-surface" bodyClassName="divide-y divide-hairline" />
    </div>
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
