'use client';

import { useMemo } from 'react';
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
        video_url: string | null;
        thumb_url: string | null;
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
  const jobEntries = useMemo(
    () => (jobsData && jobsData.ok ? jobsData.jobs : []),
    [jobsData]
  );
  const videoEntries = useMemo(
    () => jobEntries.filter((job) => typeof job.video_url === 'string' && job.video_url.trim().length),
    [jobEntries]
  );
  const receiptEntries = receiptsData && receiptsData.ok ? receiptsData.receipts : [];

  if (userError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {userError.message || 'Failed to load user details.'}
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="rounded-xl border border-hairline bg-white p-6 text-sm text-text-secondary shadow-card">
        Loading…
      </div>
    );
  }

  if (userData.ok === false) {
    const message = userData.message ?? userData.error ?? 'Admin service role key is missing.';
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        {message}
      </div>
    );
  }

  const user = userData.user;

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="text-sm text-text-secondary transition hover:text-text-primary">
        ← Back to users
      </Link>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">Identity</h2>
          <dl className="mt-4 space-y-2 text-sm text-text-secondary">
            <div>
              <dt className="text-text-tertiary">Email</dt>
              <dd className="font-medium text-text-primary">{user.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">User ID</dt>
              <dd className="font-mono text-xs text-text-tertiary">{user.id}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-text-tertiary">Created</dt>
                <dd>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</dd>
              </div>
              <div>
                <dt className="text-text-tertiary">Last sign-in</dt>
                <dd>{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : '—'}</dd>
              </div>
            </div>
            <div>
              <dt className="text-text-tertiary">Admin</dt>
              <dd>{user.isAdmin ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary">Wallet</h2>
          {walletData ? (
            <div className="mt-4 space-y-3 text-sm text-text-secondary">
              <p className="text-2xl font-semibold text-accent">
                {formatCurrency(walletData.balanceCents, walletData.currency)}
              </p>
              <p className="text-xs text-text-tertiary">{walletData.mock ? 'Mock balance' : 'Live ledger'}</p>
              {walletData.stats ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-hairline bg-bg p-2">
                    <p className="text-text-tertiary">Top-ups</p>
                    <p className="font-medium text-text-primary">
                      {formatCurrency(walletData.stats.topup ?? 0, walletData.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-hairline bg-bg p-2">
                    <p className="text-text-tertiary">Charges</p>
                    <p className="font-medium text-text-primary">
                      {formatCurrency(walletData.stats.charge ?? 0, walletData.currency)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-hairline bg-bg p-2">
                    <p className="text-text-tertiary">Refunds</p>
                    <p className="font-medium text-text-primary">
                      {formatCurrency(walletData.stats.refund ?? 0, walletData.currency)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-text-secondary">Loading…</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Recent jobs</h3>
          <p className="text-xs text-text-tertiary">Latest renders submitted by this user.</p>
        </div>
        {jobsError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {jobsError}
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-hairline text-sm">
            <thead className="bg-neutral-50 text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Job</th>
                <th className="px-3 py-2 text-left font-medium">Engine</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {jobEntries.map((job) => (
                <tr key={job.id} className="hover:bg-bg">
                  <td className="px-3 py-2 text-xs text-text-tertiary">{job.job_id}</td>
                  <td className="px-3 py-2 text-text-primary">{job.engine_label}</td>
                  <td className="px-3 py-2 text-text-secondary">{job.status}</td>
                  <td className="px-3 py-2 text-text-secondary">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-text-primary">
                    {job.final_price_cents != null
                      ? formatCurrency(job.final_price_cents, 'USD')
                      : '—'}
                  </td>
                </tr>
              ))}
              {jobsError ? null : jobEntries.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-text-tertiary" colSpan={5}>
                    No jobs recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Video previews</h3>
          <p className="text-xs text-text-tertiary">Validate that media assets remain accessible.</p>
        </div>
        {videoEntries.length === 0 ? (
          <div className="mt-6 rounded-xl border border-hairline bg-bg p-6 text-center text-sm text-text-secondary">
            No video assets available yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {videoEntries.map((job) => (
              <article key={job.id} className="flex flex-col gap-3 rounded-xl border border-hairline bg-bg p-4">
                <div className="relative aspect-video overflow-hidden rounded-lg border border-hairline bg-black">
                  <video
                    src={job.video_url ?? undefined}
                    poster={job.thumb_url ?? undefined}
                    controls
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  >
                    <track kind="captions" />
                  </video>
                </div>
                <div className="space-y-1 text-xs text-text-secondary">
                  <p className="font-semibold text-text-primary">{job.engine_label}</p>
                  <p className="font-mono text-[11px] text-text-tertiary break-all">Job: {job.job_id}</p>
                  <p>Status: {job.status} · Progress: {job.progress}%</p>
                  <p>Created: {new Date(job.created_at).toLocaleString()}</p>
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span>{job.duration_sec ?? 0}s</span>
                    <a
                      href={job.video_url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      Open externally
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Transactions</h3>
          <p className="text-xs text-text-tertiary">Latest wallet activity.</p>
        </div>
        {receiptsError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {receiptsError}
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-hairline text-sm">
            <thead className="bg-neutral-50 text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {receiptEntries.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-bg">
                  <td className="px-3 py-2 text-text-secondary">{receipt.type}</td>
                  <td className="px-3 py-2 text-text-tertiary">{receipt.description ?? '—'}</td>
                  <td className="px-3 py-2 text-text-secondary">{new Date(receipt.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-text-primary">
                    {formatCurrency(receipt.amount_cents, receipt.currency)}
                  </td>
                </tr>
              ))}
              {receiptsError ? null : receiptEntries.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-text-tertiary" colSpan={4}>
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
