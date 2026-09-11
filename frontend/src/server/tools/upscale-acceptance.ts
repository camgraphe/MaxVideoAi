import { createHash } from 'node:crypto';
import { query, type QueryExecutor } from '@/lib/db';
import type { UpscaleToolRequest, UpscaleToolResponse } from '@/types/tools-upscale';
import { UpscaleToolError } from './upscale-errors';

export function upscaleRequestIdentity(input: UpscaleToolRequest & { userId: string }) {
  if (!input.requestId || !/^[a-zA-Z0-9_-]{16,128}$/.test(input.requestId)) {
    throw new UpscaleToolError('Refresh the page before starting this upscale.', { status: 400, code: 'request_id_required' });
  }
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const { requestId, userId } = input;
  const payload = Object.fromEntries(Object.entries(input).filter(([key]) => !['requestId', 'userId', 'acceptedQuote'].includes(key)));
  return {
    jobId: `tool_upscale_${digest([userId, requestId])}`,
    fingerprint: digest(Object.keys(payload).sort().map(key => [key, payload[key as keyof typeof payload] ?? null])),
  };
}

export async function readAcceptedUpscale(jobId: string, fingerprint: string, executor: QueryExecutor = { query }): Promise<UpscaleToolResponse | null> {
  const [job] = await executor.query<{
    job_id: string; status: string; engine_id: UpscaleToolResponse['engineId']; engine_label: string;
    provider_job_id: string | null; final_price_cents: number; currency: string; video_url: string | null;
    thumb_url: string | null; message: string | null; settings_snapshot: { requestFingerprint?: string };
  }>('SELECT job_id, status, engine_id, engine_label, provider_job_id, final_price_cents, currency, video_url, thumb_url, message, settings_snapshot FROM app_jobs WHERE job_id = $1', [jobId]);
  if (!job) return null;
  if (job.settings_snapshot?.requestFingerprint !== fingerprint) {
    throw new UpscaleToolError('This request ID was already used for different settings.', { status: 409, code: 'idempotency_conflict' });
  }
  return {
    ok: true, jobId, engineId: job.engine_id, engineLabel: job.engine_label, mediaType: 'video',
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'pending',
    providerJobId: job.provider_job_id, requestId: job.provider_job_id, latencyMs: 0,
    pricing: { totalCents: job.final_price_cents, estimatedCostUsd: job.final_price_cents / 100, estimatedCredits: job.final_price_cents, currency: job.currency },
    output: job.status === 'completed' && job.video_url ? { url: job.video_url, thumbUrl: job.thumb_url } : null,
    ...(job.status === 'failed' ? { error: { code: 'upscale_failed', message: job.message ?? 'Upscale failed.' } } : {}),
  };
}
