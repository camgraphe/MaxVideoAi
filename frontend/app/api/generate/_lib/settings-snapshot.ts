import type { GenerateAttachment } from '@/lib/fal';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import type { Mode } from '@/types/engines';

type MultiPromptEntry = {
  prompt: string;
  duration: number;
};

type GenerationElement = MaxVideoProviderElement;

export type GenerationSettingsSnapshot = Record<string, unknown>;

function trimmedStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

export function buildGenerationSettingsSnapshot(params: {
  engineId: string;
  engineLabel: string;
  mode: Mode;
  prompt: string;
  negativePrompt: unknown;
  membershipTier: unknown;
  durationSec: number;
  durationOption: number | string | null;
  numFrames: number | null;
  aspectRatio: string | null;
  resolution: string;
  clampedFps: number | undefined;
  rawFps: unknown;
  iterationCount: number | null;
  audioEnabled: boolean | undefined;
  cfgScale: unknown;
  isLumaRay2: boolean;
  loop: boolean;
  shotType: 'customize' | 'intelligent' | null;
  seed: number | null;
  cameraFixed: boolean | null;
  safetyChecker: boolean | null;
  voiceIds: string[];
  voiceControl: boolean;
  multiPrompt: MultiPromptEntry[] | null;
  extraInputValues: Record<string, unknown>;
  initialImageUrl: string | undefined;
  resolvedFirstFrameUrl: string | undefined;
  resolvedAudioUrl: string | undefined;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  lastFrameUrl: string | undefined;
  endImageUrl: string | null;
  elements: GenerationElement[] | null;
  falInputs: GenerateAttachment[] | undefined;
}): GenerationSettingsSnapshot {
  return {
    schemaVersion: 1,
    surface: 'video',
    engineId: params.engineId,
    engineLabel: params.engineLabel,
    inputMode: params.mode,
    prompt: params.prompt,
    negativePrompt: trimmedStringOrNull(params.negativePrompt),
    core: {
      durationSec: params.durationSec,
      durationOption: params.durationOption,
      numFrames: params.numFrames ?? null,
      aspectRatio: params.aspectRatio,
      resolution: params.resolution,
      fps:
        typeof params.clampedFps === 'number'
          ? params.clampedFps
          : typeof params.rawFps === 'number'
            ? Math.trunc(params.rawFps)
            : null,
      iterationCount: params.iterationCount ?? null,
      audio: typeof params.audioEnabled === 'boolean' ? params.audioEnabled : null,
    },
    advanced: {
      cfgScale: typeof params.cfgScale === 'number' && Number.isFinite(params.cfgScale) ? params.cfgScale : null,
      loop: params.isLumaRay2 ? Boolean(params.loop) : null,
      shotType: params.shotType ?? null,
      seed: typeof params.seed === 'number' ? params.seed : null,
      cameraFixed: typeof params.cameraFixed === 'boolean' ? params.cameraFixed : null,
      safetyChecker: typeof params.safetyChecker === 'boolean' ? params.safetyChecker : null,
      voiceIds: params.voiceIds.length ? params.voiceIds : null,
      voiceControl: params.voiceControl ? true : null,
      multiPrompt: params.multiPrompt ?? null,
      extraInputValues: Object.keys(params.extraInputValues).length ? params.extraInputValues : null,
    },
    refs: {
      imageUrl: params.initialImageUrl ?? params.resolvedFirstFrameUrl ?? null,
      audioUrl: params.resolvedAudioUrl ?? null,
      referenceImages: params.normalizedReferenceImages ?? null,
      videoUrls: params.videoUrls.length ? params.videoUrls : null,
      firstFrameUrl: params.resolvedFirstFrameUrl ?? null,
      lastFrameUrl: params.lastFrameUrl ?? null,
      endImageUrl: params.endImageUrl ?? null,
      elements: params.elements ?? null,
      inputs: params.falInputs ?? null,
    },
    meta: {
      memberTier: trimmedStringOrNull(params.membershipTier),
    },
  };
}
