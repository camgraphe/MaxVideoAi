import { ApiError, ValidationError } from '@fal-ai/client';
import { randomUUID } from 'crypto';
import { listFalEngines } from '@/config/falEngines';
import type {
  CharacterReferenceSelection,
  GeneratedImage,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/image-generation';
import { getFalClient } from '@/lib/fal-client';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureAssetSchema, ensureBillingSchema } from '@/lib/schema';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import type { PricingSnapshot } from '@/types/engines';
import { reserveWalletCharge } from '@/lib/wallet';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureUserPreferences } from '@/server/preferences';
import { ensureUserPreferredCurrency, type Currency } from '@/lib/currency';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import { createSignedDownloadUrl, extractStorageKeyFromUrl, isStorageConfigured } from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import {
  formatSupportedImageFormatsLabel,
  getSupportedImageFormats,
  inferImageFormatFromUrl,
  isSupportedImageFormat,
  isSupportedImageMime,
} from '@/lib/image/formats';
import {
  canonicalizeImageFieldValue,
  clampRequestedImageCount,
  getImageFieldValues,
  getImageInputField,
  getReferenceConstraints,
  normalizeFalImageResolution,
  resolveRequestedAspectRatio,
  resolveRequestedResolution,
} from '@/app/api/images/utils';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER: Currency = 'usd';
const PLACEHOLDER_THUMB = '/assets/frames/thumb-1x1.svg';
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

type ExecuteImageGenerationOptions = {
  userId: string;
  body: Partial<ImageGenerationRequest>;
  settingsSnapshot?: unknown;
};

type ImageEngineEntry = (typeof IMAGE_ENGINE_REGISTRY)[number];

const IMAGE_ENGINE_REGISTRY = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'image');
const IMAGE_ENGINE_MAP = new Map(IMAGE_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
const DEFAULT_IMAGE_ENGINE_ID = IMAGE_ENGINE_REGISTRY[0]?.id ?? null;

export class ImageGenerationExecutionError extends Error {
  mode: ImageGenerationMode;
  status: number;
  code: string;
  detail?: unknown;
  extras?: Partial<ImageGenerationResponse>;

  constructor(
    message: string,
    options?: {
      mode?: ImageGenerationMode;
      status?: number;
      code?: string;
      detail?: unknown;
      extras?: Partial<ImageGenerationResponse>;
    }
  ) {
    super(message);
    this.name = 'ImageGenerationExecutionError';
    this.mode = options?.mode ?? 't2i';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'image_generation_failed';
    this.detail = options?.detail;
    this.extras = options?.extras;
  }
}

function normalizeOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function getImageEngine(engineId?: string | null): ImageEngineEntry | null {
  if (engineId && IMAGE_ENGINE_MAP.has(engineId)) {
    return IMAGE_ENGINE_MAP.get(engineId) ?? null;
  }
  if (DEFAULT_IMAGE_ENGINE_ID && IMAGE_ENGINE_MAP.has(DEFAULT_IMAGE_ENGINE_ID)) {
    return IMAGE_ENGINE_MAP.get(DEFAULT_IMAGE_ENGINE_ID) ?? null;
  }
  return null;
}

function normalizeMode(value: unknown, fallback: ImageGenerationMode = 't2i'): ImageGenerationMode {
  if (value === 't2i' || value === 'i2i') return value;
  if (value === 'generate') return 't2i';
  if (value === 'edit') return 'i2i';
  return fallback;
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://fal.media/files/${trimmed.replace(/^\.?\/+/, '')}`;
}

function sanitizeCharacterReferences(value: unknown): CharacterReferenceSelection[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<CharacterReferenceSelection[]>((acc, entry) => {
    if (!entry || typeof entry !== 'object') return acc;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const jobId = typeof record.jobId === 'string' ? record.jobId.trim() : '';
    const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
    if (!id || !jobId || !/^https?:\/\//i.test(imageUrl)) return acc;

    acc.push({
      id,
      jobId,
      imageUrl,
      thumbUrl:
        typeof record.thumbUrl === 'string' && /^https?:\/\//i.test(record.thumbUrl.trim())
          ? record.thumbUrl.trim()
          : null,
      prompt: typeof record.prompt === 'string' && record.prompt.trim().length ? record.prompt.trim() : null,
      createdAt: typeof record.createdAt === 'string' && record.createdAt.trim().length ? record.createdAt.trim() : null,
      engineLabel:
        typeof record.engineLabel === 'string' && record.engineLabel.trim().length ? record.engineLabel.trim() : null,
      outputMode:
        record.outputMode === 'portrait-reference' || record.outputMode === 'character-sheet'
          ? record.outputMode
          : null,
      action:
        record.action === 'generate' || record.action === 'full-body-fix' || record.action === 'lighting-variant'
          ? record.action
          : null,
    });
    return acc;
  }, []);
}

function buildCharacterReferencePrompt(prompt: string, characterReferences: CharacterReferenceSelection[]): string {
  if (!characterReferences.length) return prompt;

  const instruction =
    characterReferences.length === 1
      ? 'Use the selected character reference as the primary identity anchor. Preserve face, hairstyle, body proportions, and distinctive character cues unless the prompt explicitly requests a change.'
      : 'Treat the selected character references as distinct character identities. Preserve each separately, match cast order to selection order, and do not merge identities. If the user prompt implies fewer characters than selected, prioritize them in selection order.';

  return `${prompt}\n\nCharacter reference instructions:\n${instruction}`;
}

async function getStoredAssetMimeByUrl(userId: string, urls: string[]): Promise<Map<string, string>> {
  if (!urls.length) {
    return new Map();
  }

  try {
    await ensureAssetSchema();
    const rows = await query<{ url: string; mime_type: string | null }>(
      `SELECT url, mime_type
       FROM user_assets
       WHERE user_id = $1
         AND url = ANY($2::text[])`,
      [userId, urls]
    );
    return new Map(
      rows
        .filter(
          (row): row is { url: string; mime_type: string } =>
            typeof row.url === 'string' && typeof row.mime_type === 'string'
        )
        .map((row) => [row.url, row.mime_type])
    );
  } catch (error) {
    console.warn('[images] unable to inspect stored asset formats', error);
    return new Map();
  }
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
      if (!entry || typeof entry !== 'object') return acc;
      const record = entry as Record<string, unknown>;
      const urlRaw = typeof record.url === 'string' ? record.url : null;
      if (!urlRaw) return acc;

      acc.push({
        url: normalizeUrl(urlRaw),
        width: typeof record.width === 'number' ? record.width : null,
        height: typeof record.height === 'number' ? record.height : null,
        mimeType:
          typeof record.content_type === 'string'
            ? record.content_type
            : typeof record.mimetype === 'string'
              ? record.mimetype
              : null,
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
  if (typeof record.request_id === 'string') return record.request_id;
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

function buildDefaultSettingsSnapshot(args: {
  engineEntry: ImageEngineEntry;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  resolvedAspectRatio: string | null;
  resolution: string;
  normalizedSeed: number | null;
  outputFormat: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  imageUrls: string[];
  characterReferences: CharacterReferenceSelection[];
  membershipTier?: string;
  visibility: 'public' | 'private';
  indexable: boolean;
}): unknown {
  return {
    schemaVersion: 1,
    surface: 'image',
    engineId: args.engineEntry.id,
    engineLabel: args.engineEntry.marketingName,
    inputMode: args.mode,
    prompt: args.prompt,
    core: {
      numImages: args.numImages,
      aspectRatio: args.resolvedAspectRatio ?? null,
      resolution: args.resolution,
      seed: args.normalizedSeed,
      outputFormat: args.outputFormat,
      enableWebSearch: args.enableWebSearch,
      thinkingLevel: args.thinkingLevel,
      limitGenerations: args.limitGenerations,
    },
    refs: {
      imageUrls: args.imageUrls,
      characterReferences: args.characterReferences,
    },
    meta: {
      memberTier: args.membershipTier ?? null,
      visibility: args.visibility,
      indexable: args.indexable,
    },
  };
}

function fail(
  mode: ImageGenerationMode,
  code: string,
  message: string,
  status: number,
  detail?: unknown,
  extras?: Partial<ImageGenerationResponse>
): never {
  throw new ImageGenerationExecutionError(message, { mode, code, status, detail, extras });
}

export async function executeImageGeneration({
  userId,
  body,
  settingsSnapshot,
}: ExecuteImageGenerationOptions): Promise<ImageGenerationResponse> {
  if (!isDatabaseConfigured()) {
    fail('t2i', 'db_unavailable', 'Database unavailable.', 503);
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[images] failed to ensure billing schema', error);
    fail('t2i', 'db_unavailable', 'Database unavailable.', 503);
  }

  const engineEntry = getImageEngine(body.engineId);
  if (!engineEntry) {
    fail('t2i', 'engine_unavailable', 'Image engine unavailable.', 503);
  }

  const engine = engineEntry.engine;
  const fallbackMode = (engineEntry.modes[0]?.mode as ImageGenerationMode | undefined) ?? 't2i';
  const mode = normalizeMode(body.mode, fallbackMode);
  const modeConfig = engineEntry.modes.find((entry) => entry.mode === mode);
  if (!modeConfig?.falModelId) {
    fail(mode, 'mode_unsupported', 'Selected engine does not support this mode.', 400, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }

  const aspectRatioResult = resolveRequestedAspectRatio(
    engine,
    mode,
    typeof body.aspectRatio === 'string' ? body.aspectRatio : null
  );
  if (!aspectRatioResult.ok) {
    fail(
      mode,
      'aspect_ratio_invalid',
      'Selected aspect ratio is not available for this engine.',
      400,
      { allowed: aspectRatioResult.allowed },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }
  const resolvedAspectRatio = aspectRatioResult.value || null;

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt.length) {
    fail(mode, 'invalid_prompt', 'Prompt is required.', 400, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }

  const requestedImages =
    typeof body.numImages === 'number' && Number.isFinite(body.numImages) ? Math.round(body.numImages) : 1;
  const numImages = clampRequestedImageCount(engine, mode, requestedImages);

  const rawImageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const imageUrls = rawImageUrls
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length);
  const characterReferences = sanitizeCharacterReferences(body.characterReferences);
  const characterReferenceUrls = characterReferences.map((entry) => entry.imageUrl);
  const combinedImageUrls = [...characterReferenceUrls, ...imageUrls];
  const effectivePrompt = buildCharacterReferencePrompt(prompt, characterReferences);
  const invalidImageUrl = combinedImageUrls.find((entry) => !/^https?:\/\//i.test(entry));
  if (invalidImageUrl) {
    fail(
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

  const supportedReferenceFormats = getSupportedImageFormats(engine);
  if (supportedReferenceFormats.length && combinedImageUrls.length) {
    const storedAssetMimeByUrl = await getStoredAssetMimeByUrl(userId, combinedImageUrls);
    const invalidImageFormatUrl = combinedImageUrls.find((entry) => {
      const storedMime = storedAssetMimeByUrl.get(entry) ?? null;
      const supportedByMime = isSupportedImageMime(supportedReferenceFormats, storedMime);
      if (supportedByMime != null) {
        return !supportedByMime;
      }
      const inferredFormat = inferImageFormatFromUrl(entry);
      if (!inferredFormat) {
        return false;
      }
      return !isSupportedImageFormat(supportedReferenceFormats, inferredFormat);
    });
    if (invalidImageFormatUrl) {
      fail(
        mode,
        'image_format_invalid',
        `Reference images must use ${formatSupportedImageFormatsLabel(supportedReferenceFormats)}.`,
        400,
        { allowed: supportedReferenceFormats, url: invalidImageFormatUrl },
        {
          engineId: engineEntry.id,
          engineLabel: engineEntry.marketingName,
        }
      );
    }
  }

  const referenceConstraints = getReferenceConstraints(engine, mode);
  if (referenceConstraints.min > 0 && combinedImageUrls.length < referenceConstraints.min) {
    const message =
      referenceConstraints.min === 1
        ? 'At least one reference image is required for this request.'
        : `Provide at least ${referenceConstraints.min} reference images for this request.`;
    fail(mode, 'missing_image_urls', message, 400, { minRequired: referenceConstraints.min }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }
  if (combinedImageUrls.length > referenceConstraints.max) {
    fail(
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

  const requestId = typeof body.jobId === 'string' && body.jobId.trim().length ? body.jobId.trim() : null;
  const jobId = requestId ?? `img_${randomUUID()}`;
  const durationSec = numImages;

  const resolutionResult = resolveRequestedResolution(
    engine,
    mode,
    typeof body.resolution === 'string' ? body.resolution : null
  );
  if (!resolutionResult.ok) {
    fail(
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

  const normalizedSeed =
    getImageInputField(engine, 'seed', mode) && typeof body.seed === 'number' && Number.isFinite(body.seed)
      ? Math.round(body.seed)
      : null;
  const outputFormatValues = getImageFieldValues(engine, 'output_format', mode);
  const outputFormat =
    typeof body.outputFormat === 'string'
      ? canonicalizeImageFieldValue(outputFormatValues, body.outputFormat)
      : null;
  if (typeof body.outputFormat === 'string' && body.outputFormat.trim().length && !outputFormat) {
    fail(
      mode,
      'output_format_invalid',
      'Selected output format is not available for this engine.',
      400,
      { allowed: outputFormatValues },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  const thinkingLevelValues = getImageFieldValues(engine, 'thinking_level', mode);
  const thinkingLevel =
    typeof body.thinkingLevel === 'string'
      ? canonicalizeImageFieldValue(thinkingLevelValues, body.thinkingLevel)
      : null;
  if (typeof body.thinkingLevel === 'string' && body.thinkingLevel.trim().length && !thinkingLevel) {
    fail(
      mode,
      'thinking_level_invalid',
      'Selected thinking level is not available for this engine.',
      400,
      { allowed: thinkingLevelValues },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  const enableWebSearch =
    Boolean(getImageInputField(engine, 'enable_web_search', mode)) &&
    normalizeOptionalBoolean(body.enableWebSearch) === true;
  const limitGenerations =
    Boolean(getImageInputField(engine, 'limit_generations', mode)) &&
    normalizeOptionalBoolean(body.limitGenerations) === true;

  let pricing: PricingSnapshot;
  const membershipTier = typeof body.membershipTier === 'string' && body.membershipTier.trim().length
    ? body.membershipTier.trim()
    : undefined;
  try {
    pricing = await computePricingSnapshot({
      engine,
      durationSec,
      resolution,
      membershipTier,
      currency: DISPLAY_CURRENCY,
      addons: enableWebSearch ? { enable_web_search: true } : undefined,
    });
  } catch (error) {
    console.error('[images] failed to compute pricing snapshot', error);
    fail(mode, 'pricing_error', 'Unable to compute pricing.', 500, null, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
    });
  }

  const jobAspectRatio = resolvedAspectRatio ?? null;
  const falAspectRatio = resolvedAspectRatio && resolvedAspectRatio !== 'auto' ? resolvedAspectRatio : null;
  const falResolution = shouldSendResolution ? normalizeFalImageResolution(resolution) : null;

  pricing.meta = {
    ...(pricing.meta ?? {}),
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      mode,
      numImages,
      resolution,
      ...(characterReferences.length ? { characterReferenceCount: characterReferences.length } : {}),
      ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
      ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
      ...(outputFormat ? { outputFormat } : {}),
      ...(enableWebSearch ? { enableWebSearch } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
      ...(limitGenerations ? { limitGenerations } : {}),
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

  const visibility = body.visibility === 'public' ? 'public' : 'private';
  const indexable =
    typeof body.allowIndex === 'boolean'
      ? body.allowIndex
      : typeof body.indexable === 'boolean'
        ? body.indexable
        : defaultAllowIndex;

  const settingsSnapshotJson = JSON.stringify(
    settingsSnapshot ??
      buildDefaultSettingsSnapshot({
        engineEntry,
        mode,
        prompt,
        numImages,
        resolvedAspectRatio,
        resolution,
        normalizedSeed,
        outputFormat,
        enableWebSearch,
        thinkingLevel,
        limitGenerations,
        imageUrls,
        characterReferences,
        membershipTier,
        visibility,
        indexable,
      })
  );

  const description = `${engineEntry.marketingName} - ${numImages} image${numImages > 1 ? 's' : ''}`;
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
      fail(
        mode,
        'currency_mismatch',
        `Wallet currency locked to ${(reserveResult.preferredCurrency ?? 'USD').toUpperCase()}.`,
        409
      );
    }
    const shortfall = Math.max(0, pricing.totalCents - reserveResult.balanceCents);
    fail(mode, 'insufficient_funds', 'Insufficient wallet balance.', 402, {
      requiredCents: shortfall,
      balanceCents: reserveResult.balanceCents,
    });
  }

  await ensureUserPreferredCurrency(userId, DISPLAY_CURRENCY_LOWER);

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
         settings_snapshot,
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
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,$29::jsonb,$30,$31,$32,$33,$34,$35,$36,$37
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
        settingsSnapshotJson,
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
  } catch (error) {
    console.error('[images] failed to persist provisional job record', error);
    await recordRefundReceipt(pendingReceipt, `Refund ${engine.label} - ${numImages} images`, priceOnlyReceipts);
    fail(mode, 'job_persist_failed', 'Failed to save job record.', 500);
  }

  const falClient = getFalClient();
  const providerMode = getResultProviderMode();
  let providerJobId: string | undefined;

  try {
    const resolvedReferenceUrls =
      mode === 'i2i'
        ? await Promise.all(
            combinedImageUrls.map(async (url) => {
              const key = extractStorageKeyFromUrl(url);
              if (!key || !isStorageConfigured()) return url;
              try {
                return await createSignedDownloadUrl(key, {
                  expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS,
                });
              } catch (signError) {
                console.warn('[images] failed to sign reference image URL', signError);
                return url;
              }
            })
          )
        : [];

    const result = await falClient.subscribe(modeConfig.falModelId, {
      input: {
        prompt: effectivePrompt,
        num_images: numImages,
        ...(mode === 'i2i' ? { image_urls: resolvedReferenceUrls } : {}),
        ...(falAspectRatio ? { aspect_ratio: falAspectRatio } : {}),
        ...(falResolution ? { resolution: falResolution } : {}),
        ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
        ...(outputFormat ? { output_format: outputFormat } : {}),
        ...(enableWebSearch ? { enable_web_search: true } : {}),
        ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
        ...(limitGenerations ? { limit_generations: true } : {}),
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

    const thumbUrls = await createImageThumbnailBatch({
      jobId,
      userId,
      imageUrls: normalizedImages.map((image) => image.url),
    });
    const normalizedImagesWithThumbs = normalizedImages.map((image, index) => ({
      ...image,
      thumbUrl: thumbUrls[index] ?? null,
    }));
    const storedRenderEntries = buildStoredImageRenderEntries(normalizedImagesWithThumbs);
    const hero = normalizedImagesWithThumbs[0]?.url ?? null;
    const heroThumb = resolveHeroThumbFromRenders(normalizedImagesWithThumbs) ?? hero;
    const description =
      (result.data && typeof result.data === 'object' && (result.data as { description?: string }).description) || null;
    const renderIdsJson = JSON.stringify(storedRenderEntries);
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
        heroThumb ?? PLACEHOLDER_THUMB,
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
              ...(characterReferences.length ? { characterReferenceCount: characterReferences.length } : {}),
              ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
              ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
              ...(outputFormat ? { output_format: outputFormat } : {}),
              ...(enableWebSearch ? { enable_web_search: true } : {}),
              ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
              ...(limitGenerations ? { limit_generations: true } : {}),
            },
            pricing: { totalCents: pricing.totalCents, currency: pricing.currency },
          }),
        ]
      );
    } catch (error) {
      console.warn('[images] failed to record fal queue log', error);
    }

    return {
      ok: true,
      jobId,
      mode,
      images: normalizedImagesWithThumbs,
      description,
      requestId: providerJobId ?? result.requestId ?? null,
      providerJobId: providerJobId ?? null,
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
      durationMs: undefined,
      pricing,
      paymentStatus: 'paid_wallet',
      thumbUrl: heroThumb,
      aspectRatio: resolvedAspectRatio,
      resolution,
    } satisfies ImageGenerationResponse;
  } catch (error) {
    console.error('[images] Fal generation failed', error);
    const providerStatus = error instanceof ApiError && typeof error.status === 'number' ? error.status : null;
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
             payment_status = 'refunded_wallet'
         WHERE job_id = $1`,
        [jobId, message, providerJobId ?? null]
      );
    } catch (updateError) {
      console.warn('[images] failed to update failed job', updateError);
    }

    try {
      const hosts = combinedImageUrls
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
              ...(characterReferences.length ? { characterReferenceCount: characterReferences.length } : {}),
              ...(resolvedAspectRatio ? { aspect_ratio: resolvedAspectRatio } : {}),
              ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
              ...(outputFormat ? { output_format: outputFormat } : {}),
              ...(enableWebSearch ? { enable_web_search: true } : {}),
              ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
              ...(limitGenerations ? { limit_generations: true } : {}),
              referenceImageCount: combinedImageUrls.length,
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

    fail(mode, 'fal_error', message, 502, { providerStatus, providerBody }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
      jobId,
      paymentStatus: 'refunded_wallet',
    });
  }
}
