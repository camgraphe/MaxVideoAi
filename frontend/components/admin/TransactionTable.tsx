'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { TransactionHistoryControls } from './transactions/TransactionHistoryControls';
import type { TransactionHistoryQuery } from '@/lib/admin/transaction-history';
import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { needsTransactionReview as needsReview, isMissingJobRecord } from '@/lib/admin/transaction-review';
import clsx from 'clsx';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import type { AdminTransactionRecord } from '@/server/admin-transactions';
import { Button } from '@/components/ui/Button';

type StatusVariant = 'info' | 'success' | 'error';

type AdminTransactionTableProps = {
  initialTransactions: AdminTransactionRecord[];
  filters: TransactionHistoryQuery;
  nextCursor: string | null;
  initialReceipt: AdminTransactionRecord | null;
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
const durationFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const TYPE_LABEL: Record<AdminTransactionRecord['type'], string> = {
  charge: 'Charge',
  refund: 'Refund',
  topup: 'Top-up',
  discount: 'Discount',
  tax: 'Tax',
};

const TYPE_ACCENT: Record<AdminTransactionRecord['type'], { edge: string; wash: string; dot: string }> = {
  charge: { edge: 'border-l-sky-400', wash: 'bg-sky-500/10', dot: 'bg-sky-500' },
  topup: { edge: 'border-l-emerald-400', wash: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  refund: { edge: 'border-l-amber-400', wash: 'bg-amber-500/10', dot: 'bg-amber-500' },
  discount: { edge: 'border-l-violet-400', wash: 'bg-violet-500/10', dot: 'bg-violet-500' },
  tax: { edge: 'border-l-slate-400', wash: 'bg-slate-500/10', dot: 'bg-slate-500' },
};

export function AdminTransactionTable({
  initialTransactions,
  filters,
  nextCursor,
  initialReceipt,
}: AdminTransactionTableProps) {
  const rows = initialTransactions;
  const router = useRouter();
  const [isRefreshing, startNavigation] = useTransition();
  const params = useSearchParams();
  const receiptParam = params?.get('receipt') ?? '';
  const requestedReceipt = /^[1-9]\d*$/.test(receiptParam) ? receiptParam : null;
  const [selectedId, setSelectedId] = useState<string | null>(requestedReceipt);
  useEffect(() => setSelectedId(requestedReceipt), [requestedReceipt]);
  const selected =
    rows.find((row) => String(row.receiptId) === selectedId) ??
    (String(initialReceipt?.receiptId) === selectedId ? initialReceipt : null);
  const selectedDuration = selected ? formatJobDuration(selected.jobDurationSec) : null;
  const [pendingReceiptId, setPendingReceiptId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ message: string; variant: StatusVariant } | null>(null);
  const visibleRows = rows;
  const refresh = useCallback(async () => {
    startNavigation(() => router.refresh());
  }, [router]);

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
    [refresh],
  );

  return (
    <div className="space-y-4">
      <TransactionHistoryControls
        filters={filters}
        nextCursor={nextCursor}
        pending={isRefreshing}
        onNavigate={(url) => startNavigation(() => router.push(url))}
        onRefresh={refresh}
      />
      <p role="status" className="text-xs text-text-secondary">
        {isRefreshing ? 'Loading transactions…' : `${rows.length} entries on this page`}
      </p>
      {requestedReceipt && !initialReceipt && !selected ? (
        <p role="alert" className="text-sm text-warning">
          Receipt not found.
        </p>
      ) : null}
      {status ? (
        <p
          role="status"
          className={clsx(
            'rounded-md border px-3 py-2 text-sm',
            status.variant === 'error'
              ? 'border-error-border bg-error-bg text-error'
              : 'border-info-border bg-info-bg text-info',
          )}
        >
          {status.message}
        </p>
      ) : null}
      <div className={clsx('grid min-w-0 grid-cols-1 gap-6', selected && 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
        <AdminDataTable tableClassName="min-w-full">
          <thead>
            <tr>
              {['Receipt', 'Account', 'Type', 'Amount', 'Status', ''].map((title, index) => (
                <th key={index} className="relative px-3 py-3 text-xs font-medium text-text-secondary">
                  {title || <span className="sr-only">Details</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {visibleRows.map((row) => (
              <tr key={row.receiptId} className={clsx(selectedId === String(row.receiptId) && 'bg-brand/5')}>
                <td className={clsx('whitespace-nowrap border-l-2 px-3 py-2.5', TYPE_ACCENT[row.type].edge)}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(String(row.receiptId))}
                    className="font-medium text-brand"
                  >
                    #{row.receiptId}
                  </button>
                  <p className="mt-0.5 text-xs text-text-secondary">{formatDate(row.createdAt)}</p>
                </td>
                <td className="max-w-[200px] truncate px-3 py-2.5">
                  {row.userId ? (
                    <Link
                      title={row.userEmail ?? row.userId}
                      className="text-sm hover:text-brand"
                      href={`/admin/users/${row.userId}`}
                    >
                      {row.userEmail ?? row.userId}
                    </Link>
                  ) : (
                    'Unknown account'
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-medium text-text-primary',
                      TYPE_ACCENT[row.type].wash,
                    )}
                  >
                    <span aria-hidden="true" className={clsx('h-2 w-2 rounded-full', TYPE_ACCENT[row.type].dot)} />
                    {TYPE_LABEL[row.type]}
                  </span>
                </td>
                <TransactionAmount row={row} />
                <td className="px-3 py-2.5 text-xs">
                  {needsReview(row) ? (
                    <span className="text-warning">Needs review</span>
                  ) : row.hasRefund ? (
                    'Refunded'
                  ) : (
                    (row.jobPaymentStatus ?? 'Recorded')
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(String(row.receiptId))}
                    aria-label={`View receipt ${row.receiptId}`}
                    className="text-xs font-medium text-brand"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!visibleRows.length ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-secondary">
                  No transactions match these filters. Try another period, type or search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </AdminDataTable>
        {selected ? (
          <aside
            aria-label="Transaction details"
            className="min-w-0 border-t border-border pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Receipt #{selected.receiptId}</h2>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close transaction details"
                className="rounded p-2"
              >
                <X size={16} />
              </button>
            </div>
            <p className="my-4 text-2xl font-semibold tabular-nums">
              {formatCurrency(selected.amountCents, selected.currency)}
            </p>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-xs text-text-secondary">Entry</dt>
                <dd>{TYPE_LABEL[selected.type]}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Recorded · Europe/Madrid</dt>
                <dd>{formatDate(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Description</dt>
                <dd className="mt-1 break-words">{selected.description ?? 'No description'}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-secondary">Account</dt>
                <dd className="break-all">
                  {selected.userId ? (
                    <Link className="text-brand" href={`/admin/users/${selected.userId}`}>
                      {selected.userEmail ?? selected.userId}
                    </Link>
                  ) : (
                    'Unknown'
                  )}
                </dd>
              </div>
            </dl>
            {selected.jobId ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-1 text-xs text-text-secondary">Linked generation</p>
                <Link
                  className="break-all text-sm text-brand"
                  href={`/admin/jobs?jobId=${encodeURIComponent(selected.jobId)}`}
                >
                  {selected.jobEngineLabel ?? selected.jobId}
                </Link>
                <p className="mt-1 text-xs text-text-secondary">
                  {selected.jobStatus ?? (isMissingJobRecord(selected) ? 'Job record missing' : 'Status unavailable')}
                </p>
                {selectedDuration ? (
                  <p className="mt-1 text-xs text-text-secondary">Duration: {selectedDuration}</p>
                ) : null}
                {selected.jobVideoUrl ? (
                  <a
                    href={selected.jobVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs text-brand"
                  >
                    Open media
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="mt-5 border-t border-border pt-4">
              {selected.canRefund ? (
                <>
                  <p className="mb-3 text-xs text-text-secondary">
                    A wallet refund restores credits to this account. It does not refund a card payment.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefund(selected)}
                    disabled={pendingReceiptId !== null || isRefreshing}
                  >
                    {pendingReceiptId === selected.receiptId ? 'Refunding…' : 'Refund tokens'}
                  </Button>
                </>
              ) : (
                <p className="text-xs text-text-secondary">
                  {selected.hasRefund ? 'Already refunded' : 'No wallet refund available'}
                </p>
              )}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function TransactionAmount({ row }: { row: AdminTransactionRecord }) {
  const generationContext = formatGenerationContext(row);
  return (
    <td className="whitespace-nowrap px-3 py-2.5 font-medium tabular-nums">
      {formatCurrency(row.amountCents, row.currency)}
      {generationContext ? (
        <p className="mt-0.5 max-w-[180px] truncate text-xs font-normal text-text-secondary" title={generationContext}>
          {generationContext}
        </p>
      ) : null}
    </td>
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

function formatJobDuration(durationSec: number | null) {
  if (durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  return `${durationFormatter.format(durationSec)} s`;
}

function formatGenerationContext(row: AdminTransactionRecord) {
  if (!row.jobId) return null;
  const model = row.jobEngineLabel?.trim();
  const duration = formatJobDuration(row.jobDurationSec);
  return [model, duration].filter(Boolean).join(' · ') || null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const parts = dateTimeFormatter.formatToParts(parsed);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}`;
}
