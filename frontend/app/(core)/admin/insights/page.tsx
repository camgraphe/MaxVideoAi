import Link from 'next/link';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminMetricsComparison, METRIC_RANGE_OPTIONS } from '@/server/admin-metrics';
import type {
  AdminMetrics,
  AdminMetricsComparison,
  AmountSeriesPoint,
  MetricsRangeLabel,
  TimeSeriesPoint,
} from '@/lib/admin/types';
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

type PageProps = {
  searchParams?: {
    range?: string;
    excludeAdmin?: string | string[];
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

type GrowthTableRow = {
  date: string;
  signups: number;
  active: number;
};

type RevenueTableRow = {
  date: string;
  topupsUsd: number;
  topupCount: number;
  chargesUsd: number;
  chargeCount: number;
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
  barStart: string;
  barEnd: string;
  line: string;
};

type FunnelStep = {
  label: string;
  value: number;
  helper: string;
  shareOfStart: number;
  conversionFromPrevious: number | null;
  accentStart: string;
  accentEnd: string;
};

const ADMIN_EXCLUDED_USER_IDS = ['301cc489-d689-477f-94c4-0b051deda0bc'];

const CHART_THEMES: Record<'signups' | 'active' | 'topups' | 'charges', ChartTheme> = {
  signups: {
    barStart: '#b7d6ff',
    barEnd: 'var(--info)',
    line: 'rgba(136, 177, 255, 0.95)',
  },
  active: {
    barStart: '#9de8d7',
    barEnd: 'var(--chart-active)',
    line: 'rgba(109, 214, 190, 0.95)',
  },
  topups: {
    barStart: '#ffe199',
    barEnd: 'var(--accent)',
    line: 'rgba(255, 205, 96, 0.95)',
  },
  charges: {
    barStart: '#ffc2af',
    barEnd: 'var(--chart-charges)',
    line: 'rgba(255, 144, 122, 0.95)',
  },
};

export default async function AdminInsightsPage({ searchParams }: PageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/insights] access denied', error);
    notFound();
  }

  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  };

  const [metrics, comparison] = await Promise.all([
    fetchAdminMetrics(searchParams?.range, queryOptions),
    fetchAdminMetricsComparison(searchParams?.range, queryOptions),
  ]);

  const overviewStats = buildOverviewStats(metrics);
  const pulseCards = buildPulseCards(metrics, comparison);
  const quickInsights = buildQuickInsights(metrics, comparison);
  const recentGrowthRows = buildRecentGrowthRows(metrics);
  const recentRevenueRows = buildRecentRevenueRows(metrics);
  const monthlyRows = buildMonthlyRows(metrics);
  const featuredEngines = metrics.engines.slice(0, 8);
  const flaggedHealthRows = metrics.health.failedByEngine30d
    .filter((row) => row.failedCount30d > 0 || row.failureRate30d > 0)
    .sort((a, b) => b.failedCount30d - a.failedCount30d || b.failureRate30d - a.failureRate30d);

  const humanRange = describeRange(metrics.range.label);
  const signupSummary = buildCountSeriesStats(metrics.timeseries.signupsDaily, comparison.previous.signupsDaily, humanRange);
  const activeSummary = buildCountSeriesStats(
    metrics.timeseries.activeAccountsDaily,
    comparison.previous.activeAccountsDaily,
    humanRange,
    {
      totalLabel: 'Current total',
      totalHelper: 'Summed daily active-account counts',
      peakEmptyLabel: 'No activity',
    }
  );
  const topupSummary = buildAmountSeriesStats(
    metrics.timeseries.topupsDaily,
    comparison.previous.topupsDaily,
    humanRange,
    'loads'
  );
  const chargeSummary = buildAmountSeriesStats(
    metrics.timeseries.chargesDaily,
    comparison.previous.chargesDaily,
    humanRange,
    'charges'
  );
  const behaviorStats = buildBehaviorStats(metrics);
  const funnelSteps = buildFunnelSteps(metrics);

  return (
    <div className="stack-gap-lg">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-text-muted">Analytics</p>
          <h1 className="mt-1 text-3xl font-semibold text-text-primary">Workspace insights</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Admin view focused on trend reading, cash movement, conversion, and operational alerts. V2 compares the
            current window against the previous one instead of showing standalone bars only.
          </p>
        </div>
        <RangeSelector current={metrics.range.label} excludeAdmin={excludeAdmin} />
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {overviewStats.map((stat) => (
            <MetricTile key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} size="lg" tone={stat.tone} />
          ))}
        </div>
        <SectionCard title="Period pulse" description={`Current ${humanRange} against the previous ${humanRange}.`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {pulseCards.map((card) => (
              <PulseMetricTile key={card.label} card={card} />
            ))}
          </div>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {quickInsights.map((line, index) => (
              <li key={`insight-${index}`} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </section>

      <SectionCard
        title="Growth"
        description={`Current ${humanRange} in bars, previous ${humanRange} as a dashed reference line.`}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <ChartPanel
              title="Signups per day"
              description="The previous period is overlaid so trend direction is readable without mental math."
            >
              <StatStrip items={signupSummary} />
              <ChartLegend theme={CHART_THEMES.signups} />
              <div className="mt-4">
                <ComparisonChart
                  ariaLabel="Daily signup counts comparison"
                  theme={CHART_THEMES.signups}
                  currentPoints={metrics.timeseries.signupsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.value,
                  }))}
                  previousPoints={comparison.previous.signupsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.value,
                  }))}
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="Active accounts per day"
              description="Shows whether daily engagement is actually improving or just fluctuating."
            >
              <StatStrip items={activeSummary} />
              <ChartLegend theme={CHART_THEMES.active} />
              <div className="mt-4">
                <ComparisonChart
                  ariaLabel="Daily active accounts comparison"
                  theme={CHART_THEMES.active}
                  currentPoints={metrics.timeseries.activeAccountsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.value,
                  }))}
                  previousPoints={comparison.previous.activeAccountsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.value,
                  }))}
                />
              </div>
            </ChartPanel>
          </div>

          <RecentGrowthTable rows={recentGrowthRows} />
        </div>
      </SectionCard>

      <SectionCard
        title="Wallet flow"
        description={`Cash-in and usage are compared against the previous ${humanRange}, not shown as isolated snapshots.`}
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
          <div className="space-y-4">
            <ChartPanel
              title="Wallet top-ups"
              description="Gradient bars highlight the current period while the dashed line preserves previous pacing."
            >
              <StatStrip items={topupSummary} />
              <ChartLegend theme={CHART_THEMES.topups} />
              <div className="mt-4">
                <ComparisonChart
                  ariaLabel="Daily wallet top-ups comparison"
                  theme={CHART_THEMES.topups}
                  axisFormatter={formatAxisCurrency}
                  tooltipFormatter={(value) => formatCurrency(value, { precise: value < 100 })}
                  currentPoints={metrics.timeseries.topupsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.amountCents / 100,
                  }))}
                  previousPoints={comparison.previous.topupsDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.amountCents / 100,
                  }))}
                />
              </div>
            </ChartPanel>

            <ChartPanel
              title="Render charges"
              description="Charge spikes stay visible, but now you can also see whether they beat the previous window."
            >
              <StatStrip items={chargeSummary} />
              <ChartLegend theme={CHART_THEMES.charges} />
              <div className="mt-4">
                <ComparisonChart
                  ariaLabel="Daily render charges comparison"
                  theme={CHART_THEMES.charges}
                  axisFormatter={formatAxisCurrency}
                  tooltipFormatter={(value) => formatCurrency(value, { precise: value < 100 })}
                  currentPoints={metrics.timeseries.chargesDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.amountCents / 100,
                  }))}
                  previousPoints={comparison.previous.chargesDaily.map((point) => ({
                    label: formatDay(point.date),
                    value: point.amountCents / 100,
                  }))}
                />
              </div>
            </ChartPanel>
          </div>

          <RecentRevenueTable rows={recentRevenueRows} />
        </div>
      </SectionCard>

      <SectionCard
        title="Conversion funnel"
        description="A true step-down view from signup to payment to first value, with retention context and top spenders beside it."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,1fr)]">
          <div className="space-y-4">
            <FunnelVisual steps={funnelSteps} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {behaviorStats.map((stat) => (
                <MetricTile key={stat.label} label={stat.label} value={stat.value} helper={stat.helper} tone={stat.tone} size="sm" />
              ))}
            </div>
          </div>

          <TopSpendersPanel whales={metrics.behavior.whalesTop10} />
        </div>
      </SectionCard>

      <SectionCard title="Monthly rollup" description="Six-month summary kept apart from daily trends to avoid mixed granularity.">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Month</th>
                <th className="py-2 font-semibold">Signups</th>
                <th className="py-2 font-semibold">Top-ups</th>
                <th className="py-2 font-semibold">Charges</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.length ? (
                monthlyRows.map((row) => (
                  <tr key={row.month} className="border-t border-surface-on-media-40 text-text-secondary">
                    <td className="py-3">{formatMonth(row.month)}</td>
                    <td className="py-3 font-semibold text-text-primary">{formatNumber(row.signups)}</td>
                    <td className="py-3 font-semibold text-text-primary">{formatCurrency(row.topupsUsd)}</td>
                    <td className="py-3 font-semibold text-text-primary">{formatCurrency(row.chargesUsd)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-text-secondary">
                    No monthly aggregates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Engine usage (30d)" description="Ranked view first, detailed table only when you need the full mix.">
        {featuredEngines.length ? (
          <>
            <div className="grid gap-3 lg:grid-cols-2">
              {featuredEngines.map((engine) => (
                <EngineUsageCard key={engine.engineId} engine={engine} />
              ))}
            </div>
            <details className="mt-4 rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-text-primary">Open detailed engine table</summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                      <th className="py-2 font-semibold">Engine</th>
                      <th className="py-2 font-semibold">Renders</th>
                      <th className="py-2 font-semibold">Distinct users</th>
                      <th className="py-2 font-semibold">Revenue (30d)</th>
                      <th className="py-2 font-semibold">Render share</th>
                      <th className="py-2 font-semibold">Revenue share</th>
                      <th className="py-2 font-semibold">Avg spend / user</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.engines.map((engine) => (
                      <tr key={engine.engineId} className="border-t border-surface-on-media-40 text-text-secondary">
                        <td className="py-3 font-semibold text-text-primary">{engine.engineLabel}</td>
                        <td className="py-3">{formatNumber(engine.rendersCount30d)}</td>
                        <td className="py-3">{formatNumber(engine.distinctUsers30d)}</td>
                        <td className="py-3">{formatCurrency(engine.rendersAmount30dUsd)}</td>
                        <td className="py-3">
                          <ShareBar value={engine.shareOfTotalRenders30d} label={formatPercent(engine.shareOfTotalRenders30d)} />
                        </td>
                        <td className="py-3">
                          <ShareBar value={engine.shareOfTotalRevenue30d} label={formatPercent(engine.shareOfTotalRevenue30d)} />
                        </td>
                        <td className="py-3">{formatCurrency(engine.avgSpendPerUser30d, { precise: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <EmptyStateCard>No engine activity recorded in the last 30 days.</EmptyStateCard>
        )}
      </SectionCard>

      <SectionCard title="Operational health (30d)" description="Alert-first view: only engines with unresolved failures stay visible by default.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Failed renders"
            value={formatNumber(metrics.health.failedRenders30d)}
            helper="Unresolved failures"
            size="sm"
            tone={metrics.health.failedRenders30d ? 'warning' : 'success'}
          />
          <MetricTile
            label="Failure rate"
            value={formatPercent(metrics.health.failedRendersRate30d)}
            helper="Failed / completed"
            size="sm"
            tone={metrics.health.failedRendersRate30d ? 'warning' : 'success'}
          />
          <MetricTile
            label="Engines impacted"
            value={formatNumber(flaggedHealthRows.length)}
            helper="At least one unresolved failure"
            size="sm"
            tone={flaggedHealthRows.length ? 'warning' : 'success'}
          />
          <MetricTile label="Monitoring mode" value="Alert-first" helper="Healthy zero-value engines stay hidden" size="sm" />
        </div>

        {flaggedHealthRows.length ? (
          <div className="mt-4 space-y-3">
            {flaggedHealthRows.map((row) => (
              <div key={row.engineId} className="rounded-2xl border border-warning-border bg-warning-bg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{row.engineLabel}</p>
                    <p className="mt-1 text-xs text-warning">Unresolved failures need follow-up on the jobs or billing side.</p>
                  </div>
                  <div className="grid min-w-[220px] gap-2 sm:grid-cols-2">
                    <SmallMetric label="Failed renders" value={formatNumber(row.failedCount30d)} tone="warning" />
                    <SmallMetric label="Failure rate" value={formatPercent(row.failureRate30d)} tone="warning" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-success-border bg-success-bg p-4 text-sm text-success">
            No unresolved failures recorded in the past 30 days. Zero-value engine rows are intentionally hidden here.
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function resolveExcludeAdminParam(value: string | string[] | undefined): boolean {
  const resolved = Array.isArray(value) ? value[value.length - 1] : value;
  if (resolved == null) return true;
  const normalized = resolved.trim().toLowerCase();
  if (!normalized) return true;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-surface-on-media-30 bg-surface-glass-85 p-5 shadow-card">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">{title}</p>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </header>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RangeSelector({ current, excludeAdmin }: { current: MetricsRangeLabel; excludeAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center rounded-full border border-surface-on-media-40 bg-surface-glass-80 p-1 shadow-card">
        {METRIC_RANGE_OPTIONS.map((option) => {
          const isActive = option === current;
          return (
            <Link
              key={option}
              href={buildInsightsHref({ range: option, excludeAdmin })}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition',
                isActive ? 'bg-text-primary text-on-inverse' : 'text-text-secondary hover:bg-surface hover:text-text-primary',
              ].join(' ')}
            >
              {option}
            </Link>
          );
        })}
      </div>
      <Link
        href={buildInsightsHref({ range: current, excludeAdmin: !excludeAdmin })}
        className={[
          'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] transition',
          excludeAdmin
            ? 'border-success-border bg-success-bg text-success hover:bg-success-bg/80'
            : 'border-surface-on-media-40 bg-surface-glass-80 text-text-secondary hover:bg-surface hover:text-text-primary',
        ].join(' ')}
      >
        {excludeAdmin ? 'Admin excluded' : 'Include admin'}
      </Link>
    </div>
  );
}

function PulseMetricTile({ card }: { card: PulseCard }) {
  const toneClass =
    card.tone === 'success'
      ? 'border-success-border bg-success-bg/70'
      : card.tone === 'warning'
        ? 'border-warning-border bg-warning-bg/70'
        : 'border-surface-on-media-40 bg-surface/70';

  const badgeClass =
    card.tone === 'success'
      ? 'border-success-border/80 bg-success-bg text-success'
      : card.tone === 'warning'
        ? 'border-warning-border/80 bg-warning-bg text-warning'
        : 'border-surface-on-media-40 bg-surface-glass-80 text-text-secondary';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-text-muted">{card.label}</p>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${badgeClass}`}>
          {card.delta}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-text-primary">{card.value}</p>
      <p className="mt-1 text-xs text-text-secondary">Previous {card.previousValue}</p>
      <p className="mt-3 text-xs leading-5 text-text-secondary">{card.helper}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  helper,
  tone = 'default',
  size = 'sm',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning';
  size?: 'sm' | 'lg';
}) {
  const toneClass =
    tone === 'success'
      ? 'border-success-border bg-success-bg'
      : tone === 'warning'
        ? 'border-warning-border bg-warning-bg'
        : 'border-surface-on-media-30 bg-surface-glass-90';

  const valueClass = size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <div className={`rounded-card border px-4 py-3 shadow-card ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">{label}</p>
      <p className={`mt-2 font-semibold text-text-primary ${valueClass}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p> : null}
    </div>
  );
}

function SmallMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'warning' }) {
  return (
    <div
      className={[
        'rounded-xl border px-3 py-2',
        tone === 'warning' ? 'border-warning-border/70 bg-surface/70' : 'border-surface-on-media-40 bg-surface-glass-70',
      ].join(' ')}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function ChartPanel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">{title}</p>
          {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function StatStrip({ items }: { items: SmallStat[] }) {
  return (
    <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={[
            'rounded-xl border px-3 py-2',
            item.tone === 'success'
              ? 'border-success-border/70 bg-success-bg/60'
              : item.tone === 'warning'
                ? 'border-warning-border/70 bg-warning-bg/60'
                : 'border-surface-on-media-40 bg-surface/70',
          ].join(' ')}
        >
          <dt className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{item.label}</dt>
          <dd className="mt-1 text-sm font-semibold text-text-primary">{item.value}</dd>
          {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
        </div>
      ))}
    </dl>
  );
}

function ChartLegend({ theme }: { theme: ChartTheme }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-text-muted">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-sm"
          style={{
            backgroundImage: `linear-gradient(135deg, ${theme.barStart}, ${theme.barEnd})`,
          }}
        />
        Current period
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="relative block h-2 w-4">
          <span
            className="absolute inset-x-0 top-1/2 border-t border-dashed"
            style={{ borderColor: theme.line }}
          />
        </span>
        Previous period
      </span>
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
    return <p className="text-sm text-text-secondary">No data for this range.</p>;
  }

  const width = 760;
  const height = 252;
  const padding = { top: 20, right: 16, bottom: 36, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values);
  const ticks = buildChartTicks(maxValue);
  const maxTick = ticks[ticks.length - 1] || 1;
  const step = chartWidth / Math.max(1, currentPoints.length);
  const barWidth = Math.max(4, step * 0.62);
  const labelEvery = Math.max(1, Math.ceil(currentPoints.length / 6));
  const slug = ariaLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const gradientId = `${slug}-gradient`;

  const previousLinePoints = currentPoints.map((point, index) => {
    const previousValue = previousPoints[index]?.value ?? 0;
    const x = padding.left + step * index + step / 2;
    const y = padding.top + chartHeight - (previousValue / maxTick) * chartHeight;
    return { x, y };
  });

  const previousPath = previousLinePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="h-60 w-full">
      <defs>
        <linearGradient id={gradientId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={theme.barStart} />
          <stop offset="100%" stopColor={theme.barEnd} />
        </linearGradient>
      </defs>

      {ticks.map((tick) => {
        const y = padding.top + chartHeight - (tick / maxTick) * chartHeight;
        return (
          <g key={`tick-${tick}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke="var(--surface-on-media-40)"
              strokeDasharray="4 5"
            />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-text-muted text-[10px]">
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
        stroke="var(--surface-on-media-40)"
      />

      {previousLinePoints.length > 1 ? (
        <path d={previousPath} fill="none" stroke={theme.line} strokeWidth="2.5" strokeDasharray="6 6" />
      ) : null}

      {previousLinePoints.map((point, index) => (
        <circle key={`previous-${index}`} cx={point.x} cy={point.y} r="2.5" fill={theme.line} opacity="0.85" />
      ))}

      {currentPoints.map((point, index) => {
        const xCenter = padding.left + step * index + step / 2;
        const barHeight = (point.value / maxTick) * chartHeight;
        const x = xCenter - barWidth / 2;
        const y = padding.top + chartHeight - barHeight;
        const previousValue = previousPoints[index]?.value ?? 0;

        return (
          <g key={`${point.label}-${index}`}>
            <title>{`${point.label} | Current: ${tooltipFormatter(point.value)} | Previous: ${tooltipFormatter(previousValue)}`}</title>
            <rect x={x} y={y} width={barWidth} height={Math.max(1, barHeight)} rx={4} fill={`url(#${gradientId})`} opacity="0.95" />
            {(index === 0 || index === currentPoints.length - 1 || index % labelEvery === 0) && (
              <text x={xCenter} y={height - 12} textAnchor="middle" className="fill-text-muted text-[10px]">
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function FunnelVisual({ steps }: { steps: FunnelStep[] }) {
  const lastStep = steps[steps.length - 1];

  if (!steps.length) {
    return <EmptyStateCard>No funnel data available yet.</EmptyStateCard>;
  }

  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">True funnel</p>
          <p className="mt-1 text-sm text-text-secondary">
            Card widths reflect share of total signups. Connector labels show step conversion between stages.
          </p>
        </div>
        <div className="rounded-xl border border-surface-on-media-40 bg-surface/70 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">End-to-end</p>
          <p className="mt-1 text-lg font-semibold text-text-primary">{formatPercent(lastStep.shareOfStart)}</p>
          <p className="text-xs text-text-secondary">Signup → first render within 30d</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
        {steps.map((step, index) => (
          <Fragment key={step.label}>
            <FunnelStepCard step={step} index={index} />
            {index < steps.length - 1 ? <FunnelConnector label={formatPercent(steps[index + 1].conversionFromPrevious ?? 0)} /> : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function FunnelStepCard({ step, index }: { step: FunnelStep; index: number }) {
  const widthPercent = step.value > 0 ? Math.max(8, step.shareOfStart * 100) : 0;
  const style: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${step.accentStart}, ${step.accentEnd})`,
    width: `${Math.min(100, widthPercent)}%`,
  };

  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">Stage {index + 1}</span>
        <span className="text-[11px] text-text-secondary">{formatPercent(step.shareOfStart)} of signups</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-text-primary">{step.label}</p>
      <p className="mt-2 text-3xl font-semibold text-text-primary">{formatNumber(step.value)}</p>
      <p className="mt-2 text-xs leading-5 text-text-secondary">{step.helper}</p>
      <div className="mt-4 h-2.5 w-full rounded-full bg-surface-glass-60">
        <div className="h-2.5 rounded-full" style={style} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
        <span>{formatPercent(step.shareOfStart)} of stage 1</span>
        <span>{step.conversionFromPrevious == null ? 'Baseline' : `${formatPercent(step.conversionFromPrevious)} step conversion`}</span>
      </div>
    </div>
  );
}

function FunnelConnector({ label }: { label: string }) {
  return (
    <div className="hidden xl:flex flex-col items-center justify-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">
      <span>{label}</span>
      <div className="h-px w-10 bg-surface-on-media-40" />
    </div>
  );
}

function RecentGrowthTable({ rows }: { rows: GrowthTableRow[] }) {
  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Latest daily activity</p>
          <p className="mt-1 text-sm text-text-secondary">Last 7 calendar days from the current window only.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 font-semibold">Signups</th>
              <th className="py-2 font-semibold">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-surface-on-media-40 text-text-secondary">
                <td className="py-2.5">{formatDay(row.date)}</td>
                <td className="py-2.5 font-semibold text-text-primary">{formatNumber(row.signups)}</td>
                <td className="py-2.5 font-semibold text-text-primary">{formatNumber(row.active)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentRevenueTable({ rows }: { rows: RevenueTableRow[] }) {
  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Latest money days</p>
          <p className="mt-1 text-sm text-text-secondary">Current-window daily cash-in and usage, without monthly mixing.</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 font-semibold">Top-ups</th>
              <th className="py-2 font-semibold">Loads</th>
              <th className="py-2 font-semibold">Charges</th>
              <th className="py-2 font-semibold">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date} className="border-t border-surface-on-media-40 text-text-secondary">
                <td className="py-2.5">{formatDay(row.date)}</td>
                <td className="py-2.5 font-semibold text-text-primary">{formatCurrency(row.topupsUsd)}</td>
                <td className="py-2.5">{formatNumber(row.topupCount)}</td>
                <td className="py-2.5 font-semibold text-text-primary">{formatCurrency(row.chargesUsd)}</td>
                <td className="py-2.5">{formatNumber(row.chargeCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EngineUsageCard({ engine }: { engine: AdminMetrics['engines'][number] }) {
  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">{engine.engineLabel}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {formatNumber(engine.distinctUsers30d)} users · {formatCurrency(engine.avgSpendPerUser30d, { precise: true })} avg spend / user
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-text-primary">{formatCurrency(engine.rendersAmount30dUsd)}</p>
          <p className="mt-1 text-xs text-text-muted">{formatNumber(engine.rendersCount30d)} renders</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-secondary">
            <span>Render share</span>
            <span>{formatPercent(engine.shareOfTotalRenders30d)}</span>
          </div>
          <ShareBar value={engine.shareOfTotalRenders30d} label={formatPercent(engine.shareOfTotalRenders30d)} hideLabel />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-text-secondary">
            <span>Revenue share</span>
            <span>{formatPercent(engine.shareOfTotalRevenue30d)}</span>
          </div>
          <ShareBar value={engine.shareOfTotalRevenue30d} label={formatPercent(engine.shareOfTotalRevenue30d)} hideLabel />
        </div>
      </div>
    </div>
  );
}

function ShareBar({ value, label, hideLabel = false }: { value: number; label: string; hideLabel?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full rounded-full bg-surface-glass-60">
        <div className="h-2 rounded-full bg-text-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
      {!hideLabel ? <span className="text-xs text-text-secondary">{label}</span> : null}
    </div>
  );
}

function TopSpendersPanel({ whales }: { whales: AdminMetrics['behavior']['whalesTop10'] }) {
  return (
    <div className="rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Top spenders</p>
          <p className="mt-1 text-sm text-text-secondary">Direct links into admin users make this list immediately actionable.</p>
        </div>
      </div>
      {whales.length ? (
        <div className="mt-4 space-y-2">
          {whales.map((whale) => (
            <Link
              key={whale.userId}
              href={`/admin/users/${whale.userId}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-surface-on-media-40 bg-surface/70 px-3 py-3 transition hover:border-surface-on-media-60 hover:bg-surface"
            >
              <div>
                <p className="text-sm font-semibold text-text-primary">{whale.identifier}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  Last active {formatFullDate(whale.lastActiveAt)} · First seen {formatFullDate(whale.firstSeenAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{formatCurrency(whale.lifetimeTopupUsd)}</p>
                  <p className="text-[11px] text-text-muted">lifetime top-ups</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{formatNumber(whale.renderCount)}</p>
                  <p className="text-[11px] text-text-muted">renders</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyStateCard className="mt-4">No paying users yet.</EmptyStateCard>
      )}
    </div>
  );
}

function EmptyStateCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-surface-on-media-40 bg-surface-glass-70 p-4 text-sm text-text-secondary ${className}`}>
      {children}
    </div>
  );
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

function buildRecentGrowthRows(metrics: AdminMetrics): GrowthTableRow[] {
  const activeMap = new Map(metrics.timeseries.activeAccountsDaily.map((point) => [point.date.slice(0, 10), point.value]));
  return metrics.timeseries.signupsDaily
    .slice(-7)
    .map((point) => ({
      date: point.date,
      signups: point.value,
      active: activeMap.get(point.date.slice(0, 10)) ?? 0,
    }))
    .reverse();
}

function buildRecentRevenueRows(metrics: AdminMetrics): RevenueTableRow[] {
  const chargeMap = new Map(metrics.timeseries.chargesDaily.map((point) => [point.date.slice(0, 10), point]));
  return metrics.timeseries.topupsDaily
    .slice(-7)
    .map((point) => {
      const chargePoint = chargeMap.get(point.date.slice(0, 10));
      return {
        date: point.date,
        topupsUsd: point.amountCents / 100,
        topupCount: point.count,
        chargesUsd: (chargePoint?.amountCents ?? 0) / 100,
        chargeCount: chargePoint?.count ?? 0,
      };
    })
    .reverse();
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
      accentStart: '#b7d6ff',
      accentEnd: 'var(--info)',
    },
    {
      label: 'Loaded wallet',
      value: metrics.funnels.totalTopupUsers,
      helper: 'At least one wallet top-up recorded',
      accentStart: '#ffe199',
      accentEnd: 'var(--accent)',
    },
    {
      label: 'First render within 30d',
      value: metrics.funnels.convertedWithin30dUsers,
      helper: 'Reached first completed render within 30 days of first top-up',
      accentStart: '#ffc2af',
      accentEnd: 'var(--chart-charges)',
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

function buildInsightsHref({ range, excludeAdmin }: { range: MetricsRangeLabel; excludeAdmin: boolean }) {
  const params = new URLSearchParams();
  params.set('range', range);
  params.set('excludeAdmin', excludeAdmin ? '1' : '0');
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
