import { withDbTransaction } from '@/lib/db';
import { readPurchases, readLedger, type PurchaseRow, type LedgerRow } from './data';
import type { ReportPeriod } from './period';

export function readFinanceSummary(period: ReportPeriod) {
  return withDbTransaction(async (tx) => {
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const jobs = await readPurchases(period, tx.query);
    const receipts = await readLedger(period, tx.query);
    return routingFinanceSummary(jobs, receipts);
  });
}

function counters() {
  return {
    jobs: 0,
    delivered: 0,
    fallbacks: 0,
    priced: 0,
    costMicros: 0,
    comparable: 0,
    baselineMicros: 0,
    savingsMicros: 0,
  };
}
type Counters = ReturnType<typeof counters>;
function count(group: Counters, row: PurchaseRow) {
  group.jobs++;
  if (row.fallback) group.fallbacks++;
  if (row.status !== 'completed') return;
  group.delivered++;
  if (row.estimateMicros !== null) {
    group.priced++;
    group.costMicros += row.estimateMicros;
  }
  if (row.baselineMicros !== null && row.selectedMicros !== null) {
    group.comparable++;
    group.baselineMicros += row.baselineMicros;
    group.savingsMicros += row.baselineMicros - row.selectedMicros;
  }
}

export function routingFinanceSummary(jobs: PurchaseRow[], receipts: LedgerRow[]) {
  const total = counters();
  const groups = new Map<string, Counters & { engine: string; provider: string | null }>();
  for (const row of jobs) {
    const key = JSON.stringify([row.engine, row.provider]);
    const group = groups.get(key) ?? { ...counters(), engine: row.engine, provider: row.provider };
    count(total, row);
    count(group, row);
    groups.set(key, group);
  }
  const money = new Map<string, { currency: string; charges: number; refunds: number; count: number }>();
  const posted = new Map<string, { usdOnly: boolean; charged: boolean; netCents: number }>();
  for (const row of receipts) {
    const currency = row.currency ?? 'unspecified';
    const group = money.get(currency) ?? { currency, charges: 0, refunds: 0, count: 0 };
    if (row.kind === 'charge') group.charges += row.cents;
    else group.refunds += row.cents;
    group.count++;
    money.set(currency, group);
    const job = posted.get(row.job) ?? { usdOnly: true, charged: false, netCents: 0 };
    job.usdOnly &&= currency === 'USD';
    job.charged ||= row.kind === 'charge';
    job.netCents += row.kind === 'charge' ? row.cents : -row.cents;
    posted.set(row.job, job);
  }
  const spread = { jobs: 0, micros: 0 };
  for (const row of jobs) {
    const entry = posted.get(row.job);
    if (entry?.usdOnly && entry.charged && row.status === 'completed' && row.estimateMicros !== null) {
      spread.jobs++;
      spread.micros += entry.netCents * 10_000 - row.estimateMicros;
    }
  }
  return {
    total,
    spread,
    routes: [...groups.values()].sort(
      (a, b) =>
        b.jobs - a.jobs || a.engine.localeCompare(b.engine) || (a.provider ?? '').localeCompare(b.provider ?? ''),
    ),
    receipts: [...money.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
