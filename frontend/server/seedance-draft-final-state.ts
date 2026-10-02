import { query } from '@/lib/db';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

/** Outcomes are accepted only for the current owned final and its persisted lineage. */
export async function markSeedanceFinalState(
  userId: string,
  finalJobId: string,
  state: 'submitted' | 'completed' | 'failed',
  queryFn: QueryFn = query,
): Promise<boolean> {
  const rows = await queryFn<{ draft_job_id: string }>(`
    UPDATE seedance_draft_links d SET final_state = $3, updated_at = now()
    FROM app_jobs j
    WHERE d.user_id = $1 AND d.final_job_id = $2 AND d.draft_state = 'ready'
      AND j.job_id = d.final_job_id AND j.user_id = d.user_id
      AND j.engine_id = 'seedance-2-5' AND j.provider = 'byteplus_modelark'
      AND j.settings_snapshot #>> '{seedanceWorkflow,step}' = 'final'
      AND j.settings_snapshot #>> '{seedanceWorkflow,draftJobId}' = d.draft_job_id
      AND (
        ($3 = 'submitted' AND d.final_state IN ('reserved', 'submitted')
          AND j.status IN ('queued', 'running') AND j.provider_job_id IS NOT NULL)
        OR ($3 = 'completed' AND d.final_state IN ('reserved', 'submitted', 'completed')
          AND j.status = 'completed' AND j.provider_job_id IS NOT NULL)
        OR ($3 = 'failed' AND d.final_state IN ('reserved', 'submitted', 'failed') AND j.status = 'failed')
      )
    RETURNING d.draft_job_id
  `, [userId, finalJobId, state]);
  return rows.length === 1;
}

/** Never unlock a retry on provider uncertainty or an unverified/partial refund. */
export async function releaseRefundedSeedanceFinal(
  userId: string,
  draftJobId: string,
  finalJobId: string,
  queryFn: QueryFn = query,
): Promise<boolean> {
  const rows = await queryFn<{ draft_job_id: string }>(`
    UPDATE seedance_draft_links d
    SET final_job_id = NULL, final_state = 'none', updated_at = now()
    FROM app_jobs j
    WHERE d.user_id = $1 AND d.draft_job_id = $2 AND d.final_job_id = $3
      AND d.draft_state = 'ready' AND d.final_state = 'failed'
      AND j.job_id = d.final_job_id AND j.user_id = d.user_id
      AND j.engine_id = 'seedance-2-5' AND j.provider = 'byteplus_modelark' AND j.status = 'failed'
      AND j.settings_snapshot #>> '{seedanceWorkflow,step}' = 'final'
      AND j.settings_snapshot #>> '{seedanceWorkflow,draftJobId}' = d.draft_job_id
      AND j.payment_status IN ('refunded_wallet', 'refunded')
      AND j.final_price_cents > 0
      AND EXISTS (SELECT 1 FROM app_receipts r WHERE r.job_id = j.job_id AND r.user_id = j.user_id
        AND r.type = 'charge' AND r.amount_cents = j.final_price_cents AND upper(r.currency) = upper(j.currency))
      AND EXISTS (SELECT 1 FROM app_receipts r WHERE r.job_id = j.job_id AND r.user_id = j.user_id
        AND r.type = 'refund' AND r.amount_cents = j.final_price_cents AND upper(r.currency) = upper(j.currency))
    RETURNING d.draft_job_id
  `, [userId, draftJobId, finalJobId]);
  return rows.length === 1;
}
