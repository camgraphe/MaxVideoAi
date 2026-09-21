import { ApiError, ValidationError } from '@fal-ai/client';
import { query } from '@/lib/db';
import type { PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { recordRefundReceipt, type PendingReceipt } from './image-generation-receipts';

type ImageGenerationQuery = (
  text: string,
  params?: ReadonlyArray<unknown>
) => Promise<unknown>;

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
  style?: string | null;
  thinkingLevel: string | null;
}, deps: { queryFn?: ImageGenerationQuery; recordRefundReceiptFn?: typeof recordRefundReceipt } = {}) {
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
    style = null,
    thinkingLevel,
  } = params;
  const queryFn = deps.queryFn ?? query;

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
  const bodyError = providerBody && typeof providerBody === 'object'
    ? (providerBody as { error?: { code?: unknown } }).error : null;
  const seedreamSafetyCode = providerMode === 'byteplus_modelark' && typeof bodyError?.code === 'string'
    ? bodyError.code : null;
  const safetySubjects: Record<string, string> = {
    OutputImageSensitiveContentDetected: 'generated image',
    InputImageSensitiveContentDetected: 'reference image',
    InputTextSensitiveContentDetected: 'prompt',
  };
  const safetySubject = seedreamSafetyCode ? safetySubjects[seedreamSafetyCode] : null;
  const safetyReason = safetySubject
    ? `${safetySubject[0].toUpperCase()}${safetySubject.slice(1)} was blocked by safety checks.`
    : null;
  const safetyMessage = safetySubject
    ? `Seedream blocked the ${safetySubject} during safety checks. Review the prompt and any reference images before trying again.`
    : null;
  const message = safetyMessage ?? (
    providerErrors.length > 0
      ? providerErrors.slice(0, 3).join(' · ')
      : providerStatus === 422 && messageBase === 'Unprocessable Entity'
        ? 'Fal rejected the input (422). Check that your reference image URLs are reachable and valid image files.'
        : messageBase);

  try {
    await queryFn(
      `UPDATE app_jobs
       SET status = 'failed',
           progress = 0,
           message = $2,
           provider_job_id = COALESCE($3, provider_job_id),
           provisional = FALSE,
           updated_at = NOW(),
           payment_status = $4,
           provider = $5
       WHERE job_id = $1`,
      [jobId, message, providerJobId ?? null, failedPaymentStatus, providerMode]
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

    await queryFn(
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
            ...(style ? { style } : {}),
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
    await (deps.recordRefundReceiptFn ?? recordRefundReceipt)(
      pendingReceipt,
      safetyReason ? `${refundDescription.replace(/\b1 images\b/g, '1 image')} - ${safetyReason}` : refundDescription,
      priceOnlyReceipts
    );
  }

  return { message, providerBody, providerStatus };
}
