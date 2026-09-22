'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { needsTransactionReview as needsReview, isMissingJobRecord } from '@/lib/admin/transaction-review';
import clsx from 'clsx';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
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
  timeZone: 'Europe/Madrid',
});

const TYPE_LABEL: Record<AdminTransactionRecord['type'], string> = {
  charge: 'Charge',
  refund: 'Refund',
  topup: 'Top-up',
  discount: 'Discount',
  tax: 'Tax',
};

export function AdminTransactionTable({ initialTransactions }: AdminTransactionTableProps) {
  const [rows, setRows] = useState<AdminTransactionRecord[]>(initialTransactions);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const params = useSearchParams();
  const [query, setQuery] = useState(params?.get('receipt') ?? '');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = rows.find(row => row.receiptId === selectedId);
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
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {filterOptions.map(option => <button type="button" key={option.key} onClick={() => { setActiveFilter(option.key); setSelectedId(null); }} aria-pressed={activeFilter === option.key}
          className={clsx('rounded-md px-3 py-2 text-sm', activeFilter === option.key ? 'bg-brand/10 font-semibold text-brand' : 'text-text-secondary hover:bg-surface-2')}>
          {option.label} <span className="ml-1 text-xs tabular-nums">{option.count}</span>
        </button>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="max-w-sm flex-1"><span className="sr-only">Search loaded rows</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search receipt, user or generation…" className="h-9 w-full rounded-md border border-border px-3 text-sm" /></label>
        <Button type="button" size="sm" variant="outline" onClick={refresh} disabled={isRefreshing}>{isRefreshing ? 'Refreshing…' : 'Refresh'}</Button>
      </div>
      <p className="text-xs text-text-secondary">{visibleRows.length} of {rows.length} latest ledger entries · Search and filters apply to this loaded sample · Europe/Madrid</p>
      {status ? <p role="status" className={clsx('rounded-md border px-3 py-2 text-sm', status.variant === 'error' ? 'border-error-border bg-error-bg text-error' : 'border-info-border bg-info-bg text-info')}>{status.message}</p> : null}
      <div className={clsx('grid gap-6', selected && 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
        <AdminDataTable tableClassName="min-w-full">
          <thead><tr>{['Receipt', 'Account', 'Type', 'Amount', 'Status', ''].map((title, index) => <th key={index} className="px-3 py-3 text-xs font-medium text-text-secondary">{title || <span className="sr-only">Details</span>}</th>)}</tr></thead>
          <tbody className="divide-y divide-hairline">
            {visibleRows.map(row => <tr key={row.receiptId} className={clsx(selectedId === row.receiptId && 'bg-brand/5')}>
              <td className="whitespace-nowrap px-3 py-2.5"><button type="button" onClick={() => setSelectedId(row.receiptId)} className="font-medium text-brand">#{row.receiptId}</button><p className="mt-0.5 text-xs text-text-secondary">{formatDate(row.createdAt)}</p></td>
              <td className="max-w-[200px] truncate px-3 py-2.5">{row.userId ? <Link title={row.userEmail ?? row.userId} className="text-sm hover:text-brand" href={`/admin/users/${row.userId}`}>{row.userEmail ?? row.userId}</Link> : 'Unknown account'}</td>
              <td className="px-3 py-2.5 text-sm">{TYPE_LABEL[row.type]}</td>
              <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">{formatCurrency(row.amountCents, row.currency)}</td>
              <td className="px-3 py-2.5 text-xs">{needsReview(row) ? <span className="text-warning">Needs review</span> : row.hasRefund ? 'Refunded' : row.jobPaymentStatus ?? 'Recorded'}</td>
              <td className="px-3 py-2.5"><button type="button" onClick={() => setSelectedId(row.receiptId)} aria-label={`View receipt ${row.receiptId}`} className="text-xs font-medium text-brand">View</button></td>
            </tr>)}
            {!visibleRows.length ? <tr><td colSpan={6} className="py-12 text-center text-text-secondary">No transactions match this sample.</td></tr> : null}
          </tbody>
        </AdminDataTable>
        {selected ? <aside aria-label="Transaction details" className="min-w-0 border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Receipt #{selected.receiptId}</h2><button type="button" onClick={() => setSelectedId(null)} aria-label="Close transaction details" className="rounded p-2"><X size={16} /></button></div>
          <p className="my-4 text-2xl font-semibold tabular-nums">{formatCurrency(selected.amountCents, selected.currency)}</p>
          <dl className="space-y-4 text-sm"><div><dt className="text-xs text-text-secondary">Entry</dt><dd>{TYPE_LABEL[selected.type]}</dd></div><div><dt className="text-xs text-text-secondary">Recorded · Europe/Madrid</dt><dd>{formatDate(selected.createdAt)}</dd></div><div><dt className="text-xs text-text-secondary">Description</dt><dd className="mt-1 break-words">{selected.description ?? 'No description'}</dd></div><div><dt className="text-xs text-text-secondary">Account</dt><dd className="break-all">{selected.userId ? <Link className="text-brand" href={`/admin/users/${selected.userId}`}>{selected.userEmail ?? selected.userId}</Link> : 'Unknown'}</dd></div></dl>
          {selected.jobId ? <div className="mt-5 border-t border-border pt-4"><p className="mb-1 text-xs text-text-secondary">Linked generation</p><Link className="break-all text-sm text-brand" href={`/admin/jobs?jobId=${encodeURIComponent(selected.jobId)}`}>{selected.jobEngineLabel ?? selected.jobId}</Link><p className="mt-1 text-xs text-text-secondary">{selected.jobStatus ?? (isMissingJobRecord(selected) ? 'Job record missing' : 'Status unavailable')}</p>{selected.jobVideoUrl ? <a href={selected.jobVideoUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-brand">Open media</a> : null}</div> : null}
          <div className="mt-5 border-t border-border pt-4">{selected.canRefund ? <><p className="mb-3 text-xs text-text-secondary">A wallet refund restores credits to this account. It does not refund a card payment.</p><Button type="button" variant="outline" size="sm" onClick={() => handleRefund(selected)} disabled={pendingReceiptId !== null}>{pendingReceiptId === selected.receiptId ? 'Refunding…' : 'Refund tokens'}</Button></> : <p className="text-xs text-text-secondary">{selected.hasRefund ? 'Already refunded' : 'No wallet refund available'}</p>}</div>
        </aside> : null}
      </div>
    </div>
  );
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
