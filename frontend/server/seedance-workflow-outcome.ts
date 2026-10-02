import { query } from '@/lib/db';
import { isRecord } from './byteplus-record-utils';
import { captureSeedanceDraftValidityStart, markSeedanceDraftFailed, markSeedanceDraftReady,
  markSeedanceFinalState, registerSeedanceDraftLink, releaseRefundedSeedanceFinal } from './seedance-draft-links';
import type { BytePlusPendingJob } from './byteplus-poll-types';

type QueryFn = <T = unknown>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

/** Persisted MaxVideoAI lineage is authoritative; 2.5 GET omits the Draft flag. */
export async function reconcileSeedanceWorkflowOutcome(
  job: Pick<BytePlusPendingJob, 'job_id' | 'user_id' | 'engine_id' | 'provider_job_id' | 'settings_snapshot'>,
  outcome: 'completed' | 'failed', queryFn: QueryFn = query,
): Promise<void> {
  const settings = isRecord(job.settings_snapshot) ? job.settings_snapshot : {};
  const workflow = isRecord(settings.seedanceWorkflow) ? settings.seedanceWorkflow : {};
  if (job.engine_id !== 'seedance-2-5' || !job.user_id) return;
  if (workflow.step === 'final' && typeof workflow.draftJobId === 'string') {
    await markSeedanceFinalState(job.user_id, job.job_id, outcome, queryFn);
    if (outcome === 'failed') await releaseRefundedSeedanceFinal(job.user_id, workflow.draftJobId, job.job_id, queryFn);
  } else if (workflow.step === 'draft') {
    if (outcome === 'failed') {
      await markSeedanceDraftFailed(job.user_id, job.job_id, queryFn);
      return;
    }
    // Recover an accepted task whose acknowledgement could not persist the link.
    if (typeof workflow.validityStartedAt === 'string' && typeof workflow.providerModelId === 'string' && job.provider_job_id) {
      await registerSeedanceDraftLink({ userId: job.user_id, draftJobId: job.job_id,
        providerTaskId: job.provider_job_id, providerModelId: workflow.providerModelId,
        validityStart: captureSeedanceDraftValidityStart(() => new Date(workflow.validityStartedAt as string)) }, queryFn);
    }
    await markSeedanceDraftReady(job.user_id, job.job_id, queryFn);
  }
}
