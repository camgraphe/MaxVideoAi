'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import type { AdminTransactionRecord } from '@/server/admin-transactions';
import { Button } from '@/components/ui/Button';

type StatusVariant = 'info' | 'success' | 'error';
type FilterKey = 'all' | 'attention' | AdminTransactionRecord['type'];

type AdminTransactionTableProps = {
  initialTransactions: AdminTransactionRecord[];
};

type FilterOption = {
  key: FilterKey;
  label: string;
  count: number;
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Paris',
});

const TYPE_LABEL: Record<AdminTransactionRecord['type'], string> = {
  charge: 'Charge',
  refund: 'Refund',
  topup: 'Top-up',
  discount: 'Discount',
  tax: 'Tax',
};

const TYPE_CLASS: Record<AdminTransactionRecord['type'], string> = {
  charge: 'border-warning-border bg-warning-bg text-warning',
  refund: 'border-success-border bg-success-bg text-success',
  topup: 'border-info-border bg-info-bg text-info',
  discount: 'border-border bg-bg text-text-secondary',
  tax: 'border-info-border bg-info-bg text-info',
};

export function AdminTransactionTable({ initialTransactions }: AdminTransactionTableProps) {
  const [rows, setRows] = useState<AdminTransactionRecord[]>(initialTransactions);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingReceiptId, setPendingReceiptId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setRows(initialTransactions);
  }, [initialTransactions]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }),
    [rows]
  );

  const filterOptions = useMemo<FilterOption[]>(
    () => [
      { key: 'all', label: 'All', count: sortedRows.length },
      { key: 'attention', label: 'Needs review', count: sortedRows.filter(needsReview).length },
      { key: 'charge', label: 'Charges', count: sortedRows.filter((row) => row.type === 'charge').length },
      { key: 'topup', label: 'Top-ups', count: sortedRows.filter((row) => row.type === 'topup').length },
      { key: 'refund', label: 'Refunds', count: sortedRows.filter((row) => row.type === 'refund').length },
      { key: 'discount', label: 'Discounts', count: sortedRows.filter((row) => row.type === 'discount').length },
      { key: 'tax', label: 'Tax', count: sortedRows.filter((row) => row.type === 'tax').length },
    ],
    [sortedRows]
  );

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const visibleRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (activeFilter === 'attention' && !needsReview(row)) return false;
      if (activeFilter !== 'all' && activeFilter !== 'attention' && row.type !== activeFilter) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        row.receiptId,
        row.userEmail,
        row.userId,
        row.jobId,
        row.jobStatus,
        row.jobPaymentStatus,
        row.jobEngineLabel,
        row.description,
        row.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [activeFilter, normalizedQuery, sortedRows]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/admin/transactions?limit=100', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Unable to refresh transactions.');
      }
      const nextRows = Array.isArray(payload.transactions) ? payload.transactions : [];
      setRows(nextRows);
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
    <div className="space-y-4">
      <div className="rounded-2xl border border-hairline bg-bg/40 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
                    activeFilter === option.key
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
                  )}
                >
                  <span>{option.label}</span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-text-primary">{option.count}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-text-secondary">
              {activeFilter === 'all' ? 'Showing the latest 100 ledger rows.' : `Scope: ${getFilterLabel(activeFilter)}.`}{' '}
              {visibleRows.length === rows.length
                ? 'Use the search field to narrow the current slice.'
                : `Currently showing ${visibleRows.length} of ${rows.length} loaded transactions.`}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[360px]">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Search loaded rows
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="receipt, user, job, engine, status..."
                className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-bg/70">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Receipt</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Member</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Entry</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Linked job</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">State</th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-secondary">
                  No transactions match the current scope.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const amountLabel = formatCurrency(row.amountCents, row.currency);
                const userLabel = row.userEmail ?? row.userId ?? 'Unknown user';
                const isPending = pendingReceiptId === row.receiptId;
                const jobMissing = isMissingJobRecord(row);
                const rowNeedsReview = needsReview(row);

                return (
                  <tr key={`${row.receiptId}-${row.createdAt}`} className={clsx(rowNeedsReview && 'bg-warning-bg/30')}>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <p className="font-mono text-xs text-text-primary">#{row.receiptId}</p>
                      <p className="mt-1 text-xs text-text-secondary">{formatDate(row.createdAt)}</p>
                    </td>

                    <td className="px-4 py-3 align-top">
                      {row.userId ? (
                        <Link
                          href={`/admin/users/${row.userId}`}
                          className="inline-flex min-w-0 flex-col rounded-md border border-transparent px-1 py-0.5 text-left transition hover:border-text-muted hover:bg-bg/70"
                        >
                          <span className="truncate text-sm font-medium text-brand">{userLabel}</span>
                          {row.userEmail && row.userId && row.userEmail !== row.userId ? (
                            <span className="mt-1 truncate text-xs text-text-muted">{row.userId}</span>
                          ) : null}
                        </Link>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm text-text-primary">{userLabel}</span>
                          <span className="mt-1 text-xs text-text-muted">No linked account id</span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={clsx(
                              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.18em]',
                              TYPE_CLASS[row.type]
                            )}
                          >
                            {TYPE_LABEL[row.type] ?? row.type}
                          </span>
                          <span className="font-medium text-text-primary">{amountLabel}</span>
                        </div>
                        <p className="max-w-[28rem] text-sm text-text-secondary">
                          {row.description ? row.description : <span className="text-text-muted">No description</span>}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
                      {row.jobId ? (
                        <div className="flex flex-col gap-1">
                          <Link href={`/admin/jobs?jobId=${encodeURIComponent(row.jobId)}`} className="font-mono text-xs text-brand hover:underline">
                            {row.jobId}
                          </Link>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                            {row.jobEngineLabel ? <span>{row.jobEngineLabel}</span> : null}
                            {row.jobStatus ? <span className="uppercase tracking-wide">{row.jobStatus}</span> : null}
                            {row.jobVideoUrl ? (
                              <a
                                href={row.jobVideoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand underline-offset-2 hover:underline"
                              >
                                Video
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">Wallet event only</span>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2">
                        {row.jobPaymentStatus ? (
                          <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium uppercase tracking-[0.16em] text-text-secondary">
                            {row.jobPaymentStatus}
                          </span>
                        ) : null}
                        {row.hasRefund ? (
                          <span className="rounded-full border border-success-border bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                            Refunded
                          </span>
                        ) : null}
                        {row.canRefund ? (
                          <span className="rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                            Refundable
                          </span>
                        ) : null}
                        {jobMissing ? (
                          <span className="rounded-full border border-warning-border bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                            Job record missing
                          </span>
                        ) : null}
                        {row.type === 'charge' && !row.isLatestCharge ? (
                          <span className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text-muted">
                            Historical charge
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top">
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
                        <span className="text-xs text-text-muted">No action</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function needsReview(row: AdminTransactionRecord) {
  return row.canRefund || isMissingJobRecord(row) || (row.type === 'charge' && row.amountCents <= 0);
}

function isMissingJobRecord(row: AdminTransactionRecord) {
  return Boolean(row.jobId && !row.jobStatus && !row.jobPaymentStatus && !row.jobEngineLabel);
}

function getFilterLabel(filter: FilterKey) {
  return filter === 'attention' ? 'needs review' : filter === 'all' ? 'all transactions' : TYPE_LABEL[filter];
}

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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = dateTimeFormatter.formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}`;
}
