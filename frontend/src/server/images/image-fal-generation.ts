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
  style?: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
}): Record<string, unknown> {
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
    ...(params.style ? { style: params.style } : {}),
    ...(params.maskUrl ? { mask_url: params.maskUrl } : {}),
    ...(params.enableWebSearch ? { enable_web_search: true } : {}),
    ...(params.thinkingLevel ? { thinking_level: params.thinkingLevel } : {}),
    ...(params.limitGenerations ? { limit_generations: true } : {}),
  };
}

export async function runFalImageGeneration(params: {
  falModelId: string;
  effectivePrompt: string;
  numImages: number;
  mode: ImageGenerationMode;
  combinedImageUrls: string[];
  falAspectRatio: string | null;
  providerImageSize: string | GptImage2ImageSize | null;
  resolutionEngineParam: string | null | undefined;
  normalizedSeed: number | null;
  outputFormat: string | null;
  quality: string | null;
  style?: string | null;
  maskUrl: string | null;
  enableWebSearch: boolean;
  thinkingLevel: string | null;
  limitGenerations: boolean;
  onProviderJobId?: (providerJobId: string) => void;
}): Promise<{ result: { data?: unknown; requestId?: string | null }; providerJobId: string | null }> {
  let providerJobId: string | undefined;
  const shouldResolveReferenceUrls = params.mode === 'i2i' || isLumaUniTextToImageFalModel(params.falModelId);
  const resolvedReferenceUrls =
    shouldResolveReferenceUrls
      ? await Promise.all(
          params.combinedImageUrls.map(async (url) => {
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

  const result = await getFalClient().subscribe(params.falModelId, {
    input: buildFalImageGenerationInput({
      falModelId: params.falModelId,
      effectivePrompt: params.effectivePrompt,
      numImages: params.numImages,
      mode: params.mode,
      resolvedReferenceUrls,
      falAspectRatio: params.falAspectRatio,
      providerImageSize: params.providerImageSize,
      resolutionEngineParam: params.resolutionEngineParam,
      normalizedSeed: params.normalizedSeed,
      outputFormat: params.outputFormat,
      quality: params.quality,
      style: params.style,
      maskUrl: params.maskUrl,
      enableWebSearch: params.enableWebSearch,
      thinkingLevel: params.thinkingLevel,
      limitGenerations: params.limitGenerations,
    }),
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
