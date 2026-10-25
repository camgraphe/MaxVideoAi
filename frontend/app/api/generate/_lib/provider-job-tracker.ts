import type { FalQueueReceipt } from '@/lib/fal-queue-receipt';
import type {NativeFluxDraftSubmission} from '@/server/flux-draft-provenance';
import { query } from '@/lib/db';
import type { FalInputSummary } from './fal-request';

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown>;

export type ProviderJobTracker = {
  getLastProviderJobId: () => string | null;
  setLastProviderJobId: (requestId: string | null | undefined) => void;
  persistProviderJobId: (requestId: string, nativeDraftSubmission?: NativeFluxDraftSubmission, falQueueReceipt?: FalQueueReceipt) => Promise<void>;
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
  const receiptRequestIds = new Set<string>();
  const nativeDraftProofRequestIds = new Set<string>();
  const queryFn = params.queryFn ?? query;
  const now = params.now ?? (() => new Date());

  const setLastProviderJobId = (requestId: string | null | undefined) => {
    if (requestId) {
      lastProviderJobId = requestId;
    }
  };

  const persistProviderJobId = async (requestId: string, nativeDraftSubmission?: NativeFluxDraftSubmission, falQueueReceipt?: FalQueueReceipt) => {
    // A queue status can arrive before onEnqueue or an immediate-result callback.
    // Seeing its ID must not suppress the first authoritative native Draft proof.
    const needsNativeDraftProof = nativeDraftSubmission && !nativeDraftProofRequestIds.has(requestId);
    const receipt = params.providerKey === 'fal' && params.engineId === 'kling-v4' && falQueueReceipt?.requestId === requestId
      ? falQueueReceipt : undefined;
    const needsReceipt = receipt && !receiptRequestIds.has(requestId);
    if (!requestId || (lastProviderJobId === requestId && !needsNativeDraftProof && !needsReceipt)) return;
    if (nativeDraftSubmission) nativeDraftProofRequestIds.add(requestId);
    lastProviderJobId = requestId;
    try {
      await queryFn(
        `UPDATE app_jobs
         SET provider = $3, provider_job_id = $2, updated_at = NOW()
         WHERE job_id = $1
           AND (provider_job_id IS NULL OR provider_job_id <> $2)`,
        [params.jobId, requestId, params.providerKey]
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
          provider: params.providerKey,
          promptLength: params.prompt.length,
          inputSummary: params.inputSummary,
          ...(nativeDraftSubmission ? {nativeDraftSubmission} : {}),
          ...(receipt ? { falQueueReceipt: receipt } : {}),
        }),
        ]
      );
      if (receipt) receiptRequestIds.add(requestId);
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
