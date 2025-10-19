'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo, useState, useEffect } from 'react';

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
  users: AdminUser[];
  pagination: { page: number; perPage: number; nextPage: number | null };
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as UsersResponse;
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

  const { data, error, isLoading, mutate } = useSWR<UsersResponse>(`/api/admin/users?${params}`, fetcher);

  const unauthorized = error?.message?.includes('Unauthorized') || error?.message?.includes('Forbidden');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Members</h2>
          <p className="text-sm text-slate-400">Recherche par email ou ID Supabase.</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:bg-slate-800"
          onClick={() => mutate()}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or user id"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
        />
      </div>

      {unauthorized ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Accès refusé. Connecte-toi avec un compte admin.
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
          Chargement…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error.message || 'Erreur lors du chargement des utilisateurs'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">User ID</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Last sign-in</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data?.users?.map((user) => (
                <tr key={user.id} className="hover:bg-slate-900/70">
                  <td className="px-4 py-3 text-slate-100">{user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{user.id}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 transition hover:bg-emerald-500/10"
                      href={`/admin/users/${user.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {data?.users?.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-400" colSpan={5}>
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination ? (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {data.pagination.page} · {data.pagination.perPage} lignes
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border border-slate-700 px-2 py-1 text-slate-200 disabled:opacity-40"
              disabled={!data.pagination.nextPage}
              onClick={() => setPage((p) => (data.pagination.nextPage ? data.pagination.nextPage : p))}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
