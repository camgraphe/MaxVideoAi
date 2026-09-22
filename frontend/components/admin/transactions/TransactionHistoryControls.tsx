'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  transactionHistoryParams,
  type TransactionHistoryQuery,
  type TransactionFilter,
} from '@/lib/admin/transaction-history';
const filters: Array<[TransactionFilter, string]> = [
  ['all', 'All'],
  ['attention', 'Needs review'],
  ['charge', 'Charges'],
  ['topup', 'Top-ups'],
  ['refund', 'Refunds'],
  ['discount', 'Discounts'],
  ['tax', 'Tax'],
];
type Props = {
  filters: TransactionHistoryQuery;
  nextCursor: string | null;
  pending: boolean;
  onNavigate: (url: string) => void;
  onRefresh: () => void;
};
export function TransactionHistoryControls({ filters: current, nextCursor, pending, onNavigate, onRefresh }: Props) {
  const [query, setQuery] = useState(current.query);
  const navigate = (patch: Partial<TransactionHistoryQuery>) =>
    onNavigate('/admin/transactions?' + transactionHistoryParams({ ...current, cursor: undefined, ...patch }));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-border pb-3">
        {filters.map(([type, label]) => (
          <button
            key={type}
            disabled={pending}
            aria-pressed={current.type === type}
            onClick={() => navigate({ type })}
            className={`rounded-md px-3 py-2 text-sm disabled:opacity-50 ${current.type === type ? 'bg-brand/10 font-semibold text-brand' : 'text-text-secondary hover:bg-surface-2'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ query });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="w-full min-w-0 sm:w-auto sm:flex-1">
          <span className="sr-only">Search transaction history</span>
          <input
            type="search"
            value={query}
            maxLength={200}
            disabled={pending}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Receipt, user ID, generation, model or description…"
            className="h-9 w-full rounded-md border border-border px-3 text-sm"
          />
        </label>
        <label>
          <span className="sr-only">Transaction period</span>
          <select
            aria-label="Transaction period"
            disabled={pending}
            value={current.period}
            onChange={(event) => navigate({ period: event.target.value as TransactionHistoryQuery['period'] })}
            className="h-9 rounded-md border border-border px-3 text-sm"
          >
            <option value="today">Today</option>
            <option value="24h">Last 24 hours</option>
            <option value="all">All time</option>
          </select>
        </label>
        <Button type="submit" size="sm" disabled={pending}>
          Search
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onRefresh}>
          Refresh
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
        <p>
          Filters search the full ledger · Europe/Madrid.{' '}
          <Link className="text-brand" href="/admin/users">
            Find an account by email
          </Link>
          .
        </p>
        <div className="flex gap-2">
          {current.cursor ? (
            <Button variant="outline" size="sm" disabled={pending} onClick={() => navigate({})}>
              First page
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !nextCursor}
            onClick={() => navigate({ cursor: nextCursor ?? undefined })}
          >
            Next page
          </Button>
        </div>
      </div>
    </div>
  );
}
