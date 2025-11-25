import { fetchAdminTransactions, fetchTransactionAnomalies } from '@/server/admin-transactions';
import { AdminTransactionTable } from '@/components/admin/TransactionTable';

export const dynamic = 'force-dynamic';

export default async function AdminTransactionsPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
          <p className="text-sm text-text-secondary">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable transaction
            reporting.
          </p>
        </header>
      </div>
    );
  }

  const [transactions, anomalies] = await Promise.all([fetchAdminTransactions(100), fetchTransactionAnomalies()]);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Transactions</h1>
        <p className="text-sm text-text-secondary">
          Recent wallet charges, top-ups, and refunds. Use this dashboard to inspect failed jobs and issue manual wallet refunds when
          necessary.
        </p>
      </header>
      <AdminTransactionTable initialTransactions={transactions} />
      <AnomaliesPanel anomalies={anomalies} />
    </div>
  );
}

function AnomaliesPanel({
  anomalies,
}: {
  anomalies: Awaited<ReturnType<typeof fetchTransactionAnomalies>>;
}) {
  const hasContent =
    anomalies.largeRefunds.length || anomalies.frequentRefundUsers.length || anomalies.invalidCharges.length;
  if (!hasContent) {
    return (
      <section className="rounded-2xl border border-border/60 bg-white/95 p-5 shadow-card">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">Anomalies</h2>
        <p className="text-xs text-text-secondary">No anomalies detected in the latest 100 transactions.</p>
      </section>
    );
  }
  const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const formatAmount = (amountCents: number, currency: string) => {
    if (currency.toUpperCase() === 'USD') {
      return currencyFormatter.format(amountCents / 100);
    }
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  };
  const formatUsdCents = (amountCents: number) => currencyFormatter.format(amountCents / 100);
  const formatNumber = (value: number) => new Intl.NumberFormat('en-US').format(value);
  const formatDate = (value: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  };

  return (
    <section className="space-y-6 rounded-2xl border border-border/60 bg-white/95 p-5 shadow-card">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-text-muted">Anomalies</h2>
        <p className="text-xs text-text-secondary">
          Largest refunds, refund-heavy users, and invalid charges detected from recent transactions.
        </p>
      </div>

      {anomalies.largeRefunds.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Large refunds (&gt;$500)</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Receipt</th>
                <th className="py-2 font-semibold">User</th>
                <th className="py-2 font-semibold">Amount</th>
                <th className="py-2 font-semibold">Job</th>
                <th className="py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.largeRefunds.map((row) => (
                <tr key={row.receiptId} className="border-t border-border/40 text-text-secondary">
                  <td className="py-2 font-mono text-xs">#{row.receiptId}</td>
                  <td className="py-2">{row.userId ?? '—'}</td>
                  <td className="py-2 font-semibold text-text-primary">{formatAmount(row.amountCents, row.currency)}</td>
                  <td className="py-2 font-mono text-xs">{row.jobId ?? '—'}</td>
                  <td className="py-2">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {anomalies.frequentRefundUsers.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Frequent refunds (last 30d)</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">User</th>
                <th className="py-2 font-semibold">Refund count</th>
                <th className="py-2 font-semibold">Total refunded</th>
                <th className="py-2 font-semibold">Last refund</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.frequentRefundUsers.map((row) => (
                <tr key={`${row.userId ?? 'anonymous'}-${row.lastRefundAt ?? 'latest'}`} className="border-t border-border/40 text-text-secondary">
                  <td className="py-2">{row.userId ?? '—'}</td>
                  <td className="py-2">{formatNumber(row.refundCount)}</td>
                  <td className="py-2">{formatUsdCents(row.totalCents)}</td>
                  <td className="py-2">{formatDate(row.lastRefundAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {anomalies.invalidCharges.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Zero or negative charges</p>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.2em] text-text-muted">
                <th className="py-2 font-semibold">Receipt</th>
                <th className="py-2 font-semibold">User</th>
                <th className="py-2 font-semibold">Amount</th>
                <th className="py-2 font-semibold">Job</th>
                <th className="py-2 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.invalidCharges.map((row) => (
                <tr key={row.receiptId} className="border-t border-border/40 text-text-secondary">
                  <td className="py-2 font-mono text-xs">#{row.receiptId}</td>
                  <td className="py-2">{row.userId ?? '—'}</td>
                  <td className="py-2 text-rose-600">{formatUsdCents(row.amountCents)}</td>
                  <td className="py-2 font-mono text-xs">{row.jobId ?? '—'}</td>
                  <td className="py-2">{formatDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
