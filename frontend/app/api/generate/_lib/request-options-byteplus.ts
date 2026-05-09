import {
  BYTEPLUS_SEEDANCE_ASPECT_RATIOS,
  getBytePlusSeedanceAllowedResolutions,
} from '@/server/video-providers/byteplus-modelark';

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
}):
  | {
      ok: true;
      durationSec: number;
      resolution: string;
      aspectRatio: string;
    }
  | RequestOptionsFailure {
  const normalizedDuration = Math.trunc(params.durationSec);
  if (
    !Number.isFinite(params.durationSec) ||
    normalizedDuration !== params.durationSec ||
    normalizedDuration < 5 ||
    normalizedDuration > 15
  ) {
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
        message: 'This Seedance route requires an integer duration from 5 to 15 seconds.',
      },
    };
  }
  const allowedResolutions = getBytePlusSeedanceAllowedResolutions(params.engineId);
  const bytePlusResolution = params.requestedResolution === 'auto' ? '720p' : params.requestedResolution;
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
  const bytePlusAspectRatio = !params.aspectRatio || params.aspectRatio === 'auto' ? '16:9' : params.aspectRatio;
  if (!BYTEPLUS_SEEDANCE_ASPECT_RATIOS.includes(bytePlusAspectRatio as (typeof BYTEPLUS_SEEDANCE_ASPECT_RATIOS)[number])) {
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
  };
}
