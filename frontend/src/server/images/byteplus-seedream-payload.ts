import type { ImageGenerationMode } from '@/types/image-generation';
import {
  resolveSeedreamProviderSize,
  SEEDREAM_MAX_IMAGE_SET_IMAGES,
  SEEDREAM_MAX_REFERENCE_IMAGES,
  isSeedreamSingleImageEngineId,
  seedreamOutputSettingsError,
  SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES,
} from '@/lib/image/seedream';
import { BytePlusSeedreamError } from './byteplus-seedream-error';

export type BytePlusSeedreamPayload = {
  model: string;
  prompt: string;
  size: string;
  output_format?: 'jpeg' | 'png';
  response_format: 'url';
  stream?: boolean;
  watermark: false;
  image?: string | string[];
  background?: 'auto' | 'transparent' | 'opaque';
  sequential_image_generation?: 'auto';
  sequential_image_generation_options?: {
    max_images: number;
  };
};

function resolveSeedreamEngineId(modelId: string): string {
  if (/seedream-5-5(?:-|$)/i.test(modelId)) return 'seedream-5-5';
  if (/seedream-5-0-flash(?:-|$)/i.test(modelId)) return 'seedream-5-0-flash';
  if (/seedream-5-0-pro(?:-|$)/i.test(modelId)) return 'seedream-5-0-pro';
  return 'seedream';
}

function validateLatestSeedreamSize(size: string): void {
  if (SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES.some(tier => tier === size)) return;
  const dimensions = /^(\d+)x(\d+)$/.exec(size);
  const width = Number(dimensions?.[1]);
  const height = Number(dimensions?.[2]);
  const pixels = width * height;
  if (!dimensions || pixels < 921_600 || pixels > 4_624_220 || width / height < 1 / 16 || width / height > 16) {
    throw new BytePlusSeedreamError('Seedream output size must be 1K, 1.5K, 2K or valid dimensions within the supported pixel limits.', {
      code: 'IMAGE_SIZE_INVALID', status: 400,
    });
  }
}

function normalizeImageUrls(values: Array<string | null | undefined> | undefined, preserveSlots: boolean): string[] {
  const urls = (values ?? []).map(value => typeof value === 'string' ? value.trim() : '').filter(Boolean);
  return preserveSlots ? urls : Array.from(new Set(urls));
}

export function buildBytePlusSeedreamPayload(params: {
  engineId?: string;
  modelId: string;
  prompt: string;
  mode: ImageGenerationMode;
  imageUrls?: string[];
  numImages: number;
  outputFormat?: string | null;
  size: string;
  aspectRatio?: string | null;
  responseFormat: 'url';
  // Legacy saved settings cannot enable the optional provider watermark.
  watermark?: boolean | null;
  background?: string | null;
}): BytePlusSeedreamPayload {
  const model = params.modelId.trim();
  const engineId = params.engineId ?? resolveSeedreamEngineId(model);
  const prompt = params.prompt.trim();
  const imageUrls = normalizeImageUrls(params.imageUrls, engineId === 'seedream-5-5' || engineId === 'seedream-5-0-flash');
  const image = imageUrls.length === 1 ? imageUrls[0] : imageUrls.length > 1 ? imageUrls : undefined;
  const requestedFormat = params.outputFormat?.trim().toLowerCase();
  const outputFormat =
    requestedFormat === 'png' || requestedFormat === 'jpeg' ? requestedFormat
      : engineId === 'seedream-5-5' ? 'png' : undefined;
  const size = resolveSeedreamProviderSize(params.size, params.aspectRatio, engineId);
  if (engineId === 'seedream-5-5' || engineId === 'seedream-5-0-flash') validateLatestSeedreamSize(size);
  if (seedreamOutputSettingsError(engineId, { background: params.background, outputFormat: params.outputFormat })) {
    throw new BytePlusSeedreamError('A transparent Seedream background requires PNG output.', {
      code: 'IMAGE_OUTPUT_FORMAT_INVALID', status: 400,
    });
  }
  const background = engineId === 'seedream-5-5' ? params.background?.trim().toLowerCase() : undefined;
  if (background != null && !['auto', 'transparent', 'opaque'].includes(background)) {
    throw new BytePlusSeedreamError('Unsupported Seedream background setting.', { code: 'IMAGE_BACKGROUND_INVALID', status: 400 });
  }

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
  if (imageUrls.length > SEEDREAM_MAX_REFERENCE_IMAGES) {
    throw new BytePlusSeedreamError('Seedream supports up to 10 reference images.', {
      code: 'REFERENCE_IMAGE_LIMIT',
      status: 400,
      detail: { max: SEEDREAM_MAX_REFERENCE_IMAGES },
    });
  }
  const outputImageCount = Math.max(1, Math.round(params.numImages));
  if (isSeedreamSingleImageEngineId(engineId) && outputImageCount > 1) {
    const label = engineId === 'seedream-5-0-pro' ? 'Seedream 5.0 Pro'
      : engineId === 'seedream-5-0-flash' ? 'Seedream 5.0 Flash' : 'Seedream 5.5';
    throw new BytePlusSeedreamError(`${label} supports one generated image per request.`, {
      code: 'IMAGE_COUNT_LIMIT',
      status: 400,
      detail: { max: 1 },
    });
  }
  if (outputImageCount > SEEDREAM_MAX_IMAGE_SET_IMAGES) {
    throw new BytePlusSeedreamError('Seedream image sets support up to 15 generated images.', {
      code: 'IMAGE_COUNT_LIMIT',
      status: 400,
      detail: { max: SEEDREAM_MAX_IMAGE_SET_IMAGES },
    });
  }
  if (imageUrls.length + outputImageCount > SEEDREAM_MAX_IMAGE_SET_IMAGES) {
    throw new BytePlusSeedreamError('Seedream reference images plus generated images must be 15 or fewer.', {
      code: 'IMAGE_SET_TOTAL_LIMIT',
      status: 400,
      detail: {
        maxTotal: SEEDREAM_MAX_IMAGE_SET_IMAGES,
        referenceImages: imageUrls.length,
        requestedImages: outputImageCount,
      },
    });
  }

  const sequentialImageGeneration = outputImageCount > 1;

  return {
    model,
    prompt,
    size,
    ...(outputFormat ? { output_format: outputFormat } : {}),
    ...(background ? { background: background as 'auto' | 'transparent' | 'opaque' } : {}),
    response_format: params.responseFormat,
    watermark: false,
    ...(image ? { image } : {}),
    ...(sequentialImageGeneration
      ? {
          stream: true,
          sequential_image_generation: 'auto' as const,
          sequential_image_generation_options: { max_images: outputImageCount },
        }
      : {}),
  };
}
