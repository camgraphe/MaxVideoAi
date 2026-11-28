import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { PURCHASE_ROUTING_ENGINE_IDS } from '@/lib/video-purchase-decision';
import { query, type QueryExecutor } from '@/lib/db';
import {
  receiptRouteJoin,
  quotedServingMicros,
  receiptVideoPurchase,
  type ReceiptVideoEvidence,
} from '@/server/admin-transactions/video-purchase';
import type { ReportPeriod } from './period';

const scope = `j.surface = 'video' AND j.engine_id = ANY($3::text[])
  AND (j.user_id IS NULL OR j.user_id::text <> ALL($4::text[]))`;
const dates = (column: string) => `${column} >= ($1::date::timestamp AT TIME ZONE 'UTC')
  AND ${column} < (($2::date + 1)::timestamp AT TIME ZONE 'UTC')`;
const args = (period: ReportPeriod) => [
  period.from,
  period.to,
  PURCHASE_ROUTING_ENGINE_IDS,
  period.includeAdmin ? [] : ADMIN_EXCLUDED_USER_IDS,
];
type Evidence = ReceiptVideoEvidence & {
  job: string;
  at: Date;
  remote: string | null;
  linked: boolean;
  attempts: number;
  units: unknown;
  costSource: string | null;
};
export type PurchaseRow = ReturnType<typeof purchaseRow>;
export type LedgerRow = {
  at: Date;
  receipt: string;
  original: string | null;
  job: string;
  engine: string;
  kind: 'charge' | 'refund';
  cents: number;
  currency: string | null;
};
export type AttemptRow = {
  at: Date;
  job: string;
  engine: string;
  id: string;
  ordinal: number;
  provider: string;
  remote: string | null;
  status: string;
  previous: string | null;
  recordedUsd: string | null;
  units: string | null;
};

const confirmed = `NULLIF(BTRIM(j.provider_job_id),'') IS NOT NULL AND
  (trail.attempts=0 OR (receipt_route.n=1 AND receipt_route.provider=j.provider AND receipt_route.remote=j.provider_job_id))`;
const purchases = `SELECT j.job_id AS job, j.created_at AS at, j.engine_id AS engine, j.status,
    j.final_price_cents AS price, j.currency, CASE WHEN ${confirmed} THEN j.provider END AS provider,
    CASE WHEN ${confirmed} THEN j.provider_job_id END AS remote, trail.attempts, trail.linked,
    j.cost_breakdown_usd->>'provider' AS "costOwner", j.cost_breakdown_usd->>'provider_cost_source' AS "costSource",
    j.cost_breakdown_usd->'final_unit_deduction' AS units, j.cost_breakdown_usd->>'provider_cost_status' AS "costStatus",
    COALESCE(j.cost_breakdown_usd->'provider_cost_usd_list', j.cost_breakdown_usd->'provider_cost_usd') AS "listUsd",
    receipt_route.plan AS route
  FROM app_jobs j ${receiptRouteJoin}
  LEFT JOIN LATERAL (SELECT count(*)::integer AS attempts, COALESCE(bool_or(next.id IS NOT NULL),false) AS linked
    FROM provider_attempts a LEFT JOIN provider_attempts next ON next.id=a.fallback_to_attempt_id
      AND next.job_id=a.job_id AND next.attempt_index=a.attempt_index+1 AND next.provider<>a.provider
    WHERE a.job_id=j.id) trail ON true
  WHERE ${dates('j.created_at')} AND ${scope} ORDER BY j.created_at,j.id`;

// Refunds may only carry the original charge reference. Both joins require the same ledger owner.
const ledger = `SELECT r.created_at AS at,r.id::text AS receipt,original.id::text AS original,
    j.job_id AS job,j.engine_id AS engine,r.type AS kind,r.amount_cents AS cents,upper(r.currency) AS currency
  FROM app_receipts r LEFT JOIN app_receipts original
    ON r.type='refund' AND original.id=CASE WHEN r.metadata->>'original_receipt_id' ~ '^[0-9]{1,19}$'
      AND (length(r.metadata->>'original_receipt_id') < 19 OR (r.metadata->>'original_receipt_id') COLLATE "C" <= '9223372036854775807')
      THEN (r.metadata->>'original_receipt_id')::bigint END
    AND original.type='charge' AND original.user_id=r.user_id AND (r.job_id IS NULL OR original.job_id=r.job_id)
  JOIN app_jobs j ON j.job_id=COALESCE(r.job_id,original.job_id) AND j.user_id=r.user_id
  WHERE ${dates('r.created_at')} AND r.type IN ('charge','refund') AND ${scope} ORDER BY r.created_at,r.id`;

function purchaseRow(evidence: Evidence) {
  const purchase = receiptVideoPurchase(evidence);
  const plan = evidence.route;
  // Use the same saved quote basis for both sides, even when a separate usage-based cost is available.
  const winnerMicros = quotedServingMicros(evidence);
  const baseline = plan?.baselineProvider;
  const matches =
    typeof baseline === 'string' && Array.isArray(plan?.candidates)
      ? plan.candidates.filter((offer) => offer?.provider === baseline)
      : [];
  const reference = matches[0];
  const comparable =
    evidence.status === 'completed' &&
    winnerMicros !== null &&
    matches.length === 1 &&
    (reference.excluded === null ||
      (typeof reference.excluded === 'string' && reference.excluded.startsWith('After terminal '))) &&
    typeof reference.costMicros === 'number' &&
    Number.isSafeInteger(reference.costMicros) &&
    reference.costMicros >= 0;
  const usdToMicros = (usd: number) => {
    const micros = Math.round(usd * 1_000_000);
    return Number.isSafeInteger(micros) && micros >= 0 ? micros : null;
  };
  const units =
    purchase.provider === 'kling_direct' &&
    evidence.costOwner === purchase.provider &&
    evidence.costSource === 'kling_final_unit_deduction' &&
    typeof evidence.units === 'number' &&
    Number.isFinite(evidence.units) &&
    evidence.units >= 0
      ? evidence.units
      : null;
  const converted =
    units !== null &&
    evidence.status === 'completed' &&
    typeof evidence.listUsd === 'number' &&
    Number.isFinite(evidence.listUsd) &&
    evidence.listUsd >= 0
      ? usdToMicros(evidence.listUsd)
      : null;
  return {
    job: evidence.job,
    at: evidence.at,
    engine: evidence.engine,
    status: evidence.status,
    provider: purchase.provider,
    remote: purchase.provider ? evidence.remote : null,
    attempts: evidence.attempts,
    fallback: evidence.linked,
    quote: purchase.quote,
    estimateMicros: converted ?? (purchase.estimate ? usdToMicros(purchase.estimate.usd) : null),
    basis: converted !== null ? 'reported_units_at_rate' : (purchase.estimate?.basis ?? null),
    baseline: comparable ? baseline! : null,
    baselineMicros: comparable ? reference.costMicros! : null,
    selectedMicros: comparable ? winnerMicros : null,
    units,
  };
}

export async function readPurchases(period: ReportPeriod, execute: QueryExecutor['query'] = query) {
  return (await execute<Evidence>(purchases, args(period))).map(purchaseRow);
}
export async function readLedger(period: ReportPeriod, execute: QueryExecutor['query'] = query) {
  return execute<LedgerRow>(ledger, args(period));
}
export async function readAttempts(period: ReportPeriod, execute: QueryExecutor['query'] = query) {
  return execute<AttemptRow>(
    `SELECT a.created_at AS at,j.job_id AS job,j.engine_id AS engine,
    a.id::text AS id,a.attempt_index AS ordinal,a.provider,a.provider_job_id AS remote,a.status,
    prior.id::text AS previous,a.provider_cost_usd::text AS "recordedUsd",a.provider_cost_units::text AS units
    FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id LEFT JOIN provider_attempts prior
      ON prior.job_id=a.job_id AND prior.fallback_to_attempt_id=a.id AND prior.attempt_index=a.attempt_index-1
    WHERE ${dates('a.created_at')} AND ${scope} ORDER BY a.created_at,a.id`,
    args(period),
  );
}
