import { klingV4VideoRouterEnabled } from '@/server/video-providers/videorouter/kling-v4';
import { minimaxH3VideoRouterEnabled } from '@/server/video-providers/videorouter/minimax-h3';
import Link from 'next/link';
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

export default async function AdminVideoRoutingPage({ searchParams }: { searchParams: Promise<{ engine?: string; replay?: string; view?: string }> }) {
  // The layout owns the redirect. Gate data access independently during parallel rendering.
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  const [jobs, params] = await Promise.all([recentRoutingJobs().catch(() => null), searchParams]);
  const pilotLabels = {
    'alibaba-fal': 'Alibaba pilot · Fal backup when enabled',
    'with-videorouter': 'BotSmart on eligible Wan profiles · Alibaba backup',
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
      <Link href="/admin/routing/summary" prefetch={false} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-hairline bg-surface px-5 py-3 hover:bg-surface-2">
        <span className="font-semibold">Routing economics →</span>
        <span className="text-sm text-text-secondary">Average cost, savings and accounting exports</span>
      </Link>
      <RoutingWorkspace initialReplay={params.view === 'replay'} initialEngine={params.engine} scenarios={routingScenarios()} routes={installedRoutes()} />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary" aria-label="Admin purchase pilot settings">
        {([['wan-3', 'Wan Standard'], ['wan-3-prime', 'Wan Prime']] as const).map(([engine, label]) => (
          <span key={engine}><strong>{label}</strong> · {pilotLabels[configuredWanPurchaseCanary(engine) ?? 'shadow']}</span>
        ))}
        <span><strong>Kling V4</strong> · {klingV4VideoRouterEnabled()
          ? 'SandBase for three reference images · fal backup' : 'fal direct'}</span>
        <span><strong>MiniMax H3</strong> · {minimaxH3VideoRouterEnabled()
          ? 'WaveSpeed for the qualified two-image profile · Fal backup' : 'Fal direct'}</span>
      </div>
      <WanReplay requested={params.replay === 'wan-prime'} />
      <RoutingHistory jobs={jobs} />
    </div>
  );
}
