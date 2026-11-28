import Link from 'next/link';
import type { routingFinanceSummary } from '@/server/admin-routing-finance/summary';
import { PROVIDER_LABELS } from '@/lib/video-purchase-decision';

type Report = ReturnType<typeof routingFinanceSummary>;
const usd = (micros: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(
    micros / 1_000_000,
  );
const decimal = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (n: number) => n.toLocaleString('en-US');
function supplier(id: string | null) {
  return id ? (PROVIDER_LABELS[id as keyof typeof PROVIDER_LABELS] ?? id) : 'Unconfirmed';
}
const panel = 'rounded-card border border-hairline bg-surface p-5';
function Metric({ name, value, detail }: { name: string; value: string; detail: string }) {
  return (
    <div className={panel}>
      <dt className="text-sm font-semibold text-text-secondary">{name}</dt>
      <dd className="my-2 text-3xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-text-secondary">{detail}</dd>
    </div>
  );
}
export function FinanceResults({ report }: { report: Report }) {
  const { total, routes, receipts, spread } = report;
  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Routing totals">
        <Metric
          name="Average supplier cost"
          value={total.priced ? usd(total.costMicros / total.priced) : '—'}
          detail={`Estimated on ${number(total.priced)} of ${number(total.delivered)} delivered jobs`}
        />
        <Metric
          name="Estimated serving cost"
          value={total.priced ? usd(total.costMicros) : '—'}
          detail="Priced deliveries, before any charges for failed attempts"
        />
        <Metric
          name="Estimated routing savings"
          value={total.comparable ? usd(total.savingsMicros) : '—'}
          detail={`${number(total.comparable)} deliveries with both purchase quotes recorded`}
        />
        <Metric
          name="Jobs with a fallback"
          value={number(total.fallbacks)}
          detail={`Confirmed handoffs across ${number(total.jobs)} jobs created`}
        />
      </dl>
      <section className={panel} aria-label="Supplier routes">
        <h2 className="text-lg font-semibold">Where jobs went</h2>
        <p className="mt-1 text-sm text-text-secondary">
          One row per model and serving supplier. Savings compare the saved reference and selected quotes on the
          same delivery. Supplier invoice reconciliation is pending.
        </p>
        <Link className="mt-2 inline-block text-sm underline" href="/admin/routing?view=replay">
          Compare simulated alternatives in the 30-day replay →
        </Link>
        {routes.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-xs text-text-secondary">
                <tr>
                  {[
                    'Model / supplier',
                    'Jobs',
                    'Fallbacks',
                    'Priced / delivered',
                    'Avg. cost',
                    'Est. savings',
                  ].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap px-2 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {routes.map((row) => (
                  <tr key={JSON.stringify([row.engine, row.provider])} className="border-t border-hairline">
                    <th scope="row" className="min-w-40 p-2 font-medium">
                      {supplier(row.provider)}
                      <span className="block text-xs font-normal text-text-secondary">{row.engine}</span>
                    </th>
                    <td className="min-w-20 p-2">
                      {number(row.jobs)}
                      <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full bg-brand"
                          style={{ width: `${(100 * row.jobs) / total.jobs}%` }}
                        />
                      </span>
                    </td>
                    <td className="p-2">{row.fallbacks}</td>
                    <td className="p-2">
                      {row.priced} / {row.delivered}
                    </td>
                    <td className="p-2">{row.priced ? usd(row.costMicros / row.priced) : '—'}</td>
                    <td className="p-2">{row.comparable ? usd(row.savingsMicros) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4">No routing jobs were created in this period.</p>
        )}
      </section>
      <section className={panel} aria-label="Customer receipt activity">
        <h2 className="text-lg font-semibold">Customer receipt activity</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Generation debits and refunds posted during the period, including refunds for earlier jobs. Amounts are
          grouped by original currency. Wallet top-ups are tracked separately in Transactions.
        </p>
        {receipts.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm tabular-nums">
              <thead>
                <tr>
                  {['Currency', 'Posted receipts', 'Debits', 'Refunds', 'Net usage'].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.map((row) => (
                  <tr key={row.currency} className="border-t border-hairline">
                    <th scope="row" className="p-2">
                      {row.currency}
                    </th>
                    <td className="p-2">{row.count}</td>
                    <td className="p-2">{decimal(row.charges)}</td>
                    <td className="p-2">{decimal(row.refunds)}</td>
                    <td className="p-2">{decimal(row.charges - row.refunds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4">No matching debits or refunds were posted.</p>
        )}
        <p className="mt-4 border-t border-hairline pt-3 text-sm">
          <strong>Net USD usage less estimated serving cost · {spread.jobs ? usd(spread.micros) : '—'}</strong>
          <br />
          <span className="text-text-secondary">
            {spread.jobs} priced deliveries with USD-only receipts in this period. Before other fees, costs and
            later refunds.
          </span>
        </p>
      </section>
    </>
  );
}
