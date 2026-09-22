import Link from 'next/link';
import type { AdminOverview } from '@/server/admin-overview';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';

const time = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export function AdminDashboardView({ data }: { data: AdminOverview }) {
  const topups = data.finance?.totals.filter((row) => row.type === 'topup');
  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Overview"
        description="Registrations and wallet activity at a glance."
        actions={
          <form className="flex items-center gap-2">
            <label htmlFor="overview-range" className="sr-only">
              Reporting period
            </label>
            <select
              id="overview-range"
              name="range"
              defaultValue={data.window.period}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              <option value="today">Today</option>
              <option value="24h">Last 24 hours</option>
            </select>
            <button className="rounded-md border border-border px-3 py-2 text-sm">Apply</button>
          </form>
        }
      />
      <nav aria-label="Overview views" className="flex gap-6 border-b border-border text-sm">
        <Link className="border-b-2 border-brand pb-3 font-semibold text-brand" href="/admin" aria-current="page">
          Today
        </Link>
        <Link className="pb-3 text-text-secondary" href="/admin/insights">
          Trends
        </Link>
        <Link className="pb-3 text-text-secondary" href="/admin/mcp">
          MCP activity
        </Link>
      </nav>
      <AdminMetricGrid
        columnsClassName="sm:grid-cols-3"
        items={[
          {
            label: 'New users',
            value: data.users?.count ?? 'Unavailable',
            helper: 'Registered accounts · includes internal users',
          },
          {
            label: 'Wallet top-ups',
            value: topups ? topups.reduce((total, row) => total + row.count, 0) : 'Unavailable',
            helper: topups?.length
              ? topups.map((row) => money(row.cents, row.currency)).join(' · ')
              : 'Includes manual credits; not a cash revenue measure',
          },
          {
            label: 'Unresolved failures',
            value: data.finance?.unresolvedFailures ?? 'Unavailable',
            helper: <Link href="/admin/jobs">Review generation failures</Link>,
            tone: data.finance?.unresolvedFailures ? 'warning' : 'default',
          },
        ]}
      />
      <p className="text-xs text-text-secondary">
        {time(data.window.from)} – {time(data.window.to)} · Europe/Madrid · Loaded {time(data.loadedAt)} · Reload to
        update
      </p>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">New users</h2>
            <Link href="/admin/users" className="text-xs font-medium text-brand">
              Open directory
            </Link>
          </div>
          <AdminDataTable>
            <thead>
              <tr>
                <th className="px-3 py-3 text-xs text-text-secondary">Account</th>
                <th className="px-3 py-3 text-xs text-text-secondary">Registered</th>
                <th className="px-3 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.users?.recent.map((user) => (
                <tr key={user.id}>
                  <td className="px-3 py-3 font-medium">{user.email ?? user.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-text-secondary">{time(user.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                    <Link className="text-xs text-brand" href={`/admin/users/${user.id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {!data.users?.recent.length ? (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-text-secondary">
                    {data.users
                      ? 'No registrations in this period.'
                      : 'Registration data unavailable. Try reloading or open the user directory.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </AdminDataTable>
        </section>
        <aside className="space-y-6 xl:border-l xl:border-border xl:pl-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recent wallet activity</h2>
            <div className="divide-y divide-hairline">
              {data.finance?.recent.map((row) => (
                <Link
                  key={row.id}
                  href={`/admin/transactions?receipt=${row.id}`}
                  className="flex justify-between gap-3 py-3 text-sm"
                >
                  <span>
                    <span className="capitalize">{row.type}</span>
                    <span className="mt-1 block text-xs text-text-secondary">
                      #{row.id} · {time(row.createdAt)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {money(row.amountCents, row.currency)}
                  </span>
                </Link>
              ))}
            </div>
            {!data.finance?.recent.length ? (
              <p className="py-4 text-sm text-text-secondary">
                {data.finance ? 'No wallet activity in this period.' : 'Wallet data unavailable.'}
              </p>
            ) : null}
            <Link href="/admin/transactions" className="text-xs font-medium text-brand">
              All transactions
            </Link>
          </section>
          <section className="border-t border-border pt-5">
            <h2 className="mb-3 text-sm font-semibold">Publishing</h2>
            <div className="flex flex-col gap-3 text-sm text-brand">
              <Link href="/admin/moderation">Review media</Link>
              <Link href="/admin/editorial">Review articles</Link>
              <Link href="/admin/playlists">Curate site placements</Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
