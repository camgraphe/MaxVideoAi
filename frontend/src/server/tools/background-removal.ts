import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getBackgroundRemovalToolEngine } from '@/config/tools-background-removal-engines';
import { query } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency } from '@/lib/currency';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import {
  buildBackgroundRemovalFalInput,
  resolveOutputCodec,
  resolveStudioBackgroundColor,
  validateBackgroundRemovalDuration,
} from '@/lib/tools-background-removal';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import type { BackgroundRemovalToolRequest, BackgroundRemovalToolResponse } from '@/types/tools-background-removal';
import { BackgroundRemovalToolError } from './background-removal-errors';
export { BackgroundRemovalToolError } from './background-removal-errors';
import {
  BACKGROUND_REMOVAL_PLACEHOLDER_THUMB,
  BACKGROUND_REMOVAL_SURFACE,
  BACKGROUND_REMOVAL_TOOL_EVENT_NAME,
  buildBackgroundRemovalPromptSummary,
  buildBackgroundRemovalSettingsSnapshot,
  extractBackgroundRemovalActualCostUsd,
  extractBackgroundRemovalOutput,
  parseBackgroundRemovalRequestId,
  toBackgroundRemovalValidationMessage,
  type BackgroundRemovalVideoMetadata,
} from './background-removal-request-utils';
import { resolveBackgroundRemovalPricingContext } from './background-removal-pricing-context';
import {
  createAtomicInitialBackgroundRemovalJob,
  insertBackgroundRemovalToolEvent,
  recordBackgroundRemovalRefundReceipt,
  type PendingBackgroundRemovalReceipt,
} from './background-removal-job-persistence';
import { persistBackgroundRemovalOutput } from './background-removal-output-persistence';

type RunBackgroundRemovalToolInput = BackgroundRemovalToolRequest & {
  userId: string;
};

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

function assertAbsoluteVideoUrl(videoUrl: string): void {
  try {
    const parsed = new URL(videoUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('unsupported protocol');
  } catch {
    throw new BackgroundRemovalToolError('Add a valid HTTP(S) video URL before removing a background.', {
      status: 422,
      code: 'invalid_video_url',
    });
  }
}

export async function runBackgroundRemovalToolBase(
  input: RunBackgroundRemovalToolInput
): Promise<BackgroundRemovalToolResponse> {
  assertAbsoluteVideoUrl(input.videoUrl);

  const engine = getBackgroundRemovalToolEngine(input.engineId, 'studio');
  const backgroundColor = resolveStudioBackgroundColor(input.backgroundColor);
  const outputCodec = resolveOutputCodec(input.outputContainerAndCodec);
  const preserveAudio = input.preserveAudio !== false;
  const jobId = `tool_background_removal_${randomUUID()}`;
  const billingProductKey = engine.billingProductKey;
  const priceOnlyReceipts = receiptsPriceOnlyEnabled();
  const durationError = validateBackgroundRemovalDuration(input.durationSec);
  if (durationError) {
    throw new BackgroundRemovalToolError(durationError, {
      status: 422,
      code: 'video_metadata_required',
    });
  }

  const videoMetadata: BackgroundRemovalVideoMetadata = {
    width: input.videoWidth ?? null,
    height: input.videoHeight ?? null,
    durationSec: Math.ceil(input.durationSec ?? 1),
    fps: input.fps ?? null,
  };
  const { pricing, pricingEstimate } = await resolveBackgroundRemovalPricingContext({
    billingProductKey,
    engine,
    videoMetadata,
  });
  const chargedUsd = Number((pricing.totalCents / 100).toFixed(4));
  const chargedCredits = usdToCredits(chargedUsd) ?? 1;
  const settingsSnapshot = buildBackgroundRemovalSettingsSnapshot({
    engine,
    videoUrl: input.videoUrl,
    backgroundColor,
    outputCodec,
    preserveAudio,
    billingProductKey,
    sourceJobId: input.sourceJobId,
    sourceAssetId: input.sourceAssetId,
    metadata: videoMetadata,
  });
  const promptSummary = buildBackgroundRemovalPromptSummary({
    backgroundColor,
    outputCodec,
    preserveAudio,
  });
  const pricingSnapshotJson = JSON.stringify(pricing);
  const settingsSnapshotJson = JSON.stringify(settingsSnapshot);
  const pendingReceipt: PendingBackgroundRemovalReceipt = {
    userId: input.userId,
    amountCents: pricing.totalCents,
    currency: pricing.currency,
    description: `${engine.label} background removal run`,
    jobId,
    surface: BACKGROUND_REMOVAL_SURFACE,
    billingProductKey,
    snapshot: pricing,
    applicationFeeCents: priceOnlyReceipts ? null : getPlatformFeeCents(pricing),
    vendorAccountId: pricing.vendorAccountId ?? null,
  };

  const preferredCurrency = await getUserPreferredCurrency(input.userId);
  await createAtomicInitialBackgroundRemovalJob({
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
    durationSec: videoMetadata.durationSec,
    promptSummary,
    settingsSnapshotJson,
    preferredCurrency,
  });

  const falInput = buildBackgroundRemovalFalInput({
    videoUrl: input.videoUrl,
    backgroundColor,
    outputCodec,
    preserveAudio,
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

    const output = extractBackgroundRemovalOutput(result.data);
    if (!output) {
      throw new BackgroundRemovalToolError('Bria did not return a background-removed video.', {
        status: 502,
        code: 'missing_output',
      });
    }

    const latencyMs = Date.now() - startedAt;
    const requestId = providerJobId ?? parseBackgroundRemovalRequestId(result.data) ?? result.requestId ?? null;
    const providerCostUsd =
      extractBackgroundRemovalActualCostUsd(result.data) ?? extractBackgroundRemovalActualCostUsd(lastQueueUpdate);
    const persistedOutput = await persistBackgroundRemovalOutput({
      output,
      userId: input.userId,
      jobId,
      providerJobId: requestId,
      engineId: engine.id,
      engineLabel: engine.label,
      outputCodec,
      durationSec: videoMetadata.durationSec,
    });
    const thumbUrl = persistedOutput.thumbUrl ?? BACKGROUND_REMOVAL_PLACEHOLDER_THUMB;

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
           settings_snapshot = $9::jsonb,
           message = NULL,
           payment_status = 'paid_wallet',
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        thumbUrl,
        thumbUrl,
        persistedOutput.url,
        requestId,
        pricing.totalCents,
        pricingSnapshotJson,
        JSON.stringify({ providerCostUsd }),
        settingsSnapshotJson,
      ]
    );

    await upsertLegacyJobOutputs({
      job_id: jobId,
      user_id: input.userId,
      surface: BACKGROUND_REMOVAL_SURFACE,
      video_url: persistedOutput.url,
      audio_url: null,
      thumb_url: thumbUrl,
      preview_frame: thumbUrl,
      render_ids: null,
      duration_sec: videoMetadata.durationSec,
      status: 'completed',
    }).catch((outputError) => {
      console.warn('[tools/background-removal] failed to persist job outputs', { jobId }, outputError);
    });

    await ensureReusableAsset({
      userId: input.userId,
      url: persistedOutput.url,
      kind: 'video',
      source: BACKGROUND_REMOVAL_SURFACE,
      sourceJobId: jobId,
      sourceOutputId: `${jobId}:video:0`,
      mimeType: persistedOutput.mimeType ?? 'video/webm',
      width: persistedOutput.width ?? null,
      height: persistedOutput.height ?? null,
      thumbUrl,
    }).catch((assetError) => {
      console.warn('[tools/background-removal] failed to persist media asset', { jobId }, assetError);
    });

    await insertBackgroundRemovalToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId: requestId,
      payload: {
        event: BACKGROUND_REMOVAL_TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'success',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        request: {
          backgroundColor,
          outputCodec,
          preserveAudio,
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
    let message = error instanceof Error ? error.message : 'Background removal failed';
    let status = 502;
    let detail: unknown;
    let code = 'fal_error';

    if (error instanceof BackgroundRemovalToolError) {
      message = error.message;
      status = error.status;
      detail = error.detail;
      code = error.code;
    } else if (error instanceof ValidationError) {
      message = toBackgroundRemovalValidationMessage(error);
      status = 422;
      detail = error.fieldErrors;
      code = 'validation_error';
    } else if (error instanceof ApiError) {
      message = error.message || 'Provider request failed';
      status = typeof error.status === 'number' ? error.status : 502;
      detail = error.body;
      code = 'provider_error';
    }

    await recordBackgroundRemovalRefundReceipt(
      pendingReceipt,
      `Refund ${engine.label} background removal run`,
      priceOnlyReceipts
    );
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
      console.warn('[tools/background-removal] failed to mark job as failed', updateError);
    }

    await insertBackgroundRemovalToolEvent({
      jobId,
      engineId: engine.id,
      providerJobId,
      payload: {
        event: BACKGROUND_REMOVAL_TOOL_EVENT_NAME,
        userId: input.userId,
        status: 'error',
        engine: {
          id: engine.id,
          label: engine.label,
          model: engine.falModelId,
        },
        request: {
          backgroundColor,
          outputCodec,
          preserveAudio,
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

    throw new BackgroundRemovalToolError(message, {
      status,
      code,
      detail,
    });
  }
}
