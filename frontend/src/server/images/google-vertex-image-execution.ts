import { normalizeMediaUrl } from '@/lib/media';
import type { BillingProductKey, JobSurface } from '@/types/billing';
import type { EngineCaps, PricingSnapshot } from '@/types/engines';
import type { GeneratedImage, ImageGenerationMode, ImageGenerationResponse } from '@/types/image-generation';
import {
  createSignedDownloadUrl,
  extractStorageKeyFromUrl,
  isStorageConfigured,
  uploadImageToStorage,
} from '@/server/storage';
import { createImageThumbnailBatch } from '@/server/image-thumbnails';
import { uploadGoogleVertexGcsObject } from '@/server/video-providers/google-vertex-gcs';
import { GoogleVertexImageClient, isGoogleVertexImageConfigured } from './google-vertex-image-client';
import { GoogleVertexImageError } from './google-vertex-image-error';
import { buildGoogleVertexImagePayload, type GoogleVertexReferenceImage } from './google-vertex-image-payload';
import { extractGoogleVertexImages, parseGoogleVertexResponseId } from './google-vertex-image-response';
import { persistCompletedImageGeneration } from './image-generation-completion';
import { persistFailedImageGeneration } from './image-generation-failure';
import type { PendingReceipt } from './image-generation-receipts';
import { ImageGenerationExecutionError } from './image-generation-error';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;
const REFERENCE_FETCH_TIMEOUT_MS = 30_000;
const GOOGLE_VERTEX_IMAGE_PROVIDER_MODE = 'google_vertex_image_direct';
const MAX_INLINE_REFERENCE_BYTES = 7 * 1024 * 1024;

export function assertGoogleVertexImageAvailable(engine: EngineCaps): void {
  if (engine.providerMeta?.provider !== 'google_vertex_image') return;
  if (!engine.providerMeta.modelSlug || !isGoogleVertexImageConfigured()) {
    throw new ImageGenerationExecutionError('Google Vertex image generation is unavailable.', {
      code: 'google_vertex_image_unavailable',
      status: 503,
      extras: { engineId: engine.id, engineLabel: engine.label },
    });
  }
}

async function signReferenceUrl(url: string): Promise<string> {
  const key = extractStorageKeyFromUrl(url);
  if (!key || !isStorageConfigured()) return url;
  try {
    return await createSignedDownloadUrl(key, { expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS });
  } catch (error) {
    console.warn('[images] failed to sign Google Vertex reference image URL', error);
    return url;
  }
}

async function fetchReferenceImage(url: string, client: GoogleVertexImageClient): Promise<GoogleVertexReferenceImage> {
  const signedUrl = await signReferenceUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFERENCE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(signedUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new GoogleVertexImageError(`Google Vertex reference image fetch failed (${response.status}).`, {
        code: 'GOOGLE_GEMINI_REFERENCE_FETCH_FAILED',
        status: 400,
      });
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.length) {
      throw new GoogleVertexImageError('Google Vertex reference image is empty.', {
        code: 'GOOGLE_GEMINI_REFERENCE_EMPTY',
        status: 400,
      });
    }
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    if (data.length <= MAX_INLINE_REFERENCE_BYTES) return { data: data.toString('base64'), mimeType };
    const prefix = process.env.GOOGLE_VERTEX_INPUT_GCS_URI ?? process.env.GOOGLE_VERTEX_VEO_INPUT_GCS_URI;
    const fileUri = await uploadGoogleVertexGcsObject({
      prefix: prefix ?? '',
      data,
      mime: mimeType,
      extension: extensionFromMime(mimeType),
      accessToken: await client.accessToken(),
      objectNamespace: 'image-inputs',
    });
    return { fileUri, mimeType };
  } finally {
    clearTimeout(timer);
  }
}

function extensionFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

async function uploadInlineImages(params: {
  images: ReturnType<typeof extractGoogleVertexImages>;
  jobId: string;
  userId: string;
}): Promise<GeneratedImage[]> {
  if (!isStorageConfigured()) {
    throw new GoogleVertexImageError('Storage is required for Google Vertex inline image outputs.', {
      code: 'GOOGLE_GEMINI_IMAGE_STORAGE_MISSING',
      status: 503,
    });
  }

  return Promise.all(
    params.images.map(async (image, index) => {
      const upload = await uploadImageToStorage({
        data: image.data,
        mime: image.mimeType,
        userId: params.userId,
        prefix: 'renders/images',
        fileName: `${params.jobId}-${index + 1}.${extensionFromMime(image.mimeType)}`,
      });
      return {
        url: normalizeMediaUrl(upload.url) ?? upload.url,
        width: upload.width,
        height: upload.height,
        mimeType: upload.mime,
      };
    })
  );
}

export async function executeGoogleVertexImageGeneration(params: {
  billingProductKey: BillingProductKey | null;
  characterReferenceCount: number;
  combinedImageUrls: string[];
  costBreakdownJson: string | null;
  effectivePrompt: string;
  enableWebSearch: boolean;
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
}): Promise<ImageGenerationResponse> {
  const modelId = params.engine.providerMeta?.modelSlug ?? params.engine.id;
  let providerJobId: string | null = null;

  try {
    assertGoogleVertexImageAvailable(params.engine);
    const client = new GoogleVertexImageClient();

    const referenceImages =
      params.mode === 'i2i'
        ? await Promise.all(params.combinedImageUrls.map((url) => fetchReferenceImage(url, client)))
        : [];
    const requestedImages = Math.max(1, Math.round(params.numImages));
    const inlineImages = [];
    for (let index = 0; index < requestedImages; index += 1) {
      const providerResponse = await client.generateContent(modelId, buildGoogleVertexImagePayload({
        prompt: params.effectivePrompt,
        referenceImages,
        aspectRatio: params.resolvedAspectRatio,
        imageSize: params.resolution,
        enableWebSearch: params.enableWebSearch,
      }));
      providerJobId = providerJobId ?? parseGoogleVertexResponseId(providerResponse);
      inlineImages.push(...extractGoogleVertexImages(providerResponse));
    }

    if (!inlineImages.length) {
      throw new GoogleVertexImageError('Google Vertex did not return images.', {
        code: 'GOOGLE_VERTEX_IMAGE_EMPTY_RESPONSE',
        status: 502,
      });
    }

    const storedImages = await uploadInlineImages({
      images: inlineImages.slice(0, requestedImages),
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
      enableWebSearch: params.enableWebSearch,
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
      pricing: params.pricing,
      pricingSnapshotJson: params.pricingSnapshotJson,
      providerJobId,
      providerMode: GOOGLE_VERTEX_IMAGE_PROVIDER_MODE,
      quality: params.quality,
      resolvedAspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
      thinkingLevel: params.thinkingLevel,
      userId: params.userId,
      vendorAccountId: params.vendorAccountId,
      visibility: params.visibility,
    });

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
      pricing: params.pricing,
      paymentStatus: 'paid_wallet',
      thumbUrl: heroThumb,
      aspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
    } satisfies ImageGenerationResponse;
  } catch (error) {
    console.error('[images] Google Vertex image generation failed', error);
    const { message, providerBody, providerStatus } = await persistFailedImageGeneration({
      characterReferenceCount: params.characterReferenceCount,
      enableWebSearch: params.enableWebSearch,
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
      providerMode: GOOGLE_VERTEX_IMAGE_PROVIDER_MODE,
      quality: params.quality,
      referenceImageUrls: params.combinedImageUrls,
      refundDescription: params.refundDescription,
      resolvedAspectRatio: params.resolvedAspectRatio,
      resolution: params.resolution,
      thinkingLevel: params.thinkingLevel,
    });

    throw new ImageGenerationExecutionError(message, {
      mode: params.mode,
      code: 'google_vertex_image_error',
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
