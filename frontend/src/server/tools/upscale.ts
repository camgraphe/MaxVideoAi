import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import { isDatabaseConfigured, query, type QueryExecutor, withDbTransaction } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency, type Currency } from '@/lib/currency';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { isStorageConfigured, recordUserAsset, uploadFileBuffer, uploadImageToStorage } from '@/server/storage';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER,
  clampUpscaleFactor,
  estimateImageUpscaleCostUsd,
  estimateVideoUpscaleCostUsd,
  resolveUpscaleOutputFetchTimeoutMs,
  resolveUpscaleMode,
  resolveUpscaleOutputFormat,
  resolveUpscaleTargetResolution,
} from '@/lib/tools-upscale';
import type {
  UpscaleMediaType,
  UpscaleOutputFormat,
  UpscaleToolEngineId,
  UpscaleToolOutput,
  UpscaleToolRequest,
  UpscaleToolResponse,
} from '@/types/tools-upscale';
import type { PricingSnapshot } from '@/types/engines';
import {
  UPSCALE_SURFACE,
  buildUpscaleFalInput,
  buildUpscalePromptSummary,
  buildUpscaleSettingsSnapshot,
  cloneUpscalePricingWithDynamicTotal,
  extractUpscaleActualCostUsd,
  extractUpscaleOutput,
  formatToImageMime,
  formatToVideoMime,
  parseUpscaleRequestId,
  toUpscaleValidationMessage,
  type VideoMetadata,
} from './upscale-request-utils';

const TOOL_EVENT_NAME = 'tool_upscale_generate';
const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';

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

type PendingUpscaleReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  surface: typeof UPSCALE_SURFACE;
  billingProductKey: string;
  snapshot: PricingSnapshot;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
};

type CreateUpscaleInitialJobParams = {
  userId: string;
  jobId: string;
  description: string;
  amountCents: number;
  currency: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: UpscaleToolEngineId;
  engineLabel: string;
  durationSec: number;
  promptSummary: string;
  settingsSnapshotJson: string;
  preferredCurrency: Currency | null;
};

export class UpscaleToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'UpscaleToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'upscale_tool_error';
    this.detail = options?.detail;
  }
}

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

async function recordUpscaleRefundReceipt(receipt: PendingUpscaleReceipt, label: string, priceOnly: boolean) {
  try {
    await query(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         surface,
         billing_product_key,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        label,
        receipt.jobId,
        receipt.surface,
        receipt.billingProductKey,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[tools/upscale] failed to record refund receipt', error);
  }
}

async function insertProvisionalUpscaleJob(
  executor: QueryExecutor,
  params: Omit<CreateUpscaleInitialJobParams, 'description' | 'preferredCurrency' | 'applicationFeeCents'>
) {
  await executor.query(
    `INSERT INTO app_jobs (
       job_id,
       user_id,
       surface,
       billing_product_key,
       engine_id,
       engine_label,
       duration_sec,
       prompt,
       thumb_url,
       preview_frame,
       status,
       progress,
       final_price_cents,
       pricing_snapshot,
       settings_snapshot,
       currency,
       vendor_account_id,
       payment_status,
       visibility,
       indexable,
       provisional
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',0,$11,$12::jsonb,$13::jsonb,$14,$15,'paid_wallet','private',FALSE,TRUE
     )`,
    [
      params.jobId,
      params.userId,
      UPSCALE_SURFACE,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      Math.max(1, Math.ceil(params.durationSec)),
      params.promptSummary,
      PLACEHOLDER_THUMB,
      PLACEHOLDER_THUMB,
      params.amountCents,
      params.pricingSnapshotJson,
      params.settingsSnapshotJson,
      params.currency,
      params.vendorAccountId,
    ]
  );
}

async function createUpscaleInitialJobInExecutor(
  executor: QueryExecutor,
  params: CreateUpscaleInitialJobParams
): Promise<void> {
  const reserveResult = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: params.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      jobId: params.jobId,
      surface: UPSCALE_SURFACE,
      billingProductKey: params.billingProductKey,
      pricingSnapshotJson: params.pricingSnapshotJson,
      applicationFeeCents: params.applicationFeeCents,
      vendorAccountId: params.vendorAccountId,
      stripePaymentIntentId: null,
      stripeChargeId: null,
    },
    { preferredCurrency: params.preferredCurrency }
  );

  if (!reserveResult.ok) {
    if (reserveResult.errorCode === 'currency_mismatch') {
      const lockedCurrency = (reserveResult.preferredCurrency ?? 'usd').toUpperCase();
      throw new UpscaleToolError(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`, {
        status: 409,
        code: 'wallet_currency_mismatch',
        detail: { lockedCurrency },
      });
    }

    throw new UpscaleToolError('Insufficient wallet balance for this upscale run.', {
      status: 402,
      code: 'insufficient_wallet_funds',
      detail: {
        balanceCents: reserveResult.balanceCents,
        requiredCents: Math.max(0, params.amountCents - reserveResult.balanceCents),
      },
    });
  }

  await insertProvisionalUpscaleJob(executor, {
    userId: params.userId,
    jobId: params.jobId,
    amountCents: params.amountCents,
    currency: params.currency,
    billingProductKey: params.billingProductKey,
    pricingSnapshotJson: params.pricingSnapshotJson,
    vendorAccountId: params.vendorAccountId,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    durationSec: params.durationSec,
    promptSummary: params.promptSummary,
    settingsSnapshotJson: params.settingsSnapshotJson,
  });
}

async function createAtomicInitialUpscaleJob(params: CreateUpscaleInitialJobParams): Promise<void> {
  try {
    await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);
      await createUpscaleInitialJobInExecutor(executor, params);
    });
  } catch (error) {
    if (error instanceof UpscaleToolError) throw error;
    throw new UpscaleToolError('Failed to save upscale job.', {
      status: 500,
      code: 'job_persist_failed',
      detail: error instanceof Error ? error.message : error,
    });
  }
}

async function insertToolEvent(params: {
  jobId: string;
  engineId: UpscaleToolEngineId;
  providerJobId?: string | null;
  payload: Record<string, unknown>;
}) {
  if (!isDatabaseConfigured()) return;
  try {
    await ensureBillingSchema();
    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        params.jobId,
        getResultProviderMode(),
        params.providerJobId ?? null,
        params.engineId,
        TOOL_EVENT_NAME,
        JSON.stringify(params.payload),
      ]
    );
  } catch (error) {
    console.warn('[tools/upscale] failed to persist event log', error);
  }
}

async function persistUpscaleOutput(params: {
  output: UpscaleToolOutput;
  mediaType: UpscaleMediaType;
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: UpscaleToolEngineId;
  engineLabel: string;
  outputFormat: UpscaleOutputFormat;
  durationSec?: number | null;
}): Promise<UpscaleToolOutput> {
  const { output, mediaType, userId, jobId, providerJobId, engineId, engineLabel, outputFormat, durationSec } = params;
  if (!isStorageConfigured() || !output.url) return output;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      resolveUpscaleOutputFetchTimeoutMs({ mediaType, durationSec })
    );
    let response: Response;
    try {
      response = await fetch(output.url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`fetch failed (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('empty output');

    if (mediaType === 'image') {
      const mimeHeader = response.headers.get('content-type') ?? '';
      const mime =
        typeof output.mimeType === 'string' && output.mimeType.startsWith('image/')
          ? output.mimeType
          : mimeHeader.startsWith('image/')
            ? mimeHeader
            : formatToImageMime(outputFormat);
      const upload = await uploadImageToStorage({
        data: buffer,
        mime,
        userId,
        prefix: 'upscale',
        fileName: `upscale-${engineId}.${mime.split('/')[1] || 'png'}`,
      });
      const assetId = await recordUserAsset({
        userId,
        url: upload.url,
        mime: upload.mime,
        width: upload.width ?? output.width ?? null,
        height: upload.height ?? output.height ?? null,
        size: upload.size,
        source: 'upscale',
        metadata: {
          originUrl: output.url,
          jobId,
          providerJobId: providerJobId ?? null,
          tool: 'upscale',
          engineId,
          engineLabel,
        },
      });
      return {
        ...output,
        url: upload.url,
        width: upload.width ?? output.width ?? null,
        height: upload.height ?? output.height ?? null,
        mimeType: upload.mime,
        originUrl: output.url,
        assetId,
        source: 'upscale',
        persisted: true,
      };
    }

    const mimeHeader = response.headers.get('content-type') ?? '';
    const mime =
      typeof output.mimeType === 'string' && (output.mimeType.startsWith('video/') || output.mimeType === 'image/gif')
        ? output.mimeType
        : mimeHeader.startsWith('video/') || mimeHeader === 'image/gif'
          ? mimeHeader
          : formatToVideoMime(outputFormat);
    const upload = await uploadFileBuffer({
      data: buffer,
      mime,
      userId,
      prefix: 'upscale',
      fileName: `upscale-${engineId}.${outputFormat === 'gif' ? 'gif' : outputFormat}`,
    });
    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime,
      width: output.width ?? null,
      height: output.height ?? null,
      size: buffer.length,
      source: 'upscale',
      metadata: {
        originUrl: output.url,
        jobId,
        providerJobId: providerJobId ?? null,
        tool: 'upscale',
        engineId,
        engineLabel,
      },
    });
    return {
      ...output,
      url: upload.url,
      mimeType: mime,
      originUrl: output.url,
      assetId,
      source: 'upscale',
      persisted: true,
    };
  } catch (error) {
    console.warn('[tools/upscale] failed to persist output', {
      engineId,
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
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
  let pricing: PricingSnapshot;
  let pricingEstimate: { megapixels?: number | null; frames?: number | null; durationSec?: number | null } = {};
  try {
    pricing = await computeBillingProductSnapshot({
      productKey: billingProductKey,
      quantity: 1,
      engineId: engine.id,
    });

    if (mediaType === 'video' && videoMetadata) {
      const estimate = estimateVideoUpscaleCostUsd({
        engineId: engine.id,
        width: videoMetadata.width,
        height: videoMetadata.height,
        durationSec: videoMetadata.durationSec,
        fps: videoMetadata.fps,
        targetResolution,
        factor: upscaleFactor,
      });
      pricingEstimate = {
        megapixels: estimate.outputMegapixels,
        frames: estimate.frames,
        durationSec: videoMetadata.durationSec,
      };
      const dynamicCents = Math.max(1, Math.ceil(estimate.costUsd * 100 * UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER));
      pricing = cloneUpscalePricingWithDynamicTotal(pricing, dynamicCents, {
        surface: UPSCALE_SURFACE,
        billingProductKey,
        providerEstimateUsd: estimate.costUsd,
        dynamicMultiplier: UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER,
        videoMetadata,
      });
    } else {
      const estimateCostUsd = estimateImageUpscaleCostUsd({
        engineId: engine.id,
        width: input.imageWidth,
        height: input.imageHeight,
        factor: upscaleFactor,
      });
      pricing.meta = {
        ...(pricing.meta ?? {}),
        surface: UPSCALE_SURFACE,
        billingProductKey,
        providerEstimateUsd: estimateCostUsd,
      };
      pricingEstimate = {
        megapixels:
          typeof input.imageWidth === 'number' && typeof input.imageHeight === 'number'
            ? Number(((input.imageWidth * input.imageHeight * upscaleFactor * upscaleFactor) / 1_000_000).toFixed(4))
            : null,
      };
    }
  } catch (error) {
    throw new UpscaleToolError('Unable to compute upscale pricing.', {
      status: 500,
      code: 'pricing_error',
      detail: error instanceof Error ? error.message : error,
    });
  }

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

    let thumbUrl = PLACEHOLDER_THUMB;
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
      thumbUrl = resolveHeroThumbFromRenders([outputWithThumb]) ?? outputWithThumb.url ?? PLACEHOLDER_THUMB;
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

    await insertToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId: requestId,
      payload: {
        event: TOOL_EVENT_NAME,
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

    await insertToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId,
      payload: {
        event: TOOL_EVENT_NAME,
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
