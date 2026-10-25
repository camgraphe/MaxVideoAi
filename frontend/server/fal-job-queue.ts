import { ApiError } from '@fal-ai/client';
import { query } from '@/lib/db';
import { ENV } from '@/lib/env';
import { getFalClient } from '@/lib/fal-client';
import { readFalQueueReceipt } from '@/lib/fal-queue-receipt';

/** Read only server-owned enqueue evidence, never caller settings or webhook URLs. */
export async function resolveFalJobQueue(
  job: { jobId: string; engineId: string; requestId: string; legacyModel: string },
  dependencies: { queryFn?: typeof query; client?: ReturnType<typeof getFalClient>; fetchFn?: typeof fetch } = {},
) {
  const client = dependencies.client ?? getFalClient();
  const queryFn = dependencies.queryFn ?? query;
  // Legacy requires a matching server-owned ID-only enqueue, not an absent log.
  // The job marker commits with every new V4 accepted association, before logging.
  const rows = job.engineId === 'kling-v4'
    ? await queryFn<{ receipt: unknown; receipt_present: boolean; receipt_required: boolean; legacy_enqueued: boolean }>(
      `SELECT proof.receipt, proof.id IS NOT NULL AS receipt_present,
           COALESCE(j.settings_snapshot ? 'falQueueReceiptRequired', FALSE) AS receipt_required,
           EXISTS (SELECT 1 FROM fal_queue_log legacy
             WHERE legacy.job_id = j.job_id AND legacy.provider_job_id = j.provider_job_id
               AND legacy.engine_id = j.engine_id AND legacy.provider = 'fal' AND legacy.status = 'enqueue'
               AND NOT (legacy.payload ? 'falQueueReceipt')
               AND NOT (legacy.payload ? 'falQueueReceiptRequired')) AS legacy_enqueued
         FROM app_jobs j
         LEFT JOIN LATERAL (
           SELECT id, payload->'falQueueReceipt' AS receipt FROM fal_queue_log
             WHERE job_id = j.job_id AND provider_job_id = j.provider_job_id AND engine_id = j.engine_id
               AND provider = 'fal' AND status = 'enqueue' AND payload ? 'falQueueReceipt'
             ORDER BY created_at ASC, id ASC LIMIT 1
         ) proof ON TRUE
         WHERE j.job_id = $1 AND j.provider_job_id = $2 AND j.engine_id = $3 AND j.provider = 'fal'`,
      [job.jobId, job.requestId, job.engineId],
    ).catch(() => []) : [];
  const evidence = rows[0];
  // Missing/failed ownership or receipt reads refuse inside status/result so the
  // recovery callers retain their existing pending/retry behavior.
  if (job.engineId !== 'kling-v4' || (evidence?.receipt_present === false
    && evidence.receipt_required === false && evidence.legacy_enqueued === true)) {
    return {
      status: () => client.queue.status(job.legacyModel, { requestId: job.requestId }),
      result: () => client.queue.result(job.legacyModel, { requestId: job.requestId }),
    };
  }
  // An invalid new receipt must not silently become a legacy fallback.
  const fetchFn = dependencies.fetchFn ?? fetch;
  const read = async (kind: 'statusUrl' | 'responseUrl'): Promise<Record<string, unknown>> => {
    const receipt = readFalQueueReceipt(evidence?.receipt, job.requestId);
    const url = receipt[kind]!;
    const response = await fetchFn(url, {
      method: 'GET', redirect: 'error', headers: { Authorization: `Key ${ENV.FAL_API_KEY}` },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError({status: response.status, message: 'Fal queue read failed.', body});
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid Fal queue response.');
    if (body.request_id !== undefined && body.request_id !== job.requestId) throw new Error('Fal queue response identity mismatch.');
    return body;
  };
  return {
    status: () => read('statusUrl'),
    // Match the existing SDK envelope consumed by completion/webhook owners.
    result: async () => ({ data: await read('responseUrl'), requestId: job.requestId }),
  };
}
