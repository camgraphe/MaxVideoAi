'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
  factors: number;
};

type UsersResponse = {
  ok: boolean;
  users?: AdminUser[];
  pagination?: { page: number; perPage: number; nextPage: number | null };
  message?: string;
  error?: string;
};

type UserStatsResponse =
  | {
      ok: true;
      stats: {
        total: number;
        today: number;
        last7: number;
        last30: number;
      };
    }
  | { ok: false; error?: string; message?: string };

const fetchJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as T;
};

export default function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('perPage', '25');
    if (debounced) searchParams.set('search', debounced);
    return searchParams.toString();
  }, [page, debounced]);

  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(`/api/admin/users?${params}`, fetchJson);
  const { data: statsData } = useSWR<UserStatsResponse>('/api/admin/stats/users', fetchJson);

  const unauthorized = error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden');
  const serviceRoleMissing = data && data.ok === false && data.error === 'SERVICE_ROLE_NOT_CONFIGURED';
  const fetchError = data && data.ok === false && !serviceRoleMissing ? data.error ?? data.message ?? 'Failed to load users.' : null;
  const statsUnavailable =
    statsData && statsData.ok === false && statsData.error === 'SERVICE_ROLE_NOT_CONFIGURED' ? true : false;
  const stats = statsData && statsData.ok ? statsData.stats : null;
  const formatNumber = (value: number | null | undefined) =>
    value == null ? '—' : new Intl.NumberFormat('en-US').format(value);

  return (
    <div className="stack-gap-lg">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Members</h2>
          <p className="text-sm text-text-secondary">Search for a member by email or Supabase user ID.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-hairline bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-text-secondary hover:bg-bg hover:text-text-primary"
          onClick={() => mutate()}
        >
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or user id"
          className="w-full rounded-lg border border-hairline bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {statsUnavailable ? (
        <div className="rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning">
          Supabase service role key is missing. Add <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to your environment to display user metrics.
        </div>
      ) : null}

      {stats && !statsUnavailable ? (
        <section className="grid grid-gap-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">All time</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{formatNumber(stats.total)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Today</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{formatNumber(stats.today)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Last 7 days</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{formatNumber(stats.last7)}</p>
          </div>
          <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
            <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Last 30 days</p>
            <p className="mt-2 text-2xl font-semibold text-text-primary">{formatNumber(stats.last30)}</p>
          </div>
        </section>
      ) : null}

      {unauthorized ? (
        <div className="rounded-xl border border-error-border bg-error-bg p-4 text-sm text-error">
          Access denied. Sign in with an admin account.
        </div>
      ) : serviceRoleMissing ? (
        <div className="rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning">
          Supabase service role key is missing. Add <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to your environment to enable admin user management.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-hairline bg-surface p-6 text-sm text-text-secondary shadow-card">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error-border bg-error-bg p-4 text-sm text-error">
          {error.message || 'Failed to load users.'}
        </div>
      ) : fetchError ? (
        <div className="rounded-xl border border-error-border bg-error-bg p-4 text-sm text-error">
          {fetchError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-card">
          <table className="min-w-full divide-y divide-hairline text-sm">
            <thead className="bg-surface-2 text-text-secondary">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">User ID</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Last sign-in</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data?.users?.map((user) => (
                <tr key={user.id} className="hover:bg-bg">
                  <td className="px-4 py-3 text-text-primary">{user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-text-tertiary">{user.id}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="rounded-lg border border-brand/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand transition hover:bg-brand/10"
                      href={`/admin/users/${user.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.users?.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-text-tertiary" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && data?.users ? (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Page {data.pagination.page} · {data.pagination.perPage} rows
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-hairline px-2 py-1 text-text-secondary disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-hairline px-2 py-1 text-text-secondary disabled:opacity-40"
              disabled={!data.pagination || !data.pagination.nextPage}
              onClick={() =>
                setPage((p) => (data.pagination && data.pagination.nextPage ? data.pagination.nextPage : p))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
