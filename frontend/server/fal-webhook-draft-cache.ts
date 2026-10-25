import { recoverOwnedFluxDraftCache } from './flux-draft-cache-recovery';
import type { AppJobRow } from './fal-webhook-types';

/** Optional GET/decode recovery follows original outputs, settlement and lifecycle.
 * Failure must never undo or retry successful paid generation. */
export async function captureCompletedFalDraftCache(
  job: Pick<AppJobRow, 'user_id' | 'job_id' | 'engine_id'>,
  status: string | null | undefined,
  recover = recoverOwnedFluxDraftCache,
): Promise<void> {
  if (status !== 'completed' || job.engine_id !== 'flux-3-draft' || !job.user_id) return;
  try {
    await recover({ userId: job.user_id, sourceJobId: job.job_id });
  } catch {
    console.info('[fal-webhook] optional Draft cache not qualified', { jobId: job.job_id });
  }
}
