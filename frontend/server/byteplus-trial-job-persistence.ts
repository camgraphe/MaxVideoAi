import { query } from '@/lib/db';

export type BytePlusTerminalTrialOutcome = 'failed' | 'timeout' | 'unknown';

type QueryFn = <T>(
  sql: string,
  params?: ReadonlyArray<unknown>,
) => Promise<T[]>;

export async function persistBytePlusTerminalFailure(
  input: {
    jobId: string;
    userMessage: string;
    trialOutcome: BytePlusTerminalTrialOutcome;
    activeStatuses: ReadonlyArray<string>;
  },
  queryFn: QueryFn = query,
): Promise<boolean> {
  const disposition = input.trialOutcome === 'failed'
    ? 'definitive_failure'
    : input.trialOutcome;
  const rows = await queryFn<{ job_id: string }>(
    `UPDATE app_jobs
        SET status = 'failed',
            progress = 0,
            message = $2,
            mcp_trial_outcome_disposition = CASE
              WHEN payment_status = 'included_mcp_trial' THEN $3
              ELSE mcp_trial_outcome_disposition
            END,
            provisional = FALSE,
            updated_at = NOW()
      WHERE job_id = $1
        AND status = ANY($4::text[])
      RETURNING job_id`,
    [input.jobId, input.userMessage, disposition, input.activeStatuses],
  );
  return rows.length === 1;
}
