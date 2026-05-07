import { query } from '@/lib/db';
import type { FalInputSummary } from './fal-request';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

export type ProviderJobTracker = {
  getLastProviderJobId: () => string | null;
  setLastProviderJobId: (requestId: string | null | undefined) => void;
  persistProviderJobId: (requestId: string) => Promise<void>;
};

export function createProviderJobTracker(params: {
  jobId: string;
  providerKey: string;
  engineId: string;
  prompt: string;
  inputSummary: FalInputSummary;
  now?: () => Date;
  queryFn?: QueryFn;
}): ProviderJobTracker {
  let lastProviderJobId: string | null = null;
  const queryFn = params.queryFn ?? query;
  const now = params.now ?? (() => new Date());

  const setLastProviderJobId = (requestId: string | null | undefined) => {
    if (requestId) {
      lastProviderJobId = requestId;
    }
  };

  const persistProviderJobId = async (requestId: string) => {
    if (!requestId || lastProviderJobId === requestId) return;
    lastProviderJobId = requestId;
    try {
      await queryFn(
        `UPDATE app_jobs
         SET provider_job_id = $2, updated_at = NOW()
         WHERE job_id = $1
           AND (provider_job_id IS NULL OR provider_job_id <> $2)`,
        [params.jobId, requestId]
      );
    } catch (error) {
      console.warn('[api/generate] failed to persist provider_job_id', { jobId: params.jobId, requestId }, error);
    }
    try {
      await queryFn(
        `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          params.jobId,
          params.providerKey,
          requestId,
          params.engineId,
          'enqueue',
          JSON.stringify({
            at: now().toISOString(),
            engineId: params.engineId,
            promptLength: params.prompt.length,
            inputSummary: params.inputSummary,
          }),
        ]
      );
    } catch (error) {
      console.warn('[queue-log] failed to record enqueue event', { jobId: params.jobId, requestId }, error);
    }
  };

  return {
    getLastProviderJobId: () => lastProviderJobId,
    setLastProviderJobId,
    persistProviderJobId,
  };
}
