'use client';

import { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { AdminTransactionRecord } from '@/server/admin-transactions';

type StatusVariant = 'info' | 'success' | 'error';

type AdminTransactionTableProps = {
  initialTransactions: AdminTransactionRecord[];
};

function formatCurrency(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const TYPE_LABEL: Record<AdminTransactionRecord['type'], string> = {
  charge: 'Charge',
  refund: 'Refund',
  topup: 'Top-up',
  discount: 'Discount',
  tax: 'Tax',
};

const TYPE_CLASS: Record<AdminTransactionRecord['type'], string> = {
  charge: 'bg-amber-50 text-amber-700 border-amber-200',
  refund: 'bg-green-50 text-green-700 border-green-200',
  topup: 'bg-blue-50 text-blue-700 border-blue-200',
  discount: 'bg-purple-50 text-purple-700 border-purple-200',
  tax: 'bg-slate-50 text-slate-700 border-slate-200',
};

export function AdminTransactionTable({ initialTransactions }: AdminTransactionTableProps) {
  const [rows, setRows] = useState<AdminTransactionRecord[]>(initialTransactions);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [rows]
  );

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/transactions?limit=100', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Unable to refresh transactions.');
      }
      setRows(Array.isArray(payload.transactions) ? payload.transactions : []);
      setStatus({ message: 'Transactions refreshed.', variant: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh transactions.';
      setStatus({ message, variant: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleRefund = useCallback(
    async (jobId: string) => {
      const confirm = window.confirm('Issue a manual wallet refund for this job? This action cannot be undone.');
      if (!confirm) return;
      const noteInput = window.prompt('Optional note (appears in job message and metadata):') ?? undefined;
      setPendingJobId(jobId);
      try {
        const response = await fetch('/api/admin/transactions/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, note: noteInput }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? 'Refund failed.');
        }
        setStatus({ message: 'Manual refund issued.', variant: 'success' });
        await refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Refund failed.';
        setStatus({ message, variant: 'error' });
      } finally {
        setPendingJobId(null);
      }
    },
    [refresh]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-text-secondary">
          Showing {sortedRows.length} transaction{sortedRows.length === 1 ? '' : 's'} (most recent first).
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className={clsx(
              'inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isRefreshing ? 'cursor-not-allowed opacity-60' : 'hover:border-accentSoft/60 hover:bg-accentSoft/10'
            )}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {status ? (
        <div
          className={clsx(
            'rounded-md border px-3 py-2 text-sm',
            status.variant === 'success' && 'border-green-200 bg-green-50 text-green-800',
            status.variant === 'error' && 'border-red-200 bg-red-50 text-red-700',
            status.variant === 'info' && 'border-slate-200 bg-slate-50 text-slate-700'
          )}
        >
          {status.message}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Job</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Payment</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-micro text-text-muted">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background text-sm">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                  No transactions recorded yet.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => {
                const amountLabel = formatCurrency(row.amountCents, row.currency);
                const userLabel = row.userEmail ?? row.userId ?? 'Unknown user';
                const jobLabel = row.jobId ?? '—';
                const videoLink =
                  row.jobVideoUrl && row.jobVideoUrl.length ? (
                    <a
                      href={row.jobVideoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Video
                    </a>
                  ) : null;
                const isPending = pendingJobId === row.jobId;

                return (
                  <tr key={`${row.receiptId}-${row.createdAt}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm text-text-primary">{userLabel}</span>
                        {row.userEmail && row.userId && row.userEmail !== row.userId ? (
                          <span className="text-xs text-text-muted">{row.userId}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-micro',
                          TYPE_CLASS[row.type]
                        )}
                      >
                        {TYPE_LABEL[row.type] ?? row.type}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">{amountLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-text-primary">{jobLabel}</span>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                          {row.jobEngineLabel ? <span>{row.jobEngineLabel}</span> : null}
                          {row.jobStatus ? <span className="uppercase tracking-wide">{row.jobStatus}</span> : null}
                          {videoLink}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 text-xs">
                        <span className="uppercase tracking-wide text-text-muted">
                          {row.jobPaymentStatus ?? '—'}
                        </span>
                        {row.hasRefund ? <span className="text-green-700">Refunded</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {row.description ? row.description : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.canRefund ? (
                        <button
                          type="button"
                          onClick={() => handleRefund(row.jobId!)}
                          disabled={isPending}
                          className={clsx(
                            'inline-flex items-center rounded-md border border-destructive px-3 py-1.5 text-sm font-medium text-destructive transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive',
                            isPending ? 'cursor-wait opacity-60' : 'hover:bg-destructive/10'
                          )}
                        >
                          {isPending ? 'Refunding…' : 'Refund tokens'}
                        </button>
                      ) : row.type === 'charge' ? (
                        <span className="text-xs text-text-muted">
                          {row.hasRefund ? 'Already refunded' : 'Refund unavailable'}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
