import { ENV } from '@/lib/env';
import { normalizeMediaUrl } from '@/lib/media';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { ImageGenerationMode, ImageGenerationResponse } from '@/types/image-generation';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isStorageConfigured,
} from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { buildBytePlusSeedreamPayload } from './byteplus-seedream-payload';
import { callBytePlusSeedream } from './byteplus-seedream-client';
import {
  BYTEPLUS_SEEDREAM_DEFAULT_BASE_URL,
  BYTEPLUS_SEEDREAM_DEFAULT_MODEL_ID,
  BYTEPLUS_SEEDREAM_PROVIDER,
} from './byteplus-seedream-constants';
import { BytePlusSeedreamError } from './byteplus-seedream-error';
import {
  extractBytePlusSeedreamImages,
  parseBytePlusSeedreamRequestId,
} from './byteplus-seedream-response';
import { persistCompletedImageGeneration } from './image-generation-completion';
import { persistFailedImageGeneration } from './image-generation-failure';
import { recordRefundReceipt, type PendingReceipt } from './image-generation-receipts';
import { ImageGenerationExecutionError } from './image-generation-error';
import { copyGeneratedImagesToStorage } from './image-output-storage';
import { resolveBytePlusSeedreamOutputPricing } from './byteplus-seedream-pricing';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;
const BYTEPLUS_PROVIDER_MODE = BYTEPLUS_SEEDREAM_PROVIDER;

function resolveSeedreamModelId(engine: EngineCaps): string {
  const configuredModel = engine.providerMeta?.modelSlug?.trim();
  if (configuredModel?.includes('seedream-5-0-pro')) {
    return ENV.BYTEPLUS_ARK_SEEDREAM_PRO_MODEL_ID ?? configuredModel;
  }
  return ENV.BYTEPLUS_ARK_SEEDREAM_MODEL_ID ?? configuredModel ?? BYTEPLUS_SEEDREAM_DEFAULT_MODEL_ID;
}

async function signReferenceUrls(urls: string[]): Promise<string[]> {
  return Promise.all(
    urls.map(async (url) => {
      const key = extractStorageKeyFromUrl(url);
      if (!key || !isStorageConfigured()) return url;
      try {
        return await createSignedDownloadUrl(key, {
          expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS,
        });
      } catch (error) {
        console.warn('[images] failed to sign Seedream reference image URL', error);
        return url;
      }
    })
  );
}

export async function executeBytePlusSeedreamGeneration(params: {
  billingProductKey: BillingProductKey | null;
  characterReferenceCount: number;
  combinedImageUrls: string[];
  costBreakdownJson: string | null;
  effectivePrompt: string;
  engine: EngineCaps;
  engineEntry: {
    id: string;
    marketingName: string;
  };
  indexable: boolean;
  jobId: string;
  jobSurface: JobSurface;
  limitGenerations: boolean;
  maskUrl: string | null;
  mode: ImageGenerationMode;
  normalizedSeed: number | null;
  numImages: number;
  outputFormat: string | null;
  pendingReceipt: PendingReceipt;
  priceOnlyReceipts: boolean;
  pricing: PricingSnapshot;
  pricingSnapshotJson: string;
  quality: string | null;
  refundDescription: string;
  resolvedAspectRatio: string | null;
  resolution: string;
  thinkingLevel: string | null;
  userId: string;
  vendorAccountId: string | null;
  visibility: 'public' | 'private';
  watermark: boolean;
}): Promise<ImageGenerationResponse> {
  const apiKey = ENV.BYTEPLUS_ARK_API_KEY;
  const modelId = resolveSeedreamModelId(params.engine);
  let providerJobId: string | null = null;

  try {
    if (!apiKey) {
      throw new BytePlusSeedreamError('BytePlus Seedream API key is not configured.', {
        code: 'BYTEPLUS_SEEDREAM_API_KEY_MISSING',
        status: 503,
      });
    }

    const referenceUrls = params.mode === 'i2i' ? await signReferenceUrls(params.combinedImageUrls) : [];
    const providerResponse = await callBytePlusSeedream({
      baseUrl: ENV.BYTEPLUS_ARK_BASE_URL ?? BYTEPLUS_SEEDREAM_DEFAULT_BASE_URL,
      apiKey,
      payload: buildBytePlusSeedreamPayload({
        modelId,
        prompt: params.effectivePrompt,
        mode: params.mode,
        imageUrls: referenceUrls,
        numImages: params.numImages,
        outputFormat: params.outputFormat,
        size: params.resolution,
        aspectRatio: params.resolvedAspectRatio,
        responseFormat: 'url',
        watermark: params.watermark,
      }),
    });

    providerJobId = parseBytePlusSeedreamRequestId(providerResponse);
    const images = extractBytePlusSeedreamImages(providerResponse);
    if (!images.length) {
      throw new BytePlusSeedreamError('BytePlus Seedream did not return images.', {
        code: 'BYTEPLUS_SEEDREAM_EMPTY_RESPONSE',
        status: 502,
        detail: providerResponse,
      });
    }
    const outputPricing = resolveBytePlusSeedreamOutputPricing({
      generatedImages: images.length,
      priceOnlyReceipts: params.priceOnlyReceipts,
      pricing: params.pricing,
      requestedImages: params.numImages,
    });

    const normalizedImages = images.map((image) => ({
      ...image,
      url: normalizeMediaUrl(image.url) ?? image.url,
    }));
    const storedImages = await copyGeneratedImagesToStorage({
      images: normalizedImages,
      jobId: params.jobId,
      userId: params.userId,
    });
    const thumbUrls = await createImageThumbnailBatch({
      jobId: params.jobId,
      userId: params.userId,
      imageUrls: storedImages.map((image) => image.url),
    });
    const normalizedImagesWithThumbs = storedImages.map((image, index) => ({
      ...image,
      thumbUrl: thumbUrls[index] ?? null,
    }));

    const { heroThumb } = await persistCompletedImageGeneration({
      billingProductKey: params.billingProductKey,
      characterReferenceCount: params.characterReferenceCount,
      costBreakdownJson: params.costBreakdownJson,
      description: null,
      enableWebSearch: false,
      engineId: params.engine.id,
      engineLabel: params.engine.label,
      images: normalizedImagesWithThumbs,
      indexable: params.indexable,
      jobId: params.jobId,
      jobSurface: params.jobSurface,
      limitGenerations: params.limitGenerations,
      maskUrl: params.maskUrl,
      mode: params.mode,
      normalizedSeed: params.normalizedSeed,
      numImages: params.numImages,
      outputFormat: params.outputFormat,
      pricing: outputPricing.adjustedPricing,
      pricingSnapshotJson: outputPricing.adjustedPricingSnapshotJson,
      providerJobId,
      providerMode: BYTEPLUS_PROVIDER_MODE,
      quality: params.quality,
      resolvedAspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
      thinkingLevel: params.thinkingLevel,
      userId: params.userId,
      vendorAccountId: params.vendorAccountId,
      visibility: params.visibility,
    });
    if (outputPricing.partialRefundCents > 0) {
      const imageLabel = outputPricing.missingImages === 1 ? 'image' : 'images';
      await recordRefundReceipt(
        {
          ...params.pendingReceipt,
          amountCents: outputPricing.partialRefundCents,
          description: `Partial refund ${params.engine.label} - ${outputPricing.missingImages} ${imageLabel} not generated`,
          snapshot: {
            ...(typeof params.pendingReceipt.snapshot === 'object' && params.pendingReceipt.snapshot !== null
              ? params.pendingReceipt.snapshot
              : {}),
            adjustedTotalCents: outputPricing.adjustedPricing.totalCents,
            generatedImages: images.length,
            missingImages: outputPricing.missingImages,
            originalRequestedImages: params.numImages,
            originalTotalCents: params.pricing.totalCents,
            partialRefundCents: outputPricing.partialRefundCents,
          },
        },
        `Partial refund ${params.engine.label} - ${outputPricing.missingImages} ${imageLabel} not generated`,
        params.priceOnlyReceipts
      );
    }

    return {
      ok: true,
      jobId: params.jobId,
      mode: params.mode,
      images: normalizedImagesWithThumbs,
      description: null,
      requestId: providerJobId ?? undefined,
      providerJobId: providerJobId ?? undefined,
      engineId: params.engineEntry.id,
      engineLabel: params.engineEntry.marketingName,
      durationMs: undefined,
      pricing: outputPricing.adjustedPricing,
      paymentStatus: 'paid_wallet',
      thumbUrl: heroThumb,
      aspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
    } satisfies ImageGenerationResponse;
  } catch (error) {
    console.error('[images] BytePlus Seedream generation failed', error);
    const { message, providerBody, providerStatus } = await persistFailedImageGeneration({
      characterReferenceCount: params.characterReferenceCount,
      enableWebSearch: false,
      engineId: params.engine.id,
      error,
      falModelId: modelId,
      jobId: params.jobId,
      limitGenerations: params.limitGenerations,
      maskUrl: params.maskUrl,
      mode: params.mode,
      normalizedSeed: params.normalizedSeed,
      numImages: params.numImages,
      outputFormat: params.outputFormat,
      pendingReceipt: params.pendingReceipt,
      priceOnlyReceipts: params.priceOnlyReceipts,
      pricing: params.pricing,
      providerJobId,
      providerMode: BYTEPLUS_PROVIDER_MODE,
      quality: params.quality,
      referenceImageUrls: params.combinedImageUrls,
      refundDescription: params.refundDescription,
      resolvedAspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
      thinkingLevel: params.thinkingLevel,
    });

    throw new ImageGenerationExecutionError(message, {
      mode: params.mode,
      code: 'byteplus_seedream_error',
      status: 502,
      detail: { providerStatus, providerBody },
      extras: {
        engineId: params.engineEntry.id,
        engineLabel: params.engineEntry.marketingName,
        jobId: params.jobId,
        paymentStatus: 'refunded_wallet',
      },
    });
  }
}
