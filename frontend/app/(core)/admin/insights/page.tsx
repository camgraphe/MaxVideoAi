import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminMetricsComparison, METRIC_RANGE_OPTIONS } from '@/server/admin-metrics';
import type {
  AdminMetrics,
  AdminMetricsComparison,
  AmountSeriesPoint,
  MetricsRangeLabel,
  TimeSeriesPoint,
} from '@/lib/admin/types';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import { requireAdmin } from '@/server/admin';

const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const preciseCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const numberFormatter = new Intl.NumberFormat('en-US');
const compactNumberFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 1 });

type FocusMetric = 'signups' | 'active' | 'topups' | 'charges';

type PageProps = {
  searchParams?: {
    range?: string;
    excludeAdmin?: string | string[];
    focus?: string | string[];
  };
};

type ChartPoint = {
  label: string;
  value: number;
};

type SmallStat = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning';
};

type PulseCard = {
  label: string;
  value: string;
  previousValue: string;
  delta: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning';
};

type DeltaSnapshot = {
  current: number;
  previous: number;
  absoluteChange: number;
  ratioChange: number | null;
};

type ChartTheme = {
  bar: string;
  line: string;
};

type FunnelStep = {
  label: string;
  value: number;
  helper: string;
  shareOfStart: number;
  conversionFromPrevious: number | null;
  accent: string;
};

type LedgerRow = {
  date: string;
  signups: number;
  active: number;
  topupsUsd: number;
  chargesUsd: number;
};

type FocusMetricData = {
  key: FocusMetric;
  label: string;
  description: string;
  theme: ChartTheme;
  currentPoints: ChartPoint[];
  previousPoints: ChartPoint[];
  stats: SmallStat[];
  axisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
};

const ADMIN_EXCLUDED_USER_IDS = ['301cc489-d689-477f-94c4-0b051deda0bc'];

const CHART_THEMES: Record<FocusMetric, ChartTheme> = {
  signups: {
    bar: '#2563EB',
    line: '#94A3B8',
  },
  active: {
    bar: '#0F766E',
    line: '#94A3B8',
  },
  topups: {
    bar: '#CA8A04',
    line: '#94A3B8',
  },
  charges: {
    bar: '#EA580C',
    line: '#94A3B8',
  },
};

const FOCUS_OPTIONS: Array<{ key: FocusMetric; label: string }> = [
  { key: 'signups', label: 'Signups' },
  { key: 'active', label: 'Active' },
  { key: 'topups', label: 'Top-ups' },
  { key: 'charges', label: 'Charges' },
];

export default async function AdminInsightsPage({ searchParams }: PageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/insights] access denied', error);
    notFound();
  }

  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const focus = resolveFocusParam(searchParams?.focus);
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  };

  const [metrics, comparison] = await Promise.all([
    fetchAdminMetrics(searchParams?.range, queryOptions),
    fetchAdminMetricsComparison(searchParams?.range, queryOptions),
  ]);

  const humanRange = describeRange(metrics.range.label);
  const overviewStats = buildOverviewStats(metrics);
  const pulseCards = buildPulseCards(metrics, comparison);
  const quickInsights = buildQuickInsights(metrics, comparison);
  const focusMetric = buildFocusMetricData(focus, metrics, comparison, humanRange);
  const behaviorStats = buildBehaviorStats(metrics);
  const funnelSteps = buildFunnelSteps(metrics);
  const dailyLedgerRows = buildRecentLedgerRows(metrics);
  const monthlyRows = buildMonthlyRows(metrics);
  const featuredEngines = metrics.engines.slice(0, 10);
  const flaggedHealthRows = metrics.health.failedByEngine30d
    .filter((row) => row.failedCount30d > 0 || row.failureRate30d > 0)
    .sort((a, b) => b.failedCount30d - a.failedCount30d || b.failureRate30d - a.failureRate30d);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Analytics"
        title="Workspace insights"
        description="Surface admin resserrée pour lire les tendances, comparer la fenêtre courante à la précédente et agir vite sur les signaux business ou ops."
        actions={<InsightsControls current={metrics.range.label} excludeAdmin={excludeAdmin} focus={focus} />}
      />

      <AdminSection
        title="Overview"
        description={`Base de lecture pour la fenêtre courante de ${humanRange}, sans empiler de cartes décoratives.`}
        contentClassName="p-0"
      >
        <div className="grid xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="grid gap-px bg-hairline sm:grid-cols-2 xl:grid-cols-3">
            {overviewStats.map((stat) => (
              <OverviewStatCell key={stat.label} stat={stat} />
            ))}
          </div>
          <div className="border-t border-hairline px-5 py-5 xl:border-l xl:border-t-0">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Window summary</p>
              <p className="mt-1 text-sm text-text-secondary">Lecture rapide des mouvements à retenir avant d’ouvrir les tables détaillées.</p>
            </div>
            <ul className="space-y-3 text-sm text-text-secondary">
              {quickInsights.map((line, index) => (
                <li key={`overview-note-${index}`} className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Trend Workspace"
        description="Un seul indicateur principal à la fois, avec un vrai overlay période courante vs précédente."
        action={<MetricFocusTabs current={focus} range={metrics.range.label} excludeAdmin={excludeAdmin} />}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_360px]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{focusMetric.label}</h2>
                <p className="mt-1 text-sm text-text-secondary">{focusMetric.description}</p>
              </div>
              <div className="text-xs font-medium text-text-secondary">Current bars, previous dashed line</div>
            </div>
            <StatStrip items={focusMetric.stats} className="mt-4" />
            <div className="mt-5 rounded-2xl border border-hairline bg-bg/60 p-4">
              <ComparisonChart
                ariaLabel={`${focusMetric.label} comparison`}
                theme={focusMetric.theme}
                axisFormatter={focusMetric.axisFormatter}
                tooltipFormatter={focusMetric.tooltipFormatter}
                currentPoints={focusMetric.currentPoints}
                previousPoints={focusMetric.previousPoints}
              />
            </div>
          </div>

          <div className="space-y-4 xl:border-l xl:border-hairline xl:pl-6">
            <WindowPulseTable cards={pulseCards} humanRange={humanRange} />
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Conversion & Customers"
        description="Du signup à la première valeur, puis lecture des comptes les plus engagés."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_380px]">
          <div className="space-y-5">
            <FunnelRows steps={funnelSteps} />
            <BehaviorGrid stats={behaviorStats} />
          </div>
          <TopSpendersTable whales={metrics.behavior.whalesTop10} />
        </div>
      </AdminSection>

      <AdminSection
        title="Engine Mix & Health"
        description="Répartition usage/revenu à gauche, incidents encore ouverts à droite."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <EngineMixTable engines={featuredEngines} />
          <HealthPanel
            failedRenders={metrics.health.failedRenders30d}
            failureRate={metrics.health.failedRendersRate30d}
            flaggedRows={flaggedHealthRows}
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Daily Ledger"
        description="Derniers jours et rollup mensuel gardés en lecture table-first, sans mélange de granularités."
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <DailyLedgerTable rows={dailyLedgerRows} />
          <MonthlyRollupTable rows={monthlyRows} />
        </div>
      </AdminSection>
    </div>
  );
}

function InsightsControls({
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

function MetricFocusTabs({
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

function OverviewStatCell({ stat }: { stat: SmallStat }) {
  const valueClass =
    stat.tone === 'warning'
      ? 'text-error'
      : stat.tone === 'success'
        ? 'text-success'
        : 'text-text-primary';

  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{stat.label}</p>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{stat.value}</p>
      {stat.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{stat.helper}</p> : null}
    </div>
  );
}

function WindowPulseTable({ cards, humanRange }: { cards: PulseCard[]; humanRange: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Window pulse</p>
        <p className="mt-1 text-sm text-text-secondary">Current {humanRange} compared to the previous {humanRange}.</p>
      </div>
      <div className="divide-y divide-hairline">
        {cards.map((card) => (
          <div key={card.label} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{card.label}</p>
                <p className="mt-1 text-xs text-text-secondary">Previous {card.previousValue}</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${toneBadgeClass(card.tone)}`}>{card.delta}</span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-lg font-semibold text-text-primary">{card.value}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatStrip({ items, className = '' }: { items: SmallStat[]; className?: string }) {
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

function ComparisonChart({
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

function FunnelRows({ steps }: { steps: FunnelStep[] }) {
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

function BehaviorGrid({ stats }: { stats: SmallStat[] }) {
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

function TopSpendersTable({ whales }: { whales: AdminMetrics['behavior']['whalesTop10'] }) {
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

function EngineMixTable({ engines }: { engines: AdminMetrics['engines'] }) {
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

function HealthPanel({
  failedRenders,
  failureRate,
  flaggedRows,
}: {
  failedRenders: number;
  failureRate: number;
  flaggedRows: AdminMetrics['health']['failedByEngine30d'];
}) {
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

function SummaryCell({
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

function DailyLedgerTable({ rows }: { rows: LedgerRow[] }) {
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

function MonthlyRollupTable({
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

function ShareBar({
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

function EmptyStateCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-hairline bg-bg/40 px-4 py-5 text-sm text-text-secondary">
      {children}
    </div>
  );
}

function toneBadgeClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'bg-success-bg text-success';
  }
  if (tone === 'warning') {
    return 'bg-error-bg text-error';
  }
  return 'bg-surface-hover text-text-secondary';
}

function toneValueClass(tone: SmallStat['tone']) {
  if (tone === 'success') {
    return 'text-success';
  }
  if (tone === 'warning') {
    return 'text-error';
  }
  return 'text-text-primary';
}

function resolveExcludeAdminParam(value: string | string[] | undefined): boolean {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved == null) return true;
  const normalized = resolved.trim().toLowerCase();
  if (!normalized) return true;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

function resolveFocusParam(value: string | string[] | undefined): FocusMetric {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved === 'active' || resolved === 'topups' || resolved === 'charges') {
    return resolved;
  }
  return 'signups';
}

function buildOverviewStats(metrics: AdminMetrics): SmallStat[] {
  return [
    {
      label: 'Total accounts',
      value: formatNumber(metrics.totals.totalAccounts),
      helper: 'All synced signups',
    },
    {
      label: 'Paying accounts',
      value: formatNumber(metrics.totals.payingAccounts),
      helper: `${formatPercent(metrics.funnels.signupToTopUpConversion)} signup → top-up`,
    },
    {
      label: 'Active (30d)',
      value: formatNumber(metrics.totals.activeAccounts30d),
      helper: 'Distinct users with a completed render in the last 30 days',
    },
    {
      label: 'All-time top-ups',
      value: formatCurrency(metrics.totals.allTimeTopUpsUsd),
      helper: 'Wallet cash-in recorded to date',
    },
    {
      label: 'All-time charges',
      value: formatCurrency(metrics.totals.allTimeRenderChargesUsd || metrics.totals.allTimeTopUpsUsd),
      helper: 'Render usage charged to date',
    },
    {
      label: 'Failure rate (30d)',
      value: formatPercent(metrics.health.failedRendersRate30d),
      helper: `${formatNumber(metrics.health.failedRenders30d)} unresolved failures`,
      tone: metrics.health.failedRenders30d ? 'warning' : 'success',
    },
  ];
}

function buildPulseCards(metrics: AdminMetrics, comparison: AdminMetricsComparison): PulseCard[] {
  const signupsCurrent = sumTimeSeries(comparison.current.signupsDaily);
  const signupsPrevious = sumTimeSeries(comparison.previous.signupsDaily);
  const activeCurrent = sumTimeSeries(comparison.current.activeAccountsDaily);
  const activePrevious = sumTimeSeries(comparison.previous.activeAccountsDaily);
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const topupsPrevious = sumAmountSeries(comparison.previous.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const chargesPrevious = sumAmountSeries(comparison.previous.chargesDaily);

  const signupsPeak = findPeakTimeSeriesPoint(comparison.current.signupsDaily);
  const activePeak = findPeakTimeSeriesPoint(comparison.current.activeAccountsDaily);
  const chargesPeak = findPeakAmountSeriesPoint(comparison.current.chargesDaily);

  return [
    createPulseCard({
      label: 'Signups',
      current: signupsCurrent,
      previous: signupsPrevious,
      formatValue: formatNumber,
      helper: signupsPeak
        ? `Peak ${formatDay(signupsPeak.date)} · ${formatAverage(signupsCurrent / metrics.range.days)} per day`
        : `No signup peak in the current ${describeRange(metrics.range.label)}`,
    }),
    createPulseCard({
      label: 'Active account-days',
      current: activeCurrent,
      previous: activePrevious,
      formatValue: formatNumber,
      helper: activePeak
        ? `Peak ${formatDay(activePeak.date)} · summed daily activity, not distinct users`
        : 'No activity in this range',
    }),
    createPulseCard({
      label: 'Wallet top-ups',
      current: topupsCurrent.amountUsd,
      previous: topupsPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: topupsCurrent.count
        ? `${formatNumber(topupsCurrent.count)} loads · avg ${formatAverageTicket(topupsCurrent)}`
        : 'No wallet loads in the current range',
    }),
    createPulseCard({
      label: 'Render charges',
      current: chargesCurrent.amountUsd,
      previous: chargesPrevious.amountUsd,
      formatValue: (value) => formatCurrency(value),
      helper: chargesPeak
        ? `${formatNumber(chargesCurrent.count)} charges · peak ${formatDay(chargesPeak.date)}`
        : 'No render charges in the current range',
    }),
  ];
}

function createPulseCard({
  label,
  current,
  previous,
  formatValue,
  helper,
  positiveIsGood = true,
}: {
  label: string;
  current: number;
  previous: number;
  formatValue: (value: number) => string;
  helper: string;
  positiveIsGood?: boolean;
}): PulseCard {
  const delta = compareValues(current, previous);
  return {
    label,
    value: formatValue(current),
    previousValue: formatValue(previous),
    delta: formatDeltaLabel(delta),
    helper,
    tone: resolveDeltaTone(delta, positiveIsGood),
  };
}

function buildQuickInsights(metrics: AdminMetrics, comparison: AdminMetricsComparison): string[] {
  const insights: string[] = [];
  const humanRange = describeRange(metrics.range.label);
  const signupsDelta = compareValues(sumTimeSeries(comparison.current.signupsDaily), sumTimeSeries(comparison.previous.signupsDaily));
  const topupsCurrent = sumAmountSeries(comparison.current.topupsDaily);
  const chargesCurrent = sumAmountSeries(comparison.current.chargesDaily);
  const netUsd = topupsCurrent.amountUsd - chargesCurrent.amountUsd;
  const topEngine = metrics.engines[0];
  const flaggedEngines = metrics.health.failedByEngine30d.filter((row) => row.failedCount30d > 0);

  insights.push(`Signups are ${formatNarrativeDelta(signupsDelta)} versus the previous ${humanRange}.`);
  insights.push(
    `Wallet flow in the current ${humanRange}: ${formatCurrency(topupsCurrent.amountUsd)} in top-ups against ${formatCurrency(chargesCurrent.amountUsd)} in charges (${netUsd >= 0 ? '+' : ''}${formatCurrency(netUsd)} net).`
  );
  insights.push(
    `Funnel today: ${formatPercent(metrics.funnels.signupToTopUpConversion)} signup → top-up, then ${formatPercent(metrics.funnels.topUpToRenderConversion30d)} top-up → first render within 30 days.`
  );

  if (topEngine) {
    insights.push(
      `${topEngine.engineLabel} leads the engine mix with ${formatCurrency(topEngine.rendersAmount30dUsd)} and ${formatPercent(topEngine.shareOfTotalRevenue30d)} of 30-day revenue.`
    );
  }

  if (flaggedEngines.length) {
    insights.push(`${formatNumber(flaggedEngines.length)} engine${flaggedEngines.length > 1 ? 's' : ''} still show unresolved failures.`);
  } else {
    insights.push('No unresolved failures detected in the last 30 days.');
  }

  return insights;
}

function buildRecentLedgerRows(metrics: AdminMetrics): LedgerRow[] {
  const signupsMap = new Map(metrics.timeseries.signupsDaily.map((point) => [point.date.slice(0, 10), point.value]));
  const activeMap = new Map(metrics.timeseries.activeAccountsDaily.map((point) => [point.date.slice(0, 10), point.value]));
  const topupsMap = new Map(metrics.timeseries.topupsDaily.map((point) => [point.date.slice(0, 10), point.amountCents / 100]));
  const chargesMap = new Map(metrics.timeseries.chargesDaily.map((point) => [point.date.slice(0, 10), point.amountCents / 100]));

  const dates = Array.from(
    new Set([
      ...metrics.timeseries.signupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.activeAccountsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.topupsDaily.map((point) => point.date.slice(0, 10)),
      ...metrics.timeseries.chargesDaily.map((point) => point.date.slice(0, 10)),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .slice(-7)
    .reverse();

  return dates.map((date) => ({
    date,
    signups: signupsMap.get(date) ?? 0,
    active: activeMap.get(date) ?? 0,
    topupsUsd: topupsMap.get(date) ?? 0,
    chargesUsd: chargesMap.get(date) ?? 0,
  }));
}

function buildMonthlyRows(metrics: AdminMetrics) {
  const map = new Map<
    string,
    {
      month: string;
      signups: number;
      topupsUsd: number;
      chargesUsd: number;
    }
  >();

  metrics.monthly.signupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.signups = point.value;
    map.set(key, existing);
  });

  metrics.monthly.topupsMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.topupsUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  metrics.monthly.chargesMonthly.forEach((point) => {
    const key = point.date.slice(0, 7);
    const existing = map.get(key) ?? { month: point.date, signups: 0, topupsUsd: 0, chargesUsd: 0 };
    existing.chargesUsd = point.amountCents / 100;
    map.set(key, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .reverse();
}

function buildBehaviorStats(metrics: AdminMetrics): SmallStat[] {
  return [
    {
      label: 'Signup → Top-up',
      value: formatPercent(metrics.funnels.signupToTopUpConversion),
      helper: `${formatNumber(metrics.funnels.totalTopupUsers)} users reached their first wallet load`,
    },
    {
      label: 'Top-up → First render',
      value: formatPercent(metrics.funnels.topUpToRenderConversion30d),
      helper: `${formatNumber(metrics.funnels.convertedWithin30dUsers)} users converted within 30 days`,
    },
    {
      label: 'Avg days to first top-up',
      value: formatDays(metrics.funnels.avgTimeSignupToFirstTopUpDays),
      helper: 'From signup to first wallet load',
    },
    {
      label: 'Avg days to first render',
      value: formatDays(metrics.funnels.avgTimeTopUpToFirstRenderDays),
      helper: 'From first top-up to first completed render',
    },
    {
      label: 'Avg renders / paying user',
      value: formatAverage(metrics.behavior.avgRendersPerPayingUser30d),
      helper: `Median ${formatAverage(metrics.behavior.medianRendersPerPayingUser30d)} over 30 days`,
    },
    {
      label: 'Returning users (7d)',
      value: formatNumber(metrics.behavior.returningUsers7d),
      helper: 'Completed renders in both the last 7 days and the previous 7 days',
      tone: metrics.behavior.returningUsers7d ? 'success' : 'default',
    },
  ];
}

function buildFunnelSteps(metrics: AdminMetrics): FunnelStep[] {
  const rawSteps = [
    {
      label: 'Signed up',
      value: metrics.totals.totalAccounts,
      helper: 'All synced accounts in the workspace',
      accent: '#2563EB',
    },
    {
      label: 'Loaded wallet',
      value: metrics.funnels.totalTopupUsers,
      helper: 'At least one wallet top-up recorded',
      accent: '#CA8A04',
    },
    {
      label: 'First render within 30d',
      value: metrics.funnels.convertedWithin30dUsers,
      helper: 'Reached first completed render within 30 days of first top-up',
      accent: '#EA580C',
    },
  ];

  const startValue = rawSteps[0]?.value ?? 0;

  return rawSteps.map((step, index) => {
    const previousValue = index > 0 ? rawSteps[index - 1].value : 0;
    return {
      ...step,
      shareOfStart: startValue ? step.value / startValue : 0,
      conversionFromPrevious: index === 0 ? null : previousValue ? step.value / previousValue : 0,
    };
  });
}

function buildFocusMetricData(
  focus: FocusMetric,
  metrics: AdminMetrics,
  comparison: AdminMetricsComparison,
  humanRange: string
): FocusMetricData {
  if (focus === 'active') {
    return {
      key: 'active',
      label: 'Active account-days',
      description: 'Mesure d’usage journalier cumulé. Ce n’est pas un distinct user count, mais un vrai rythme d’activité.',
      theme: CHART_THEMES.active,
      currentPoints: comparison.current.activeAccountsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.value,
      })),
      previousPoints: comparison.previous.activeAccountsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.value,
      })),
      stats: buildCountSeriesStats(comparison.current.activeAccountsDaily, comparison.previous.activeAccountsDaily, humanRange, {
        totalLabel: 'Current total',
        totalHelper: 'Summed daily active-account counts',
        peakEmptyLabel: 'No activity',
      }),
    };
  }

  if (focus === 'topups') {
    return {
      key: 'topups',
      label: 'Wallet top-ups',
      description: 'Cash-in par jour. Le tracé précédent garde la cadence historique visible sans surcharger le graph.',
      theme: CHART_THEMES.topups,
      currentPoints: comparison.current.topupsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.topupsDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      stats: buildAmountSeriesStats(comparison.current.topupsDaily, comparison.previous.topupsDaily, humanRange, 'loads'),
      axisFormatter: formatAxisCurrency,
      tooltipFormatter: (value) => formatCurrency(value, { precise: value < 100 }),
    };
  }

  if (focus === 'charges') {
    return {
      key: 'charges',
      label: 'Render charges',
      description: 'Consommation par jour. Les pics restent visibles, mais la comparaison n’oblige plus à faire le calcul mental.',
      theme: CHART_THEMES.charges,
      currentPoints: comparison.current.chargesDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      previousPoints: comparison.previous.chargesDaily.map((point) => ({
        label: formatDay(point.date),
        value: point.amountCents / 100,
      })),
      stats: buildAmountSeriesStats(comparison.current.chargesDaily, comparison.previous.chargesDaily, humanRange, 'charges'),
      axisFormatter: formatAxisCurrency,
      tooltipFormatter: (value) => formatCurrency(value, { precise: value < 100 }),
    };
  }

  return {
    key: 'signups',
    label: 'Signups per day',
    description: 'Nouvelle acquisition dans la fenêtre. C’est la meilleure lecture de tendance en haut de funnel.',
    theme: CHART_THEMES.signups,
    currentPoints: comparison.current.signupsDaily.map((point) => ({
      label: formatDay(point.date),
      value: point.value,
    })),
    previousPoints: comparison.previous.signupsDaily.map((point) => ({
      label: formatDay(point.date),
      value: point.value,
    })),
    stats: buildCountSeriesStats(comparison.current.signupsDaily, comparison.previous.signupsDaily, humanRange),
  };
}

function buildCountSeriesStats(
  currentPoints: TimeSeriesPoint[],
  previousPoints: TimeSeriesPoint[],
  humanRange: string,
  options?: {
    totalLabel?: string;
    totalHelper?: string;
    peakEmptyLabel?: string;
  }
): SmallStat[] {
  const currentTotal = sumTimeSeries(currentPoints);
  const previousTotal = sumTimeSeries(previousPoints);
  const delta = compareValues(currentTotal, previousTotal);
  const average = currentPoints.length ? currentTotal / currentPoints.length : 0;
  const peak = findPeakTimeSeriesPoint(currentPoints);
  const activeDays = currentPoints.filter((point) => point.value > 0).length;

  return [
    {
      label: options?.totalLabel ?? 'Current total',
      value: formatNumber(currentTotal),
      helper: options?.totalHelper ?? `Across ${humanRange}`,
    },
    {
      label: 'Vs previous',
      value: formatDeltaLabel(delta),
      helper: `Previous ${formatNumber(previousTotal)}`,
      tone: resolveDeltaTone(delta),
    },
    {
      label: 'Avg / day',
      value: formatAverage(average),
      helper: `${formatNumber(activeDays)} active days`,
    },
    {
      label: 'Peak day',
      value: peak ? formatDay(peak.date) : '—',
      helper: peak ? formatNumber(peak.value) : options?.peakEmptyLabel ?? 'No activity',
    },
  ];
}

function buildAmountSeriesStats(
  currentPoints: AmountSeriesPoint[],
  previousPoints: AmountSeriesPoint[],
  humanRange: string,
  countLabel: string
): SmallStat[] {
  const currentTotals = sumAmountSeries(currentPoints);
  const previousTotals = sumAmountSeries(previousPoints);
  const delta = compareValues(currentTotals.amountUsd, previousTotals.amountUsd);
  const peak = findPeakAmountSeriesPoint(currentPoints);

  return [
    {
      label: 'Current amount',
      value: formatCurrency(currentTotals.amountUsd),
      helper: `${formatNumber(currentTotals.count)} ${countLabel} across ${humanRange}`,
    },
    {
      label: 'Vs previous',
      value: formatDeltaLabel(delta),
      helper: `Previous ${formatCurrency(previousTotals.amountUsd)}`,
      tone: resolveDeltaTone(delta),
    },
    {
      label: 'Avg ticket',
      value: currentTotals.count ? formatAverageTicket(currentTotals) : '—',
      helper: currentTotals.count ? 'Per recorded transaction' : 'No transactions',
    },
    {
      label: 'Peak day',
      value: peak ? formatDay(peak.date) : '—',
      helper: peak ? formatCurrency(peak.amountCents / 100) : 'No activity',
    },
  ];
}

function compareValues(current: number, previous: number): DeltaSnapshot {
  const absoluteChange = current - previous;
  return {
    current,
    previous,
    absoluteChange,
    ratioChange: previous === 0 ? null : absoluteChange / previous,
  };
}

function formatDeltaLabel(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'Flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'New' : 'Flat';
  }
  if (delta.absoluteChange === 0) {
    return 'Flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

function formatNarrativeDelta(delta: DeltaSnapshot) {
  if (delta.current === 0 && delta.previous === 0) {
    return 'flat';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? 'up from a zero base' : 'flat';
  }
  if (delta.absoluteChange === 0) {
    return 'flat';
  }
  return formatSignedPercent(delta.ratioChange ?? 0);
}

function resolveDeltaTone(delta: DeltaSnapshot, positiveIsGood = true): SmallStat['tone'] {
  if (delta.current === 0 && delta.previous === 0) {
    return 'default';
  }
  if (delta.previous === 0) {
    return delta.current > 0 ? (positiveIsGood ? 'success' : 'warning') : 'default';
  }
  if (delta.absoluteChange === 0) {
    return 'default';
  }
  const improved = positiveIsGood ? delta.absoluteChange > 0 : delta.absoluteChange < 0;
  return improved ? 'success' : 'warning';
}

function sumTimeSeries(points: TimeSeriesPoint[]): number {
  return points.reduce((sum, point) => sum + point.value, 0);
}

function sumAmountSeries(points: AmountSeriesPoint[]): { amountUsd: number; count: number } {
  return points.reduce(
    (accumulator, point) => ({
      amountUsd: accumulator.amountUsd + point.amountCents / 100,
      count: accumulator.count + point.count,
    }),
    { amountUsd: 0, count: 0 }
  );
}

function findPeakTimeSeriesPoint(points: TimeSeriesPoint[]): TimeSeriesPoint | null {
  if (!points.length) return null;
  const peak = [...points].sort((a, b) => b.value - a.value)[0];
  return peak?.value > 0 ? peak : null;
}

function findPeakAmountSeriesPoint(points: AmountSeriesPoint[]): AmountSeriesPoint | null {
  if (!points.length) return null;
  const peak = [...points].sort((a, b) => b.amountCents - a.amountCents)[0];
  return peak?.amountCents > 0 ? peak : null;
}

function buildChartTicks(maxValue: number): number[] {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return [0, 1];
  }

  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const residual = roughStep / magnitude;
  let niceStep = 1;

  if (residual <= 1) {
    niceStep = 1;
  } else if (residual <= 2) {
    niceStep = 2;
  } else if (residual <= 5) {
    niceStep = 5;
  } else {
    niceStep = 10;
  }

  const step = niceStep * magnitude;
  const niceMax = Math.ceil(maxValue / step) * step;
  const tickCount = Math.max(2, Math.round(niceMax / step));

  return Array.from({ length: tickCount + 1 }, (_, index) => Number((index * step).toFixed(4)));
}

function buildInsightsHref({
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

function describeRange(label: MetricsRangeLabel) {
  switch (label) {
    case '7d':
      return '7 days';
    case '90d':
      return '90 days';
    default:
      return '30 days';
  }
}

function formatCurrency(amount: number, options?: { precise?: boolean }) {
  if (options?.precise) {
    return preciseCurrencyFormatter.format(amount);
  }
  return currencyFormatter.format(amount);
}

function formatAverageTicket(totals: { amountUsd: number; count: number }) {
  return formatCurrency(totals.amountUsd / totals.count, { precise: true });
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatCompactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return compactNumberFormatter.format(value);
  if (Number.isInteger(value)) return numberFormatter.format(value);
  return value.toFixed(1);
}

function formatAxisCurrency(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `$${(value / 1000).toFixed(absolute >= 10000 ? 0 : 1)}k`;
  }
  if (absolute >= 10) {
    return `$${Math.round(value)}`;
  }
  return `$${value.toFixed(1)}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return percentFormatter.format(value);
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${percentFormatter.format(Math.abs(value))}`;
}

function formatDay(value: string) {
  return dayFormatter.format(new Date(value));
}

function formatMonth(value: string) {
  return monthFormatter.format(new Date(value));
}

function formatFullDate(value: string | null) {
  if (!value) return '—';
  return fullDateFormatter.format(new Date(value));
}

function formatDays(value: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} days`;
}

function formatAverage(value: number) {
  if (!Number.isFinite(value)) {
    return '0.0';
  }
  return value.toFixed(1);
}
