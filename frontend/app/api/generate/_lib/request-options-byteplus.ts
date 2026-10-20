import { requireBytePlusSeedanceProfile } from '@/server/video-providers/byteplus-modelark';
import type { Mode } from '@/types/engines';
import { getBytePlusSeedanceModeResolutions } from '@/lib/byteplus-mode-capabilities';
import { seedanceAutomaticDurationBounds, isSeedanceAdaptiveAspect } from '@/lib/seedance-option-pricing';
import { resolveBytePlusTransport } from '@/server/video-providers/byteplus-modelark-transport';

type RequestOptionsFailure = {
  ok: false;
  status: number;
  body: Record<string, unknown>;
  metric?: {
    errorCode: string;
    meta?: Record<string, unknown>;
  };
};

export function normalizeBytePlusOptions(params: {
  engineId: string;
  durationSec: number;
  durationOption?: number | string | null;
  requestedResolution: string;
  aspectRatio: string | null;
  mode?: Mode;
  workflowStep?: 'draft' | 'final';
}):
  | {
      ok: true;
      durationSec: number;
      resolution: string;
      aspectRatio: string | null;
      generatedAudio: boolean;
    }
  | RequestOptionsFailure {
  const profile = requireBytePlusSeedanceProfile(params.engineId);
  const automaticBounds = seedanceAutomaticDurationBounds(params.engineId);
  if (params.durationOption === 'auto' && !automaticBounds) {
    return { ok: false, status: 400, body: { ok: false, error: 'BYTEPLUS_DURATION_UNSUPPORTED',
      message: 'Automatic duration is unavailable for this route.' } };
  }
  const pricingDuration = params.durationOption === 'auto' && automaticBounds ? automaticBounds.max : params.durationSec;
  const normalizedDuration = Math.trunc(pricingDuration);
  const allowedDurations = profile.durationOptions;
  if (
    !Number.isFinite(pricingDuration) ||
    normalizedDuration !== pricingDuration ||
    !allowedDurations.includes(normalizedDuration as never)
  ) {
    const minDuration = allowedDurations[0] ?? 5;
    const maxDuration = allowedDurations[allowedDurations.length - 1] ?? 15;
    return {
      ok: false,
      status: 400,
      metric: {
        errorCode: 'BYTEPLUS_DURATION_UNSUPPORTED',
        meta: { durationSec: params.durationSec },
      },
      body: {
        ok: false,
        error: 'BYTEPLUS_DURATION_UNSUPPORTED',
        message: `This Seedance route requires an integer duration from ${minDuration} to ${maxDuration} seconds.`,
      },
    };
  }
  const allowedResolutions = getBytePlusSeedanceModeResolutions(params.engineId, params.mode, profile.resolutions,
    params.workflowStep ? 'modelark' : resolveBytePlusTransport(params.engineId, params.mode));
  const bytePlusResolution =
    params.requestedResolution === 'auto'
      ? profile.defaultResolution
      : params.requestedResolution;
  if (!allowedResolutions.includes(bytePlusResolution as (typeof allowedResolutions)[number])) {
    return {
      ok: false,
      status: 400,
      metric: {
        errorCode: 'BYTEPLUS_RESOLUTION_UNSUPPORTED',
        meta: { resolution: params.requestedResolution, engineId: params.engineId },
      },
      body: {
        ok: false,
        error: 'BYTEPLUS_RESOLUTION_UNSUPPORTED',
        message: 'This Seedance route does not support this resolution for the selected model.',
      },
    };
  }
  const inheritsSourceAspectRatio =
    params.engineId === 'seedance-2-5' && params.mode === 'i2v';
  const bytePlusAspectRatio =
    isSeedanceAdaptiveAspect(params.aspectRatio) && automaticBounds
      ? 'auto'
      : inheritsSourceAspectRatio
      ? null
      : !params.aspectRatio || params.aspectRatio === 'auto'
        ? profile.defaultAspectRatio
        : params.aspectRatio;
  if (
    bytePlusAspectRatio && bytePlusAspectRatio !== 'auto' &&
    !profile.aspectRatios.includes(bytePlusAspectRatio as (typeof profile.aspectRatios)[number])
  ) {
    return {
      ok: false,
      status: 400,
      metric: {
        errorCode: 'BYTEPLUS_RATIO_UNSUPPORTED',
        meta: { aspectRatio: params.aspectRatio, engineId: params.engineId },
      },
      body: {
        ok: false,
        error: 'BYTEPLUS_RATIO_UNSUPPORTED',
        message: 'This Seedance route does not support this aspect ratio.',
      },
    };
  }
  return {
    ok: true,
    durationSec: normalizedDuration,
    resolution: bytePlusResolution,
    aspectRatio: bytePlusAspectRatio,
    generatedAudio: profile.generatedAudio,
  };
}
