import { query } from '@/lib/db';

type PendingFinishingJob = { job_id: string; user_id: string };
const defaults = {
  query,
  refresh: async (userId: string, jobId: string) => {
    const [{ refreshFinishingTool }, { readFinishingExecution, readFinishingJob }] = await Promise.all([
      import('./finishing-status'), import('./finishing-jobs'),
    ]);
    // Hiding a row in a user's history must not stop its payment reconciliation.
    return refreshFinishingTool(userId, jobId, {
      read: (owner, id) => readFinishingExecution(owner, id, { includeHidden: true }),
      status: (owner, id) => readFinishingJob(owner, id, { includeHidden: true }),
    });
  },
};

/** A bounded phase of the existing Fal cron, never a submission or a new scheduler. */
export async function reconcileFinishingJobs(dependencies: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...dependencies };
  const rows = await deps.query<PendingFinishingJob>(`SELECT job_id, user_id FROM app_jobs
    WHERE surface='tool' AND engine_id='toolbox-finishing' AND user_id IS NOT NULL
      AND payment_status='paid_wallet' AND status IN ('pending','queued','running','processing','failed')
    ORDER BY COALESCE(settings_snapshot->>'lastFinishingPollAt',''), updated_at, job_id
    LIMIT 10`);
  let reconciled = 0;
  let failures = 0;
  for (const job of rows) {
    try {
      await deps.refresh(job.user_id, job.job_id);
      reconciled += 1;
    } catch {
      failures += 1;
      console.warn('[finishing-poll] reconciliation deferred');
    } finally {
      // Rotate unfinished rows without renewing the submission/finalization lease.
      try {
        await deps.query(`UPDATE app_jobs SET settings_snapshot=jsonb_set(
          COALESCE(settings_snapshot,'{}'::jsonb),'{lastFinishingPollAt}',to_jsonb(NOW()::text))
          WHERE job_id=$1 AND user_id=$2 AND surface='tool' AND engine_id='toolbox-finishing'
            AND payment_status='paid_wallet' AND status IN ('pending','queued','running','processing','failed')`,
        [job.job_id, job.user_id]);
      } catch {
        failures += 1;
        console.warn('[finishing-poll] poll cursor deferred');
      }
    }
  }
  return { checked: rows.length, reconciled, failures };
}
