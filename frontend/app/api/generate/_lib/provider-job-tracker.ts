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
  const persistedRequestIds = new Set<string>();
  const pendingWrites = new Map<string, Promise<void>>();
  const receiptRequestIds = new Set<string>();
  const receiptRequirementRequestIds = new Set<string>();
  const requiresReceipt = params.providerKey === 'fal' && params.engineId === 'kling-v4';
  const nativeDraftProofRequestIds = new Set<string>();
  const queryFn = params.queryFn ?? query;
  const now = params.now ?? (() => new Date());

  const setLastProviderJobId = (requestId: string | null | undefined) => {
    if (requestId) {
      lastProviderJobId = requestId;
    }
  };

  const persistRequest = async (requestId: string, nativeDraftSubmission?: NativeFluxDraftSubmission, falQueueReceipt?: FalQueueReceipt) => {
    // A queue status can arrive before onEnqueue or an immediate-result callback.
    // Observing an ID is not proof that its database association was saved.
    const needsNativeDraftProof = nativeDraftSubmission && !nativeDraftProofRequestIds.has(requestId);
    const needsReceiptRequirement = requiresReceipt && !receiptRequirementRequestIds.has(requestId);
    const receipt = requiresReceipt && falQueueReceipt?.requestId === requestId
      ? falQueueReceipt : undefined;
    const needsReceipt = receipt && !receiptRequestIds.has(requestId);
    if (!requestId || (persistedRequestIds.has(requestId) && !needsNativeDraftProof && !needsReceipt && !needsReceiptRequirement)) return;
    if (nativeDraftSubmission) nativeDraftProofRequestIds.add(requestId);
    lastProviderJobId = requestId;
    try {
      // The accepted association and its requirement commit as one statement. The
      // diagnostic receipt log may fail or never run without proving legacy.
      if (requiresReceipt) {
        const rows = await queryFn(
          `UPDATE app_jobs
           SET provider = $3, provider_job_id = $2,
               settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb),
                 '{falQueueReceiptRequired}', jsonb_build_object('requestId', $2::text), true),
               updated_at = NOW()
           WHERE job_id = $1 AND engine_id = 'kling-v4'
             AND (provider_job_id IS NULL OR provider_job_id = $2)
           RETURNING job_id`,
          [params.jobId, requestId, params.providerKey]
        );
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error('Accepted Fal identity persistence deferred.');
        receiptRequirementRequestIds.add(requestId);
      } else await queryFn(
        `UPDATE app_jobs
         SET provider = $3, provider_job_id = $2, updated_at = NOW()
         WHERE job_id = $1
           AND (provider_job_id IS NULL OR provider_job_id <> $2)`,
        [params.jobId, requestId, params.providerKey]
      );
      persistedRequestIds.add(requestId);
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
          ...(requiresReceipt ? { falQueueReceiptRequired: true } : {}),
          ...(receipt ? { falQueueReceipt: receipt } : {}),
        }),
        ]
      );
      if (receipt) receiptRequestIds.add(requestId);
    } catch (error) {
      console.warn('[queue-log] failed to record enqueue event', { jobId: params.jobId, requestId }, error);
    }
  };

  const persistProviderJobId: ProviderJobTracker['persistProviderJobId'] = (requestId, nativeDraftSubmission, falQueueReceipt) => {
    // SDK callbacks can overlap. Serialize one identity so a second callback can
    // retry a failed write or enrich its proof without duplicating the first.
    const pending = (pendingWrites.get(requestId) ?? Promise.resolve())
      .then(() => persistRequest(requestId, nativeDraftSubmission, falQueueReceipt));
    pendingWrites.set(requestId, pending);
    return pending.finally(() => {
      if (pendingWrites.get(requestId) === pending) pendingWrites.delete(requestId);
    });
  };

  return {
    getLastProviderJobId: () => lastProviderJobId,
    setLastProviderJobId,
    persistProviderJobId,
  };
}
