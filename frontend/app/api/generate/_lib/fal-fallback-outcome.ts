import { markProviderAttemptAccepted, syncProviderAttemptTerminalStatus } from '@/server/video-providers/provider-attempts';
import type { FalGenerateSubmissionResult } from './fal-submission';
import { buildPersistedVideoJobResponse, readPersistedVideoJob } from './persisted-video-job';

type QueryFn = <T = unknown>(sql: string, values?: unknown[]) => Promise<T[]>;

/** A durable job response is not proof that the current Fal attempt failed or produced it. */
export async function reconcileFalFallbackTerminalResponse(params: {
  jobId: string;
  result: FalGenerateSubmissionResult;
  attemptId: number | null;
  acceptedProviderJobId: string | null;
  queryFn: QueryFn;
}): Promise<Extract<FalGenerateSubmissionResult, { ok: false }> | null> {
  const { result } = params;
  if (result.ok || result.status !== 200 || result.body.ok !== true
    || !['completed', 'failed'].includes(String(result.body.status))) return null;
  let recovered = result;
  if (result.body.jobId !== params.jobId) {
    // Never adopt or return a different job's identity/output through this boundary.
    try {
      const job = await readPersistedVideoJob(params.jobId, params.queryFn);
      const terminal = job.status === 'completed' || job.status === 'failed';
      recovered = { ok: false, status: terminal ? 200 : 202, body: {
        ...buildPersistedVideoJobResponse(job), ...(terminal ? {} : { deferred: true }),
      } };
    } catch {
      recovered = { ok: false, status: 202, body: { ok: true, jobId: params.jobId, status: 'running',
        provider: 'fal', providerJobId: params.acceptedProviderJobId, deferred: true,
        message: 'Generation status is temporarily unavailable. Do not submit again.' } };
    }
  }
  if (params.attemptId !== null && params.acceptedProviderJobId) {
    try {
      // Only this submission's ACK can bind its attempt, never a winner's body ID.
      await markProviderAttemptAccepted({ attemptId: params.attemptId, providerJobId: params.acceptedProviderJobId,
        queryFn: params.queryFn });
      if (recovered.body.provider === 'fal' && recovered.body.providerJobId === params.acceptedProviderJobId) {
        await syncProviderAttemptTerminalStatus({ publicJobId: params.jobId, provider: 'fal',
          providerJobId: params.acceptedProviderJobId, queryFn: params.queryFn });
      }
    } catch {
      console.warn('[fal-fallback] durable outcome projection deferred', { jobId: params.jobId });
    }
  }
  return recovered;
}
