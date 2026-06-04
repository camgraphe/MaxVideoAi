import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchAdminAuditLogs } from '@/server/admin-audit';
import { fetchInfraCostsReport, INFRA_COST_ALERT_ACTION } from '@/server/infra-costs';
import { AdminInfraCostsView } from './_components/AdminInfraCostsView';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminInfraCostsPage() {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/infra-costs] access denied', error);
    notFound();
  }

  const [report, auditLogs] = await Promise.all([
    fetchInfraCostsReport(),
    fetchAdminAuditLogs({ limit: 8, action: INFRA_COST_ALERT_ACTION }),
  ]);

  return <AdminInfraCostsView report={report} auditLogs={auditLogs} />;
}
