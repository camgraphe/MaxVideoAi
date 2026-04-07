import { AlertTriangle, ArrowRightLeft, ReceiptText, RotateCcw, ShieldAlert, Wallet } from 'lucide-react';
import { AdminTransactionTable } from '@/components/admin/TransactionTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { ButtonLink } from '@/components/ui/Button';
import type { AdminTransactionRecord, TransactionAnomalies } from '@/server/admin-transactions';
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
  const anomalySummary = buildAnomalySummary(anomalies);

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
              watchlistHits ? `${formatNumber(watchlistHits)} anomaly hit${watchlistHits > 1 ? 's' : ''}` : 'No active anomaly',
            ]}
          />
        }
      >
        <div className="space-y-4">
          {anomalySummary ? <AdminNotice tone="warning">{anomalySummary}</AdminNotice> : null}
          <AdminTransactionTable initialTransactions={transactions} />
        </div>
      </AdminSection>
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

function formatNumber(value: number) {
  return numberFormatter.format(value);
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

function buildAnomalySummary(anomalies: TransactionAnomalies) {
  const parts: string[] = [];

  if (anomalies.frequentRefundUsers.length) {
    parts.push(`${formatNumber(anomalies.frequentRefundUsers.length)} refund-heavy user${anomalies.frequentRefundUsers.length > 1 ? 's' : ''} over 30d`);
  }
  if (anomalies.largeRefunds.length) {
    parts.push(`${formatNumber(anomalies.largeRefunds.length)} refund${anomalies.largeRefunds.length > 1 ? 's' : ''} above $500`);
  }
  if (anomalies.invalidCharges.length) {
    parts.push(`${formatNumber(anomalies.invalidCharges.length)} invalid charge${anomalies.invalidCharges.length > 1 ? 's' : ''}`);
  }

  if (!parts.length) return null;
  return `Anomaly scan: ${parts.join(' · ')}. The ledger keeps full width; use search and the user/job links in-table when you need to investigate.`;
}
