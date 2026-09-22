import type { TransactionAnomalies } from '@/server/admin-transactions';
import { AdminTransactionTable } from '@/components/admin/TransactionTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { fetchAdminTransactions, fetchTransactionAnomalies } from '@/server/admin-transactions';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('en-US');
export default async function AdminTransactionsPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          eyebrow="Finance Ops"
          title="Transactions"
          description="Wallet credits, generation charges and refunds."
        />
        <AdminSection title="Transaction Workspace" description="Transaction data is unavailable.">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable transaction
            reporting.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const [transactions, anomalies] = await Promise.all([fetchAdminTransactions(100), fetchTransactionAnomalies()]);
  const anomalySummary = buildAnomalySummary(anomalies);
  return <div className="space-y-5">
    <AdminPageHeader title="Transactions" description="Wallet credits, generation charges and refunds." actions={<AdminActionLink href="/admin/checkout-report">Checkout review</AdminActionLink>} />
    {anomalySummary ? <AdminNotice tone="warning">{anomalySummary}</AdminNotice> : null}
    <AdminTransactionTable initialTransactions={transactions} />
  </div>;
}

function buildAnomalySummary(anomalies: TransactionAnomalies) {
  const parts: string[] = [];

  if (anomalies.frequentRefundUsers.length) {
    parts.push(`${numberFormatter.format(anomalies.frequentRefundUsers.length)} refund-heavy user${anomalies.frequentRefundUsers.length > 1 ? 's' : ''} over 30d`);
  }
  if (anomalies.largeRefunds.length) {
    parts.push(`${numberFormatter.format(anomalies.largeRefunds.length)} refund${anomalies.largeRefunds.length > 1 ? 's' : ''} above $500`);
  }
  if (anomalies.invalidCharges.length) {
    parts.push(`${numberFormatter.format(anomalies.invalidCharges.length)} invalid charge${anomalies.invalidCharges.length > 1 ? 's' : ''}`);
  }

  if (!parts.length) return null;
  return `Anomaly scan: ${parts.join(' · ')}.`;
}
