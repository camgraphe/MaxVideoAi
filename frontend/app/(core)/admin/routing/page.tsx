import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { requireAdmin } from '@/server/admin';
import { configuredWanPurchaseCanary } from '@/server/video-providers/router';
import { recentRoutingJobs } from './_lib/routing-data';
import { routingScenarios } from './_lib/routing-scenarios';
import { RoutingWorkspace } from './_components/RoutingWorkspace.client';
import { installedRoutes } from './_lib/installed-routes';
import { WanReplay } from './_components/WanReplay';
import { RoutingHistory } from './_components/RoutingHistory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Video routing · Admin' };

export default async function AdminVideoRoutingPage({ searchParams }: { searchParams: Promise<{ engine?: string; replay?: string }> }) {
  // The layout owns the redirect. Gate data access independently during parallel rendering.
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  const [jobs, params] = await Promise.all([recentRoutingJobs().catch(() => null), searchParams]);
  const pilotLabels = {
    'alibaba-fal': 'Alibaba pilot · Fal backup when enabled',
    'with-apimart': 'APIMart pilot · installed suppliers eligible for fallback',
    shadow: 'Price simulation only',
  };
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Generations"
        title="Video routing"
        description="Compare supplier costs, rehearse a fallback and inspect the actual attempts for a generation."
      />
      <RoutingWorkspace initialEngine={params.engine} scenarios={routingScenarios()} routes={installedRoutes()} />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary" aria-label="Admin purchase pilot settings">
        {([['wan-3', 'Wan Standard'], ['wan-3-prime', 'Wan Prime']] as const).map(([engine, label]) => (
          <span key={engine}><strong>{label}</strong> · {pilotLabels[configuredWanPurchaseCanary(engine) ?? 'shadow']}</span>
        ))}
      </div>
      <WanReplay requested={params.replay === 'wan-prime'} />
      <RoutingHistory jobs={jobs} />
    </div>
  );
}
