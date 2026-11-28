import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { requireAdmin } from '@/server/admin';
import { previousMonth, routingPeriod } from '@/server/admin-routing-finance/period';
import { readFinanceSummary } from '@/server/admin-routing-finance/summary';
import { FinanceResults } from './FinanceResults';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Routing economics · Admin' };
const path = '/admin/routing/summary';

export default async function RoutingSummaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch {
    return null;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === 'string') params.append(key, value);
    else for (const item of value ?? []) params.append(key, item);
  }
  const now = new Date();
  const period = routingPeriod(params, now);
  if (!period)
    return (
      <div role="alert">
        Choose a valid UTC period of up to 31 days ending today or earlier. <Link href={path}>Reset dates</Link>
      </div>
    );
  const scope = period.includeAdmin ? '&internal=1' : '';
  const filters = `from=${period.from}&to=${period.to}${scope}`;
  const last = previousMonth(now);
  const report = await readFinanceSummary(period).catch((error) => {
    console.error('[admin/routing/summary] report unavailable', error instanceof Error ? error.name : 'error');
    return null;
  });
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Link href="/admin/routing" className="text-sm font-medium text-text-secondary">
        ← Video routing
      </Link>
      <AdminPageHeader
        eyebrow="Video routing"
        title="Routing economics"
        description="Supplier costs, routing savings and customer receipts for the engines tracked by the video router."
      />
      <section aria-label="Report period" className="rounded-card border border-hairline bg-surface p-4">
        <form key={filters} action={path} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">
            From (UTC)
            <input
              type="date"
              name="from"
              required
              defaultValue={period.from}
              className="rounded-input border border-hairline bg-surface p-2"
            />
          </label>
          <label className="grid gap-1">
            Through (UTC)
            <input
              type="date"
              name="to"
              required
              defaultValue={period.to}
              max={now.toISOString().slice(0, 10)}
              className="rounded-input border border-hairline bg-surface p-2"
            />
          </label>
          <label className="flex items-center gap-2 py-2">
            <input type="checkbox" name="internal" value="1" defaultChecked={period.includeAdmin} />
            Include internal accounts
          </label>
          <button type="submit" className="rounded-input bg-text-primary px-4 py-2 font-semibold text-surface">
            Apply
          </button>
          <Link className="p-2 underline" href={path + (scope ? '?internal=1' : '')}>
            Last 30 days
          </Link>
          <Link className="p-2 underline" href={path + `?from=${last.from}&to=${last.to}${scope}`}>
            Previous month
          </Link>
        </form>
      </section>
      {report ? (
        <>
          <FinanceResults report={report} />
          <section className="rounded-card border border-hairline bg-surface p-5" aria-label="Accounting exports">
            <h2 className="text-lg font-semibold">Accounting exports</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Purchases follow job creation dates. The attempt ledger includes retries and failures by attempt date
              for invoice matching. The receipt journal follows posting dates.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {(
                [
                  ['summary', 'Period summary CSV'],
                  ['purchases', 'Supplier purchases CSV'],
                  ['attempts', 'Supplier attempts CSV'],
                  ['receipts', 'Receipt journal CSV'],
                ] as const
              ).map(([file, label]) => (
                <a
                  key={file}
                  download
                  className="rounded-input border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2"
                  href={'/api/admin/routing/finance?' + filters + '&file=' + file}
                >
                  {label} ↓
                </a>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p role="alert" className="rounded-card border border-hairline bg-surface p-5">
          Report data is unavailable. Refresh to retry.
        </p>
      )}
    </div>
  );
}
