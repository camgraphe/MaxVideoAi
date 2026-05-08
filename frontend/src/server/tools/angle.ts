import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getAngleToolEngine } from '@/config/tools-angle-engines';
import { isDatabaseConfigured, query, type QueryExecutor, withDbTransaction } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency, type Currency } from '@/lib/currency';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
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
  AngleToolEngineId,
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

const TOOL_EVENT_NAME = 'tool_angle_generate';
const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';

function usdToCredits(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * 100));
}

export class AngleToolError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; detail?: unknown }) {
    super(message);
    this.name = 'AngleToolError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'angle_tool_error';
    this.detail = options?.detail;
  }
}

type RunAngleToolInput = AngleToolRequest & {
  userId: string;
};

type PendingAngleReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  surface: typeof ANGLE_SURFACE;
  billingProductKey: string;
  snapshot: PricingSnapshot;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
};

type ProvisionalAngleJobInsert = {
  jobId: string;
  userId: string;
  billingProductKey: string;
  engineId: AngleToolEngineId;
  engineLabel: string;
  durationSec: number;
  promptSummary: string;
  finalPriceCents: number;
  pricingSnapshotJson: string;
  settingsSnapshotJson: string;
  currency: string;
  vendorAccountId: string | null;
};

type CreateAngleInitialJobParams = {
  userId: string;
  jobId: string;
  description: string;
  amountCents: number;
  currency: string;
  billingProductKey: string;
  pricingSnapshotJson: string;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
  requestedOutputCount: number;
  promptSummary: string;
  settingsSnapshotJson: string;
  preferredCurrency: Currency | null;
};

async function recordAngleRefundReceipt(receipt: PendingAngleReceipt, label: string, priceOnly: boolean) {
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
    console.warn('[tools/angle] failed to record refund receipt', error);
  }
}

async function insertProvisionalAngleJob(executor: QueryExecutor, params: ProvisionalAngleJobInsert) {
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
      ANGLE_SURFACE,
      params.billingProductKey,
      params.engineId,
      params.engineLabel,
      params.durationSec,
      params.promptSummary,
      PLACEHOLDER_THUMB,
      PLACEHOLDER_THUMB,
      params.finalPriceCents,
      params.pricingSnapshotJson,
      params.settingsSnapshotJson,
      params.currency,
      params.vendorAccountId,
    ]
  );
}

export async function createAngleInitialJobInExecutor(
  executor: QueryExecutor,
  params: CreateAngleInitialJobParams
): Promise<void> {
  const reserveResult = await reserveWalletChargeInExecutor(
    executor,
    {
      userId: params.userId,
      amountCents: params.amountCents,
      currency: params.currency,
      description: params.description,
      jobId: params.jobId,
      surface: ANGLE_SURFACE,
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
      throw new AngleToolError(`Wallet currency locked to ${lockedCurrency}. Contact support to request a change.`, {
        status: 409,
        code: 'wallet_currency_mismatch',
        detail: { lockedCurrency },
      });
    }

    throw new AngleToolError('Insufficient wallet balance for this angle run.', {
      status: 402,
      code: 'insufficient_wallet_funds',
      detail: {
        balanceCents: reserveResult.balanceCents,
        requiredCents: Math.max(0, params.amountCents - reserveResult.balanceCents),
      },
    });
  }

  await insertProvisionalAngleJob(executor, {
    jobId: params.jobId,
    userId: params.userId,
    billingProductKey: params.billingProductKey,
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    durationSec: params.requestedOutputCount,
    promptSummary: params.promptSummary,
    finalPriceCents: params.amountCents,
    pricingSnapshotJson: params.pricingSnapshotJson,
    settingsSnapshotJson: params.settingsSnapshotJson,
    currency: params.currency,
    vendorAccountId: params.vendorAccountId,
  });
}

async function createAtomicInitialAngleJob(params: CreateAngleInitialJobParams): Promise<void> {
  try {
    await withDbTransaction(async (executor) => {
      await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [params.jobId]);
      await createAngleInitialJobInExecutor(executor, params);
    });
  } catch (error) {
    if (error instanceof AngleToolError) {
      throw error;
    }

    throw new AngleToolError('Failed to save angle job.', {
      status: 500,
      code: 'job_persist_failed',
      detail: error instanceof Error ? error.message : error,
    });
  }
}

async function insertToolEvent(params: {
  jobId: string;
  engineId: AngleToolEngineId;
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
    console.warn('[tools/angle] failed to persist event log', error);
  }
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
