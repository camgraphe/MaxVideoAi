import {
  applyTrialJobOutcome,
  type NormalizedTrialJobOutcome,
} from '@/server/agent-api/trial-outcomes';

type BytePlusTrialJob = {
  job_id: string;
  payment_status: string | null;
};

type BytePlusTrialOutcome = Extract<
  NormalizedTrialJobOutcome,
  { kind: 'completed' | 'failed' | 'timeout' | 'unknown' }
>;

export async function applyBytePlusTrialOutcomeSafely(
  job: BytePlusTrialJob,
  outcome: BytePlusTrialOutcome,
  applyOutcome: typeof applyTrialJobOutcome = applyTrialJobOutcome,
): Promise<void> {
  if (job.payment_status !== 'included_mcp_trial') return;
  try {
    await applyOutcome(job.job_id, outcome);
  } catch (error) {
    console.warn('[byteplus-poll] trial outcome deferred to reconciliation', {
      jobId: job.job_id,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}
