import { ApiError, ValidationError } from '@fal-ai/client';
import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { recordRefundReceipt, type PendingReceipt } from './image-generation-receipts';

export async function persistFailedImageGeneration(params: {
  characterReferenceCount: number;
  enableWebSearch: boolean;
  engineId: string;
  error: unknown;
  falModelId: string;
  jobId: string;
  limitGenerations: boolean;
  maskUrl: string | null;
  mode: ImageGenerationMode;
  normalizedSeed: number | null;
  numImages: number;
  outputFormat: string | null;
  pendingReceipt: PendingReceipt;
  priceOnlyReceipts: boolean;
  pricing: PricingSnapshot;
  refundOnFailure?: boolean;
  failedPaymentStatus?: string;
  providerJobId: string | null;
  providerMode: string;
  quality: string | null;
  referenceImageUrls: string[];
  refundDescription: string;
  resolvedAspectRatio: string | null;
  resolution: string;
  thinkingLevel: string | null;
}) {
  const {
    characterReferenceCount,
    enableWebSearch,
    engineId,
    error,
    falModelId,
    jobId,
    limitGenerations,
    maskUrl,
    mode,
    normalizedSeed,
    numImages,
    outputFormat,
    pendingReceipt,
    priceOnlyReceipts,
    pricing,
    refundOnFailure = true,
    failedPaymentStatus = 'refunded_wallet',
    providerJobId,
    providerMode,
    quality,
    referenceImageUrls,
    refundDescription,
    resolvedAspectRatio,
    resolution,
    thinkingLevel,
  } = params;

  const genericProviderError =
    error && typeof error === 'object'
      ? (error as { status?: unknown; detail?: unknown; body?: unknown })
      : null;
  const providerStatus =
    error instanceof ApiError && typeof error.status === 'number'
      ? error.status
      : typeof genericProviderError?.status === 'number'
        ? genericProviderError.status
        : null;
  const providerBody =
    error instanceof ApiError
      ? error.body
      : genericProviderError && 'detail' in genericProviderError
        ? genericProviderError.detail
        : genericProviderError?.body ?? null;
  const providerErrors =
    error instanceof ValidationError
      ? error.fieldErrors
          .map((entry) => {
            const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== 'body') : [];
            const path = loc.length ? loc.join('.') : null;
            const msg = typeof entry.msg === 'string' ? entry.msg.trim() : '';
            if (!msg) return null;
            return path ? `${path}: ${msg}` : msg;
          })
          .filter((entry): entry is string => Boolean(entry))
      : [];
  const messageBase = error instanceof Error && error.message ? error.message : 'Fal request failed';
  const message =
    providerErrors.length > 0
      ? providerErrors.slice(0, 3).join(' · ')
      : providerStatus === 422 && messageBase === 'Unprocessable Entity'
        ? 'Fal rejected the input (422). Check that your reference image URLs are reachable and valid image files.'
        : messageBase;

  try {
    await query(
      `UPDATE app_jobs
       SET status = 'failed',
           progress = 0,
           message = $2,
           provider_job_id = COALESCE($3, provider_job_id),
           provisional = FALSE,
           updated_at = NOW(),
           payment_status = $4
       WHERE job_id = $1`,
      [jobId, message, providerJobId ?? null, failedPaymentStatus]
    );
  } catch (updateError) {
    console.warn('[images] failed to update failed job', updateError);
  }

  try {
    const hosts = referenceImageUrls
      .map((url) => {
        try {
          return new URL(url).host;
        } catch {
          return null;
        }
      })
      .filter((host): host is string => Boolean(host));
    const uniqueHosts = Array.from(new Set(hosts));

    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        jobId,
        providerMode,
        providerJobId ?? null,
        engineId,
        'failed',
        JSON.stringify({
          request: {
            mode,
            numImages,
            resolution,
            ...(characterReferenceCount ? { characterReferenceCount } : {}),
            ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
            ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
            ...(outputFormat ? { output_format: outputFormat } : {}),
            ...(quality ? { quality } : {}),
            ...(maskUrl ? { mask_url: maskUrl } : {}),
            ...(enableWebSearch ? { enable_web_search: true } : {}),
            ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
            ...(limitGenerations ? { limit_generations: true } : {}),
            referenceImageCount: referenceImageUrls.length,
            referenceImageHosts: uniqueHosts,
            falModelId,
          },
          error: {
            status: providerStatus,
            message,
            body: providerBody,
          },
          pricing: { totalCents: pricing.totalCents, currency: pricing.currency },
        }),
      ]
    );
  } catch (logError) {
    console.warn('[images] failed to record fal queue log', logError);
  }

  if (refundOnFailure) {
    await recordRefundReceipt(pendingReceipt, refundDescription, priceOnlyReceipts);
  }

  return { message, providerBody, providerStatus };
}
