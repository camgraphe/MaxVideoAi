import {
  assertKlingImageV4OutputCount, assertKlingImageV4ReferenceCount,
  KLING_IMAGE_V4_ASPECT_RATIOS, KLING_IMAGE_V4_ENDPOINTS, KLING_IMAGE_V4_RESOLUTIONS,
} from '@/lib/image/kling-image-v4';
import { getFalClient } from '@/lib/fal-client';
import { createSignedDownloadUrl, extractStorageKeyFromUrl, isStorageConfigured } from '@/server/storage';
import type { GptImage2ImageSize } from '@/lib/image/gptImage2';
import type { ImageGenerationMode } from '@/types/image-generation';

const SIGNED_REFERENCE_URL_TTL_SECONDS = 60 * 60;

export function isLumaUniTextToImageFalModel(falModelId: string): boolean {
  return falModelId === 'luma/agent/uni-1/v1/text-to-image' || falModelId === 'luma/agent/uni-1/v1/max';
}

export function isLumaUniEditFalModel(falModelId: string): boolean {
  return falModelId === 'luma/agent/uni-1/v1/edit' || falModelId === 'luma/agent/uni-1/v1/max/edit';
}

export function buildFalImageGenerationInput(params: {
  falModelId: string;
  effectivePrompt: string;
  numImages: number;
  mode: ImageGenerationMode;
  resolvedReferenceUrls: string[];
  falAspectRatio: string | null;
  providerImageSize: string | GptImage2ImageSize | null;
  resolutionEngineParam: string | null | undefined;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  background?: string | null;
  style?: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
}): Record<string, unknown> {
  if (Object.values(KLING_IMAGE_V4_ENDPOINTS).some(endpoint => endpoint === params.falModelId)) {
    if (params.falModelId !== KLING_IMAGE_V4_ENDPOINTS[params.mode]) throw new Error('Kling Image endpoint does not match the requested mode.');
    assertKlingImageV4OutputCount(params.numImages);
    assertKlingImageV4ReferenceCount(params.mode, params.resolvedReferenceUrls.length);
    const resolution = KLING_IMAGE_V4_RESOLUTIONS.find(option => option === params.providerImageSize);
    if (!resolution) throw new Error('Unsupported Kling Image resolution.');
    const aspectRatio = KLING_IMAGE_V4_ASPECT_RATIOS.find(option => option === (params.falAspectRatio ?? 'auto'));
    if (!aspectRatio) throw new Error('Unsupported Kling Image aspect ratio.');
    return {
      prompt: params.effectivePrompt,
      resolution,
      aspect_ratio: aspectRatio,
      ...(params.numImages === 1
        ? { result_type: 'single', num_images: 1 }
        : { result_type: 'series', series_amount: params.numImages }),
      ...(params.mode === 'i2i' ? { image_urls: params.resolvedReferenceUrls } : {}),
    };
  }
  const isLumaUniT2I = params.mode === 't2i' && isLumaUniTextToImageFalModel(params.falModelId);
  const isLumaUniEdit = params.mode === 'i2i' && isLumaUniEditFalModel(params.falModelId);
  const [sourceImageUrl, ...editReferenceUrls] = params.resolvedReferenceUrls;

  return {
    prompt: params.effectivePrompt,
    num_images: params.numImages,
    ...(params.mode === 'i2i' && !isLumaUniEdit ? { image_urls: params.resolvedReferenceUrls } : {}),
    ...(isLumaUniT2I && params.resolvedReferenceUrls.length
      ? { reference_image_urls: params.resolvedReferenceUrls }
      : {}),
    ...(isLumaUniEdit && sourceImageUrl ? { image_url: sourceImageUrl } : {}),
    ...(isLumaUniEdit && editReferenceUrls.length ? { reference_image_urls: editReferenceUrls } : {}),
    ...(params.falAspectRatio ? { aspect_ratio: params.falAspectRatio } : {}),
    ...(params.providerImageSize && params.resolutionEngineParam === 'image_size'
      ? { image_size: params.providerImageSize }
      : {}),
    ...(params.providerImageSize && params.resolutionEngineParam !== 'image_size'
      ? { resolution: params.providerImageSize }
      : {}),
    ...(params.normalizedSeed != null ? { seed: params.normalizedSeed } : {}),
    ...(params.outputFormat ? { output_format: params.outputFormat } : {}),
    ...(params.quality ? { quality: params.quality } : {}),
    ...(params.background ? { background: params.background } : {}),
    ...(params.style ? { style: params.style } : {}),
    ...(params.maskUrl ? { mask_url: params.maskUrl } : {}),
    ...(params.enableWebSearch ? { enable_web_search: true } : {}),
    ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
    ...(params.limitGenerations ? { limit_generations: true } : {}),
  };
}

type FalImageGenerationInput = Omit<Parameters<typeof buildFalImageGenerationInput>[0], 'resolvedReferenceUrls'> & {
  combinedImageUrls: string[];
  onProviderJobId?: (providerJobId: string) => void;
};

export async function prepareFalImageInput(params: FalImageGenerationInput): Promise<Record<string, unknown>> {
  const requiresSignedReferences = params.falModelId === KLING_IMAGE_V4_ENDPOINTS.i2i;
  const shouldResolveReferenceUrls = params.mode === 'i2i' || isLumaUniTextToImageFalModel(params.falModelId);
  const resolvedReferenceUrls =
    shouldResolveReferenceUrls
      ? await Promise.all(
          params.combinedImageUrls.map(async (url) => {
            const key = extractStorageKeyFromUrl(url);
            if (!key || !isStorageConfigured()) {
              if (requiresSignedReferences) throw new Error('Kling Image references require owned image storage.');
              return url;
            }
            try {
              return await createSignedDownloadUrl(key, {
                expiresInSeconds: SIGNED_REFERENCE_URL_TTL_SECONDS,
              });
            } catch (signError) {
              if (requiresSignedReferences) throw signError;
              console.warn('[images] failed to sign reference image URL', signError);
              return url;
            }
          })
        )
      : [];

  return buildFalImageGenerationInput({ ...params, resolvedReferenceUrls });
}

export async function runFalImageGeneration(params: FalImageGenerationInput):
Promise<{ result: { data?: unknown; requestId?: string | null }; providerJobId: string | null }> {
  let providerJobId: string | undefined;
  const result = await getFalClient().subscribe(params.falModelId, {
    input: await prepareFalImageInput(params),
    mode: 'polling',
    onEnqueue(requestId) {
      providerJobId = requestId;
      params.onProviderJobId?.(requestId);
    },
    onQueueUpdate(update) {
      if (update?.request_id) {
        providerJobId = update.request_id;
        params.onProviderJobId?.(update.request_id);
      }
    },
  });

  return {
    result,
    providerJobId: providerJobId ?? result.requestId ?? null,
  };
}
