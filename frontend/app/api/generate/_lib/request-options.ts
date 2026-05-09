import { getEngineCaps } from '@/fixtures/engineCaps';
import {
  getLumaRay2DurationInfo,
  getLumaRay2ResolutionInfo,
  isLumaRay2AspectRatio,
  isLumaRay2EngineId,
  normaliseLumaRay2Loop,
  toLumaRay2DurationLabel,
  LUMA_RAY2_ERROR_UNSUPPORTED,
  type LumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { isSoraEngineId, type SoraRequest } from '@/lib/sora';
import type { EngineCaps, Mode } from '@/types/engines';
import { normalizeBytePlusOptions } from './request-options-byteplus';
import {
  normalizeGenerationElements,
  normalizeMultiPrompt,
  normalizeSeed,
  normalizeStringArray,
  trimString,
  type GenerationElement,
  type MultiPromptEntry,
} from './request-option-normalizers';
import { buildSoraRequestOptions } from './request-options-sora';

export type { GenerationElement, MultiPromptEntry } from './request-option-normalizers';

export type VideoMode = Extract<
  Mode,
  't2v' | 'i2v' | 'ref2v' | 'fl2v' | 'i2i' | 'v2v' | 'r2v' | 'a2v' | 'extend' | 'retake' | 'reframe'
>;

export type GenerateRequestOptionsMetric = {
  errorCode: string;
  meta?: Record<string, unknown>;
};

export type GenerateRequestOptions = {
  prompt: string;
  multiPrompt: MultiPromptEntry[] | null;
  audioEnabled: boolean | undefined;
  isLumaRay2: boolean;
  supportsDuration: boolean;
  supportsResolution: boolean;
  supportsFps: boolean;
  supportsAspectRatio: boolean;
  rawDurationOption: number | string | null;
  rawDurationLabel: LumaRay2DurationLabel | undefined;
  durationLabel: string | undefined;
  durationSec: number;
  lumaDurationInfo: ReturnType<typeof getLumaRay2DurationInfo>;
  shotType: 'customize' | 'intelligent' | null;
  seed: number | null;
  cameraFixed: boolean | null;
  safetyChecker: boolean | null;
  voiceIds: string[];
  voiceControl: boolean;
  elements: GenerationElement[] | null;
  endImageUrl: string | null;
  rawAudioUrl: string | null;
  aspectRatio: string | null;
  batchId: string | null;
  groupId: string | null;
  iterationIndex: number | null;
  iterationCount: number | null;
  renderIds: string[] | null;
  heroRenderId: string | null;
  message: string | null;
  etaSeconds: number | null;
  etaLabel: string | null;
  rawExtraInputValues: Record<string, unknown> | null;
  requestedResolution: string;
  pricingResolution: string;
  effectiveResolution: string;
  numFrames: number | null;
  loop: boolean;
  soraRequest: SoraRequest | null;
};

export type GenerateRequestOptionsResult =
  | {
      ok: true;
      options: GenerateRequestOptions;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      metric?: GenerateRequestOptionsMetric;
    };

export function isVideoMode(value: unknown): value is VideoMode {
  return (
    value === 't2v' ||
    value === 'i2v' ||
    value === 'ref2v' ||
    value === 'fl2v' ||
    value === 'i2i' ||
    value === 'v2v' ||
    value === 'r2v' ||
    value === 'a2v' ||
    value === 'extend' ||
    value === 'retake' ||
    value === 'reframe'
  );
}

export function buildGenerateRequestOptions(params: {
  body: Record<string, unknown>;
  engine: EngineCaps;
  mode: Mode;
  isBytePlusV1a: boolean;
}): GenerateRequestOptionsResult {
  const { body, engine, mode, isBytePlusV1a } = params;
  const prompt = String(body.prompt || '');
  const multiPrompt = normalizeMultiPrompt(body.multiPrompt);
  const multiPromptTotalSec = multiPrompt
    ? multiPrompt.reduce((sum: number, entry: MultiPromptEntry) => sum + (entry.duration || 0), 0)
    : 0;
  let audioEnabled =
    typeof body.audio === 'boolean'
      ? body.audio
      : typeof body.generate_audio === 'boolean'
        ? body.generate_audio
        : undefined;
  const isLumaRay2 = isLumaRay2EngineId(engine.id);
  const capability = getEngineCaps(engine.id, mode);
  const supportsDuration = capability ? Boolean(capability.duration || capability.frames) : true;
  const supportsResolution = capability ? Boolean(capability.resolution && capability.resolution.length) : true;
  const supportsFps = capability
    ? Array.isArray(capability.fps)
      ? capability.fps.length > 0
      : typeof capability.fps === 'number'
    : true;
  const supportsAspectRatio = capability ? Boolean(capability.aspectRatio && capability.aspectRatio.length) : true;
  const rawDurationOption =
    typeof body.durationOption === 'number' || typeof body.durationOption === 'string' ? body.durationOption : null;
  let durationSec = Number(body.durationSec || body.duration || 4);
  if (multiPromptTotalSec > 0) {
    durationSec = multiPromptTotalSec;
  }
  const lumaDurationInfo =
    isLumaRay2 && supportsDuration ? getLumaRay2DurationInfo(rawDurationOption ?? durationSec) : null;
  if (isLumaRay2 && supportsDuration && !lumaDurationInfo) {
    return {
      ok: false,
      status: 400,
      metric: {
        errorCode: 'LUMA_DURATION_UNSUPPORTED',
        meta: { durationOption: rawDurationOption, durationSec: body.durationSec },
      },
      body: { ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED },
    };
  }
  if (lumaDurationInfo) {
    durationSec = lumaDurationInfo.seconds;
  }

  const shotTypeRaw = typeof body.shotType === 'string' ? body.shotType.trim().toLowerCase() : '';
  const shotType = shotTypeRaw === 'intelligent' ? 'intelligent' : shotTypeRaw === 'customize' ? 'customize' : null;
  const seed = normalizeSeed(body.seed);
  const cameraFixed = typeof body.cameraFixed === 'boolean' ? body.cameraFixed : null;
  const safetyChecker = typeof body.safetyChecker === 'boolean' ? body.safetyChecker : null;
  const voiceIds = normalizeStringArray(body.voiceIds);
  const voiceControl = Boolean(body.voiceControl) || voiceIds.length > 0;
  if (voiceControl) {
    audioEnabled = true;
  }
  const elements = normalizeGenerationElements(body.elements);
  const endImageUrl =
    typeof body.endImageUrl === 'string' && body.endImageUrl.trim().length ? body.endImageUrl.trim() : null;
  const rawAudioUrl =
    typeof body.audioUrl === 'string' && body.audioUrl.trim().length
      ? body.audioUrl.trim()
      : typeof body.audio_url === 'string' && body.audio_url.trim().length
        ? body.audio_url.trim()
        : null;
  const rawAspectRatio =
    supportsAspectRatio && typeof body.aspectRatio === 'string' && body.aspectRatio.trim().length
      ? body.aspectRatio.trim()
      : null;
  const fallbackAspectRatio = supportsAspectRatio
    ? capability?.aspectRatio?.find((value) => value !== 'auto') ??
      engine.aspectRatios?.find((value) => value !== 'auto') ??
      engine.aspectRatios?.[0] ??
      '16:9'
    : null;
  let aspectRatio =
    rawAspectRatio && fallbackAspectRatio
      ? rawAspectRatio === 'auto'
        ? fallbackAspectRatio
        : rawAspectRatio
      : rawAspectRatio ?? fallbackAspectRatio ?? null;
  if (isLumaRay2 && supportsAspectRatio) {
    if (aspectRatio && !isLumaRay2AspectRatio(aspectRatio, { includeSquare: mode === 'reframe' })) {
      return {
        ok: false,
        status: 400,
        metric: {
          errorCode: 'LUMA_ASPECT_UNSUPPORTED',
          meta: { aspectRatio },
        },
        body: { ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED },
      };
    }
    if (!aspectRatio) {
      aspectRatio = fallbackAspectRatio ?? '16:9';
    }
  }

  const batchId = trimString(body.batchId);
  const groupId = trimString(body.groupId);
  const iterationIndex =
    typeof body.iterationIndex === 'number' && Number.isFinite(body.iterationIndex)
      ? Math.max(0, Math.trunc(body.iterationIndex))
      : null;
  const iterationCount =
    typeof body.iterationCount === 'number' && Number.isFinite(body.iterationCount)
      ? Math.max(1, Math.trunc(body.iterationCount))
      : null;
  const renderIds =
    Array.isArray(body.renderIds) && body.renderIds.length
      ? body.renderIds.map((value: unknown) => trimString(value)).filter((value): value is string => Boolean(value))
      : null;
  const heroRenderId = trimString(body.heroRenderId);
  const message = trimString(body.message);
  const etaSeconds =
    typeof body.etaSeconds === 'number' && Number.isFinite(body.etaSeconds)
      ? Math.max(0, Math.trunc(body.etaSeconds))
      : null;
  const etaLabel = trimString(body.etaLabel);
  const rawExtraInputValues =
    body.extraInputValues && typeof body.extraInputValues === 'object' && !Array.isArray(body.extraInputValues)
      ? (body.extraInputValues as Record<string, unknown>)
      : null;

  let requestedResolution =
    typeof body.resolution === 'string' && body.resolution.trim().length
      ? body.resolution.trim()
      : engine.resolutions?.[0] ?? '1080p';
  let pricingResolution =
    requestedResolution === 'auto'
      ? engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '1080p'
      : requestedResolution;
  let effectiveResolution = requestedResolution === 'auto' ? pricingResolution : requestedResolution;
  let lumaResolutionInfo = isLumaRay2 && supportsResolution ? getLumaRay2ResolutionInfo(requestedResolution) : null;
  if (isLumaRay2 && supportsResolution) {
    if (requestedResolution === 'auto') {
      requestedResolution = '540p';
      lumaResolutionInfo = getLumaRay2ResolutionInfo(requestedResolution);
    }
    if (!lumaResolutionInfo) {
      return {
        ok: false,
        status: 400,
        body: { ok: false, error: LUMA_RAY2_ERROR_UNSUPPORTED },
      };
    }
    pricingResolution = lumaResolutionInfo.value;
    effectiveResolution = lumaResolutionInfo.value;
    requestedResolution = lumaResolutionInfo.value;
  } else if (!supportsResolution) {
    const fallbackResolution =
      engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '540p';
    pricingResolution = fallbackResolution;
    effectiveResolution = fallbackResolution;
    requestedResolution = fallbackResolution;
  }
  if ((engine.id === 'ltx-2-fast' || engine.id === 'ltx-2-3-fast') && durationSec > 10) {
    requestedResolution = '1080p';
    pricingResolution = '1080p';
    effectiveResolution = '1080p';
  }
  if (isBytePlusV1a) {
    const bytePlusResult = normalizeBytePlusOptions({
      engineId: engine.id,
      durationSec,
      requestedResolution,
      aspectRatio,
    });
    if (!bytePlusResult.ok) {
      return bytePlusResult;
    }
    durationSec = bytePlusResult.durationSec;
    requestedResolution = bytePlusResult.resolution;
    pricingResolution = bytePlusResult.resolution;
    effectiveResolution = bytePlusResult.resolution;
    aspectRatio = bytePlusResult.aspectRatio;
    audioEnabled = audioEnabled ?? true;
  }

  const rawNumFrames =
    typeof body.numFrames === 'number'
      ? body.numFrames
      : typeof body.num_frames === 'number'
        ? body.num_frames
        : null;
  const numFrames =
    rawNumFrames != null && Number.isFinite(rawNumFrames) && rawNumFrames > 0 ? Math.round(rawNumFrames) : null;
  const loopValue = isLumaRay2 ? normaliseLumaRay2Loop(body.loop) : undefined;
  const loop = isLumaRay2 ? loopValue === true : false;

  let soraRequest: SoraRequest | null = null;
  if (isSoraEngineId(engine.id)) {
    const soraResult = buildSoraRequestOptions({
      body,
      engine,
      mode,
      prompt,
      requestedResolution,
      rawAspectRatio,
      durationSec,
    });
    if (!soraResult.ok) {
      return soraResult;
    }
    soraRequest = soraResult.soraRequest;
    durationSec = soraRequest.duration;
    requestedResolution = soraRequest.resolution;
    const fallbackResolution =
      engine.resolutions.find((value) => value !== 'auto') ?? engine.resolutions[0] ?? '720p';
    pricingResolution = soraRequest.resolution === 'auto' ? fallbackResolution : soraRequest.resolution;
    effectiveResolution = soraRequest.resolution === 'auto' ? fallbackResolution : soraRequest.resolution;
    const fallbackAspectNormalized =
      engine.aspectRatios?.find((value) => value !== 'auto') ?? engine.aspectRatios?.[0] ?? '16:9';
    aspectRatio =
      soraRequest.mode === 'i2v' && soraRequest.aspect_ratio === 'auto'
        ? fallbackAspectNormalized
        : soraRequest.aspect_ratio === 'auto'
          ? fallbackAspectNormalized
          : soraRequest.aspect_ratio;
  }

  const rawDurationLabel: LumaRay2DurationLabel | undefined =
    typeof rawDurationOption === 'string' && ['5s', '9s'].includes(rawDurationOption)
      ? (rawDurationOption as LumaRay2DurationLabel)
      : undefined;
  const durationLabel = lumaDurationInfo?.label ?? toLumaRay2DurationLabel(durationSec, rawDurationLabel) ?? undefined;

  return {
    ok: true,
    options: {
      prompt,
      multiPrompt,
      audioEnabled,
      isLumaRay2,
      supportsDuration,
      supportsResolution,
      supportsFps,
      supportsAspectRatio,
      rawDurationOption,
      rawDurationLabel,
      durationLabel,
      durationSec,
      lumaDurationInfo,
      shotType,
      seed,
      cameraFixed,
      safetyChecker,
      voiceIds,
      voiceControl,
      elements,
      endImageUrl,
      rawAudioUrl,
      aspectRatio,
      batchId,
      groupId,
      iterationIndex,
      iterationCount,
      renderIds,
      heroRenderId,
      message,
      etaSeconds,
      etaLabel,
      rawExtraInputValues,
      requestedResolution,
      pricingResolution,
      effectiveResolution,
      numFrames,
      loop,
      soraRequest,
    },
  };
}
