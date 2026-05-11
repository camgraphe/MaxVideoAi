import type { ImageGenerationMode } from '@/types/image-generation';
import { resolveSeedreamProviderSize } from '@/lib/image/seedream';
import { BytePlusSeedreamError } from './byteplus-seedream-error';

export type BytePlusSeedreamPayload = {
  model: string;
  prompt: string;
  size: string;
  output_format?: 'jpeg' | 'png';
  response_format: 'url';
  watermark: boolean;
  image?: string | string[];
};

function uniqueNonEmptyUrls(values: Array<string | null | undefined> | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

export function buildBytePlusSeedreamPayload(params: {
  modelId: string;
  prompt: string;
  mode: ImageGenerationMode;
  imageUrls?: string[];
  numImages: number;
  outputFormat?: string | null;
  size: string;
  aspectRatio?: string | null;
  responseFormat: 'url';
  watermark?: boolean | null;
}): BytePlusSeedreamPayload {
  const model = params.modelId.trim();
  const prompt = params.prompt.trim();
  const imageUrls = uniqueNonEmptyUrls(params.imageUrls);
  const image = imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : undefined;
  const outputFormat =
    params.outputFormat === 'png' || params.outputFormat === 'jpeg' ? params.outputFormat : undefined;

  if (!model) {
    throw new BytePlusSeedreamError('BytePlus Seedream model id is not configured.', {
      code: 'BYTEPLUS_SEEDREAM_MODEL_MISSING',
      status: 500,
    });
  }
  if (!prompt) {
    throw new BytePlusSeedreamError('Prompt is required for BytePlus Seedream.', {
      code: 'PROMPT_REQUIRED',
      status: 400,
    });
  }
  if (params.mode === 'i2i' && imageUrls.length === 0) {
    throw new BytePlusSeedreamError('At least one reference image is required for Seedream edit mode.', {
      code: 'REFERENCE_IMAGE_REQUIRED',
      status: 400,
    });
  }
  if (imageUrls.length > 14) {
    throw new BytePlusSeedreamError('Seedream supports up to 14 reference images.', {
      code: 'REFERENCE_IMAGE_LIMIT',
      status: 400,
      detail: { max: 14 },
    });
  }
  if (params.numImages > 1) {
    throw new BytePlusSeedreamError('Seedream standard image requests support one image per request.', {
      code: 'IMAGE_COUNT_LIMIT',
      status: 400,
      detail: { max: 1 },
    });
  }

  return {
    model,
    prompt,
    size: resolveSeedreamProviderSize(params.size, params.aspectRatio),
    ...(outputFormat ? { output_format: outputFormat } : {}),
    response_format: params.responseFormat,
    watermark: params.watermark === true,
    ...(image ? { image } : {}),
  };
}
