import { withDbTransaction } from '@/lib/db';
import { submitFalQueueOnce } from '@/lib/fal-queue-submit';
import type { FalQueueReceipt } from '@/lib/fal-queue-receipt';
import { KLING_IMAGE_V4_ID } from '@/lib/image/kling-image-v4';

async function persistKlingImageAcceptance(jobId: string, userId: string, receipt: FalQueueReceipt): Promise<void> {
  await withDbTransaction(async executor => {
    const rows = await executor.query(
      `UPDATE app_jobs
          SET provider = 'fal', provider_job_id = $3, provisional = FALSE,
              settings_snapshot = jsonb_set(COALESCE(settings_snapshot, '{}'::jsonb), '{falQueueReceiptRequired}',
                jsonb_build_object('requestId', $3::text), TRUE),
              updated_at = NOW()
        WHERE job_id = $1 AND user_id = $2 AND engine_id = $4
          AND (provider_job_id IS NULL OR provider_job_id = $3)
        RETURNING job_id`,
      [jobId, userId, receipt.requestId, KLING_IMAGE_V4_ID],
    );
    if (rows.length !== 1) throw new Error('Kling Image acceptance could not be associated with its job.');
    await executor.query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,'fal',$2,$3,'enqueue',$4::jsonb)`,
      [jobId, receipt.requestId, KLING_IMAGE_V4_ID,
        JSON.stringify({ falQueueReceiptRequired: true, falQueueReceipt: receipt })],
    );
  });
}

/** No SDK POST retries. Return only once the accepted provider identity is durable. */
export function enqueueKlingImageV4(params: {
  jobId: string;
  userId: string;
  endpoint: string;
  input: Record<string, unknown>;
  onRequestId: (requestId: string) => void;
}, deps: { submit?: typeof submitFalQueueOnce; persist?: typeof persistKlingImageAcceptance } = {}): Promise<string> {
  return (deps.submit ?? submitFalQueueOnce)(params.endpoint, params.input, params.jobId, undefined, async (requestId, receipt) => {
    params.onRequestId(requestId);
    await (deps.persist ?? persistKlingImageAcceptance)(params.jobId, params.userId, receipt);
  });
}
