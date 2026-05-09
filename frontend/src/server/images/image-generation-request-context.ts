import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import type {
  ImageGenerationMode,
  ImageGenerationRequest,
  ImageGenerationResponse,
} from '@/types/image-generation';
import {
  clampRequestedImageCount,
  resolveRequestedAspectRatio,
} from '@/app/api/images/utils';
import { ImageGenerationExecutionError } from './image-generation-error';

export type ImageEngineEntry = FalEngineEntry;

export type ImageGenerationRequestContext = {
  engineEntry: ImageEngineEntry;
  engine: ImageEngineEntry['engine'];
  mode: ImageGenerationMode;
  modeConfig: ImageEngineEntry['modes'][number];
  resolvedAspectRatio: string | null;
  prompt: string;
  numImages: number;
  durationSec: number;
};

const IMAGE_ENGINE_REGISTRY = listFalEngines().filter((entry) => (entry.category ?? 'video') === 'image');
const IMAGE_ENGINE_MAP = new Map(IMAGE_ENGINE_REGISTRY.map((entry) => [entry.id, entry]));
const DEFAULT_IMAGE_ENGINE_ID = IMAGE_ENGINE_REGISTRY[0]?.id ?? null;

export function resolveImageGenerationRequestContext(
  body: Partial<ImageGenerationRequest>
): ImageGenerationRequestContext {
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

  return {
    engineEntry,
    engine,
    mode,
    modeConfig,
    resolvedAspectRatio: aspectRatioResult.value || null,
    prompt,
    numImages,
    durationSec: numImages,
  };
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
