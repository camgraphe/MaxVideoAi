import { randomUUID } from 'crypto';
import type { ImageGenerationMode, ImageGenerationRequest, ImageGenerationResponse } from '@/types/image-generation';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { computePricingSnapshot, getPlatformFeeCents } from '@/lib/pricing';
import type { PricingSnapshot } from '@/types/engines';
import { receiptsPriceOnlyEnabled } from '@/lib/env';
import { ensureUserPreferredCurrency, getUserPreferredCurrency, type Currency } from '@/lib/currency';
import { normalizeMediaUrl } from '@/lib/media';
import { getResultProviderMode } from '@/lib/result-provider';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import {
  canonicalizeImageFieldValue,
  getImageFieldDefaultBoolean,
  getImageFieldValues,
  getImageInputField,
  normalizeFalImageResolution,
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
import { STORYBOARD_INCLUDED_PAYMENT_STATUS, getStoryboardBillingIdentity } from '@/lib/storyboard-pricing';
import { isLumaAgentsImageEngineId } from '@/lib/luma-agents';
import { buildResponseFromExistingJob } from './existing-image-job-response';
import { ImageGenerationExecutionError } from './image-generation-error';
import { createAtomicInitialImageJob } from './image-initial-job';
import { persistCompletedImageGeneration } from './image-generation-completion';
import { persistFailedImageGeneration } from './image-generation-failure';
import { extractImages, parseRequestId } from './image-provider-payload';
import { buildReceiptSnapshot, type PendingReceipt } from './image-generation-receipts';
import { buildDefaultSettingsSnapshot } from './image-generation-settings-snapshot';
import { resolveImageGenerationRequestContext } from './image-generation-request-context';
import { prepareImageGenerationReferences } from './image-generation-references';
import { copyGeneratedImagesToStorage } from './image-output-storage';
import { executeBytePlusSeedreamGeneration } from './byteplus-seedream-execution';
import { normalizeImageGenerationMetadata, normalizeOptionalBoolean } from './image-generation-normalization';
import {
  executeImageProviderWithLumaAgentsDirectFallback,
  lumaAgentsImageDirectEnabled,
} from './luma-agents-execution';
import {
  applyStoryboardImagePricing,
  resolveIncludedKlingFirstFrameParentJobId,
} from './storyboard-image-billing';

export { buildResponseFromExistingJob } from './existing-image-job-response';
export { ImageGenerationExecutionError } from './image-generation-error';

const DISPLAY_CURRENCY = 'USD';
const DISPLAY_CURRENCY_LOWER: Currency = 'usd';

type ExecuteImageGenerationOptions = {
  userId: string;
  body: Partial<ImageGenerationRequest>;
  settingsSnapshot?: unknown;
  jobSurface?: JobSurface;
  billingProductKey?: BillingProductKey | null;
  billingQuantityMultiplier?: number;
  isAdminForDirectProvider?: boolean;
};

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
  isAdminForDirectProvider = false,
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

  const { engineEntry, engine, mode, modeConfig, resolvedAspectRatio, prompt, numImages, durationSec } =
    resolveImageGenerationRequestContext(body);

  const { characterReferences, normalizedImageUrls, combinedImageUrls, effectivePrompt, storedAssetInfoByUrl } =
    await prepareImageGenerationReferences({ userId, body, engineEntry, mode, prompt });

  const requestId = typeof body.jobId === 'string' && body.jobId.trim().length ? body.jobId.trim() : null;
  const jobId = requestId ?? `img_${randomUUID()}`;
  const requestMetadata = normalizeImageGenerationMetadata(body.metadata);
  const engineResponseExtras = { engineId: engineEntry.id, engineLabel: engineEntry.marketingName };

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
      engineResponseExtras
    );
  }
  const resolution = resolutionResult.resolution;
  const shouldSendResolution = resolutionResult.configurable;
  const parsedResolutionImageSize = engine.id === 'gpt-image-2' ? parseGptImage2SizeKey(resolution) : null;
  let customImageSize: GptImage2ImageSize | null = parsedResolutionImageSize;
  let providerImageSize: string | GptImage2ImageSize | null =
    parsedResolutionImageSize ?? (shouldSendResolution ? normalizeFalImageResolution(resolution) : null);
  if (engine.id === 'gpt-image-2' && mode === 'i2i' && resolution === 'auto') {
    const storedReferenceSizes = combinedImageUrls
      .map((url) => storedAssetInfoByUrl.get(url))
      .filter((size) => typeof size?.width === 'number' && typeof size.height === 'number');
    const clientReferenceImageSizes = Array.isArray(body.referenceImageSizes) ? body.referenceImageSizes : [];
    customImageSize = resolveGptImage2AutoInputImageSize(
      storedReferenceSizes.length ? storedReferenceSizes : clientReferenceImageSizes
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
        engineResponseExtras
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
      engineResponseExtras
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
      engineResponseExtras
    );
  }

  const styleValues = getImageFieldValues(engine, 'style', mode);
  const style =
    typeof body.style === 'string'
      ? canonicalizeImageFieldValue(styleValues, body.style)
      : null;
  if (typeof body.style === 'string' && body.style.trim().length && !style) {
    fail(
      mode,
      'style_invalid',
      'Selected style is not available for this engine.',
      400,
      { allowed: styleValues },
      engineResponseExtras
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
      engineResponseExtras
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
      engineResponseExtras
    );
  }

  const enableWebSearch =
    Boolean(getImageInputField(engine, 'enable_web_search', mode)) &&
    normalizeOptionalBoolean(body.enableWebSearch) === true;
  const limitGenerations =
    Boolean(getImageInputField(engine, 'limit_generations', mode)) &&
    normalizeOptionalBoolean(body.limitGenerations) === true;
  const watermarkField = getImageInputField(engine, 'watermark', mode);
  const watermark =
    Boolean(watermarkField) &&
    (normalizeOptionalBoolean(body.watermark) ?? getImageFieldDefaultBoolean(engine, 'watermark', mode) ?? false);
  const includedKlingFirstFrameParentJobId = await resolveIncludedKlingFirstFrameParentJobId({
    userId,
    jobId,
    mode,
    engineId: engine.id,
    jobSurface,
    source: body.source,
    metadata: requestMetadata,
  });

  let pricing: PricingSnapshot;
  const membershipTier = typeof body.membershipTier === 'string' && body.membershipTier.trim().length
    ? body.membershipTier.trim()
    : undefined;
  const lumaAgentsReferenceImageCount = isLumaAgentsImageEngineId(engine.id)
    ? mode === 'i2i'
      ? Math.max(0, combinedImageUrls.length - 1)
      : combinedImageUrls.length
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
          mode,
          customImageSize,
          quality,
          referenceImageCount: lumaAgentsReferenceImageCount,
          membershipTier,
          currency: DISPLAY_CURRENCY,
          addons: enableWebSearch ? { enable_web_search: true } : undefined,
        });
    pricing = await applyStoryboardImagePricing({
      pricing,
      engine,
      jobSurface,
      source: body.source,
      metadata: requestMetadata,
      includedKlingFirstFrameParentJobId,
      customImageSize,
      resolution,
      quality,
      resolvedAspectRatio,
      membershipTier,
      currency: DISPLAY_CURRENCY,
    });
  } catch (error) {
    console.error('[images] failed to compute pricing snapshot', error);
    fail(mode, 'pricing_error', 'Unable to compute pricing.', 500, null, engineResponseExtras);
  }

  const jobAspectRatio = resolvedAspectRatio ?? null;
  const falAspectRatio = resolvedAspectRatio && resolvedAspectRatio !== 'auto' ? resolvedAspectRatio : null;
  const resolutionField = getImageInputField(engine, 'resolution', mode);
  const resolutionEngineParam = resolutionField?.engineParam;
  const storyboardBillingIdentity =
    jobSurface === 'storyboard' && engine.id === 'gpt-image-2' ? getStoryboardBillingIdentity(body.source) : null;
  const billingEngineId = storyboardBillingIdentity?.engineId ?? engine.id;
  const billingEngineLabel = storyboardBillingIdentity?.engineLabel ?? engine.label;

  pricing.meta = {
    ...(pricing.meta ?? {}),
    surface: jobSurface,
    billingProductKey,
    engineId: billingEngineId,
    engineLabel: billingEngineLabel,
    ...(storyboardBillingIdentity ? { billingProductLabel: storyboardBillingIdentity.productLabel } : {}),
    request: {
      engineId: billingEngineId,
      engineLabel: billingEngineLabel,
      mode,
      numImages,
      resolution,
      ...(customImageSize ? { customImageSize } : {}),
      ...(characterReferences.length ? { characterReferenceCount: characterReferences.length } : {}),
      ...(resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : {}),
      ...(normalizedSeed != null ? { seed: normalizedSeed } : {}),
      ...(outputFormat ? { outputFormat } : {}),
      ...(quality ? { quality } : {}),
      ...(style ? { style } : {}),
      ...(maskUrl ? { maskUrl } : {}),
      ...(enableWebSearch ? { enableWebSearch } : {}),
      ...(thinkingLevel ? { thinkingLevel } : {}),
      ...(limitGenerations ? { limitGenerations } : {}),
      ...(watermark ? { watermark } : {}),
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
  const walletChargeMode = includedKlingFirstFrameParentJobId ? 'included' : 'charge';
  const imagePaymentStatus =
    walletChargeMode === 'included' ? STORYBOARD_INCLUDED_PAYMENT_STATUS : 'paid_wallet';
  const failedPaymentStatus =
    walletChargeMode === 'included' ? STORYBOARD_INCLUDED_PAYMENT_STATUS : 'refunded_wallet';

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
        style,
        maskUrl,
        enableWebSearch,
        thinkingLevel,
        limitGenerations,
        watermark,
        imageUrls: normalizedImageUrls,
        characterReferences,
        metadata: requestMetadata,
        membershipTier,
        visibility,
        indexable,
      })
  );

  const billingProductLabel =
    storyboardBillingIdentity?.productLabel ??
    (pricing.meta && typeof pricing.meta.billingProductLabel === 'string' ? pricing.meta.billingProductLabel : null);
  const description = billingProductLabel
    ? `${billingProductLabel} - ${numImages} image${numImages > 1 ? 's' : ''}`
    : `${billingEngineLabel} - ${numImages} image${numImages > 1 ? 's' : ''}`;
  const refundDescription = billingProductLabel
    ? `Refund ${billingProductLabel} - ${numImages} image${numImages > 1 ? 's' : ''}`
    : `Refund ${billingEngineLabel} - ${numImages} images`;
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
  let shouldEnsurePreferredCurrency = !preferredCurrency && walletChargeMode === 'charge';
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
      engineId: billingEngineId,
      engineLabel: billingEngineLabel,
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
      walletChargeMode,
      includedPaymentStatus: STORYBOARD_INCLUDED_PAYMENT_STATUS,
    });

    if (initialJobState.kind === 'existing_job') {
      return buildResponseFromExistingJob({
        job: initialJobState.job,
        mode,
        engineId: billingEngineId,
        engineLabel: billingEngineLabel,
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

  let providerMode: string = getResultProviderMode();
  let providerJobId: string | undefined;

  if (engine.id === 'seedream' && engine.providerMeta?.provider === 'byteplus_modelark') {
    return executeBytePlusSeedreamGeneration({
      billingProductKey,
      characterReferenceCount: characterReferences.length,
      combinedImageUrls,
      costBreakdownJson,
      effectivePrompt,
      engine,
      engineEntry,
      indexable,
      jobId,
      jobSurface,
      limitGenerations,
      maskUrl,
      mode,
      normalizedSeed,
      numImages,
      outputFormat,
      pendingReceipt,
      priceOnlyReceipts,
      pricing,
      pricingSnapshotJson,
      quality,
      refundDescription,
      resolvedAspectRatio,
      resolution,
      thinkingLevel,
      userId,
      vendorAccountId,
      visibility,
      watermark,
    });
  }

  try {
    const { result, providerJobId: completedProviderJobId, providerMode: completedProviderMode } =
      await executeImageProviderWithLumaAgentsDirectFallback({
        falModelId: modeConfig.falModelId, effectivePrompt, numImages, mode, combinedImageUrls, falAspectRatio,
        providerImageSize, resolutionEngineParam, normalizedSeed, outputFormat, quality, maskUrl, enableWebSearch,
        thinkingLevel, limitGenerations, style, engine, engineEntry, jobId, userId, requestId: jobId,
        useLumaDirect:
          isLumaAgentsImageEngineId(engine.id) &&
          lumaAgentsImageDirectEnabled({ isAdmin: isAdminForDirectProvider }),
        onProviderJobId(requestId) { providerJobId = requestId; },
        onProviderMode(nextProviderMode) { providerMode = nextProviderMode; },
      });
    providerMode = completedProviderMode;
    providerJobId = completedProviderJobId ?? providerJobId;

    const images = extractImages(result.data);
    if (!images.length) {
      throw new Error('Fal did not return images');
    }

    const normalizedImages = images.map((image) => ({
      ...image,
      url: normalizeMediaUrl(image.url) ?? image.url,
    }));
    const stableImages =
      jobSurface === 'storyboard'
        ? await copyGeneratedImagesToStorage({
            images: normalizedImages,
            jobId,
            userId,
          })
        : normalizedImages;

    const thumbUrls = await createImageThumbnailBatch({
      jobId,
      userId,
      imageUrls: stableImages.map((image) => image.url),
    });
    const normalizedImagesWithThumbs = stableImages.map((image, index) => ({
      ...image,
      thumbUrl: thumbUrls[index] ?? null,
    }));
    const resultDescription =
      result.data && typeof result.data === 'object' ? (result.data as { description?: unknown }).description : null;
    const description = typeof resultDescription === 'string' ? resultDescription : null;
    const providerRequestId = providerJobId ?? parseRequestId(result.data) ?? result.requestId ?? null;
    providerJobId = providerRequestId ?? undefined;

    const { heroThumb } = await persistCompletedImageGeneration({
      billingProductKey,
      characterReferenceCount: characterReferences.length,
      costBreakdownJson,
      description,
      enableWebSearch,
      engineId: engine.id,
      engineLabel: engine.label,
      images: normalizedImagesWithThumbs,
      indexable,
      jobId,
      jobSurface,
      limitGenerations,
      maskUrl,
      mode,
      normalizedSeed,
      numImages,
      outputFormat,
      pricing,
      pricingSnapshotJson,
      paymentStatus: imagePaymentStatus,
      providerJobId: providerJobId ?? null,
      providerMode,
      quality,
      resolvedAspectRatio,
      resolution,
      style,
      thinkingLevel,
      userId,
      vendorAccountId,
      visibility,
    });

    return {
      ok: true,
      jobId,
      mode,
      images: normalizedImagesWithThumbs,
      description,
      requestId: providerJobId ?? result.requestId ?? undefined,
      providerJobId: providerJobId ?? undefined,
      engineId: billingEngineId,
      engineLabel: billingEngineLabel,
      durationMs: undefined,
      pricing,
      paymentStatus: imagePaymentStatus,
      thumbUrl: heroThumb,
      aspectRatio: resolvedAspectRatio,
      resolution,
    } satisfies ImageGenerationResponse;
  } catch (error) {
    console.error('[images] Fal generation failed', error);
    const { message, providerBody, providerStatus } = await persistFailedImageGeneration({
      characterReferenceCount: characterReferences.length,
      enableWebSearch,
      engineId: engine.id,
      error,
      falModelId: modeConfig.falModelId,
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
      refundOnFailure: walletChargeMode === 'charge',
      failedPaymentStatus,
      providerJobId: providerJobId ?? null,
      providerMode,
      quality,
      referenceImageUrls: combinedImageUrls,
      refundDescription,
      resolvedAspectRatio,
      resolution,
      style,
      thinkingLevel,
    });

    fail(mode, 'fal_error', message, 502, { providerStatus, providerBody }, {
      engineId: billingEngineId,
      engineLabel: billingEngineLabel,
      jobId,
      paymentStatus: failedPaymentStatus,
    });
  }
}
