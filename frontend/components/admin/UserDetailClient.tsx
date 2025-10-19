'use client';

import Link from 'next/link';
import useSWR from 'swr';

type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
  factors: unknown[];
  isAdmin: boolean;
};

type WalletResponse = {
  ok: boolean;
  balanceCents: number;
  balance: number;
  currency: string;
  mock: boolean;
  stats: Record<string, number> | null;
};

type ReceiptsResponse =
  | {
      ok: true;
      receipts: Array<{
        id: number;
        type: string;
        amount_cents: number;
        currency: string;
        description: string | null;
        created_at: string;
        job_id: string | null;
      }>;
    }
  | { ok: false; error?: string; message?: string };

type JobsResponse =
  | {
      ok: true;
      jobs: Array<{
        id: number;
        job_id: string;
        engine_id: string;
        engine_label: string;
        status: string;
        progress: number;
        duration_sec: number;
        created_at: string;
        updated_at: string;
        final_price_cents: number | null;
      }>;
    }
  | { ok: false; error?: string; message?: string };

const fetcher = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  const json = (await res.json().catch(() => null)) as T | null;
  if (!res.ok) {
    let message: string | null = null;
    if (json && typeof json === 'object' && 'error' in json) {
      const candidate = (json as Record<string, unknown>).error;
      if (typeof candidate === 'string' && candidate.trim()) {
        message = candidate;
      }
    }
    throw new Error(message ?? res.statusText);
  }
  if (json === null) {
    throw new Error('Invalid response from server');
  }
  return json;
};

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

type UserResponse =
  | {
      ok: true;
      user: AdminUser;
    }
  | { ok: false; error?: string; message?: string };

export default function UserDetailClient({ userId }: { userId: string }) {
  const { data: userData, error: userError } = useSWR<UserResponse>(`/api/admin/users/${userId}`, fetcher);
  const { data: walletData } = useSWR<WalletResponse>(`/api/admin/users/${userId}/wallet`, fetcher);
  const { data: receiptsData } = useSWR<ReceiptsResponse>(`/api/admin/users/${userId}/receipts?limit=25`, fetcher);
  const { data: jobsData } = useSWR<JobsResponse>(`/api/admin/users/${userId}/jobs?limit=20`, fetcher);

  const jobsError = jobsData && jobsData.ok === false ? jobsData.error ?? jobsData.message ?? 'Failed to load jobs.' : null;
  const receiptsError =
    receiptsData && receiptsData.ok === false
      ? receiptsData.error ?? receiptsData.message ?? 'Failed to load receipts.'
      : null;

  if (userError) {
    return (
      <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
        {userError.message || 'Failed to load user details.'}
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        Loading…
      </div>
    );
  }

  if (userData.ok === false) {
    const message = userData.message ?? userData.error ?? 'Admin service role key is missing.';
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
        {message}
      </div>
    );
  }

  const user = userData.user;

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="text-sm text-slate-400 transition hover:text-slate-200">
        ← Back to users
      </Link>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white">Identity</h2>
          <dl className="mt-4 space-y-2 text-sm text-slate-300">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="font-medium text-slate-100">{user.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">User ID</dt>
              <dd className="font-mono text-xs text-slate-300">{user.id}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last sign-in</dt>
                <dd>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}</dd>
              </div>
            </div>
            <div>
              <dt className="text-slate-500">Admin</dt>
              <dd>{user.isAdmin ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-white">Wallet</h2>
          {walletData ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p className="text-2xl font-semibold text-emerald-300">
                {formatCurrency(walletData.balanceCents, walletData.currency)}
              </p>
              <p className="text-xs text-slate-500">{walletData.mock ? 'Mock balance' : 'Live ledger'}</p>
              {walletData.stats ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">Top-ups</p>
                    <p className="font-medium text-slate-200">
                      {formatCurrency(walletData.stats.topup ?? 0, walletData.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">Charges</p>
                    <p className="font-medium text-slate-200">
                      {formatCurrency(walletData.stats.charge ?? 0, walletData.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2">
                    <p className="text-slate-500">Refunds</p>
                    <p className="font-medium text-slate-200">
                      {formatCurrency(walletData.stats.refund ?? 0, walletData.currency)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Loading…</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Recent jobs</h3>
          <p className="text-xs text-slate-500">Latest renders submitted by this user.</p>
        </div>
        {jobsError ? (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {jobsError}
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Job</th>
                <th className="px-3 py-2 text-left font-medium">Engine</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {jobsData?.jobs?.map((job) => (
                <tr key={job.id} className="hover:bg-slate-900/60">
                  <td className="px-3 py-2 text-xs text-slate-400">{job.job_id}</td>
                  <td className="px-3 py-2 text-slate-100">{job.engine_label}</td>
                  <td className="px-3 py-2 text-slate-300">{job.status}</td>
                  <td className="px-3 py-2 text-slate-300">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-slate-200">
                    {job.final_price_cents != null
                      ? formatCurrency(job.final_price_cents, 'USD')
                      : '—'}
                  </td>
                </tr>
              ))}
              {jobsData?.jobs?.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-400" colSpan={5}>
                    No jobs recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Transactions</h3>
          <p className="text-xs text-slate-500">Latest wallet activity.</p>
        </div>
        {receiptsError ? (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
            {receiptsError}
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {receiptsData && receiptsData.ok
                ? receiptsData.receipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-slate-900/60">
                      <td className="px-3 py-2 text-slate-300">{receipt.type}</td>
                      <td className="px-3 py-2 text-slate-400">{receipt.description ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-300">{new Date(receipt.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-slate-100">
                        {formatCurrency(receipt.amount_cents, receipt.currency)}
                      </td>
                    </tr>
                  ))
                : null}
              {receiptsData && receiptsData.ok && receiptsData.receipts.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-400" colSpan={4}>
                    No transactions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
