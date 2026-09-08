import { getFalClient } from '@/lib/fal-client';
import { claimFinishingCompletion, completeFinishingJob, failFinishingJob, readFinishingExecution, readFinishingJob } from './finishing-jobs';
import { persistFinishingOutput } from './finishing-output';

const defaults = {
  read: readFinishingExecution, status: readFinishingJob, claim: claimFinishingCompletion,
  complete: completeFinishingJob, fail: failFinishingJob, persist: persistFinishingOutput,
  poll: async (endpoint: string, requestId: string) => getFalClient().queue.status(endpoint, { requestId, logs: false }),
  result: async (endpoint: string, requestId: string) => getFalClient().queue.result(endpoint, { requestId }),
};

/** Resume the stored provider request; polling never submits or charges again. */
export async function refreshFinishingTool(userId: string, jobId: string, dependencies: Partial<typeof defaults> = {}) {
  const deps = { ...defaults, ...dependencies };
  const job = await deps.read(userId, jobId);
  if (!job) throw new Error('JOB_UNAVAILABLE');
  if (job.status === 'completed') return deps.status(userId, jobId);
  if (job.status === 'failed') {
    // Reconcile a paid failure left by an older polling owner without resubmitting.
    if (job.payment_status === 'paid_wallet') await deps.fail(userId, jobId, 'Tool processing failed.', job.provider_job_id);
    return deps.status(userId, jobId);
  }
  if (!job.provider_job_id) {
    // An interrupted submission without a durable provider ID must not lock a wallet forever.
    if (Date.now() - new Date(job.updated_at).getTime() > 15 * 60_000) await deps.fail(userId, jobId, 'Submission interrupted.', null);
    return deps.status(userId, jobId);
  }
  const prepared = job.settings_snapshot.preparedTool;
  let output: unknown;
  try {
    const polled = await deps.poll(prepared.profile.endpoint, job.provider_job_id);
    if (polled.status !== 'COMPLETED') return deps.status(userId, jobId);
    output = (await deps.result(prepared.profile.endpoint, job.provider_job_id)).data;
  } catch (error) {
    // A transport outage is not a failed generation. fal uses 422 for failed results.
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 422) {
      await deps.fail(userId, jobId, 'Provider processing failed.', job.provider_job_id);
    }
    return deps.status(userId, jobId);
  }
  if (!await deps.claim(userId, jobId)) return deps.status(userId, jobId);
  try {
    const result = await deps.persist(userId, jobId, prepared, output);
    await deps.complete(userId, jobId, result, job.provider_job_id);
  } catch {
    await deps.fail(userId, jobId, 'Unable to preserve the tool result.', job.provider_job_id);
  }
  return deps.status(userId, jobId);
}
