import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { loadAdminMcpMetrics } from '@/server/admin-mcp-metrics';
import { AdminMcpView } from './_components/AdminMcpView';
import { resolveAdminMcpRange } from './_lib/admin-mcp-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AdminMcpPageProps = {
  searchParams: Promise<{ range?: string | string[] }>;
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
  const metrics = await loadAdminMcpMetrics(range.query);

  return <AdminMcpView metrics={metrics} selectedRange={range.label} />;
}
