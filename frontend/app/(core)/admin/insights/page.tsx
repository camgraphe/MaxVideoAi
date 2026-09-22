import { notFound } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminMetricsComparison } from '@/server/admin-metrics';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { requireAdmin } from '@/server/admin';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '@/lib/admin/exclusions';
import type { PageProps } from './_lib/insights-types';
import {
  buildBehaviorStats,
  buildFocusMetricData,
  buildFunnelSteps,
  buildMonthlyRows,
  buildRecentLedgerRows,
  buildRevenueBoardRows,
} from './_lib/insights-helpers';
import { describeRange, resolveFocusParam } from './_lib/insights-navigation';
import {
  BehaviorGrid,
  DailyLedgerTable,
  EngineMixTable,
  FunnelRows,
  HealthPanel,
  InsightsControls,
  MetricFocusTabs,
  MonthlyRollupTable,
  RevenueBoardTable,
  StatStrip,
  TopSpendersTable,
} from './_components/InsightsPanels';
import { ComparisonChart } from './_components/InsightsChartSurfaces';

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
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  };

  const [metrics, comparison] = await Promise.all([
    fetchAdminMetrics(searchParams?.range, queryOptions),
    fetchAdminMetricsComparison(searchParams?.range, queryOptions),
  ]);

  const humanRange = describeRange(metrics.range.label);
  const focusMetric = buildFocusMetricData(focus, metrics, comparison, humanRange);
  const revenueBoardRows = buildRevenueBoardRows(comparison);
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
        title="Trends"
        description="Compare acquisition, wallet activity and generation usage over time."
        actions={<InsightsControls current={metrics.range.label} excludeAdmin={excludeAdmin} focus={focus} />}
      />

      <AdminSection
        title="Activity over time"
        description={`Current ${humanRange} compared with the previous period.`}
        action={<MetricFocusTabs current={focus} range={metrics.range.label} excludeAdmin={excludeAdmin} />}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{focusMetric.label}</h2>
            <p className="mt-1 text-sm text-text-secondary">{focusMetric.description}</p>
          </div>
          <p className="text-xs text-text-secondary">Current bars · Previous dashed line</p>
        </div>
        <StatStrip items={focusMetric.stats} className="mt-4" />
        <div className="mt-5 min-w-0">
          <ComparisonChart
            ariaLabel={`${focusMetric.label} comparison`}
            theme={focusMetric.theme}
            axisFormatter={focusMetric.axisFormatter}
            tooltipFormatter={focusMetric.tooltipFormatter}
            currentPoints={focusMetric.currentPoints}
            previousPoints={focusMetric.previousPoints}
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Revenue & Activation"
        description="Compare wallet activity, account activation and top spenders."
      >
        <div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div className="space-y-5">
            <RevenueBoardTable rows={revenueBoardRows} />
            <FunnelRows steps={funnelSteps} />
            <BehaviorGrid stats={behaviorStats} />
          </div>
          <TopSpendersTable whales={metrics.behavior.whalesTop10} />
        </div>
      </AdminSection>

      <AdminSection
        title="Risk & Demand"
        description="Model demand and generation failures. Reliability measures use the last 30 days."
      >
        <div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <EngineMixTable engines={featuredEngines} />
          <HealthPanel
            failedRenders={metrics.health.failedRenders30d}
            failureRate={metrics.health.failedRendersRate30d}
            flaggedRows={flaggedHealthRows}
            metrics={metrics}
          />
        </div>
      </AdminSection>

      <AdminSection
        title="Daily Ledger"
        description="Daily activity and monthly totals, shown separately."
      >
        <div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <DailyLedgerTable rows={dailyLedgerRows} />
          <MonthlyRollupTable rows={monthlyRows} />
        </div>
      </AdminSection>
    </div>
  );
}
