import type { PurchaseRow, LedgerRow, AttemptRow } from './data';
import type { routingFinanceSummary } from './summary';

type Cell = string | number | null;
function field(value: Cell) {
  if (value === null) return '';
  if (typeof value === 'number') return String(value);
  // Prevent spreadsheet formulas in external identifiers and quote RFC 4180 delimiters.
  const text = /^(?:\s*[=+@-]|[\t\r\n])/.test(value) ? "'" + value : value;
  return '"' + text.replaceAll('"', '""') + '"';
}
function csv(header: string[], rows: Cell[][]) {
  const extractedAt = new Date().toISOString();
  const lines = [[...header, 'extracted_at_utc'].map(field).join(',')];
  for (const row of rows) lines.push([...row, extractedAt].map(field).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
const usd = (micros: number | null) => (micros === null ? null : Number((micros / 1_000_000).toFixed(6)));

export function summaryCsv(report: ReturnType<typeof routingFinanceSummary>) {
  const rows: Cell[][] = [];
  function add(scope: string, engine: string | null, provider: string | null, group: typeof report.total) {
    const key = [scope, engine, provider];
    rows.push(
      [...key, 'jobs', 'count', group.jobs],
      [...key, 'delivered', 'count', group.delivered],
      [...key, 'linked_fallbacks', 'count', group.fallbacks],
      [...key, 'priced_deliveries', 'count', group.priced],
      [...key, 'serving_cost_estimate', 'USD', group.priced ? usd(group.costMicros) : null],
      [...key, 'mean_serving_cost_estimate', 'USD', group.priced ? usd(group.costMicros / group.priced) : null],
      [...key, 'comparable_deliveries', 'count', group.comparable],
      [...key, 'estimated_routing_savings', 'USD', group.comparable ? usd(group.savingsMicros) : null],
    );
  }
  add('period', null, null, report.total);
  for (const route of report.routes) add('route', route.engine, route.provider, route);
  for (const row of report.receipts) {
    const key = ['receipts', null, null];
    rows.push(
      [...key, 'posted_receipts', 'count', row.count],
      [...key, 'debits', row.currency, row.charges / 100],
      [...key, 'refunds', row.currency, row.refunds / 100],
      [...key, 'net_usage', row.currency, (row.charges - row.refunds) / 100],
    );
  }
  rows.push(
    ['period', null, null, 'matched_usd_deliveries', 'count', report.spread.jobs],
    [
      'period',
      null,
      null,
      'net_usage_less_estimated_serving_cost',
      'USD',
      report.spread.jobs ? usd(report.spread.micros) : null,
    ],
  );
  return csv(['scope', 'engine', 'serving_supplier', 'metric', 'unit', 'value'], rows);
}

export function purchaseCsv(rows: PurchaseRow[]) {
  return csv(
    [
      'job_created_utc',
      'job_id',
      'engine',
      'job_status',
      'confirmed_supplier',
      'supplier_task_id',
      'recorded_attempts',
      'linked_fallback',
      'customer_quote_cents',
      'customer_quote_currency',
      'estimated_purchase_usd',
      'estimate_basis',
      'reported_kling_units',
      'reference_supplier',
      'reference_quote_usd',
      'selected_quote_usd',
      'estimated_routing_savings_usd',
    ],
    rows.map((row) => [
      row.at.toISOString(),
      row.job,
      row.engine,
      row.status,
      row.provider,
      row.remote,
      row.attempts,
      Number(row.fallback),
      row.quote?.cents ?? null,
      row.quote?.currency ?? null,
      usd(row.estimateMicros),
      row.basis,
      row.units,
      row.baseline,
      usd(row.baselineMicros),
      usd(row.selectedMicros),
      usd(
        row.baselineMicros === null || row.selectedMicros === null
          ? null
          : row.baselineMicros - row.selectedMicros,
      ),
    ]),
  );
}
export function ledgerCsv(rows: LedgerRow[]) {
  return csv(
    [
      'posted_utc',
      'receipt_id',
      'original_charge_receipt_id',
      'job_id',
      'engine',
      'entry_type',
      'currency',
      'amount_cents',
      'net_usage_cents',
    ],
    rows.map((row) => [
      row.at.toISOString(),
      row.receipt,
      row.original,
      row.job,
      row.engine,
      row.kind,
      row.currency,
      row.cents,
      row.kind === 'refund' ? -row.cents : row.cents,
    ]),
  );
}
export function attemptsCsv(rows: AttemptRow[]) {
  return csv(
    [
      'attempt_created_utc',
      'attempt_id',
      'job_id',
      'engine',
      'attempt_number',
      'supplier',
      'supplier_task_id',
      'status',
      'previous_linked_attempt_id',
      'attempt_ledger_usd_unreconciled',
      'attempt_ledger_units',
    ],
    rows.map((row) => [
      row.at.toISOString(),
      row.id,
      row.job,
      row.engine,
      row.ordinal,
      row.provider,
      row.remote,
      row.status,
      row.previous,
      row.recordedUsd,
      row.units,
    ]),
  );
}
