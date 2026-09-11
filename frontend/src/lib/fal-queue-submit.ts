import { ApiError } from '@fal-ai/client';
import { ENV } from '@/lib/env';
import { getFalWebhookUrl } from '@/lib/fal-webhook-url';

// The SDK retries queue POSTs. An ambiguous acknowledgment must never submit a second paid request.
export async function submitFalQueueOnce(modelId: string, input: Record<string, unknown>, jobId?: string, fetchFn = fetch): Promise<string> {
  const url = new URL(`https://queue.fal.run/${modelId}`);
  const webhook = getFalWebhookUrl();
  if (webhook) {
    const callback = new URL(webhook);
    if (jobId) callback.searchParams.set('jobId', jobId);
    url.searchParams.set('fal_webhook', callback.toString());
  }
  const response = await fetchFn(url, {
    method: 'POST', headers: { Authorization: `Key ${ENV.FAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError({ status: response.status, message: 'Generation submission could not be confirmed.', body });
  if (typeof body?.request_id !== 'string' || !body.request_id.trim()) throw new Error('Missing generation request acknowledgment.');
  return body.request_id.trim();
}
