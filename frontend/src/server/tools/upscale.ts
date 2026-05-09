import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import { query } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency } from '@/lib/currency';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  clampUpscaleFactor,
  resolveUpscaleMode,
  resolveUpscaleOutputFormat,
  resolveUpscaleTargetResolution,
} from '@/lib/tools-upscale';
import type {
  UpscaleToolRequest,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import {
  UPSCALE_SURFACE,
  buildUpscaleFalInput,
  buildUpscalePromptSummary,
  buildUpscaleSettingsSnapshot,
  extractUpscaleActualCostUsd,
  extractUpscaleOutput,
  parseUpscaleRequestId,
  toUpscaleValidationMessage,
  type VideoMetadata,
} from './upscale-request-utils';
import { UPSCALE_PLACEHOLDER_THUMB, UPSCALE_TOOL_EVENT_NAME } from './upscale-constants';
import { UpscaleToolError } from './upscale-errors';
export { UpscaleToolError } from './upscale-errors';
import { resolveUpscalePricingContext } from './upscale-pricing-context';
import {
  createAtomicInitialUpscaleJob,
  insertUpscaleToolEvent,
  recordUpscaleRefundReceipt,
  type PendingUpscaleReceipt,
} from './upscale-job-persistence';
import { persistUpscaleOutput } from './upscale-output-persistence';


type RunUpscaleToolInput = UpscaleToolRequest & {
  userId: string;
};

type ImageThumbnailBatchInput = {
  jobId: string;
  userId?: string | null;
  imageUrls: string[];
  maxDimension?: number;
  concurrency?: number;
  fetchTimeoutMs?: number;
  processingTimeoutMs?: number;
};

export type RunUpscaleToolDependencies = {
  createImageThumbnailBatch?: (input: ImageThumbnailBatchInput) => Promise<Array<string | null>>;
  detectVideoMetadata?: (videoUrl: string, options?: { timeoutMs?: number }) => Promise<VideoMetadata | null>;
};

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

export async function runUpscaleToolBase(
  input: RunUpscaleToolInput,
  dependencies: RunUpscaleToolDependencies = {}
): Promise<UpscaleToolResponse> {
  const mediaType = input.mediaType;
  const engine = getUpscaleToolEngine(input.engineId, mediaType);
  const mode = resolveUpscaleMode(engine, input.mode);
  const upscaleFactor = clampUpscaleFactor(engine, input.upscaleFactor);
  const targetResolution = resolveUpscaleTargetResolution(engine, input.targetResolution);
  const outputFormat = resolveUpscaleOutputFormat(engine, input.outputFormat);
  const jobId = `tool_upscale_${randomUUID()}`;
  const billingProductKey = engine.billingProductKey;
  const priceOnlyReceipts = receiptsPriceOnlyEnabled();

  const videoMetadata =
    mediaType === 'video' && dependencies.detectVideoMetadata
      ? await dependencies.detectVideoMetadata(input.mediaUrl, { timeoutMs: 15_000 })
      : null;
  if (mediaType === 'video' && !dependencies.detectVideoMetadata) {
    throw new UpscaleToolError('Video metadata detection is not configured for this route.', {
      status: 500,
      code: 'video_metadata_dependency_missing',
    });
  }
  if (mediaType === 'video' && !videoMetadata) {
    throw new UpscaleToolError('Unable to read video metadata for dynamic upscale pricing.', {
      status: 422,
      code: 'video_metadata_required',
    });
  }
  const { pricing, pricingEstimate } = await resolveUpscalePricingContext({
    billingProductKey,
    engine,
    input,
    targetResolution,
    upscaleFactor,
    videoMetadata,
  });

  const chargedUsd = Number((pricing.totalCents / 100).toFixed(4));
  const chargedCredits = usdToCredits(chargedUsd) ?? 1;
  const settingsSnapshot = buildUpscaleSettingsSnapshot({
    engine,
    mediaUrl: input.mediaUrl,
    mode,
    upscaleFactor,
    targetResolution,
    outputFormat,
    billingProductKey,
    sourceJobId: input.sourceJobId,
    sourceAssetId: input.sourceAssetId,
    metadata: videoMetadata,
  });
  const promptSummary = buildUpscalePromptSummary({
    engine,
    mediaType,
    mode,
    upscaleFactor,
    targetResolution,
    outputFormat,
  });
  const pricingSnapshotJson = JSON.stringify(pricing);
  const settingsSnapshotJson = JSON.stringify(settingsSnapshot);
  const pendingReceipt: PendingUpscaleReceipt = {
    userId: input.userId,
    amountCents: pricing.totalCents,
    currency: pricing.currency,
    description: `${engine.label} upscale run`,
    jobId,
    surface: UPSCALE_SURFACE,
    billingProductKey,
    snapshot: pricing,
    applicationFeeCents: priceOnlyReceipts ? null : getPlatformFeeCents(pricing),
    vendorAccountId: pricing.vendorAccountId ?? null,
  };

  const preferredCurrency = await getUserPreferredCurrency(input.userId);
  await createAtomicInitialUpscaleJob({
    userId: input.userId,
    jobId,
    description: pendingReceipt.description,
    amountCents: pricing.totalCents,
    currency: pricing.currency,
    billingProductKey,
    pricingSnapshotJson,
    applicationFeeCents: pendingReceipt.applicationFeeCents,
    vendorAccountId: pendingReceipt.vendorAccountId,
    engineId: engine.id,
    engineLabel: engine.label,
    durationSec: videoMetadata?.durationSec ?? 1,
    promptSummary,
    settingsSnapshotJson,
    preferredCurrency,
  });

  const falInput = buildUpscaleFalInput({
    engine,
    mediaUrl: input.mediaUrl,
    mode,
    upscaleFactor,
    targetResolution,
    outputFormat,
    metadata: videoMetadata,
  });
  const falClient = getFalClient();
  let providerJobId: string | null = null;
  let lastQueueUpdate: unknown = null;
  const startedAt = Date.now();

  try {
    const result = await falClient.subscribe(engine.falModelId, {
      input: falInput,
      mode: 'polling',
      onEnqueue(requestId) {
        providerJobId = providerJobId ?? requestId;
      },
      onQueueUpdate(update) {
        if (update?.request_id) providerJobId = providerJobId ?? update.request_id;
        lastQueueUpdate = update;
      },
    });

    const output = extractUpscaleOutput(result.data, mediaType);
    if (!output) {
      throw new UpscaleToolError('The selected engine did not return an upscale output.', {
        status: 502,
        code: 'missing_output',
      });
    }

    const latencyMs = Date.now() - startedAt;
    const requestId = providerJobId ?? parseUpscaleRequestId(result.data) ?? result.requestId ?? null;
    const providerCostUsd = extractUpscaleActualCostUsd(result.data) ?? extractUpscaleActualCostUsd(lastQueueUpdate);
    const persistedOutput = await persistUpscaleOutput({
      output,
      mediaType,
      userId: input.userId,
      jobId,
      providerJobId: requestId,
      engineId: engine.id,
      engineLabel: engine.label,
      outputFormat,
      durationSec: videoMetadata?.durationSec ?? null,
    });

    let thumbUrl = UPSCALE_PLACEHOLDER_THUMB;
    let renderIdsJson: string | null = null;
    let heroRenderId: string | null = null;
    if (mediaType === 'image') {
      if (!dependencies.createImageThumbnailBatch) {
        throw new UpscaleToolError('Image thumbnail generation is not configured for this route.', {
          status: 500,
          code: 'image_thumbnail_dependency_missing',
        });
      }
      const [imageThumb] = await dependencies.createImageThumbnailBatch({
        jobId,
        userId: input.userId,
        imageUrls: [persistedOutput.url],
      });
      const outputWithThumb = {
        ...persistedOutput,
        thumbUrl: imageThumb ?? null,
      };
      const renderEntries = buildStoredImageRenderEntries([outputWithThumb]);
      renderIdsJson = JSON.stringify(renderEntries);
      heroRenderId = outputWithThumb.url;
      thumbUrl = resolveHeroThumbFromRenders([outputWithThumb]) ?? outputWithThumb.url ?? UPSCALE_PLACEHOLDER_THUMB;
      persistedOutput.thumbUrl = outputWithThumb.thumbUrl;
    }

    await query(
      `UPDATE app_jobs
       SET thumb_url = $2,
           preview_frame = $3,
           video_url = $4,
           status = 'completed',
           progress = 100,
           provider_job_id = $5,
           final_price_cents = $6,
           pricing_snapshot = $7::jsonb,
           cost_breakdown_usd = $8::jsonb,
           render_ids = COALESCE($9::jsonb, render_ids),
           hero_render_id = COALESCE($10, hero_render_id),
           message = NULL,
           payment_status = 'paid_wallet',
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        thumbUrl,
        thumbUrl,
        mediaType === 'video' ? persistedOutput.url : null,
        requestId,
        pricing.totalCents,
        pricingSnapshotJson,
        JSON.stringify({ providerCostUsd }),
        renderIdsJson,
        heroRenderId,
      ]
    );

    await upsertLegacyJobOutputs({
      job_id: jobId,
      user_id: input.userId,
      surface: 'upscale',
      video_url: mediaType === 'video' ? persistedOutput.url : null,
      audio_url: null,
      thumb_url: thumbUrl,
      preview_frame: thumbUrl,
      render_ids: renderIdsJson ? JSON.parse(renderIdsJson) : null,
      duration_sec: videoMetadata?.durationSec ?? 1,
      status: 'completed',
    }).catch((outputError) => {
      console.warn('[tools/upscale] failed to persist job outputs', { jobId }, outputError);
    });

    await ensureReusableAsset({
      userId: input.userId,
      url: persistedOutput.url,
      kind: mediaType,
      source: 'upscale',
      sourceJobId: jobId,
      sourceOutputId: `${jobId}:${mediaType}:0`,
      mimeType: persistedOutput.mimeType ?? (mediaType === 'video' ? 'video/mp4' : 'image/png'),
      width: persistedOutput.width ?? null,
      height: persistedOutput.height ?? null,
      thumbUrl,
    }).catch((assetError) => {
      console.warn('[tools/upscale] failed to persist media asset', { jobId }, assetError);
    });

    await insertUpscaleToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId: requestId,
      payload: {
        event: UPSCALE_TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'success',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        request: {
          mediaType,
          mode,
          upscaleFactor,
          targetResolution,
          outputFormat,
          sourceJobId: input.sourceJobId ?? null,
          sourceAssetId: input.sourceAssetId ?? null,
        },
        latencyMs,
        pricing: {
          estimatedCostUsd: chargedUsd,
          actualCostUsd: chargedUsd,
          providerCostUsd,
          currency: pricing.currency,
          estimatedCredits: chargedCredits,
          actualCredits: chargedCredits,
          totalCents: pricing.totalCents,
          billingProductKey,
          estimate: pricingEstimate,
        },
      },
    });

    return {
      ok: true,
      jobId,
      engineId: engine.id,
      engineLabel: engine.label,
      mediaType,
      requestId,
      providerJobId: requestId,
      latencyMs,
      pricing: {
        estimatedCostUsd: chargedUsd,
        actualCostUsd: chargedUsd,
        currency: pricing.currency,
        estimatedCredits: chargedCredits,
        actualCredits: chargedCredits,
        totalCents: pricing.totalCents,
        billingProductKey,
        estimate: pricingEstimate,
      },
      output: persistedOutput,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    let message = error instanceof Error ? error.message : 'Upscale generation failed';
    let status = 502;
    let detail: unknown;
    let code = 'fal_error';

    if (error instanceof UpscaleToolError) {
      message = error.message;
      status = error.status;
      detail = error.detail;
      code = error.code;
    } else if (error instanceof ValidationError) {
      message = toUpscaleValidationMessage(error);
      status = 422;
      detail = error.fieldErrors;
      code = 'validation_error';
    } else if (error instanceof ApiError) {
      message = error.message || 'Fal request failed';
      status = typeof error.status === 'number' ? error.status : 502;
      detail = error.body;
      code = 'provider_error';
    }

    await recordUpscaleRefundReceipt(pendingReceipt, `Refund ${engine.label} upscale run`, priceOnlyReceipts);
    try {
      await query(
        `UPDATE app_jobs
         SET status = 'failed',
             progress = 0,
             provider_job_id = COALESCE($2, provider_job_id),
             payment_status = 'refunded_wallet',
             message = $3,
             provisional = FALSE,
             updated_at = NOW()
         WHERE job_id = $1`,
        [jobId, providerJobId, message]
      );
    } catch (updateError) {
      console.warn('[tools/upscale] failed to mark job as failed', updateError);
    }

    await insertUpscaleToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId,
      payload: {
        event: UPSCALE_TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'error',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        request: {
          mediaType,
          mode,
          upscaleFactor,
          targetResolution,
          outputFormat,
        },
        latencyMs,
        pricing: {
          estimatedCostUsd: chargedUsd,
          actualCostUsd: null,
          currency: pricing.currency,
          estimatedCredits: chargedCredits,
          actualCredits: null,
          totalCents: pricing.totalCents,
          billingProductKey,
          estimate: pricingEstimate,
        },
        error: {
          code,
          message,
          detail,
        },
      },
    });

    throw new UpscaleToolError(message, {
      status,
      code,
      detail,
    });
  }
}
