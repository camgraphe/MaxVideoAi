import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { loadAdminMcpOutcomes } from '@/server/admin-mcp-outcomes';
import { loadAdminMcpMetrics } from '@/server/admin-mcp-metrics';
import { AdminMcpView } from './_components/AdminMcpView';
import { McpTrialControls } from './_components/McpTrialControls';
import { resolveAdminMcpRange } from './_lib/admin-mcp-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AdminMcpPageProps = {
  searchParams: Promise<{
    range?: string | string[];
    trialUserId?: string | string[];
  }>;
};

export default async function AdminMcpPage({ searchParams }: AdminMcpPageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/mcp] access denied', error);
    notFound();
  }

  const params = await searchParams;
  const range = resolveAdminMcpRange(params.range);
  const [metrics, outcomes] = await Promise.all([
    loadAdminMcpMetrics(range.query),
    loadAdminMcpOutcomes(range.query),
  ]);
  const trialUserId = typeof params.trialUserId === 'string'
    ? params.trialUserId.trim() || null
    : null;

  return (
    <>
      <AdminMcpView outcomes={outcomes} metrics={metrics} selectedRange={range.label} />
      <McpTrialControls inspectionUserId={trialUserId} />
    </>
  );
}
