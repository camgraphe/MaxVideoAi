import { notFound } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminMetricsComparison } from '@/server/admin-metrics';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { requireAdmin } from '@/server/admin';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '@/lib/admin/exclusions';
import type { ChartGranularity, PageProps } from './_lib/insights-types';
import {
  buildBehaviorStats,
  buildFocusMetricData,
  buildFunnelSteps,
  buildMonthlyRows,
  buildPrioritySignals,
  buildRecentLedgerRows,
  buildRevenueBoardRows,
} from './_lib/insights-helpers';
import {
  describeRange,
  resolveComparison,
  resolveCustomDays,
  resolveFocusParam,
  resolveGranularity,
} from './_lib/insights-navigation';
import {
  BehaviorGrid,
  DailyLedgerTable,
  EngineMixTable,
  FunnelRows,
  HealthPanel,
  InsightsControls,
  MetricFocusTabs,
  MonthlyRollupTable,
  PrioritySignalPanel,
  RevenueBoardTable,
  TopSpendersTable,
} from './_components/InsightsPanels';
import { ComparisonChart } from './_components/InsightsChartSurfaces';
import { InsightsTrendSummary } from './_components/InsightsTrendSummary';

export default async function AdminInsightsPage(props: PageProps) {
  const searchParams = await props.searchParams;
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/insights] access denied', error);
    notFound();
  }

  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const focus = resolveFocusParam(searchParams?.focus);
  const customDays = resolveCustomDays(searchParams?.days);
  const compare = resolveComparison(searchParams?.compare);
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
    excludeManualAdminTopups: excludeAdmin,
    customDays,
  };

  const [metrics, comparison] = await Promise.all([
    fetchAdminMetrics(searchParams?.range, queryOptions),
    fetchAdminMetricsComparison(searchParams?.range, queryOptions),
  ]);

  const granularity: ChartGranularity = metrics.range.days >= 14 ? resolveGranularity(searchParams?.grain) : 'daily';
  const humanRange = describeRange(metrics.range.label, metrics.range.days);
  const focusMetric = buildFocusMetricData(focus, metrics, comparison, humanRange);
  const revenueBoardRows = buildRevenueBoardRows(comparison);
  const prioritySignals = buildPrioritySignals(metrics, comparison, humanRange);
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
        title="Insights"
        description={excludeAdmin
          ? 'Customer activity excludes Camgraph Admin and manually granted wallet credits.'
          : 'Wallet activity and generation usage, including internal activity.'}
      />

      <InsightsControls
        current={metrics.range.label}
        days={metrics.range.days}
        excludeAdmin={excludeAdmin}
        focus={focus}
        grain={granularity}
        compare={compare}
      />

      <section aria-labelledby="insights-trend-heading" className="min-w-0">
        <h2 id="insights-trend-heading" className="sr-only">Activity over time</h2>
        <InsightsTrendSummary metric={focusMetric} humanRange={humanRange} showComparison={compare} />
        <div className="mt-4 min-w-0">
          <ComparisonChart
            ariaLabel={`${focusMetric.label} over the last ${humanRange}`}
            theme={focusMetric.theme}
            valueKind={focusMetric.valueKind}
            granularity={granularity}
            showComparison={compare}
            currentPoints={focusMetric.currentPoints}
            previousPoints={focusMetric.previousPoints}
            currentDayKey={metrics.range.to.slice(0, 10)}
            tabs={<MetricFocusTabs
              current={focus}
              range={metrics.range.label}
              days={metrics.range.days}
              excludeAdmin={excludeAdmin}
              grain={granularity}
              compare={compare}
            />}
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {focusMetric.description}
          {granularity === 'weekly' ? ` Seven-day totals align to the latest day.${metrics.range.days % 7 ? ` The first bucket covers ${metrics.range.days % 7} days.` : ''}` : ''}
          {' '}The latest bucket includes today in progress and appears as an open point.
        </p>
      </section>

      <AdminSection
        title="Revenue & activation"
        description="Key commercial measures and operational signals for the selected period."
        contentClassName="pt-0"
      >
        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(270px,0.85fr)]">
          <RevenueBoardTable rows={revenueBoardRows.slice(0, 4)} compact />
          <PrioritySignalPanel signals={prioritySignals} humanRange={humanRange} />
        </div>
      </AdminSection>

      <details className="group border-t border-hairline pt-4">
        <summary className="cursor-pointer text-base font-semibold text-text-primary">More revenue and activation detail</summary>
        <p className="mt-1 text-sm text-text-secondary">Refunds, spend, conversion and top paying accounts.</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-5">
            <RevenueBoardTable rows={revenueBoardRows.slice(4)} />
            <FunnelRows steps={funnelSteps} />
            <BehaviorGrid stats={behaviorStats} />
          </div>
          <TopSpendersTable whales={metrics.behavior.whalesTop10} />
        </div>
      </details>

      <details className="group border-t border-hairline pt-4">
        <summary className="cursor-pointer text-base font-semibold text-text-primary">Engine demand and reliability</summary>
        <p className="mt-1 text-sm text-text-secondary">Model demand and unresolved generation failures. Reliability uses the last 30 days.</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <EngineMixTable engines={featuredEngines} />
          <HealthPanel
            failedRenders={metrics.health.failedRenders30d}
            failureRate={metrics.health.failedRendersRate30d}
            flaggedRows={flaggedHealthRows}
            metrics={metrics}
          />
        </div>
      </details>

      <details className="group border-t border-hairline pt-4">
        <summary className="cursor-pointer text-base font-semibold text-text-primary">Daily ledger and monthly totals</summary>
        <p className="mt-1 text-sm text-text-secondary">Recent daily activity and six-month totals, shown separately.</p>
        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <DailyLedgerTable rows={dailyLedgerRows} />
          <MonthlyRollupTable rows={monthlyRows} />
        </div>
      </details>
    </div>
  );
}
