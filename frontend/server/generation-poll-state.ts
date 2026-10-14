import { randomUUID } from 'node:crypto';
import { query } from '@/lib/db';

export const ACTIVE_GENERATION_POLL_MS = 15_000;
type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
export type GenerationPollClaim = { checked(): Promise<void>; release(): Promise<void> };

/** A shared throttle plus expiring lease prevents duplicate provider calls across tabs/cron. */
export async function claimGenerationPoll(jobId: string, queryFn: QueryFn = query,
  options: { leaseDurationMs?: number } = {}): Promise<GenerationPollClaim | null> {
  const token = randomUUID();
  const leaseDurationMs = Number.isFinite(options.leaseDurationMs)
    ? Math.max(120_000, Math.min(600_000, Math.trunc(options.leaseDurationMs!))) : 120_000;
  const rows = await queryFn<{ job_id: string }>(`INSERT INTO generation_poll_state(job_id,token,started_at,lease_until)
    SELECT job_id,$2,NOW(),NOW()+($3::integer * INTERVAL '1 millisecond') FROM app_jobs
      WHERE job_id=$1 AND status IN ('pending','queued','running','processing','in_progress','provider_polling_stalled')
    ON CONFLICT(job_id) DO UPDATE SET token=EXCLUDED.token,started_at=EXCLUDED.started_at,lease_until=EXCLUDED.lease_until
      WHERE generation_poll_state.lease_until < NOW()
        AND generation_poll_state.started_at <= NOW()-INTERVAL '15 seconds'
    RETURNING job_id`, [jobId, token, leaseDurationMs]);
  if (!rows.length) return null;
  return {
    checked: async () => { await queryFn('UPDATE generation_poll_state SET checked_at=NOW() WHERE job_id=$1 AND token=$2', [jobId, token]); },
    release: async () => { await queryFn('UPDATE generation_poll_state SET lease_until=NOW() WHERE job_id=$1 AND token=$2', [jobId, token]); },
  };
}
