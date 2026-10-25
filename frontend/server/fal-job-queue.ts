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
  // Only V4 writes receipt identities in this wave. Other providers keep their contracts.
  const rows = job.engineId === 'kling-v4'
    ? await queryFn<{ receipt: unknown }>(
      `SELECT payload->'falQueueReceipt' AS receipt FROM fal_queue_log
         WHERE job_id = $1 AND provider_job_id = $2 AND engine_id = $3
           AND provider = 'fal' AND status = 'enqueue' AND payload ? 'falQueueReceipt'
         ORDER BY created_at ASC, id ASC LIMIT 1`,
      [job.jobId, job.requestId, job.engineId],
    ).catch(() => [{ receipt: null }]) : [];
  // A failed receipt read is unavailable evidence, never proof of a legacy job.
  // Defer the refusal to status/result so callers keep their existing retry semantics.
  if (!rows.length) {
    // Legacy ID-only jobs have no receipt. Do not replace or resubmit them.
    return {
      status: () => client.queue.status(job.legacyModel, { requestId: job.requestId }),
      result: () => client.queue.result(job.legacyModel, { requestId: job.requestId }),
    };
  }
  // An invalid new receipt must not silently become a legacy fallback.
  const fetchFn = dependencies.fetchFn ?? fetch;
  const read = async (kind: 'statusUrl' | 'responseUrl'): Promise<Record<string, unknown>> => {
    const receipt = readFalQueueReceipt(rows[0].receipt, job.requestId);
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
