import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { requireAdmin } from '@/server/admin';
import { apimartCanaryAvailable } from '@/server/video-providers/apimart/wan-prime';
import { recentRoutingJobs, routingScenarios } from './_lib/routing-data';
import { RouteSimulator } from './_components/RouteSimulator.client';
import { installedRoutes } from './_lib/installed-routes';
import { RoutingHistory } from './_components/RoutingHistory';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Video routing · Admin' };

export default async function AdminVideoRoutingPage() {
  // The layout owns the redirect. Gate data access independently during parallel rendering.
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  const jobs = await recentRoutingJobs().catch(() => null);
  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Generations"
        title="Video routing"
        description="Compare supplier costs, rehearse a fallback and inspect the actual attempts for a generation."
      />
      <AdminSection
        title="Route simulator"
        description="Simulation only. Changes here never submit a render or change routing settings."
      >
        <RouteSimulator scenarios={routingScenarios()} />
      </AdminSection>
      <p className="text-sm text-text-secondary">
        {apimartCanaryAvailable()
          ? 'APIMart preproduction canary is configured for eligible admin requests on the Alibaba route.'
          : 'APIMart is available here for price simulation. The submission canary is off.'}
      </p>
      <RoutingHistory jobs={jobs} />
      <AdminSection
        title="Existing provider paths"
        description="Configured public routing for representative catalog requests in this environment. Availability at the supplier is checked when submitting."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                {['Integration', 'Engine / mode', 'Configured route'].map((h) => (
                  <th key={h} className="p-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {installedRoutes().map((row) => (
                <tr key={row.provider} className="border-t border-hairline">
                  <td className="p-2">{row.provider}</td>
                  <td className="p-2">
                    {row.engineId} · {row.mode}
                  </td>
                  <td className="p-2">{row.preference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSection>
    </div>
  );
}
