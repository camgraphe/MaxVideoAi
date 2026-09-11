import { ApiError } from '@fal-ai/client';
import { readAcceptedUpscale } from './upscale-acceptance';
import { submitFalQueueOnce } from '@/lib/fal-queue-submit';
import { persistQueuedUpscaleRequest, insertUpscaleToolEvent } from './upscale-job-persistence';
import type { UpscaleToolEngineDefinition } from '@/types/tools-upscale';
import { query } from '@/lib/db';

export async function acceptVideoUpscale(engine: UpscaleToolEngineDefinition, input: Record<string, unknown>, identity: { jobId: string; fingerprint: string }) {
  let providerJobId: string | null = null;
  try {
    providerJobId = await submitFalQueueOnce(engine.falModelId, input, identity.jobId);
    await persistQueuedUpscaleRequest(identity.jobId, providerJobId);
  } catch (error) {
    if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) throw error;
    await insertUpscaleToolEvent({ jobId: identity.jobId, engineId: engine.id, providerJobId, payload: { status: 'submission_unknown' } });
    if (providerJobId) {
      // Retrying persistence is safe; retrying the paid submission is not.
      await persistQueuedUpscaleRequest(identity.jobId, providerJobId).catch(() => undefined);
    }
    await query(`UPDATE app_jobs SET message = $2, updated_at = NOW() WHERE job_id = $1 AND status = 'pending'`,
      [identity.jobId, 'Checking whether the upscale was accepted. Please keep this job; contact support if the status does not update.']);
    // Preserve the reservation and identity: a lost acknowledgment never authorizes another POST.
  }
  return (await readAcceptedUpscale(identity.jobId, identity.fingerprint))!;
}
