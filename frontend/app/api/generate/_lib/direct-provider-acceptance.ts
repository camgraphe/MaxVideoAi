import { markProviderAttemptAccepted } from '@/server/video-providers/provider-attempts';
import type { VideoProviderKey } from '@/server/video-providers/types';
import { buildPersistedVideoJobResponse, readPersistedVideoJob } from './persisted-video-job';

type QueryFn = <T = unknown>(sql: string, values?: unknown[]) => Promise<T[]>;

/** Called only after a validated direct ACK, outside the pre-acceptance rejection catch. */
export async function persistDirectProviderAcceptance(params: {
  jobId: string;
  provider: VideoProviderKey;
  providerJobId: string;
  attemptId: number;
  responseSnapshot: unknown;
  acceptedBody: Record<string, unknown>;
  status: 'queued' | 'running';
  progress: number;
  localKey: string | null;
  queryFn: QueryFn;
  logAccepted(): void;
}): Promise<Record<string, unknown>> {
  try {
    await markProviderAttemptAccepted({ attemptId: params.attemptId, providerJobId: params.providerJobId,
      responseSnapshot: params.responseSnapshot, queryFn: params.queryFn });
  } catch {
    console.warn('[direct-acceptance] attempt persistence deferred', { jobId: params.jobId, provider: params.provider });
  }
  // These writes are independent: losing one must not prevent the other identity copy.
  try {
    await params.queryFn(`UPDATE app_jobs
      SET status=$2,progress=GREATEST(COALESCE(progress,0),$3),message='Render submitted.',
          provider=$4,provider_job_id=$5,provisional=FALSE,updated_at=NOW()
      WHERE job_id=$1 AND status IN ('pending','queued','running','processing','in_progress')
        AND (provider_job_id IS NULL OR (provider=$4 AND provider_job_id=$5))`,
    [params.jobId, params.status, params.progress, params.provider, params.providerJobId]);
  } catch {
    console.warn('[direct-acceptance] job persistence deferred', { jobId: params.jobId, provider: params.provider });
  }
  try { params.logAccepted(); } catch {
    console.warn('[direct-acceptance] accepted metric deferred', { jobId: params.jobId, provider: params.provider });
  }
  try {
    // A new statement sees a terminal winner that committed while UPDATE waited.
    const job = await readPersistedVideoJob(params.jobId, params.queryFn);
    const body = { ...params.acceptedBody, ...buildPersistedVideoJobResponse(job, params.localKey) };
    if (job.status === 'completed' || job.status === 'failed') return body;
    if (job.provider === params.provider && job.provider_job_id === params.providerJobId) return body;
    return { ...body, ...(job.provider_job_id ? {} : { provider: params.provider, providerJobId: params.providerJobId }),
      deferred: true, message: 'The provider accepted this generation. Status persistence is delayed. Do not submit again.' };
  } catch {
    // The ACK is known; current payment/terminal state and automatic polling are not.
    const body: Record<string, unknown> = { ...params.acceptedBody, deferred: true,
      message: 'The provider accepted this generation. Status persistence is delayed. Do not submit again.' };
    delete body.paymentStatus;
    return body;
  }
}
