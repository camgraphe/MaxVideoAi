import { parseFalQueueReceipt, type FalQueueReceipt } from '@/lib/fal-queue-receipt';
import { ApiError } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getFalWebhookUrl } from '@/lib/fal-webhook-url';

/** A real HTTP response to our single POST, rather than a status attached to a network exception. */
export class FalQueueHttpError extends ApiError<unknown> {}

// The SDK retries queue POSTs. An ambiguous acknowledgment must never submit a second paid request.
export async function submitFalQueueOnce(modelId: string, input: Record<string, unknown>, jobId?: string, fetchFn = fetch,
  onAccepted?: (requestId: string, receipt: FalQueueReceipt) => void | Promise<void>,
): Promise<string> {
  const url = new URL(`https://queue.fal.run/${modelId}`);
  const webhook = getFalWebhookUrl();
  if (webhook) {
    const callback = new URL(webhook);
    if (jobId) callback.searchParams.set('jobId', jobId);
    url.searchParams.set('fal_webhook', callback.toString());
  }
  const response = await fetchFn(url, {
    method: 'POST', headers: { Authorization: `Key ${ENV.FAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), redirect: 'error', signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new FalQueueHttpError({ status: response.status, message: 'Generation submission could not be confirmed.', body });
  if (typeof body?.request_id !== 'string' || !body.request_id.trim()) throw new Error('Missing generation request acknowledgment.');
  const requestId = body.request_id.trim();
  if (onAccepted) await onAccepted(requestId, parseFalQueueReceipt(modelId, requestId, body));
  return requestId;
}
