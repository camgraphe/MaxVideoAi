import { requireBytePlusSeedanceProfile } from '@/server/video-providers/byteplus-modelark';
import type { Mode } from '@/types/engines';

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
  requestedResolution: string;
  aspectRatio: string | null;
  mode?: Mode;
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
  const normalizedDuration = Math.trunc(params.durationSec);
  const allowedDurations = profile.durationOptions;
  if (
    !Number.isFinite(params.durationSec) ||
    normalizedDuration !== params.durationSec ||
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
  const allowedResolutions = profile.resolutions;
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
    inheritsSourceAspectRatio
      ? null
      : !params.aspectRatio || params.aspectRatio === 'auto'
        ? profile.defaultAspectRatio
        : params.aspectRatio;
  if (
    bytePlusAspectRatio &&
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
