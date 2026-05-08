import { fetchAdminHealth, fetchAdminMetrics } from '@/server/admin-metrics';
import { ADMIN_EXCLUDED_USER_IDS, resolveExcludeAdminParam } from '@/lib/admin/exclusions';
import { AdminDashboardView } from './_components/AdminDashboardView';
import {
  buildActivityItems,
  buildEngineRows,
  buildIncidentRows,
  buildKpiCards,
  buildQueueRows,
  buildRangeStats,
  buildSystemRows,
  buildUtilizationScore,
  resolveHubRange,
  type PageProps,
} from './_lib/admin-dashboard-helpers';

export const dynamic = 'force-dynamic';

export default async function AdminIndexPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const selectedRange = resolveHubRange(searchParams?.range);
  const excludeAdmin = resolveExcludeAdminParam(searchParams?.excludeAdmin);
  const queryOptions = {
    excludeUserIds: excludeAdmin ? ADMIN_EXCLUDED_USER_IDS : [],
  };
  const [metrics, health] = await Promise.all([fetchAdminMetrics(selectedRange, queryOptions), fetchAdminHealth()]);
  const topEngines = metrics.engines.slice(0, 5);

  return (
    <AdminDashboardView
      selectedRange={selectedRange}
      excludeAdmin={excludeAdmin}
      monthlyStats={buildRangeStats(metrics, selectedRange)}
      kpis={buildKpiCards(metrics, health, selectedRange)}
      systemRows={buildSystemRows(health, metrics)}
      incidents={buildIncidentRows(health, metrics, selectedRange)}
      queueRows={buildQueueRows(health)}
      activity={buildActivityItems(metrics, health)}
      engineRows={buildEngineRows(topEngines)}
      utilizationScore={buildUtilizationScore(metrics)}
    />
  );
}
