import { query } from '@/lib/db';
import { createVideoRouterClient } from './wan-prime';

// A completed clip can precede its final cost. Revisit its existing ID without touching delivery or the wallet.
export async function reconcileVideoRouterCosts(
  queryFn: <T>(sql: string, params?: unknown[]) => Promise<T[]> = query,
  client: Pick<ReturnType<typeof createVideoRouterClient>, 'getTask'> = createVideoRouterClient(),
) {
  const rows = await queryFn<{ id: string; provider_job_id: string }>(
    `WITH due AS (
       SELECT a.id FROM provider_attempts a JOIN app_jobs j ON j.id=a.job_id
        WHERE a.provider='videorouter' AND j.provider=a.provider AND j.provider_job_id=a.provider_job_id
          AND a.status IN ('completed','failed') AND j.status IN ('completed','failed')
          AND a.provider_cost_usd IS NULL AND a.accepted_at IS NOT NULL
          AND (a.response_snapshot->>'costCheckStarted' IS NULL OR a.updated_at < NOW() -
            CASE WHEN a.accepted_at > NOW()-INTERVAL '1 day' THEN INTERVAL '2 minutes' ELSE INTERVAL '1 day' END)
        ORDER BY a.updated_at, a.id LIMIT 4 FOR UPDATE OF a SKIP LOCKED
     )
     UPDATE provider_attempts a SET response_snapshot=COALESCE(a.response_snapshot,'{}'::jsonb)
       || '{"costCheckStarted":true}'::jsonb FROM due WHERE a.id=due.id RETURNING a.id,a.provider_job_id`
  );
  const results = await Promise.allSettled(rows.map(async (row) => {
    const task = await client.getTask(row.provider_job_id);
    const cost = task.providerCostUsd;
    if (cost == null || !['completed','failed'].includes(task.status)) return;
    await queryFn(
      `WITH settled AS (
         UPDATE provider_attempts SET provider_cost_usd=$3::numeric,
           response_snapshot=COALESCE(response_snapshot,'{}'::jsonb) || jsonb_build_object('cost_usd',$3::numeric)
          WHERE id=$1 AND provider='videorouter' AND provider_job_id=$2 AND provider_cost_usd IS NULL
          RETURNING job_id,provider,provider_job_id
       )
       UPDATE app_jobs j SET cost_breakdown_usd=COALESCE(j.cost_breakdown_usd,'{}'::jsonb) ||
         jsonb_build_object('provider',s.provider,'provider_cost_source','videorouter_job_cost_usd',
           'provider_cost_status','provider_reported','provider_cost_usd_effective',$3::numeric,
           'provider_cost_usd',$3::numeric,'vendor_cost_usd',$3::numeric)
       FROM settled s WHERE j.id=s.job_id AND j.provider=s.provider AND j.provider_job_id=s.provider_job_id`,
      [row.id, row.provider_job_id, cost],
    );
  }));
  return { checked: rows.length, errors: results.filter(result => result.status === 'rejected').length };
}
