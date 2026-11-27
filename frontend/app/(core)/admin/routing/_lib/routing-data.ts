import { query, isDatabaseConfigured } from '@/lib/db';
import { type PurchaseCandidate, type PurchaseStrategy } from '@/lib/video-purchase-decision';
export type RoutingJob = {
  job_id: string;
  engine_id: string;
  provider: string | null;
  status: string;
  created_at: string;
  attempts: { provider: string; status: string; reason: string | null }[];
  purchase_mode: string | null;
  strategy: PurchaseStrategy | null;
  ranked: string[] | null;
  candidates: PurchaseCandidate[] | null;
  ceiling_micros: string | null;
};
export async function recentRoutingJobs(): Promise<RoutingJob[] | null> {
  if (!isDatabaseConfigured()) return null;
  return query<RoutingJob>(`WITH recent AS (
    SELECT id, job_id, engine_id, provider, status, created_at FROM app_jobs
    WHERE surface = 'video' ORDER BY created_at DESC, id DESC LIMIT 24
  ) SELECT recent.job_id, recent.engine_id, recent.provider, recent.status, recent.created_at,
    COALESCE(ledger.attempts, '[]'::jsonb) AS attempts,
    primary_attempt.request_snapshot #>> '{purchaseRouting,mode}' AS purchase_mode,
    primary_attempt.request_snapshot #>> '{purchaseRouting,strategy}' AS strategy,
    primary_attempt.request_snapshot #> '{purchaseRouting,order}' AS ranked,
    primary_attempt.request_snapshot #> '{purchaseRouting,candidates}' AS candidates,
    primary_attempt.request_snapshot #>> '{purchaseRouting,ceilingMicros}' AS ceiling_micros
    FROM recent LEFT JOIN provider_attempts primary_attempt ON primary_attempt.job_id = recent.id AND primary_attempt.attempt_index = 1
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('provider', provider, 'status', status, 'reason', error_class)
        ORDER BY attempt_index) AS attempts FROM provider_attempts WHERE job_id = recent.id
    ) ledger ON true ORDER BY recent.created_at DESC,recent.id DESC`);
}
