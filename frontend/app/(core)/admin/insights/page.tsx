import { notFound } from 'next/navigation';
import { fetchAdminMetrics, fetchAdminMetricsComparison } from '@/server/admin-metrics';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminShortcutRail } from '@/components/admin-system/surfaces/AdminShortcutRail';
import { requireAdmin } from '@/server/admin';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '@/lib/admin/exclusions';
import type { PageProps } from './_lib/insights-types';
import {
  buildBehaviorStats,
  buildExecutiveMetrics,
  buildFocusMetricData,
  buildFunnelSteps,
  buildInsightsRailItems,
  buildMonthlyRows,
  buildPrioritySignals,
  buildPulseCards,
  buildQuickInsights,
  buildRecentLedgerRows,
  buildRevenueBoardRows,
} from './_lib/insights-helpers';
import { describeRange, resolveFocusParam } from './_lib/insights-navigation';
import {
  BehaviorGrid,
  ComparisonChart,
  DailyLedgerTable,
  EngineMixTable,
  FunnelRows,
  HealthPanel,
  InsightsControls,
  MetricFocusTabs,
  MetricSnapshotPanel,
  MonthlyRollupTable,
  NarrativePanel,
  PrioritySignalPanel,
  RevenueBoardTable,
  StatStrip,
  TopSpendersTable,
  WindowPulseGrid,
} from './_components/InsightsPanels';

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
  const executiveMetrics = buildExecutiveMetrics(metrics, comparison, humanRange);
  const pulseCards = buildPulseCards(metrics, comparison);
  const quickInsights = buildQuickInsights(metrics, comparison);
  const prioritySignals = buildPrioritySignals(metrics, comparison, humanRange);
  const navigationRailItems = buildInsightsRailItems(metrics, comparison, excludeAdmin, focus);
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
        title="Workspace insights"
        description="Surface de décision pour lire acquisition, cash-in, usage et fiabilité dans un seul workspace opérateur."
        actions={<InsightsControls current={metrics.range.label} excludeAdmin={excludeAdmin} focus={focus} />}
      />

      <AdminSection
        title="Executive Summary"
        description={`Lecture de base pour ${humanRange}, organisée comme une console de décision plutôt qu’un mur de widgets.`}
        contentClassName="p-0"
      >
        <div className="grid xl:items-start xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="border-b border-hairline xl:border-b-0 xl:border-r">
            <div className="border-b border-hairline px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Command deck</p>
              <p className="mt-1 text-sm text-text-secondary">Acquisition, monetization, activation and reliability compressed into one first read.</p>
            </div>
            <AdminMetricGrid
              items={executiveMetrics}
              density="compact"
              columnsClassName="sm:grid-cols-2 xl:grid-cols-3"
              className="rounded-none border-0"
            />
            <div className="border-t border-hairline px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Navigate</p>
              <p className="mt-1 text-sm text-text-secondary">Raccourcis vers les surfaces à ouvrir juste après la lecture du board.</p>
              <AdminShortcutRail items={navigationRailItems} className="mt-3" />
            </div>
          </div>
          <PrioritySignalPanel signals={prioritySignals} humanRange={humanRange} />
        </div>
      </AdminSection>

      <AdminSection
        title="Trend Workspace"
        description="Un seul indicateur directeur à la fois, avec comparaison explicite et contexte de lecture à droite."
        action={<MetricFocusTabs current={focus} range={metrics.range.label} excludeAdmin={excludeAdmin} />}
      >
        <div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.75fr)_320px]">
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
            <WindowPulseGrid cards={pulseCards} humanRange={humanRange} className="mt-5" />
          </div>

          <div className="space-y-4 xl:border-l xl:border-hairline xl:pl-6">
            <MetricSnapshotPanel title={`${focusMetric.label} scorecard`} items={focusMetric.stats} />
            <NarrativePanel title="Operator brief" lines={quickInsights} />
          </div>
        </div>
      </AdminSection>

      <AdminSection
        title="Revenue & Activation"
        description="Valeur créée dans la fenêtre, vitesse d’activation et lecture des comptes qui concentrent le plus de spend."
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
        description="Concentration du revenu moteur à gauche, backlog de fiabilité et signaux de risque à droite."
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
        description="Derniers jours et rollup mensuel gardés en lecture table-first, sans mélange de granularités."
      >
        <div className="grid gap-6 xl:items-start xl:grid-cols-[minmax(0,1.4fr)_360px]">
          <DailyLedgerTable rows={dailyLedgerRows} />
          <MonthlyRollupTable rows={monthlyRows} />
        </div>
      </AdminSection>
    </div>
  );
}
