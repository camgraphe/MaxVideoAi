import { getUpscaleToolEngine } from '@/config/tools-upscale-engines';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleOutputFormat,
  UpscaleTargetResolution,
  UpscaleToolEngineId,
  UpscaleToolEngineDefinition,
} from '@/types/tools-upscale';

export const UPSCALE_VIDEO_MAX_DURATION_SEC = 20;
export const UPSCALE_VIDEO_DEFAULT_FPS = 30;

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
  const durationSec = Math.max(1, Math.min(UPSCALE_VIDEO_MAX_DURATION_SEC, Math.ceil(params.durationSec)));
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

export function isUpscaleMediaType(value: unknown): value is UpscaleMediaType {
  return value === 'image' || value === 'video';
}
