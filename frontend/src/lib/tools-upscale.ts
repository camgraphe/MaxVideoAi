import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolEngineDefinition,
} from '@/types/tools-upscale';

export const UPSCALE_VIDEO_DEFAULT_FPS = 30;
export const UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER = 4;
export const UPSCALE_OUTPUT_IMAGE_FETCH_TIMEOUT_MS = 20_000;
export const UPSCALE_OUTPUT_VIDEO_MIN_FETCH_TIMEOUT_MS = 60_000;
export const UPSCALE_OUTPUT_VIDEO_MAX_FETCH_TIMEOUT_MS = 10 * 60_000;
export const UPSCALE_OUTPUT_VIDEO_FETCH_TIMEOUT_PER_SECOND_MS = 4_000;

const TARGET_RESOLUTION_HEIGHT: Record<UpscaleTargetResolution, number> = {
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
};

export function clampUpscaleFactor(engine: UpscaleToolEngineDefinition, value?: number | null): number {
  const fallback = engine.defaultUpscaleFactor;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return engine.supportedUpscaleFactors.includes(rounded) ? rounded : fallback;
}

export function resolveUpscaleMode(engine: UpscaleToolEngineDefinition, value?: string | null): UpscaleMode {
  return value === 'target' && engine.supportedModes.includes('target') ? 'target' : engine.defaultMode;
}

export function resolveUpscaleTargetResolution(
  engine: UpscaleToolEngineDefinition,
  value?: string | null
): UpscaleTargetResolution {
  const fallback = engine.defaultTargetResolution ?? '1080p';
  return engine.supportedTargetResolutions?.includes(value as UpscaleTargetResolution)
    ? (value as UpscaleTargetResolution)
    : fallback;
}

export function resolveUpscaleOutputFormat(
  engine: UpscaleToolEngineDefinition,
  value?: string | null
): UpscaleOutputFormat {
  return engine.supportedOutputFormats.includes(value as UpscaleOutputFormat)
    ? (value as UpscaleOutputFormat)
    : engine.defaultOutputFormat;
}

export function getTargetResolutionHeight(value: UpscaleTargetResolution): number {
  return TARGET_RESOLUTION_HEIGHT[value];
}

export function estimateImageUpscaleCostUsd(params: {
  engineId: UpscaleToolEngineId;
  width?: number | null;
  height?: number | null;
  factor?: number | null;
}): number {
  const engine = getUpscaleToolEngine(params.engineId, 'image');
  if (typeof engine.providerPriceUsd.perImage === 'number') {
    return engine.providerPriceUsd.perImage;
  }
  const sourcePixels =
    typeof params.width === 'number' && typeof params.height === 'number' && params.width > 0 && params.height > 0
      ? params.width * params.height
      : 1_000_000;
  const factor = clampUpscaleFactor(engine, params.factor);
  const outputMegapixels = (sourcePixels * factor * factor) / 1_000_000;
  return Number(Math.max(0.001, outputMegapixels * (engine.providerPriceUsd.perMegapixel ?? 0.001)).toFixed(4));
}

export function estimateVideoUpscaleCostUsd(params: {
  engineId: UpscaleToolEngineId;
  width: number;
  height: number;
  durationSec: number;
  fps?: number | null;
  targetResolution?: UpscaleTargetResolution | null;
  factor?: number | null;
}): { costUsd: number; frames: number; outputMegapixels: number } {
  const engine = getUpscaleToolEngine(params.engineId, 'video');
  const durationSec = Math.max(1, Math.ceil(params.durationSec));
  const fps = Math.max(1, Math.round(params.fps ?? UPSCALE_VIDEO_DEFAULT_FPS));
  const frames = durationSec * fps;
  const sourcePixels = Math.max(1, params.width * params.height);
  const targetHeight = params.targetResolution ? getTargetResolutionHeight(params.targetResolution) : null;
  const targetScale = targetHeight ? Math.max(1, targetHeight / Math.min(params.width, params.height)) : null;
  const factor = targetScale ?? clampUpscaleFactor(engine, params.factor);
  const outputMegapixels = (sourcePixels * factor * factor * frames) / 1_000_000;
  const perSecond = params.targetResolution ? engine.providerPriceUsd.perSecondByResolution?.[params.targetResolution] : null;
  const costUsd =
    typeof perSecond === 'number'
      ? perSecond * durationSec
      : outputMegapixels * ((engine.providerPriceUsd.perVideoMegapixelFrame ?? 0.001 / 1_000_000) * 1_000_000);
  return {
    costUsd: Number(Math.max(0.01, costUsd).toFixed(4)),
    frames,
    outputMegapixels: Number(outputMegapixels.toFixed(4)),
  };
}

export type UpscaleVideoPricingMetadata = {
  width: number;
  height: number;
  durationSec: number;
  fps?: number | null;
};

export type UpscalePricingPreview = {
  totalCents: number | null;
  currency: string;
  ready: boolean;
  estimate: {
    megapixels?: number | null;
    frames?: number | null;
    durationSec?: number | null;
  } | null;
};

export function buildUpscalePricingPreview(params: {
  mediaType: UpscaleMediaType;
  engineId: UpscaleToolEngineId;
  unitPriceCents?: number | null;
  currency?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  videoMetadata?: UpscaleVideoPricingMetadata | null;
  targetResolution?: UpscaleTargetResolution | null;
  upscaleFactor?: number | null;
}): UpscalePricingPreview {
  const unitPriceCents =
    typeof params.unitPriceCents === 'number' && Number.isFinite(params.unitPriceCents)
      ? Math.max(0, Math.round(params.unitPriceCents))
      : null;
  const currency = typeof params.currency === 'string' && params.currency.trim() ? params.currency.trim().toUpperCase() : 'USD';

  if (params.mediaType === 'image') {
    return {
      totalCents: unitPriceCents,
      currency,
      ready: typeof unitPriceCents === 'number',
      estimate: null,
    };
  }

  const metadata = params.videoMetadata;
  if (
    !metadata ||
    metadata.width <= 0 ||
    metadata.height <= 0 ||
    metadata.durationSec <= 0 ||
    typeof unitPriceCents !== 'number'
  ) {
    return {
      totalCents: unitPriceCents,
      currency,
      ready: false,
      estimate: null,
    };
  }

  const estimate = estimateVideoUpscaleCostUsd({
    engineId: params.engineId,
    width: metadata.width,
    height: metadata.height,
    durationSec: metadata.durationSec,
    fps: metadata.fps,
    targetResolution: params.targetResolution,
    factor: params.upscaleFactor,
  });
  const dynamicCents = Math.max(1, Math.ceil(estimate.costUsd * 100 * UPSCALE_VIDEO_DYNAMIC_MARGIN_MULTIPLIER));

  return {
    totalCents: Math.max(unitPriceCents, dynamicCents),
    currency,
    ready: true,
    estimate: {
      megapixels: estimate.outputMegapixels,
      frames: estimate.frames,
      durationSec: metadata.durationSec,
    },
  };
}

export function resolveUpscaleOutputFetchTimeoutMs(params: {
  mediaType: UpscaleMediaType;
  durationSec?: number | null;
}): number {
  if (params.mediaType !== 'video') return UPSCALE_OUTPUT_IMAGE_FETCH_TIMEOUT_MS;
  const durationSec =
    typeof params.durationSec === 'number' && Number.isFinite(params.durationSec) && params.durationSec > 0
      ? Math.ceil(params.durationSec)
      : 1;
  return Math.min(
    UPSCALE_OUTPUT_VIDEO_MAX_FETCH_TIMEOUT_MS,
    Math.max(UPSCALE_OUTPUT_VIDEO_MIN_FETCH_TIMEOUT_MS, durationSec * UPSCALE_OUTPUT_VIDEO_FETCH_TIMEOUT_PER_SECOND_MS)
  );
}

export function isUpscaleMediaType(value: unknown): value is UpscaleMediaType {
  return value === 'image' || value === 'video';
}
