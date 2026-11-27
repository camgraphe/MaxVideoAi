import type { VideoPurchase } from './types';

type Plan = {
  mode?: string; engineId?: string; order?: unknown;
  candidates?: { provider?: string; excluded?: string | null; costMicros?: number }[];
};
export type ReceiptVideoEvidence = {
  price: number | null; currency: string | null; engine: string; provider: string | null;
  status: string; costOwner: string | null; costStatus: string | null; listUsd: unknown;
  route: Plan | null;
};

// Run only when an admin opens one receipt. Match the accepted remote task on this job.
// A fallback quote may be stored on its linked predecessor.
export const receiptRouteJoin = `LEFT JOIN LATERAL (
  SELECT count(*) AS n, min(a.provider) AS provider, min(a.provider_job_id) AS remote,
         (array_agg(COALESCE(a.request_snapshot->'purchaseRouting', predecessor.request_snapshot->'purchaseRouting')))[1] AS plan
  FROM provider_attempts a
  LEFT JOIN provider_attempts predecessor ON predecessor.job_id=a.job_id
    AND predecessor.fallback_to_attempt_id=a.id AND predecessor.attempt_index=a.attempt_index-1
  WHERE a.job_id=j.id AND (a.accepted_at IS NOT NULL OR a.status IN ('accepted','completed'))
) receipt_route ON true`;

export function receiptPurchaseProjection(hasAttempts: boolean) {
  const confirmed = `NULLIF(btrim(j.provider_job_id),'') IS NOT NULL` + (hasAttempts
    ? ` AND (receipt_route.n=0 OR (receipt_route.n=1 AND receipt_route.provider=j.provider AND receipt_route.remote=j.provider_job_id))` : '');
  return `CASE WHEN r.type IN ('charge','refund') AND j.surface='video' AND j.user_id::text=r.user_id::text
    THEN jsonb_build_object(
      'price', j.final_price_cents, 'currency', j.currency, 'engine', j.engine_id, 'status', j.status,
      'provider', CASE WHEN ${confirmed} THEN j.provider END,
      'costOwner', j.cost_breakdown_usd->>'provider', 'costStatus', j.cost_breakdown_usd->>'provider_cost_status',
      'listUsd', COALESCE(j.cost_breakdown_usd->'provider_cost_usd_list', j.cost_breakdown_usd->'provider_cost_usd'),
      'route', ${hasAttempts ? 'receipt_route.plan' : 'NULL::jsonb'}) END`;
}

const listStatuses = new Set([
  'list_estimate_from_provider_usage', 'list_estimate_from_verified_durations', 'list_estimate_from_provider_duration',
  'list_estimate_from_requested_duration', 'list_estimate_from_dimensions',
]);

export function receiptVideoPurchase(row: ReceiptVideoEvidence): VideoPurchase {
  const quote = typeof row.price === 'number' && Number.isSafeInteger(row.price) && row.price >= 0 && row.currency && /^[A-Z]{3}$/i.test(row.currency)
    ? { cents: row.price, currency: row.currency.toUpperCase() } : null;
  const result: VideoPurchase = { quote, provider: row.provider, estimate: null };
  if (!row.provider) return result;
  if (row.status === 'completed' && row.provider === row.costOwner && listStatuses.has(row.costStatus ?? '')
    && typeof row.listUsd === 'number' && Number.isFinite(row.listUsd) && row.listUsd >= 0) {
    result.estimate = { usd: row.listUsd, basis: 'completed_list' };
    return result;
  }
  const plan = row.route;
  if (plan?.mode !== 'canary' || plan.engineId !== row.engine || !Array.isArray(plan.order)
    || !plan.order.includes(row.provider) || !Array.isArray(plan.candidates)) return result;
  const matches = plan.candidates.filter(candidate => candidate?.provider === row.provider);
  const offer = matches[0];
  if (matches.length === 1 && offer.excluded === null && typeof offer.costMicros === 'number'
    && Number.isSafeInteger(offer.costMicros) && offer.costMicros >= 0) {
    result.estimate = { usd: offer.costMicros / 1_000_000, basis: 'routing_quote' };
  }
  return result;
}
