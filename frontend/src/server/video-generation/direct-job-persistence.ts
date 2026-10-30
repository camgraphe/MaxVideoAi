import {
  persistFinalVideoJobUpdate,
  type FinalVideoJobPersistenceResult,
} from '@/app/api/generate/_lib/final-job-persistence';
import { buildPersistedVideoJobResponse, readPersistedVideoJob } from '@/app/api/generate/_lib/persisted-video-job';
import type { VideoGenerationResponse } from './video-generation-contracts';

/** A stale or unconfirmed final write never authorizes payment or terminal effects. */
export async function persistDirectVideoJob(
  update: Parameters<typeof persistFinalVideoJobUpdate>[0],
  localKey: string | null,
): Promise<Extract<FinalVideoJobPersistenceResult, { kind: 'applied' }> | { kind: 'response'; response: VideoGenerationResponse }> {
  try {
    const outcome = await persistFinalVideoJobUpdate(update);
    if (outcome.kind === 'applied') return outcome;
    return { kind: 'response', response: { body: buildPersistedVideoJobResponse(outcome.job, localKey) } };
  } catch (error) {
    console.error('[api/generate] final persistence needs recovery', { jobId: update.jobId }, error);
    try {
      const current = await readPersistedVideoJob(update.jobId, update.queryFn);
      return { kind: 'response', response: {
        body: buildPersistedVideoJobResponse(current, localKey),
        status: ['completed', 'failed'].includes(current.status ?? '') ? 200 : 202,
      } };
    } catch {
      return { kind: 'response', response: { status: 202, body: {
        ok: true, jobId: update.jobId, providerJobId: update.providerJobId,
        status: 'running', deferred: true, message: 'The generation outcome is being checked. Do not submit again.',
      } } };
    }
  }
}
