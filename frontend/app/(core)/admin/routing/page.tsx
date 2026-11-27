import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { requireAdmin } from '@/server/admin';
import { apimartCanaryAvailable } from '@/server/video-providers/apimart/wan-prime';
import { recentRoutingJobs } from './_lib/routing-data';
import { routingScenarios } from './_lib/routing-scenarios';
import { RouteSimulator } from './_components/RouteSimulator.client';
import { installedRoutes } from './_lib/installed-routes';
import { RoutingHistory } from './_components/RoutingHistory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Video routing · Admin' };

export default async function AdminVideoRoutingPage({ searchParams }: { searchParams: Promise<{ engine?: string }> }) {
  // The layout owns the redirect. Gate data access independently during parallel rendering.
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  const [jobs, params] = await Promise.all([recentRoutingJobs().catch(() => null), searchParams]);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Generations"
        title="Video routing"
        description="Compare supplier costs, rehearse a fallback and inspect the actual attempts for a generation."
      />
      <RouteSimulator initialEngine={params.engine} scenarios={routingScenarios()} routes={installedRoutes()} />
      <p className="text-sm text-text-secondary">
        {apimartCanaryAvailable()
          ? 'APIMart preproduction canary is configured for eligible admin requests on the Alibaba route.'
          : 'APIMart is available here for price simulation. The submission canary is off.'}
      </p>
      <RoutingHistory jobs={jobs} />
    </div>
  );
}
