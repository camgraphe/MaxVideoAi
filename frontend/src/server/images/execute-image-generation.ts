import { ApiError, ValidationError } from '@fal-ai/client';
import { randomUUID } from 'crypto';
import { listFalEngines } from '@/config/falEngines';
import type {
  CharacterReferenceSelection,
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/image-generation';
import { getFalClient } from '@/lib/fal-client';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import type { PricingSnapshot } from '@/types/engines';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureUserPreferredCurrency, getUserPreferredCurrency, type Currency } from '@/lib/currency';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isStorageConfigured,
  recordUserAsset,
} from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { buildStoredImageRenderEntries, resolveHeroThumbFromRenders } from '@/lib/image-renders';
import { ensureReusableAsset, upsertLegacyJobOutputs } from '@/server/media-library';
import {
  formatSupportedImageFormatsLabel,
  getSupportedImageFormats,
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
import {
  parseGptImage2SizeKey,
  resolveGptImage2AutoInputImageSize,
  validateGptImage2CustomImageSize,
  type GptImage2ImageSize,
} from '@/lib/image/gptImage2';
import { computeBillingProductSnapshot } from '@/lib/billing-products';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import { buildResponseFromExistingJob } from './existing-image-job-response';
import {
  getStoredAssetInfoByUrl,
  isReferenceImageSupported,
  normalizeReferenceImageForEngine,
  type StoredAssetInfo,
} from './image-reference-normalization';
import { ImageGenerationExecutionError } from './image-generation-error';
import { createAtomicInitialImageJob, PLACEHOLDER_THUMB } from './image-initial-job';
import {
  buildCharacterReferencePrompt,
  extractImages,
  parseRequestId,
  sanitizeCharacterReferences,
} from './image-provider-payload';

export { buildResponseFromExistingJob } from './existing-image-job-response';
export { ImageGenerationExecutionError } from './image-generation-error';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER: Currency = 'usd';
const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;
type PendingReceipt = {
  userId: string;
  amountCents: number;
  currency: string;
  description: string;
  jobId: string;
  surface: JobSurface;
  billingProductKey: BillingProductKey | null;
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
  jobSurface?: JobSurface;
  billingProductKey?: BillingProductKey | null;
  billingQuantityMultiplier?: number;
};

type ImageEngineEntry = (typeof IMAGE_ENGINE_REGISTRY)[number];

const IMAGE_ENGINE_REGISTRY = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'image');
const IMAGE_ENGINE_MAP = new Map(IMAGE_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
const DEFAULT_IMAGE_ENGINE_ID = IMAGE_ENGINE_REGISTRY[0]?.id ?? null;

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
         surface,
         billing_product_key,
         pricing_snapshot,
         application_fee_cents,
         vendor_account_id,
         stripe_payment_intent_id,
         stripe_charge_id,
         platform_revenue_cents,
         destination_acct
       )
       VALUES ($1,'refund',$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14)
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
  surface: JobSurface;
  engineEntry: ImageEngineEntry;
  mode: ImageGenerationMode;
  prompt: string;
  numImages: number;
  resolvedAspectRatio: string | null;
  resolution: string;
  customImageSize: GptImage2ImageSize | null;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  maskUrl: string | null;
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
    surface: args.surface,
    engineId: args.engineEntry.id,
    engineLabel: args.engineEntry.marketingName,
    inputMode: args.mode,
    prompt: args.prompt,
    core: {
      numImages: args.numImages,
      aspectRatio: args.resolvedAspectRatio ?? null,
      resolution: args.resolution,
      customImageSize: args.customImageSize,
      seed: args.normalizedSeed,
      outputFormat: args.outputFormat,
      quality: args.quality,
      maskUrl: args.maskUrl,
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
  jobSurface = 'image',
  billingProductKey = null,
  billingQuantityMultiplier = 1,
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
  let characterReferences = sanitizeCharacterReferences(body.characterReferences);
  const characterReferenceUrls = characterReferences.map((entry) => entry.imageUrl);
  let normalizedImageUrls = imageUrls.filter((url) => !characterReferenceUrls.includes(url));
  let combinedImageUrls = [...characterReferenceUrls, ...normalizedImageUrls];
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
  let storedAssetInfoByUrl = new Map<string, StoredAssetInfo>();
  if (supportedReferenceFormats.length && combinedImageUrls.length) {
    storedAssetInfoByUrl = await getStoredAssetInfoByUrl(userId, combinedImageUrls);
    const normalizedReferenceByUrl = new Map<string, { url: string; mime: string }>();

    for (const referenceUrl of [...new Set(combinedImageUrls)]) {
      if (isReferenceImageSupported(supportedReferenceFormats, referenceUrl, storedAssetInfoByUrl)) {
        continue;
      }

      try {
        const normalizedReference = await normalizeReferenceImageForEngine({
          userId,
          url: referenceUrl,
          supportedFormats: supportedReferenceFormats,
          engineId: engine.id,
        });
        normalizedReferenceByUrl.set(referenceUrl, normalizedReference);
        storedAssetInfoByUrl.set(normalizedReference.url, { mime: normalizedReference.mime });
      } catch (error) {
        const reason = error instanceof Error && error.message ? error.message : 'Unable to normalize reference image.';
        console.warn('[images] failed to normalize reference image for engine', {
          engineId: engine.id,
          url: referenceUrl,
          reason,
        });
        fail(
          mode,
          'image_normalization_failed',
          'Reference image could not be converted to a format supported by this engine.',
          422,
          { allowed: supportedReferenceFormats, url: referenceUrl, reason },
          {
            engineId: engineEntry.id,
            engineLabel: engineEntry.marketingName,
          }
        );
      }
    }

    if (normalizedReferenceByUrl.size) {
      characterReferences = characterReferences.map((entry) => ({
        ...entry,
        imageUrl: normalizedReferenceByUrl.get(entry.imageUrl)?.url ?? entry.imageUrl,
      }));
      normalizedImageUrls = normalizedImageUrls.map(
        (entry) => normalizedReferenceByUrl.get(entry)?.url ?? entry
      );
      const currentCharacterReferenceUrls = new Set(characterReferences.map((entry) => entry.imageUrl));
      combinedImageUrls = [
        ...characterReferences.map((entry) => entry.imageUrl),
        ...normalizedImageUrls.filter((url) => !currentCharacterReferenceUrls.has(url)),
      ];
    }

    const invalidImageFormatUrl = combinedImageUrls.find(
      (entry) => !isReferenceImageSupported(supportedReferenceFormats, entry, storedAssetInfoByUrl)
    );
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
  const parsedResolutionImageSize = engine.id === 'gpt-image-2' ? parseGptImage2SizeKey(resolution) : null;
  let customImageSize: GptImage2ImageSize | null = parsedResolutionImageSize;
  let providerImageSize: string | GptImage2ImageSize | null =
    parsedResolutionImageSize ?? (shouldSendResolution ? normalizeFalImageResolution(resolution) : null);
  if (engine.id === 'gpt-image-2' && mode === 'i2i' && resolution === 'auto') {
    customImageSize = resolveGptImage2AutoInputImageSize(
      combinedImageUrls.map((url) => storedAssetInfoByUrl.get(url))
    );
  }

  if (engine.id === 'gpt-image-2' && resolution === 'custom') {
    const customSizeResult = validateGptImage2CustomImageSize(body.customImageSize);
    if (!customSizeResult.ok) {
      fail(
        mode,
        'image_size_invalid',
        customSizeResult.message,
        400,
        customSizeResult.detail,
        {
          engineId: engineEntry.id,
          engineLabel: engineEntry.marketingName,
        }
      );
    }
    customImageSize = customSizeResult.size;
    providerImageSize = customSizeResult.size;
  }

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

  const qualityValues = getImageFieldValues(engine, 'quality', mode);
  const quality =
    typeof body.quality === 'string'
      ? canonicalizeImageFieldValue(qualityValues, body.quality)
      : null;
  if (typeof body.quality === 'string' && body.quality.trim().length && !quality) {
    fail(
      mode,
      'quality_invalid',
      'Selected quality is not available for this engine.',
      400,
      { allowed: qualityValues },
      {
        engineId: engineEntry.id,
        engineLabel: engineEntry.marketingName,
      }
    );
  }

  const maskUrlField = getImageInputField(engine, 'mask_url', mode);
  const maskUrl =
    maskUrlField && typeof body.maskUrl === 'string' && body.maskUrl.trim().length ? body.maskUrl.trim() : null;
  if (maskUrl && !/^https?:\/\//i.test(maskUrl)) {
    fail(
      mode,
      'invalid_mask_url',
      'Mask URL must be an absolute URL (https://...).',
      400,
      { url: maskUrl },
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
    pricing = billingProductKey
      ? await computeBillingProductSnapshot({
          productKey: billingProductKey,
          quantity: numImages * Math.max(1, Math.round(billingQuantityMultiplier)),
          membershipTier,
          engineId: engine.id,
        })
      : await computePricingSnapshot({
          engine,
          durationSec,
          resolution,
          customImageSize,
          quality,
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
  const resolutionField = getImageInputField(engine, 'resolution', mode);
  const resolutionEngineParam = resolutionField?.engineParam;

  pricing.meta = {
    ...(pricing.meta ?? {}),
    surface: jobSurface,
    billingProductKey,
    engineId: engine.id,
    request: {
      engineId: engine.id,
      engineLabel: engine.label,
      mode,
      numImages,
      resolution,
      ...(customImageSize ? { customImageSize } : {}),
      ...(characterReferences.length ? { characterReferenceCount: characterReferences.length } : {}),
      ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
      ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
      ...(outputFormat ? { outputFormat } : {}),
      ...(quality ? { quality } : {}),
      ...(maskUrl ? { maskUrl } : {}),
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

  const visibility: 'public' | 'private' = 'private';
  const indexable = false;

  const settingsSnapshotJson = JSON.stringify(
    settingsSnapshot ??
      buildDefaultSettingsSnapshot({
        surface: jobSurface,
        engineEntry,
        mode,
        prompt,
        numImages,
        resolvedAspectRatio,
        resolution,
        customImageSize,
        normalizedSeed,
        outputFormat,
        quality,
        maskUrl,
        enableWebSearch,
        thinkingLevel,
        limitGenerations,
        imageUrls: normalizedImageUrls,
        characterReferences,
        membershipTier,
        visibility,
        indexable,
      })
  );

  const billingProductLabel =
    pricing.meta && typeof pricing.meta.billingProductLabel === 'string' ? pricing.meta.billingProductLabel : null;
  const description = billingProductLabel
    ? `${billingProductLabel} - ${numImages} image${numImages > 1 ? 's' : ''}`
    : `${engineEntry.marketingName} - ${numImages} image${numImages > 1 ? 's' : ''}`;
  const refundDescription = billingProductLabel
    ? `Refund ${billingProductLabel} - ${numImages} image${numImages > 1 ? 's' : ''}`
    : `Refund ${engine.label} - ${numImages} images`;
  const pendingReceipt: PendingReceipt = {
    userId,
    amountCents: pricing.totalCents,
    currency: DISPLAY_CURRENCY,
    description,
    jobId,
    surface: jobSurface,
    billingProductKey,
    snapshot: receiptSnapshot,
    applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
    vendorAccountId,
    stripePaymentIntentId: null,
    stripeChargeId: null,
  };
  const preferredCurrency = await getUserPreferredCurrency(userId);
  let shouldEnsurePreferredCurrency = !preferredCurrency;
  try {
    const initialJobState = await createAtomicInitialImageJob({
      userId,
      mode,
      jobId,
      surface: jobSurface,
      billingProductKey,
      description,
      amountCents: pricing.totalCents,
      currency: DISPLAY_CURRENCY,
      pricingSnapshotJson,
      applicationFeeCents: priceOnlyReceipts ? null : applicationFeeCents,
      vendorAccountId,
      engineId: engine.id,
      engineLabel: engine.label,
      durationSec,
      prompt,
      aspectRatio: jobAspectRatio,
      canUpscale: Boolean(engine.upscale4k),
      finalPriceCents: pricing.totalCents,
      costBreakdownJson,
      settingsSnapshotJson,
      visibility,
      indexable,
      preferredCurrency,
    });

    if (initialJobState.kind === 'existing_job') {
      return buildResponseFromExistingJob({
        job: initialJobState.job,
        mode,
        engineId: engine.id,
        engineLabel: engine.label,
        pricing,
        resolvedAspectRatio,
        resolution,
      });
    }

    if (shouldEnsurePreferredCurrency) {
      await ensureUserPreferredCurrency(userId, DISPLAY_CURRENCY_LOWER).catch((error) => {
        console.warn('[images] unable to ensure preferred currency', error);
      });
      shouldEnsurePreferredCurrency = false;
    }
  } catch (error) {
    if (error instanceof ImageGenerationExecutionError) {
      throw error;
    }
    console.error('[images] failed to create provisional image job', error);
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
        ...(providerImageSize && resolutionEngineParam === 'image_size' ? { image_size: providerImageSize } : {}),
        ...(providerImageSize && resolutionEngineParam !== 'image_size' ? { resolution: providerImageSize } : {}),
        ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
        ...(outputFormat ? { output_format: outputFormat } : {}),
        ...(quality ? { quality } : {}),
        ...(maskUrl ? { mask_url: maskUrl } : {}),
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

    if (jobSurface === 'character') {
      await Promise.all(
        normalizedImagesWithThumbs.map(async (image, index) => {
          try {
            await recordUserAsset({
              assetId: `${jobId}:character:${index + 1}`,
              userId,
              url: image.url,
              mime: image.mimeType ?? 'image/png',
              width: image.width ?? null,
              height: image.height ?? null,
              size: null,
              source: 'character',
              metadata: {
                jobId,
                thumbUrl: image.thumbUrl ?? null,
                engineId: engine.id,
                engineLabel: engine.label,
                surface: jobSurface,
                billingProductKey,
                resultIndex: index,
              },
            });
          } catch (assetError) {
            console.warn('[images] failed to persist character asset', { jobId, index }, assetError);
          }
        })
      );
    }

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

    await upsertLegacyJobOutputs({
      job_id: jobId,
      user_id: userId,
      surface: jobSurface,
      video_url: null,
      audio_url: null,
      thumb_url: heroThumb ?? PLACEHOLDER_THUMB,
      preview_frame: heroThumb ?? PLACEHOLDER_THUMB,
      render_ids: storedRenderEntries,
      duration_sec: 1,
      status: 'completed',
    }).catch((outputError) => {
      console.warn('[images] failed to persist job outputs', { jobId }, outputError);
    });

    if (jobSurface === 'character') {
      await Promise.allSettled(
        normalizedImagesWithThumbs.map((image, index) =>
          ensureReusableAsset({
            userId,
            url: image.url,
            kind: 'image',
            source: 'character',
            sourceJobId: jobId,
            sourceOutputId: `${jobId}:image:${index}`,
            mimeType: image.mimeType ?? 'image/png',
            width: image.width ?? null,
            height: image.height ?? null,
            thumbUrl: image.thumbUrl ?? null,
          })
        )
      );
    }

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
              ...(quality ? { quality } : {}),
              ...(maskUrl ? { mask_url: maskUrl } : {}),
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
              ...(quality ? { quality } : {}),
              ...(maskUrl ? { mask_url: maskUrl } : {}),
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

    await recordRefundReceipt(pendingReceipt, refundDescription, priceOnlyReceipts);

    fail(mode, 'fal_error', message, 502, { providerStatus, providerBody }, {
      engineId: engineEntry.id,
      engineLabel: engineEntry.marketingName,
      jobId,
      paymentStatus: 'refunded_wallet',
    });
  }
}
