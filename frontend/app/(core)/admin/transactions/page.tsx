import Link from 'next/link';
import { AlertTriangle, ArrowRightLeft, ReceiptText, RotateCcw, ShieldAlert, Wallet } from 'lucide-react';
import { AdminTransactionTable } from '@/components/admin/TransactionTable';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { type AdminStatColumn, AdminStatTable } from '@/components/admin-system/surfaces/AdminStatTable';
import { AdminWatchlistCard } from '@/components/admin-system/surfaces/AdminWatchlistCard';
import { ButtonLink } from '@/components/ui/Button';
import type { AdminTransactionRecord, TransactionAnomalies } from '@/server/admin-transactions';
import { fetchAdminTransactions, fetchTransactionAnomalies } from '@/server/admin-transactions';

export const dynamic = 'force-dynamic';

const numberFormatter = new Intl.NumberFormat('en-US');
const usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Paris',
});

export default async function AdminTransactionsPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          eyebrow="Finance Ops"
          title="Transactions"
          description="Ledger admin pour auditer les charges wallet, les top-ups et les remboursements manuels."
        />
        <AdminSection title="Transaction Workspace" description="La connexion base de donnees est requise pour charger le ledger.">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable transaction
            reporting.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const [transactions, anomalies] = await Promise.all([fetchAdminTransactions(100), fetchTransactionAnomalies()]);
  const overviewCards = buildOverviewCards(transactions, anomalies);
  const watchlistHits =
    anomalies.largeRefunds.length + anomalies.frequentRefundUsers.length + anomalies.invalidCharges.length;
  const refundableCharges = transactions.filter((row) => row.canRefund).length;
  const missingJobs = transactions.filter(isMissingJobRecord).length;
  const largeRefundColumns: AdminStatColumn<TransactionAnomalies['largeRefunds'][number]>[] = [
    {
      key: 'receipt',
      header: 'Receipt',
      render: (row) => (
        <>
          <p className="font-mono text-xs text-text-primary">#{row.receiptId}</p>
          <p className="mt-1 text-xs text-text-muted">{formatDate(row.createdAt)}</p>
        </>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => <UserRef userId={row.userId} />,
    },
    {
      key: 'amount',
      header: 'Amount',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatAmount(row.amountCents, row.currency),
    },
  ];
  const refundHeavyColumns: AdminStatColumn<TransactionAnomalies['frequentRefundUsers'][number]>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <>
          <UserRef userId={row.userId} />
          <p className="mt-1 text-xs text-text-muted">{formatDate(row.lastRefundAt)}</p>
        </>
      ),
    },
    {
      key: 'refunds',
      header: 'Refunds',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatNumber(row.refundCount),
    },
    {
      key: 'value',
      header: 'Value',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-text-primary',
      render: (row) => formatUsdCents(row.totalCents),
    },
  ];
  const invalidChargeColumns: AdminStatColumn<TransactionAnomalies['invalidCharges'][number]>[] = [
    {
      key: 'receipt',
      header: 'Receipt',
      render: (row) => (
        <>
          <p className="font-mono text-xs text-text-primary">#{row.receiptId}</p>
          <div className="mt-1">
            <UserRef userId={row.userId} />
          </div>
        </>
      ),
    },
    {
      key: 'job',
      header: 'Job',
      render: (row) => (
        <>
          {row.jobId ? (
            <Link href={`/admin/jobs?jobId=${encodeURIComponent(row.jobId)}`} className="text-sm text-brand hover:underline">
              {row.jobId}
            </Link>
          ) : (
            <span className="text-text-muted">No linked job</span>
          )}
          <p className="mt-1 text-xs text-text-muted">{formatDate(row.createdAt)}</p>
        </>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      headerClassName: 'text-right',
      cellClassName: 'text-right font-medium text-error',
      render: (row) => formatUsdCents(row.amountCents),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Finance Ops"
        title="Transactions"
        description="Workspace de controle pour les mouvements wallet, les remboursements manuels et les anomalies de facturation."
        actions={
          <>
            <ButtonLink href="/admin/insights" variant="outline" size="sm" className="border-border bg-surface">
              Insights
            </ButtonLink>
            <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-border bg-surface">
              Jobs
            </ButtonLink>
            <ButtonLink href="/admin/users" variant="outline" size="sm" className="border-border bg-surface">
              Users
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Ledger Overview"
        description="Signal rapide sur le lot charge pour savoir si on est en revue courante ou en mode incident."
      >
        <AdminMetricGrid items={overviewCards} columnsClassName="sm:grid-cols-2 xl:grid-cols-6" className="border-0" />
      </AdminSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_360px] xl:items-start">
        <AdminSection
          title="Transaction Workspace"
          description="Recherche locale, filtres rapides et actions de remboursement sur les 100 dernieres ecritures."
          action={
            <AdminSectionMeta
              title="Current ledger slice"
              lines={[
                `${formatNumber(transactions.length)} rows`,
                `${formatNumber(refundableCharges)} refundable`,
                `${formatNumber(missingJobs)} missing jobs`,
                `${formatNumber(watchlistHits)} watchlist hits`,
              ]}
            />
          }
        >
          <AdminTransactionTable initialTransactions={transactions} />
        </AdminSection>

        <div className="xl:sticky xl:top-[5.75rem]">
          <div className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-card">
            <div className="border-b border-hairline px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Watchlist</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Remboursements eleves, utilisateurs refund-heavy et charges invalides a investiguer en priorite.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-semibold text-text-primary">
                  {watchlistHits ? `${formatNumber(watchlistHits)} hit${watchlistHits > 1 ? 's' : ''}` : 'Clear'}
                </span>
              </div>
            </div>
            <div className="space-y-4 px-4 py-4">
              <AdminWatchlistCard
                title="Large refunds"
                description="Remboursements supérieurs a 500 USD."
                badge={formatNumber(anomalies.largeRefunds.length)}
                className="bg-bg/30"
              >
                {anomalies.largeRefunds.length ? (
                  <AdminStatTable
                    columns={largeRefundColumns}
                    rows={anomalies.largeRefunds}
                    getRowKey={(row) => String(row.receiptId)}
                    empty={<AdminEmptyState>No refunds above the review threshold in the latest scan.</AdminEmptyState>}
                    className="border-0 bg-transparent"
                    tableClassName="min-w-full"
                    headerClassName="bg-transparent"
                    bodyClassName="divide-y divide-hairline/80"
                    emptyClassName="px-0 py-0"
                    viewportClassName="max-h-56 overflow-auto"
                    stickyHeader
                  />
                ) : (
                  <AdminEmptyState>No refunds above the review threshold in the latest scan.</AdminEmptyState>
                )}
              </AdminWatchlistCard>

              <AdminWatchlistCard
                title="Refund-heavy users"
                description="Utilisateurs avec au moins 3 remboursements sur 30 jours."
                badge={formatNumber(anomalies.frequentRefundUsers.length)}
                className="bg-bg/30"
              >
                {anomalies.frequentRefundUsers.length ? (
                  <AdminStatTable
                    columns={refundHeavyColumns}
                    rows={anomalies.frequentRefundUsers}
                    getRowKey={(row) => `${row.userId ?? 'anonymous'}-${row.lastRefundAt ?? 'latest'}`}
                    empty={<AdminEmptyState>No user currently exceeds the refund frequency threshold.</AdminEmptyState>}
                    className="border-0 bg-transparent"
                    tableClassName="min-w-full"
                    headerClassName="bg-transparent"
                    bodyClassName="divide-y divide-hairline/80"
                    emptyClassName="px-0 py-0"
                    viewportClassName="max-h-56 overflow-auto"
                    stickyHeader
                  />
                ) : (
                  <AdminEmptyState>No user currently exceeds the refund frequency threshold.</AdminEmptyState>
                )}
              </AdminWatchlistCard>

              <AdminWatchlistCard
                title="Invalid charges"
                description="Charges nulles ou negatives a corriger."
                badge={formatNumber(anomalies.invalidCharges.length)}
                className="bg-bg/30"
              >
                {anomalies.invalidCharges.length ? (
                  <AdminStatTable
                    columns={invalidChargeColumns}
                    rows={anomalies.invalidCharges}
                    getRowKey={(row) => String(row.receiptId)}
                    empty={<AdminEmptyState>No zero-value or negative charges detected.</AdminEmptyState>}
                    className="border-0 bg-transparent"
                    tableClassName="min-w-full"
                    headerClassName="bg-transparent"
                    bodyClassName="divide-y divide-hairline/80"
                    emptyClassName="px-0 py-0"
                    viewportClassName="max-h-56 overflow-auto"
                    stickyHeader
                  />
                ) : (
                  <AdminEmptyState>No zero-value or negative charges detected.</AdminEmptyState>
                )}
              </AdminWatchlistCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildOverviewCards(
  transactions: AdminTransactionRecord[],
  anomalies: TransactionAnomalies
): AdminMetricItem[] {
  const charges = transactions.filter((row) => row.type === 'charge');
  const refunds = transactions.filter((row) => row.type === 'refund');
  const topups = transactions.filter((row) => row.type === 'topup');
  const refundableCharges = charges.filter((row) => row.canRefund).length;
  const missingJobs = transactions.filter(isMissingJobRecord).length;
  const watchlistHits =
    anomalies.largeRefunds.length + anomalies.frequentRefundUsers.length + anomalies.invalidCharges.length;

  return [
    {
      label: 'Loaded',
      value: formatNumber(transactions.length),
      helper: 'Latest ledger slice',
      icon: ReceiptText,
    },
    {
      label: 'Charges',
      value: formatNumber(charges.length),
      helper: formatTypeVolume(charges, 'customer debits'),
      icon: Wallet,
    },
    {
      label: 'Top-ups',
      value: formatNumber(topups.length),
      helper: formatTypeVolume(topups, 'cash-ins'),
      tone: topups.length > 0 ? 'success' : 'default',
      icon: ArrowRightLeft,
    },
    {
      label: 'Refunds',
      value: formatNumber(refunds.length),
      helper: formatTypeVolume(refunds, 'manual or automatic returns'),
      tone: refunds.length > 0 ? 'warning' : 'success',
      icon: RotateCcw,
    },
    {
      label: 'Refundable',
      value: formatNumber(refundableCharges),
      helper: 'Latest valid charges still eligible for manual refund',
      tone: refundableCharges > 0 ? 'warning' : 'success',
      icon: ShieldAlert,
    },
    {
      label: 'Watchlist',
      value: formatNumber(watchlistHits),
      helper: `${formatNumber(missingJobs)} missing job link${missingJobs === 1 ? '' : 's'} in the current slice`,
      tone: watchlistHits > 0 || missingJobs > 0 ? 'warning' : 'success',
      icon: AlertTriangle,
    },
  ];
}

function formatTypeVolume(rows: AdminTransactionRecord[], fallbackLabel: string) {
  if (!rows.length) return `No ${fallbackLabel}`;
  const currencies = new Set(rows.map((row) => row.currency.toUpperCase()));
  if (currencies.size === 1) {
    const [currency] = Array.from(currencies);
    const total = rows.reduce((sum, row) => sum + row.amountCents, 0);
    return `${formatAmount(total, currency)} ${fallbackLabel}`;
  }
  return `${formatNumber(rows.length)} entries across ${formatNumber(currencies.size)} currencies`;
}

function isMissingJobRecord(row: AdminTransactionRecord) {
  return Boolean(row.jobId && !row.jobStatus && !row.jobPaymentStatus && !row.jobEngineLabel);
}

function UserRef({ userId }: { userId: string | null }) {
  if (!userId) {
    return <span className="text-sm text-text-muted">Anonymous</span>;
  }

  return (
    <Link href={`/admin/users/${userId}`} className="text-sm text-brand hover:underline">
      {userId}
    </Link>
  );
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatUsdCents(amountCents: number) {
  return usdFormatter.format(amountCents / 100);
}

function formatAmount(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateFormatter.format(parsed);
}
