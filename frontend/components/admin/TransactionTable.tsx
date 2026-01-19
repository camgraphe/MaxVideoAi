'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { AdminTransactionRecord } from '@/server/admin-transactions';
import { Button } from '@/components/ui/Button';

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
  charge: 'bg-warning-bg text-warning border-warning-border',
  refund: 'bg-success-bg text-success border-success-border',
  topup: 'bg-info-bg text-info border-info-border',
  discount: 'bg-purple-50 text-purple-700 border-purple-200',
  tax: 'bg-info-bg text-info border-info-border',
};

export function AdminTransactionTable({ initialTransactions }: AdminTransactionTableProps) {
  const [rows, setRows] = useState<AdminTransactionRecord[]>(initialTransactions);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingReceiptId, setPendingReceiptId] = useState<number | null>(null);
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
    async (record: AdminTransactionRecord) => {
      const confirm = window.confirm('Issue a manual wallet refund for this charge? This action cannot be undone.');
      if (!confirm) return;
      const noteInput = window.prompt('Optional note (appears in metadata):') ?? undefined;
      setPendingReceiptId(record.receiptId);
      try {
        const response = await fetch('/api/admin/transactions/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: record.jobId, receiptId: record.receiptId, note: noteInput }),
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
        setPendingReceiptId(null);
      }
    },
    [refresh]
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-text-secondary">
          Showing {sortedRows.length} transaction{sortedRows.length === 1 ? '' : 's'} (most recent first).
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refresh}
            disabled={isRefreshing}
            className={clsx(
              'gap-2 rounded-md border-border px-3 py-1.5 text-sm font-medium',
              isRefreshing ? 'cursor-not-allowed opacity-60' : 'hover:border-text-muted hover:bg-surface-2'
            )}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {status ? (
        <div
          className={clsx(
            'rounded-md border px-3 py-2 text-sm',
            status.variant === 'success' && 'border-success-border bg-success-bg text-success',
            status.variant === 'error' && 'border-error-border bg-error-bg text-error',
            status.variant === 'info' && 'border-info-border bg-info-bg text-info'
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
                const isPending = pendingReceiptId === row.receiptId;
                const jobMissing = Boolean(row.jobId && !row.jobStatus && !row.jobPaymentStatus && !row.jobEngineLabel);

                return (
                  <tr key={`${row.receiptId}-${row.createdAt}`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-secondary">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.userId ? (
                        <Link
                          href={`/admin/users/${row.userId}`}
                          className="flex flex-col rounded-md border border-transparent px-1 py-0.5 text-left transition hover:border-text-muted hover:bg-surface-2"
                        >
                          <span className="text-sm font-medium text-brand">{userLabel}</span>
                          {row.userEmail && row.userId && row.userEmail !== row.userId ? (
                            <span className="text-xs text-text-muted">{row.userId}</span>
                          ) : null}
                          <span className="text-[11px] uppercase tracking-wide text-text-muted">View member</span>
                        </Link>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm text-text-primary">{userLabel}</span>
                          {row.userEmail && row.userId && row.userEmail !== row.userId ? (
                            <span className="text-xs text-text-muted">{row.userId}</span>
                          ) : null}
                        </div>
                      )}
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
                        {jobMissing ? <span className="text-warning">Job record missing</span> : null}
                        {row.hasRefund ? <span className="text-success">Refunded</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {row.description ? row.description : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {row.canRefund ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRefund(row)}
                          disabled={isPending}
                          className={clsx(
                            'rounded-md border-destructive px-3 py-1.5 text-sm font-medium text-destructive hover:text-destructive',
                            isPending ? 'cursor-wait opacity-60' : 'hover:bg-destructive/10'
                          )}
                        >
                          {isPending ? 'Refunding…' : 'Refund tokens'}
                        </Button>
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
