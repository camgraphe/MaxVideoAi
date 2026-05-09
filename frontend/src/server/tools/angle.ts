import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getAngleToolEngine } from '@/config/tools-angle-engines';
import { query } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency } from '@/lib/currency';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  applyCinemaSafeParams,
  buildBestAngleVariantParams,
  resolveAngleEngineForParams,
  sanitizeAngleParams,
} from '@/lib/tools-angle';
import type {
  AngleToolOutput,
  AngleToolRequest,
  AngleToolResponse,
} from '@/types/tools-angle';
import type { PricingSnapshot } from '@/types/engines';
import {
  ANGLE_MULTI_OUTPUT_COUNT,
  ANGLE_SURFACE,
  buildAngleFalInput,
  buildAnglePromptSummary,
  buildAngleSettingsSnapshot,
  extractAngleActualCostUsd,
  extractAngleOutputs,
  getAngleBillingProductKeyForEngine,
  parseAngleRequestId,
  toAngleValidationMessage,
} from './angle-request-utils';
import { persistAngleOutputs } from './angle-output-persistence';
import { AngleToolError } from './angle-error';
import {
  createAtomicInitialAngleJob,
  PLACEHOLDER_THUMB,
} from './angle-initial-job';
import { insertAngleToolEvent, TOOL_EVENT_NAME } from './angle-event-log';
import { recordAngleRefundReceipt, type PendingAngleReceipt } from './angle-receipts';

export { AngleToolError } from './angle-error';
export { createAngleInitialJobInExecutor } from './angle-initial-job';

type RunAngleToolInput = AngleToolRequest & {
  userId: string;
};

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

export async function runAngleTool(input: RunAngleToolInput): Promise<AngleToolResponse> {
  const requested = sanitizeAngleParams(input.params);
  const safeMode = input.safeMode !== false;
  const applied = applyCinemaSafeParams(requested, safeMode);
  const resolvedEngineId = resolveAngleEngineForParams(input.engineId ?? 'flux-multiple-angles', applied);
  const engine = getAngleToolEngine(resolvedEngineId);
  const generateBestAngles = input.generateBestAngles === true;
  const requestedOutputCount = generateBestAngles && engine.supportsMultiOutput ? ANGLE_MULTI_OUTPUT_COUNT : 1;
  const jobId = `tool_angle_${randomUUID()}`;
  const billingProductKey = getAngleBillingProductKeyForEngine(engine.id, generateBestAngles);
  const priceOnlyReceipts = receiptsPriceOnlyEnabled();
  let pricing: PricingSnapshot;
  try {
    pricing = await computeBillingProductSnapshot({
      productKey: billingProductKey,
      quantity: requestedOutputCount,
      engineId: engine.id,
    });
  } catch (error) {
    throw new AngleToolError('Unable to compute angle pricing.', {
      status: 500,
      code: 'pricing_error',
      detail: error instanceof Error ? error.message : error,
    });
  }

  pricing.meta = {
    ...(pricing.meta ?? {}),
    surface: ANGLE_SURFACE,
    billingProductKey,
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      generateBestAngles,
      requestedOutputCount,
      requested,
      applied: {
        ...applied,
        safeMode,
      },
    },
  };

  const chargedUsd = Number((pricing.totalCents / 100).toFixed(4));
  const chargedCredits = usdToCredits(chargedUsd) ?? 1;
  const settingsSnapshot = buildAngleSettingsSnapshot({
    engine,
    imageUrl: input.imageUrl,
    requested,
    applied: {
      ...applied,
      safeMode,
    },
    generateBestAngles,
    outputCount: requestedOutputCount,
    billingProductKey,
  });
  const promptSummary = buildAnglePromptSummary(applied, requestedOutputCount);
  const pricingSnapshotJson = JSON.stringify(pricing);
  const settingsSnapshotJson = JSON.stringify(settingsSnapshot);
  const pendingReceipt: PendingAngleReceipt = {
    userId: input.userId,
    amountCents: pricing.totalCents,
    currency: pricing.currency,
    description: `${engine.label} angle run`,
    jobId,
    surface: ANGLE_SURFACE,
    billingProductKey,
    snapshot: pricing,
    applicationFeeCents: priceOnlyReceipts ? null : getPlatformFeeCents(pricing),
    vendorAccountId: pricing.vendorAccountId ?? null,
  };
  const preferredCurrency = await getUserPreferredCurrency(input.userId);
  await createAtomicInitialAngleJob({
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
    requestedOutputCount,
    promptSummary,
    settingsSnapshotJson,
    preferredCurrency,
  });

  const falInputs = generateBestAngles
    ? buildBestAngleVariantParams(applied).map((variant) => buildAngleFalInput(engine, input.imageUrl, variant))
    : [buildAngleFalInput(engine, input.imageUrl, applied)];
  const falClient = getFalClient();
  let providerJobId: string | null = null;
  let lastQueueUpdate: unknown = null;
  const startedAt = Date.now();

  try {
    const results = [];
    const outputs: AngleToolOutput[] = [];
    let providerCostUsdTotal = 0;

    for (const falInput of falInputs) {
      const result = await falClient.subscribe(engine.falModelId, {
        input: falInput,
        mode: 'polling',
        onEnqueue(requestId) {
          providerJobId = providerJobId ?? requestId;
        },
        onQueueUpdate(update) {
          if (update?.request_id) {
            providerJobId = providerJobId ?? update.request_id;
          }
          lastQueueUpdate = update;
        },
      });
      results.push(result);
      outputs.push(...extractAngleOutputs(result.data));
      const providerCostUsd = extractAngleActualCostUsd(result.data) ?? extractAngleActualCostUsd(lastQueueUpdate) ?? 0;
      providerCostUsdTotal += providerCostUsd;
    }

    if (!outputs.length) {
      throw new AngleToolError('The selected engine did not return any image output.', {
        status: 502,
        code: 'missing_output',
      });
    }

    const latencyMs = Date.now() - startedAt;
    const finalResult = results[results.length - 1] ?? null;
    const providerCostUsd = providerCostUsdTotal > 0 ? Number(providerCostUsdTotal.toFixed(6)) : null;
    const requestId = providerJobId ?? (finalResult ? parseAngleRequestId(finalResult.data) ?? finalResult.requestId ?? null : null);
    const persistedOutputs = await persistAngleOutputs({
      outputs,
      userId: input.userId,
      jobId,
      providerJobId: requestId,
      engineId: engine.id,
      engineLabel: engine.label,
    });
    const thumbUrls = await createImageThumbnailBatch({
      jobId,
      userId: input.userId,
      imageUrls: persistedOutputs.map((output) => output.url),
    });
    const outputsWithThumbs = persistedOutputs.map((output, index) => ({
      ...output,
      thumbUrl: thumbUrls[index] ?? null,
    }));
    const storedRenderEntries = buildStoredImageRenderEntries(outputsWithThumbs);
    const heroRenderId = outputsWithThumbs[0]?.url ?? null;
    const heroThumb = resolveHeroThumbFromRenders(outputsWithThumbs) ?? heroRenderId ?? PLACEHOLDER_THUMB;

    await query(
      `UPDATE app_jobs
       SET thumb_url = $2,
           preview_frame = $3,
           status = 'completed',
           progress = 100,
           provider_job_id = $4,
           final_price_cents = $5,
           pricing_snapshot = $6::jsonb,
           cost_breakdown_usd = $7::jsonb,
           render_ids = $8::jsonb,
           hero_render_id = $9,
           message = NULL,
           payment_status = 'paid_wallet',
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        heroThumb,
        heroThumb,
        requestId,
        pricing.totalCents,
        pricingSnapshotJson,
        JSON.stringify({ providerCostUsd }),
        JSON.stringify(storedRenderEntries),
        heroRenderId,
      ]
    );

    await upsertLegacyJobOutputs({
      job_id: jobId,
      user_id: input.userId,
      surface: 'angle',
      video_url: null,
      audio_url: null,
      thumb_url: heroThumb,
      preview_frame: heroThumb,
      render_ids: storedRenderEntries,
      duration_sec: 1,
      status: 'completed',
    }).catch((outputError) => {
      console.warn('[tools/angle] failed to persist job outputs', { jobId }, outputError);
    });

    await Promise.allSettled(
      outputsWithThumbs.map((output, index) =>
        ensureReusableAsset({
          userId: input.userId,
          url: output.url,
          kind: 'image',
          source: 'angle',
          sourceJobId: jobId,
          sourceOutputId: `${jobId}:image:${index}`,
          mimeType: output.mimeType ?? 'image/png',
          width: output.width ?? null,
          height: output.height ?? null,
          thumbUrl: output.thumbUrl ?? null,
        })
      )
    );

    await insertAngleToolEvent({
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
        requested,
        applied: {
          ...applied,
          safeMode,
        },
        options: {
          generateBestAngles,
          requestedOutputCount,
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
        },
        outputCount: outputsWithThumbs.length,
      },
    });

    return {
      ok: true,
      jobId,
      engineId: engine.id,
      engineLabel: engine.label,
      requestedOutputCount,
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
      },
      requested,
      applied: {
        ...applied,
        safeMode,
      },
      outputs: outputsWithThumbs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;

    let message = error instanceof Error ? error.message : 'Angle generation failed';
    let status = 502;
    let detail: unknown;
    let code = 'fal_error';

    if (error instanceof AngleToolError) {
      message = error.message;
      status = error.status;
      detail = error.detail;
      code = error.code;
    } else if (error instanceof ValidationError) {
      message = toAngleValidationMessage(error);
      status = 422;
      detail = error.fieldErrors;
      code = 'validation_error';
    } else if (error instanceof ApiError) {
      message = error.message || 'Fal request failed';
      status = typeof error.status === 'number' ? error.status : 502;
      detail = error.body;
      code = 'provider_error';
    }

    await recordAngleRefundReceipt(pendingReceipt, `Refund ${engine.label} angle run`, priceOnlyReceipts);
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
      console.warn('[tools/angle] failed to mark job as failed', updateError);
    }

    await insertAngleToolEvent({
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
        requested,
        applied: {
          ...applied,
          safeMode,
        },
        options: {
          generateBestAngles,
          requestedOutputCount,
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
        },
        error: {
          code,
          message,
          detail,
        },
      },
    });

    throw new AngleToolError(message, {
      status,
      code,
      detail,
    });
  }
}
