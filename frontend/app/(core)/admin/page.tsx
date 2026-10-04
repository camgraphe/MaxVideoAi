import { fetchAdminOverview } from '@/server/admin-overview';
import { requireAdmin } from '@/server/admin';
import { resolveExcludeAdminParam } from '@/lib/admin/exclusions';
import { AdminDashboardView } from './_components/AdminDashboardView';

export const dynamic = 'force-dynamic';

export default async function AdminIndexPage({ searchParams }: { searchParams?: Promise<{ range?: string; excludeAdmin?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const data = await fetchAdminOverview(params?.range, resolveExcludeAdminParam(params?.excludeAdmin));
  return <AdminDashboardView data={data} />;
}
