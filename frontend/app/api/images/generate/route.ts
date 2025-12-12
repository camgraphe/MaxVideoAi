export const runtime = 'nodejs';

import { ApiError, ValidationError } from '@fal-ai/client';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { listFalEngines } from '@/config/falEngines';
import type {
  GeneratedImage,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/image-generation';
import { getFalClient } from '@/lib/fal-client';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import type { PricingSnapshot } from '@/types/engines';
import { reserveWalletCharge } from '@/lib/wallet';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureUserPreferences } from '@/server/preferences';
import { ensureUserPreferredCurrency, type Currency } from '@/lib/currency';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import { getNanoBananaDefaultAspectRatio, normalizeNanoBananaAspectRatio } from '@/lib/image/aspectRatios';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createSignedDownloadUrl, extractStorageKeyFromUrl, isStorageConfigured } from '@/server/storage';
import { getReferenceConstraints, resolveRequestedResolution } from '../utils';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER: Currency = 'usd';
const MAX_IMAGES = 8;
const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';
const NANO_BANANA_IMAGE_ENGINE_IDS = new Set(['nano-banana', 'nano-banana-pro']);
const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;

type PendingReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  snapshot: unknown;
  applicationFeeCents: number | null;
  vendorAccountId: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
};

const IMAGE_ENGINE_REGISTRY = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'image');
const IMAGE_ENGINE_MAP = new Map(IMAGE_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
const DEFAULT_IMAGE_ENGINE_ID = IMAGE_ENGINE_REGISTRY[0]?.id ?? null;

function getImageEngine(engineId?: string | null) {
  if (engineId && IMAGE_ENGINE_MAP.has(engineId)) {
    return IMAGE_ENGINE_MAP.get(engineId)!;
  }
  if (DEFAULT_IMAGE_ENGINE_ID && IMAGE_ENGINE_MAP.has(DEFAULT_IMAGE_ENGINE_ID)) {
    return IMAGE_ENGINE_MAP.get(DEFAULT_IMAGE_ENGINE_ID)!;
  }
  return null;
}

function normalizeMode(value: unknown, fallback: ImageGenerationMode = 't2i'): ImageGenerationMode {
  if (value === 't2i' || value === 'i2i') {
    return value;
  }
  if (value === 'generate') return 't2i';
  if (value === 'edit') return 'i2i';
  return fallback;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.replace(/^\.?\/+/, '');
  return `https://fal.media/files/${normalized}`;
}

function extractImages(payload: unknown): GeneratedImage[] {
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
    const imagesCandidate = (root as { images?: unknown }).images;
    if (!Array.isArray(imagesCandidate)) continue;
    const mapped = imagesCandidate.reduce<GeneratedImage[]>((acc, entry) => {
      if (!entry || typeof entry !== 'object') {
        return acc;
      }
      const record = entry as Record<string, unknown>;
      const urlRaw = typeof record.url === 'string' ? record.url : null;
      if (!urlRaw) {
        return acc;
      }
      const width = typeof record.width === 'number' ? record.width : null;
      const height = typeof record.height === 'number' ? record.height : null;
      const mime =
        typeof record.content_type === 'string'
          ? (record.content_type as string)
          : typeof record.mimetype === 'string'
            ? (record.mimetype as string)
            : null;
      acc.push({
        url: normalizeUrl(urlRaw),
        width,
        height,
        mimeType: mime,
      });
      return acc;
    }, []);
    if (mapped.length) {
      return mapped;
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

function buildReceiptSnapshot(pricing: PricingSnapshot): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {
    totalCents: pricing.totalCents,
    currency: pricing.currency,
  };

  const discountCandidate = (pricing as {
    discount?: { amountCents?: number; percentApplied?: number; label?: string };
  }).discount;
  if (discountCandidate && typeof discountCandidate.amountCents === 'number' && discountCandidate.amountCents > 0) {
    snapshot.discount = {
      amountCents: discountCandidate.amountCents,
      percentApplied: discountCandidate.percentApplied ?? null,
      label: discountCandidate.label ?? null,
    };
  }

  const taxesCandidate = (pricing as { taxes?: Array<{ amountCents?: number; label?: string }> }).taxes;
  if (Array.isArray(taxesCandidate)) {
    const taxes = taxesCandidate
      .filter((tax) => tax && typeof tax.amountCents === 'number' && tax.amountCents > 0)
      .map((tax) => ({
        amountCents: tax.amountCents!,
        label: tax.label ?? null,
      }));
    if (taxes.length) {
      snapshot.taxes = taxes;
    }
  }

  return snapshot;
}

async function recordRefundReceipt(receipt: PendingReceipt, label: string, priceOnly: boolean) {
  try {
    await query(
      `INSERT INTO app_receipts (
         user_id,
         type,
         amount_cents,
         currency,
         description,
         job_id,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         stripe_payment_intent_id,
         stripe_charge_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
       ON CONFLICT DO NOTHING`,
      [
        receipt.userId,
        receipt.amountCents,
        receipt.currency,
        label,
        receipt.jobId,
        JSON.stringify(receipt.snapshot),
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
        receipt.stripePaymentIntentId ?? null,
        receipt.stripeChargeId ?? null,
        priceOnly ? null : 0,
        priceOnly ? null : receipt.vendorAccountId,
      ]
    );
  } catch (error) {
    console.warn('[images] failed to record refund receipt', error);
  }
}

function respondError(
  mode: ImageGenerationMode,
  code: string,
  message: string,
  status: number,
  detail?: unknown,
  extras?: Partial<ImageGenerationResponse>
) {
  const payload: ImageGenerationResponse = {
    ok: false,
    mode,
    images: [],
    ...extras,
    error: {
      code,
      message,
      detail,
    },
  };
  return NextResponse.json(payload, { status });
}

export async function POST(req: NextRequest) {
  let body: Partial<ImageGenerationRequest> | null = null;
  try {
    body = (await req.json()) as Partial<ImageGenerationRequest>;
  } catch {
    return respondError('t2i', 'invalid_payload', 'Payload must be valid JSON.', 400);
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return respondError('t2i', 'auth_required', 'Authentication required.', 401);
  }

  if (!isDatabaseConfigured()) {
    return respondError('t2i', 'db_unavailable', 'Database unavailable.', 503);
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[images] failed to ensure billing schema', error);
    return respondError('t2i', 'db_unavailable', 'Database unavailable.', 503);
  }

  const engineEntry = getImageEngine(body?.engineId);
  if (!engineEntry) {
    return respondError('t2i', 'engine_unavailable', 'Image engine unavailable.', 503);
  }

  const engine = engineEntry.engine;
  const fallbackMode = (engineEntry.modes[0]?.mode as ImageGenerationMode | undefined) ?? 't2i';
  const mode = normalizeMode(body?.mode, fallbackMode);
  const modeConfig = engineEntry.modes.find((entry) => entry.mode === mode);
  if (!modeConfig?.falModelId) {
    return respondError(mode, 'mode_unsupported', 'Selected engine does not support this mode.', 400, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }
  const isNanoBanana = NANO_BANANA_IMAGE_ENGINE_IDS.has(engineEntry.id);
  const resolvedAspectRatio = isNanoBanana
    ? normalizeNanoBananaAspectRatio(mode, body?.aspectRatio) ?? getNanoBananaDefaultAspectRatio(mode)
    : null;

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt.length) {
    return respondError(mode, 'invalid_prompt', 'Prompt is required.', 400, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }

  const requestedImages =
    typeof body?.numImages === 'number' && Number.isFinite(body.numImages) ? Math.round(body.numImages) : 1;
  const numImages = Math.min(MAX_IMAGES, Math.max(1, requestedImages));

  const rawImageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
  const imageUrls = rawImageUrls
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length);
  const invalidImageUrl = imageUrls.find((entry) => !/^https?:\/\//i.test(entry));
  if (invalidImageUrl) {
    return respondError(
      mode,
      'invalid_image_url',
      'Reference images must be absolute URLs (https://...).',
      400,
      { url: invalidImageUrl },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }
  const referenceConstraints = getReferenceConstraints(engine, mode);
  if (referenceConstraints.min > 0 && imageUrls.length < referenceConstraints.min) {
    const message =
      referenceConstraints.min === 1
        ? 'At least one reference image is required for this request.'
        : `Provide at least ${referenceConstraints.min} reference images for this request.`;
    return respondError(mode, 'missing_image_urls', message, 400, { minRequired: referenceConstraints.min }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }
  if (imageUrls.length > referenceConstraints.max) {
    return respondError(
      mode,
      'too_many_image_urls',
      `You can attach up to ${referenceConstraints.max} reference images.`,
      400,
      { maxAllowed: referenceConstraints.max },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  const requestId = typeof body?.jobId === 'string' && body.jobId.trim().length ? body.jobId.trim() : null;
  const jobId = requestId ?? `img_${randomUUID()}`;

  const durationSec = numImages;
  const resolutionResult = resolveRequestedResolution(
    engine,
    mode,
    typeof body?.resolution === 'string' ? body.resolution : null
  );
  if (!resolutionResult.ok) {
    return respondError(
      mode,
      'resolution_invalid',
      'Selected resolution is not available for this engine.',
      400,
      { allowed: resolutionResult.allowed },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }
  const resolution = resolutionResult.resolution;
  const shouldSendResolution = resolutionResult.configurable;

  let pricing: PricingSnapshot;
  try {
    pricing = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier: body && typeof body === 'object' && 'membershipTier' in body ? (body as { membershipTier?: string }).membershipTier : undefined,
      currency: DISPLAY_CURRENCY,
    });
  } catch (error) {
    console.error('[images] failed to compute pricing snapshot', error);
    return respondError(mode, 'pricing_error', 'Unable to compute pricing.', 500, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }

  const jobAspectRatio = resolvedAspectRatio ?? null;
  const falAspectRatio = resolvedAspectRatio && resolvedAspectRatio !== 'auto' ? resolvedAspectRatio : null;

  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      mode,
      numImages,
      resolution,
      ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
    },
  };

  const priceOnlyReceipts = receiptsPriceOnlyEnabled();
  const receiptSnapshot = priceOnlyReceipts ? buildReceiptSnapshot(pricing) : pricing;
  const pricingSnapshotJson = JSON.stringify(receiptSnapshot);
  const costBreakdownJson =
    !priceOnlyReceipts && pricing.meta?.cost_breakdown_usd ? JSON.stringify(pricing.meta.cost_breakdown_usd) : null;

  const vendorAccountId = pricing.vendorAccountId ?? engine.vendorAccountId ?? null;
  const applicationFeeCents = getPlatformFeeCents(pricing);

  let defaultAllowIndex = true;
  try {
    const prefs = await ensureUserPreferences(userId);
    defaultAllowIndex = prefs.defaultAllowIndex;
  } catch (error) {
    console.warn('[images] unable to read user preferences', error);
  }

  const visibility = body?.visibility === 'public' ? 'public' : 'private';
  const indexable =
    typeof body?.allowIndex === 'boolean' ? body.allowIndex : typeof body?.indexable === 'boolean' ? body.indexable : defaultAllowIndex;

  const description = `${engineEntry.marketingName} – ${numImages} image${numImages > 1 ? 's' : ''}`;
  const pendingReceipt: PendingReceipt = {
    userId,
    amountCents: pricing.totalCents,
    currency: DISPLAY_CURRENCY,
    description,
    jobId,
    snapshot: receiptSnapshot,
    applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
    vendorAccountId,
    stripePaymentIntentId: null,
    stripeChargeId: null,
  };

  const reserveResult = await reserveWalletCharge({
    userId,
    amountCents: pricing.totalCents,
    currency: DISPLAY_CURRENCY,
    description,
    jobId,
    pricingSnapshotJson,
    applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
    vendorAccountId,
    stripePaymentIntentId: null,
    stripeChargeId: null,
  });

  if (!reserveResult.ok) {
    if (reserveResult.errorCode === 'currency_mismatch') {
      return respondError(
        mode,
        'currency_mismatch',
        `Wallet currency locked to ${(reserveResult.preferredCurrency ?? 'USD').toUpperCase()}.`,
        409
      );
    }
    const shortfall = Math.max(0, pricing.totalCents - reserveResult.balanceCents);
    return respondError(mode, 'insufficient_funds', 'Insufficient wallet balance.', 402, {
      requiredCents: shortfall,
      balanceCents: reserveResult.balanceCents,
    });
  }

  await ensureUserPreferredCurrency(userId, DISPLAY_CURRENCY_LOWER);

  let jobInserted = false;
  try {
    await query(
      `INSERT INTO app_jobs (
         job_id,
         user_id,
         engine_id,
         engine_label,
         duration_sec,
         prompt,
         thumb_url,
         aspect_ratio,
         has_audio,
         can_upscale,
         preview_frame,
         batch_id,
         group_id,
         iteration_index,
         iteration_count,
         render_ids,
         hero_render_id,
         local_key,
         message,
         eta_seconds,
         eta_label,
         video_url,
         status,
         progress,
         provider_job_id,
         final_price_cents,
         pricing_snapshot,
         cost_breakdown_usd,
         currency,
         vendor_account_id,
         payment_status,
         stripe_payment_intent_id,
         stripe_charge_id,
         visibility,
         indexable,
         provisional
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,$29,$30,$31,$32,$33,$34,$35,$36
       )`,
      [
        jobId,
        userId,
        engine.id,
        engine.label,
        durationSec,
        prompt,
        PLACEHOLDER_THUMB,
        jobAspectRatio,
        false,
        Boolean(engine.upscale4k),
        PLACEHOLDER_THUMB,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        'pending',
        0,
        null,
        pricing.totalCents,
        pricingSnapshotJson,
        costBreakdownJson,
        pricing.currency,
        vendorAccountId,
        'paid_wallet',
        null,
        null,
        visibility,
        indexable,
        true,
      ]
    );
    jobInserted = true;
  } catch (error) {
    console.error('[images] failed to persist provisional job record', error);
    if (!jobInserted) {
      await recordRefundReceipt(pendingReceipt, `Refund ${engine.label} - ${numImages} images`, priceOnlyReceipts);
    }
    return respondError(mode, 'job_persist_failed', 'Failed to save job record.', 500);
  }

  const falClient = getFalClient();
  const providerMode = getResultProviderMode();
  let providerJobId: string | undefined;

  try {
    const resolvedReferenceUrls =
      mode === 'i2i'
        ? await Promise.all(
            imageUrls.map(async (url) => {
              const key = extractStorageKeyFromUrl(url);
              if (!key) return url;
              if (!isStorageConfigured()) return url;
              try {
                return await createSignedDownloadUrl(key, { expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS });
              } catch (signError) {
                console.warn('[images] failed to sign reference image URL', signError);
                return url;
              }
            })
          )
        : [];

    const result = await falClient.subscribe(modeConfig.falModelId, {
      input: {
        prompt,
        num_images: numImages,
        ...(mode === 'i2i' ? { image_urls: resolvedReferenceUrls } : {}),
        ...(falAspectRatio ? { aspect_ratio: falAspectRatio } : {}),
        ...(shouldSendResolution ? { resolution } : {}),
      },
      mode: 'polling',
      onEnqueue(requestId) {
        providerJobId = requestId;
      },
      onQueueUpdate(update) {
        if (update?.request_id) {
          providerJobId = update.request_id;
        }
      },
    });

    const images = extractImages(result.data);
    if (!images.length) {
      throw new Error('Fal did not return images');
    }

    const normalizedImages = images.map((image) => ({
      ...image,
      url: normalizeMediaUrl(image.url) ?? image.url,
    }));

    const hero = normalizedImages[0]?.url ?? null;
    const description = (result.data && typeof result.data === 'object' && (result.data as { description?: string }).description) || null;
    const renderIdsJson = JSON.stringify(normalizedImages.map((image) => image.url));
    const providerRequestId = providerJobId ?? parseRequestId(result.data) ?? result.requestId ?? null;
    providerJobId = providerRequestId ?? undefined;

    await query(
      `UPDATE app_jobs
       SET thumb_url = $2,
           video_url = $3,
           status = 'completed',
           progress = 100,
           provider_job_id = COALESCE($4, provider_job_id),
           final_price_cents = $5,
           pricing_snapshot = $6::jsonb,
           cost_breakdown_usd = $7::jsonb,
           currency = $8,
           vendor_account_id = $9,
           payment_status = 'paid_wallet',
           visibility = $10,
           indexable = $11,
           message = $12,
           render_ids = $13::jsonb,
           hero_render_id = $14,
           provisional = FALSE,
           updated_at = NOW()
       WHERE job_id = $1`,
      [
        jobId,
        hero ?? PLACEHOLDER_THUMB,
        null,
        providerJobId ?? null,
        pricing.totalCents,
        pricingSnapshotJson,
        costBreakdownJson,
        pricing.currency,
        vendorAccountId,
        visibility,
        indexable,
        description,
        renderIdsJson,
        hero,
      ]
    );

    try {
      await query(
        `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          jobId,
          providerMode,
          providerJobId ?? null,
          engine.id,
          'completed',
          JSON.stringify({
            request: {
              mode,
              numImages,
              resolution,
              ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
            },
            pricing: { totalCents: pricing.totalCents, currency: pricing.currency },
          }),
        ]
      );
    } catch (error) {
      console.warn('[images] failed to record fal queue log', error);
    }

    return NextResponse.json({
      ok: true,
      jobId,
      mode,
      images: normalizedImages,
      description,
      requestId: providerJobId ?? result.requestId ?? null,
      providerJobId: providerJobId ?? null,
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
      durationMs: undefined,
      pricing,
      paymentStatus: 'paid_wallet',
      thumbUrl: hero,
      aspectRatio: resolvedAspectRatio,
      resolution,
    } satisfies ImageGenerationResponse);
  } catch (error) {
    console.error('[images] Fal generation failed', error);
    const providerStatus =
      error instanceof ApiError && typeof error.status === 'number' ? error.status : null;
    const providerBody = error instanceof ApiError ? error.body : null;
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
    const messageBase =
      error instanceof Error && error.message ? error.message : 'Fal request failed';
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
             payment_status = 'refunded_wallet'
         WHERE job_id = $1`,
        [jobId, message, providerJobId ?? null]
      );
    } catch (updateError) {
      console.warn('[images] failed to update failed job', updateError);
    }

    try {
      const hosts = imageUrls
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
          engine.id,
          'failed',
          JSON.stringify({
            request: {
              mode,
              numImages,
              resolution,
              ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
              referenceImageCount: imageUrls.length,
              referenceImageHosts: uniqueHosts,
              falModelId: modeConfig.falModelId,
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

    await recordRefundReceipt(pendingReceipt, `Refund ${engine.label} - ${numImages} images`, priceOnlyReceipts);

    return respondError(mode, 'fal_error', message, 502, { providerStatus, providerBody }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
      jobId,
      paymentStatus: 'refunded_wallet',
    });
  }
}
