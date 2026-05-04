import { randomUUID } from 'crypto';
import { ApiError, ValidationError } from '@fal-ai/client';
import { getAngleToolEngine } from '@/config/tools-angle-engines';
import { isDatabaseConfigured, query, type QueryExecutor, withDbTransaction } from '@/lib/db';
import { getFalClient } from '@/lib/fal-client';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import { ensureBillingSchema } from '@/lib/schema';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import { getPlatformFeeCents } from '@/lib/pricing';
import { getUserPreferredCurrency, type Currency } from '@/lib/currency';
import { reserveWalletChargeInExecutor } from '@/lib/wallet';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { isStorageConfigured, recordUserAsset, uploadImageToStorage } from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  applyCinemaSafeParams,
  buildBestAngleVariantParams,
  mapTiltForEngine,
  normalizeRotation,
  resolveAngleEngineForParams,
  sanitizeAngleParams,
} from '@/lib/tools-angle';
import type {
  AngleToolEngineDefinition,
  AngleToolOutput,
  AngleToolRequest,
  AngleToolResponse,
  AngleToolEngineId,
} from '@/types/tools-angle';
import type { PricingSnapshot } from '@/types/engines';

const TOOL_EVENT_NAME = 'tool_angle_generate';
const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';
const ANGLE_SURFACE = 'angle' as const;
const ANGLE_MULTI_OUTPUT_COUNT = 4;

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

function getAngleBillingProductKeyForEngine(engineId: AngleToolEngineId, generateBestAngles: boolean): string {
  const family = engineId === 'qwen-multiple-angles' ? 'qwen' : 'flux';
  return `angle-${family}-${generateBestAngles ? 'multi' : 'single'}`;
}

function buildAnglePromptSummary(params: { rotation: number; tilt: number; zoom: number }, outputCount: number): string {
  return `Angle tool · rotation ${Math.round(params.rotation)}° · tilt ${Math.round(params.tilt)}° · zoom ${params.zoom.toFixed(1)} · ${outputCount} output${outputCount > 1 ? 's' : ''}`;
}

function buildAngleSettingsSnapshot(args: {
  engine: AngleToolEngineDefinition;
  imageUrl: string;
  requested: AngleToolRequest['params'];
  applied: AngleToolRequest['params'] & { safeMode: boolean; safeApplied: boolean };
  generateBestAngles: boolean;
  outputCount: number;
  billingProductKey: string;
}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    surface: ANGLE_SURFACE,
    billingProductKey: args.billingProductKey,
    engineId: args.engine.id,
    engineLabel: args.engine.label,
    inputMode: 'i2i',
    prompt: buildAnglePromptSummary(args.applied, args.outputCount),
    source: {
      imageUrl: args.imageUrl,
    },
    controls: {
      requested: args.requested,
      applied: args.applied,
      generateBestAngles: args.generateBestAngles,
      outputCount: args.outputCount,
    },
  };
}

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

function normalizeFalUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^\.?\/+/, '');
  return `https://fal.media/files/${normalized}`;
}

function toAngleOutput(entry: Record<string, unknown>): AngleToolOutput | null {
  const urlRaw =
    typeof entry.url === 'string'
      ? entry.url
      : typeof entry.image_url === 'string'
        ? entry.image_url
        : typeof entry.path === 'string'
          ? entry.path
          : null;
  if (!urlRaw) return null;

  const width = typeof entry.width === 'number' ? entry.width : null;
  const height = typeof entry.height === 'number' ? entry.height : null;
  const mimeType =
    typeof entry.content_type === 'string'
      ? entry.content_type
      : typeof entry.mimetype === 'string'
        ? entry.mimetype
        : typeof entry.mime === 'string'
          ? entry.mime
          : null;

  return {
    url: normalizeMediaUrl(normalizeFalUrl(urlRaw)) ?? normalizeFalUrl(urlRaw),
    width,
    height,
    mimeType,
  };
}

function extractOutputs(payload: unknown): AngleToolOutput[] {
  const roots: unknown[] = [];
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    roots.push(record);
    if (record.output && typeof record.output === 'object') roots.push(record.output);
    if (record.response && typeof record.response === 'object') roots.push(record.response);
    if (record.data && typeof record.data === 'object') roots.push(record.data);
  }

  for (const root of roots) {
    if (!root || typeof root !== 'object') continue;
    const record = root as Record<string, unknown>;

    if (Array.isArray(record.images)) {
      const mapped = record.images
        .map((entry) => (entry && typeof entry === 'object' ? toAngleOutput(entry as Record<string, unknown>) : null))
        .filter((entry): entry is AngleToolOutput => Boolean(entry));
      if (mapped.length) return mapped;
    }

    if (record.image && typeof record.image === 'object') {
      const single = toAngleOutput(record.image as Record<string, unknown>);
      if (single) return [single];
    }

    if (typeof record.url === 'string') {
      const single = toAngleOutput(record);
      if (single) return [single];
    }
  }

  return [];
}

function parseRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  const direct = typeof record.request_id === 'string' ? record.request_id : undefined;
  if (direct) return direct;
  if (typeof record.id === 'string') return record.id;
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.request_id === 'string') return responseRecord.request_id;
    if (typeof responseRecord.id === 'string') return responseRecord.id;
  }
  if (record.output && typeof record.output === 'object') {
    const outputRecord = record.output as Record<string, unknown>;
    if (typeof outputRecord.request_id === 'string') return outputRecord.request_id;
    if (typeof outputRecord.id === 'string') return outputRecord.id;
  }
  return undefined;
}

function extractActualCostUsd(payload: unknown): number | null {
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  const candidates: number[] = [];

  const isCostKey = (rawKey: string): boolean => {
    const key = rawKey.toLowerCase();
    if (key.includes('zoom_amount')) return false;
    return (
      key === 'cost' ||
      key === 'price' ||
      key.includes('cost_usd') ||
      key.includes('price_usd') ||
      key.includes('actual_cost') ||
      key.includes('estimated_cost') ||
      key.endsWith('_usd') ||
      key.endsWith('usd')
    );
  };

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    const { value, depth } = current;
    if (depth > 5 || value == null) continue;

    if (typeof value === 'string') {
      const cleaned = value.trim();
      const dollarMatch = cleaned.match(/\$\s*([0-9]+(?:\.[0-9]+)?)/);
      if (dollarMatch) {
        const parsed = Number(dollarMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) candidates.push(parsed);
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.slice(0, 20).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
      continue;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      Object.entries(record).forEach(([key, field]) => {
        const costLike = isCostKey(key);

        if (costLike && typeof field === 'number' && Number.isFinite(field) && field > 0 && field < 10_000) {
          candidates.push(field);
          return;
        }

        if (costLike && typeof field === 'string') {
          const parsed = Number(field.replace(/[^0-9.]+/g, ''));
          if (Number.isFinite(parsed) && parsed > 0) {
            candidates.push(parsed);
            return;
          }
        }

        queue.push({ value: field, depth: depth + 1 });
      });
    }
  }

  if (!candidates.length) return null;
  const costCandidate = candidates.find((value) => value <= 100) ?? candidates[0];
  return Number(costCandidate.toFixed(6));
}

function buildFalInput(
  engine: AngleToolEngineDefinition,
  imageUrl: string,
  params: { rotation: number; tilt: number; zoom: number }
) {
  const horizontalAngle = Math.round(normalizeRotation(params.rotation));
  const verticalAngle = Math.round(mapTiltForEngine(engine.id, params.tilt));
  const zoomAmount = Number(params.zoom.toFixed(1));

  return {
    image_urls: [imageUrl],
    horizontal_angle: horizontalAngle,
    vertical_angle: verticalAngle,
    zoom_amount: zoomAmount,
    num_images: 1,
  };
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

async function persistAngleOutput(params: {
  output: AngleToolOutput;
  outputIndex: number;
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
}): Promise<AngleToolOutput> {
  const { output, outputIndex, userId, jobId, providerJobId, engineId, engineLabel } = params;
  if (!isStorageConfigured() || !output.url) {
    return output;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let response: Response;
    try {
      response = await fetch(output.url, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`fetch failed (${response.status})`);
    }

    const mimeHeader = response.headers.get('content-type') ?? '';
    const mime =
      typeof output.mimeType === 'string' && output.mimeType.startsWith('image/')
        ? output.mimeType
        : mimeHeader.startsWith('image/')
          ? mimeHeader
          : 'image/png';

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      throw new Error('empty image');
    }

    const upload = await uploadImageToStorage({
      data: buffer,
      mime,
      userId,
      prefix: 'angle',
      fileName: `angle-${engineId}-${outputIndex + 1}.${mime.split('/')[1] || 'png'}`,
    });

    const assetId = await recordUserAsset({
      userId,
      url: upload.url,
      mime: upload.mime,
      width: upload.width ?? output.width ?? null,
      height: upload.height ?? output.height ?? null,
      size: upload.size,
      source: 'angle',
      metadata: {
        originUrl: output.url,
        jobId,
        providerJobId: providerJobId ?? null,
        tool: 'angle',
        label: 'angle',
        engineId,
        engineLabel,
        outputIndex,
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
      source: 'angle',
      persisted: true,
    };
  } catch (error) {
    console.warn('[tools/angle] failed to persist output', {
      engineId,
      jobId,
      outputIndex,
      error: error instanceof Error ? error.message : String(error),
    });
    return output;
  }
}

async function persistAngleOutputs(params: {
  outputs: AngleToolOutput[];
  userId: string;
  jobId: string;
  providerJobId?: string | null;
  engineId: AngleToolEngineId;
  engineLabel: string;
}): Promise<AngleToolOutput[]> {
  const { outputs, userId, jobId, providerJobId, engineId, engineLabel } = params;
  return Promise.all(
    outputs.map((output, index) =>
      persistAngleOutput({
        output,
        outputIndex: index,
        userId,
        jobId,
        providerJobId,
        engineId,
        engineLabel,
      })
    )
  );
}

function toValidationMessage(error: ValidationError): string {
  const messages = error.fieldErrors
    .map((entry) => {
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => part !== 'body') : [];
      const path = loc.length ? loc.join('.') : null;
      const msg = typeof entry.msg === 'string' ? entry.msg.trim() : '';
      if (!msg) return null;
      return path ? `${path}: ${msg}` : msg;
    })
    .filter((entry): entry is string => Boolean(entry));

  if (!messages.length) {
    return error.message || 'Validation failed';
  }
  return messages.slice(0, 3).join(' · ');
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
    ? buildBestAngleVariantParams(applied).map((variant) => buildFalInput(engine, input.imageUrl, variant))
    : [buildFalInput(engine, input.imageUrl, applied)];
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
      outputs.push(...extractOutputs(result.data));
      const providerCostUsd = extractActualCostUsd(result.data) ?? extractActualCostUsd(lastQueueUpdate) ?? 0;
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
    const requestId = providerJobId ?? (finalResult ? parseRequestId(finalResult.data) ?? finalResult.requestId ?? null : null);
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
      message = toValidationMessage(error);
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
