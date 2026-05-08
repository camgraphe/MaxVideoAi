import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchAdminAuditLogs } from '@/server/admin-audit';
import { AdminAuditDatabaseNotice, AdminAuditView } from './_components/AdminAuditView';
import { normalizeFilters, type SearchParamValue } from './_lib/admin-audit-helpers';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    action?: SearchParamValue;
    adminId?: SearchParamValue;
    targetUserId?: SearchParamValue;
  }>;
};

export default async function AdminAuditLogPage(props: PageProps) {
  const searchParams = await props.searchParams;
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/audit] access denied', error);
    notFound();
  }

  const filters = normalizeFilters(searchParams);

  if (!process.env.DATABASE_URL) {
    return <AdminAuditDatabaseNotice />;
  }

  const logs = await fetchAdminAuditLogs({
    limit: 150,
    action: filters.action || null,
    adminId: filters.adminId || null,
    targetUserId: filters.targetUserId || null,
  });

  return (
    <AdminAuditView
      filters={filters}
      logs={logs}
      serviceRoleMissing={!process.env.SUPABASE_SERVICE_ROLE_KEY}
    />
  );
}
