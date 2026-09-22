import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchTransactionHistory, fetchTransactionReceipt } from '@/server/admin-transactions/history';
import { parseTransactionHistoryParams } from '@/lib/admin/transaction-history';
import type { TransactionAnomalies } from '@/server/admin-transactions';
import { AdminTransactionTable } from '@/components/admin/TransactionTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { fetchTransactionAnomalies } from '@/server/admin-transactions';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('en-US');
export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch {
    notFound();
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.set(key, value);
  }
  let filters;
  try {
    filters = parseTransactionHistoryParams(params);
  } catch {
    return (
      <AdminNotice tone="warning">
        Invalid history filters. <Link href="/admin/transactions">Reset filters</Link>
      </AdminNotice>
    );
  }

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
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable
            transaction reporting.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const receipt = params.get('receipt');
  let history, initialReceipt, anomalies;
  try {
    [history, initialReceipt, anomalies] = await Promise.all([
      fetchTransactionHistory(filters),
      receipt ? fetchTransactionReceipt(receipt) : Promise.resolve(null),
      fetchTransactionAnomalies(),
    ]);
  } catch (error) {
    console.error('[admin/transactions] history unavailable', error);
    return (
      <AdminNotice tone="warning">
        Transaction history could not be loaded. <Link href="/admin/transactions">Retry from the first page</Link>
      </AdminNotice>
    );
  }
  const anomalySummary = buildAnomalySummary(anomalies);
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Transactions"
        description="Wallet credits, generation charges and refunds."
        actions={<AdminActionLink href="/admin/checkout-report">Checkout review</AdminActionLink>}
      />
      {anomalySummary ? <AdminNotice tone="warning">{anomalySummary}</AdminNotice> : null}
      <AdminTransactionTable
        key={params.toString()}
        initialTransactions={history.transactions}
        filters={filters}
        nextCursor={history.nextCursor}
        initialReceipt={initialReceipt}
      />
    </div>
  );
}

function buildAnomalySummary(anomalies: TransactionAnomalies) {
  const parts: string[] = [];

  if (anomalies.frequentRefundUsers.length) {
    parts.push(
      `${numberFormatter.format(anomalies.frequentRefundUsers.length)} refund-heavy user${anomalies.frequentRefundUsers.length > 1 ? 's' : ''} over 30d`,
    );
  }
  if (anomalies.largeRefunds.length) {
    parts.push(
      `${numberFormatter.format(anomalies.largeRefunds.length)} refund${anomalies.largeRefunds.length > 1 ? 's' : ''} above $500`,
    );
  }
  if (anomalies.invalidCharges.length) {
    parts.push(
      `${numberFormatter.format(anomalies.invalidCharges.length)} invalid charge${anomalies.invalidCharges.length > 1 ? 's' : ''}`,
    );
  }

  if (!parts.length) return null;
  return `Anomaly scan: ${parts.join(' · ')}.`;
}
