import type { GenerateAttachment, GeneratePayload } from '@/lib/fal';
import type { SoraRequest } from '@/lib/sora';
import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import type { Mode } from '@/types/engines';
import type { NormalizedAttachment } from './attachments';

export type FalInputSummary = {
  primaryImageUrl: string | null;
  primaryAudioUrl: string | null;
  referenceImageCount: number;
  referenceVideoCount: number;
  referenceAudioCount: number;
  hasFirstFrame: boolean;
  hasLastFrame: boolean;
  inputSlots: Array<{
    slotId: string | null;
    kind: NormalizedAttachment['kind'] | null;
    hasUrl: boolean;
  }>;
};

type MultiPromptEntry = {
  prompt: string;
  duration: number;
};

type GenerationElement = MaxVideoProviderElement;

export type FalRequestParts = {
  falInputs: GenerateAttachment[] | undefined;
  falInputSummary: FalInputSummary;
  falDurationOption: number | string | null;
  clampedFps: number | undefined;
  falPayload: GeneratePayload;
};

export function buildFalInputs(attachments: NormalizedAttachment[]): GenerateAttachment[] | undefined {
  return attachments.length > 0
    ? attachments.map((attachment) => ({
        name: attachment.name,
        type: attachment.type,
        size: attachment.size,
        kind: attachment.kind,
        slotId: attachment.slotId,
        label: attachment.label,
        url: attachment.url,
        width: attachment.width ?? undefined,
        height: attachment.height ?? undefined,
        assetId: attachment.assetId,
      }))
    : undefined;
}

export function buildFalRequestParts(params: {
  attachments: NormalizedAttachment[];
  engineId: string;
  prompt: string;
  mode: Mode;
  apiKey: unknown;
  jobId: string;
  localKey: string | null;
  needsImage: boolean;
  needsFirstLastFrames: boolean;
  initialImageUrl: string | undefined;
  resolvedFirstFrameUrl: string | undefined;
  lastFrameUrl: string | undefined;
  resolvedAudioUrl: string | undefined;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  audioUrls: string[];
  soraRequest: SoraRequest | null;
  isLumaRay2: boolean;
  loop: boolean;
  multiPrompt: MultiPromptEntry[] | null;
  shotType: 'customize' | 'intelligent' | null;
  seed: number | null;
  cameraFixed: boolean | null;
  safetyChecker: boolean | null;
  voiceIds: string[];
  elements: GenerationElement[] | null;
  endImageUrl: string | null;
  extraInputValues: Record<string, unknown>;
  supportsDuration: boolean;
  durationSec: number;
  durationOption: number | string | null;
  numFrames: number | null;
  supportsAspectRatio: boolean;
  aspectRatio: string | null;
  supportsResolution: boolean;
  resolution: string;
  audioEnabled: boolean | undefined;
  supportsFps: boolean;
  fps: unknown;
  cfgScale: unknown;
}): FalRequestParts {
  const falInputs = buildFalInputs(params.attachments);
  const falInputSummary: FalInputSummary = {
    primaryImageUrl: params.initialImageUrl ?? params.resolvedFirstFrameUrl ?? null,
    primaryAudioUrl: params.resolvedAudioUrl ?? null,
    referenceImageCount: params.normalizedReferenceImages.length,
    referenceVideoCount: params.videoUrls.length,
    referenceAudioCount: params.audioUrls.length,
    hasFirstFrame: Boolean(params.resolvedFirstFrameUrl),
    hasLastFrame: Boolean(params.lastFrameUrl),
    inputSlots:
      falInputs?.map((attachment) => ({
        slotId: attachment.slotId ?? null,
        kind: attachment.kind ?? null,
        hasUrl: Boolean(attachment.url),
      })) ?? [],
  };

  const isLtxFastLong = (params.engineId === 'ltx-2-fast' || params.engineId === 'ltx-2-3-fast') && params.durationSec > 10;
  let clampedFps =
    typeof params.fps === 'number' && Number.isFinite(params.fps) && params.fps > 0
      ? Math.trunc(params.fps)
      : undefined;
  if (isLtxFastLong) {
    clampedFps = 25;
  }

  const falPayload: GeneratePayload = {
    engineId: params.engineId,
    prompt: params.prompt,
    mode: params.mode,
    apiKey: typeof params.apiKey === 'string' ? params.apiKey : undefined,
    idempotencyKey: params.jobId,
    imageUrl:
      params.needsImage || params.mode === 'v2v' || params.mode === 'reframe'
        ? params.initialImageUrl
        : params.needsFirstLastFrames
          ? params.resolvedFirstFrameUrl
          : undefined,
    audioUrl: params.resolvedAudioUrl,
    referenceImages: params.normalizedReferenceImages.length ? params.normalizedReferenceImages : undefined,
    inputs: falInputs,
    soraRequest: params.soraRequest ?? undefined,
    jobId: params.jobId,
    localKey: params.localKey,
    loop: params.isLumaRay2 ? params.loop : undefined,
    multiPrompt: params.multiPrompt ?? undefined,
    shotType: params.mode === 'i2v' ? 'customize' : params.shotType ?? undefined,
    seed: typeof params.seed === 'number' ? params.seed : undefined,
    cameraFixed: typeof params.cameraFixed === 'boolean' ? params.cameraFixed : undefined,
    safetyChecker: typeof params.safetyChecker === 'boolean' ? params.safetyChecker : undefined,
    voiceIds: params.voiceIds.length ? params.voiceIds : undefined,
    elements: params.elements ?? undefined,
    endImageUrl: params.endImageUrl ?? undefined,
    extraInputValues: Object.keys(params.extraInputValues).length ? params.extraInputValues : undefined,
    ...(params.supportsDuration
      ? { durationSec: params.durationSec, durationOption: params.durationOption, numFrames: params.numFrames }
      : {}),
    ...(params.supportsAspectRatio ? { aspectRatio: params.aspectRatio ?? undefined } : {}),
    ...(params.supportsResolution ? { resolution: params.resolution } : {}),
  };

  if (typeof params.audioEnabled === 'boolean') {
    falPayload.audio = params.audioEnabled;
  }
  if (params.supportsFps && typeof clampedFps === 'number') {
    falPayload.fps = clampedFps;
  }
  if (typeof params.cfgScale === 'number' && Number.isFinite(params.cfgScale)) {
    falPayload.cfgScale = params.cfgScale;
  }

  return {
    falInputs,
    falInputSummary,
    falDurationOption: params.durationOption,
    clampedFps,
    falPayload,
  };
}
