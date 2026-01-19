import Link from 'next/link';
import { isDatabaseConfigured } from '@/lib/db';
import { fetchMarketingOptIns } from '@/server/admin-marketing';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminMarketingOptInsPage() {
  if (!isDatabaseConfigured()) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-text-primary">Marketing opt-ins</h1>
        <p className="text-sm text-text-secondary">
          Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to view marketing consent
          stats.
        </p>
      </div>
    );
  }

  const records = await fetchMarketingOptIns();
  const now = Date.now();
  const last7 = records.filter((record) => record.optedInAt && new Date(record.optedInAt).getTime() >= now - 7 * DAY_MS).length;
  const last30 = records.filter((record) => record.optedInAt && new Date(record.optedInAt).getTime() >= now - 30 * DAY_MS).length;
  const csvHref = '/api/admin/marketing/opt-ins?format=csv';

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-text-primary">Marketing opt-ins</h1>
        <p className="text-sm text-text-secondary">
          Track the members who agreed to receive promotional email updates. Use the export to sync with your marketing platform.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Total opt-ins</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{records.length}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Last 7 days</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{last7}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
          <p className="text-xs uppercase tracking-[0.18em] text-text-tertiary">Last 30 days</p>
          <p className="mt-2 text-3xl font-semibold text-text-primary">{last30}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-white p-4 shadow-card">
        <div className="text-sm text-text-secondary">
          List updates automatically when members toggle their marketing preference inside Settings → Notifications.
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-2 rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Export CSV
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-white shadow-card">
        <table className="min-w-full divide-y divide-hairline text-sm">
          <thead className="bg-neutral-50 text-text-secondary">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">User ID</th>
              <th className="px-4 py-3 text-left font-medium">Opt-in date</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {records.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-text-tertiary" colSpan={4}>
                  No marketing opt-ins recorded yet.
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record.userId} className="hover:bg-bg">
                  <td className="px-4 py-3 text-text-primary">{record.email ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-tertiary">{record.userId}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatDate(record.optedInAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/users/${record.userId}`}
                      className="rounded-lg border border-brand/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand transition hover:bg-brand/10"
                    >
                      View member
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
