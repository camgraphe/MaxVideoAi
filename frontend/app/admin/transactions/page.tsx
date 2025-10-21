import { fetchAdminTransactions } from '@/server/admin-transactions';
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

  const transactions = await fetchAdminTransactions(100);

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
    </div>
  );
}
