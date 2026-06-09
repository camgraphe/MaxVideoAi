import type { GeneratePayload } from '@/lib/fal';
import { isLumaRay32EngineId, isLumaRay32PublicMode } from '@/lib/luma-agents';
import type { Mode } from '@/types/engines';
import {
  LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS,
  LUMA_AGENTS_RAY_32_DIRECT_DURATIONS,
  LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS,
  LUMA_AGENTS_RAY_32_PROVIDER_MODEL,
} from './constants';

export const LUMA_AGENTS_DIRECT_PROVIDER = 'luma_agents_direct' as const;

export type LumaAgentsGenerationType = 'video' | 'video_edit' | 'video_reframe';

export type LumaAgentsVideoModelRoute = {
  providerModel: typeof LUMA_AGENTS_RAY_32_PROVIDER_MODEL;
  type: LumaAgentsGenerationType;
  fallbackCompatible: boolean;
};

export type LumaAgentsVideoSupportResult =
  | {
      supported: true;
      route: LumaAgentsVideoModelRoute;
    }
  | {
      supported: false;
      reason: string;
      route: LumaAgentsVideoModelRoute | null;
      fallbackCompatible: boolean;
    };

const DIRECT_ASPECT_RATIOS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS);
const DIRECT_DURATIONS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_DURATIONS);
const DIRECT_RESOLUTIONS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS);

export function isLumaAgentsVideoEngine(engineId: string): boolean {
  return isLumaRay32EngineId(engineId);
}

export function isLumaAgentsVideoModeSupported(
  mode: Mode | string,
  options?: { advancedDirectOnlyEnabled?: boolean }
): boolean {
  if (isLumaRay32PublicMode(mode)) return true;
  return options?.advancedDirectOnlyEnabled === true && (mode === 'v2v' || mode === 'reframe');
}

export function resolveLumaAgentsModelRoute(params: {
  engineId: string;
  mode: Mode | string;
}): LumaAgentsVideoModelRoute {
  if (!isLumaRay32EngineId(params.engineId)) {
    throw new Error(`Unsupported Luma Agents video engine: ${params.engineId}`);
  }
  if (params.mode === 'v2v') {
    return { providerModel: LUMA_AGENTS_RAY_32_PROVIDER_MODEL, type: 'video_edit', fallbackCompatible: false };
  }
  if (params.mode === 'reframe') {
    return { providerModel: LUMA_AGENTS_RAY_32_PROVIDER_MODEL, type: 'video_reframe', fallbackCompatible: false };
  }
  return {
    providerModel: LUMA_AGENTS_RAY_32_PROVIDER_MODEL,
    type: 'video',
    fallbackCompatible: params.mode === 't2v' || params.mode === 'i2v',
  };
}

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function normalizeDurationOption(payload: GeneratePayload): string {
  const raw = payload.durationOption ?? payload.durationSec;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === '5' || normalized === '5s') return '5s';
    if (normalized === '10' || normalized === '10s') return '10s';
    return normalized;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const duration = Math.trunc(raw);
    if (duration === 5) return '5s';
    if (duration === 10) return '10s';
  }
  return '5s';
}

function hasReferenceImages(payload: GeneratePayload): boolean {
  if ((payload.referenceImages?.length ?? 0) > 0) return true;
  return (payload.inputs ?? []).some((input) => {
    if (input.kind !== 'image') return false;
    const slotId = cleanString(input.slotId);
    return slotId === 'reference_image_urls' || slotId === 'reference_images' || slotId === 'image_urls';
  });
}

function hasEndImage(payload: GeneratePayload): boolean {
  if (cleanString(payload.endImageUrl)) return true;
  return (payload.inputs ?? []).some((input) => {
    if (input.kind !== 'image') return false;
    const slotId = cleanString(input.slotId);
    return slotId === 'end_image_url' || slotId === 'last_frame_url';
  });
}

function hasAdvancedDirectOnlyRequest(params: {
  mode: Mode | string;
  advancedDirectOnlyEnabled?: boolean;
  hdrRequested: boolean;
  exrRequested: boolean;
}): boolean {
  if (params.advancedDirectOnlyEnabled !== true) return false;
  return params.mode === 'v2v' || params.mode === 'reframe' || params.hdrRequested || params.exrRequested;
}

export function resolveLumaAgentsVideoSupport(params: {
  engineId: string;
  mode: Mode | string;
  falPayload: GeneratePayload;
  advancedDirectOnlyEnabled?: boolean;
}): LumaAgentsVideoSupportResult {
  if (!isLumaRay32EngineId(params.engineId)) {
    return { supported: false, route: null, reason: 'unsupported_engine', fallbackCompatible: false };
  }
  const route = resolveLumaAgentsModelRoute({ engineId: params.engineId, mode: params.mode });
  const extra = params.falPayload.extraInputValues ?? {};
  const hdrRequested = booleanValue(extra.hdr);
  const exrRequested = booleanValue(extra.exr_export ?? extra.exrExport);
  const advancedDirectOnlyRequest = hasAdvancedDirectOnlyRequest({
    mode: params.mode,
    advancedDirectOnlyEnabled: params.advancedDirectOnlyEnabled,
    hdrRequested,
    exrRequested,
  });
  const unsupportedFallbackCompatible = advancedDirectOnlyRequest ? false : route.fallbackCompatible;

  if (!isLumaAgentsVideoModeSupported(params.mode, params)) {
    return { supported: false, route, reason: 'unsupported_mode', fallbackCompatible: unsupportedFallbackCompatible };
  }

  const aspectRatio = cleanString(params.falPayload.aspectRatio);
  if (aspectRatio && !DIRECT_ASPECT_RATIOS.has(aspectRatio)) {
    return {
      supported: false,
      route,
      reason: 'aspect_ratio_not_supported',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }

  const resolution = cleanString(params.falPayload.resolution);
  if (resolution && !DIRECT_RESOLUTIONS.has(resolution)) {
    return {
      supported: false,
      route,
      reason: 'resolution_not_supported',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }

  const duration = normalizeDurationOption(params.falPayload);
  if (!DIRECT_DURATIONS.has(duration)) {
    return {
      supported: false,
      route,
      reason: 'duration_not_supported',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }

  if (hasReferenceImages(params.falPayload)) {
    return {
      supported: false,
      route,
      reason: 'reference_images_not_supported',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }

  const hasEndFrame = hasEndImage(params.falPayload);
  if (duration === '10s' && (params.mode === 'i2v' || hasEndFrame || params.falPayload.loop === true)) {
    return {
      supported: false,
      route,
      reason: 'duration_10s_incompatible_with_frames_or_loop',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }
  if (params.falPayload.loop === true && hasEndFrame) {
    return {
      supported: false,
      route,
      reason: 'loop_incompatible_with_end_frame',
      fallbackCompatible: unsupportedFallbackCompatible,
    };
  }
  if (params.advancedDirectOnlyEnabled && duration === '10s' && (hdrRequested || exrRequested)) {
    return { supported: false, route, reason: 'duration_10s_incompatible_with_hdr', fallbackCompatible: false };
  }
  if (params.advancedDirectOnlyEnabled && params.falPayload.loop === true && hdrRequested) {
    return { supported: false, route, reason: 'loop_incompatible_with_direct_options', fallbackCompatible: false };
  }

  return { supported: true, route };
}
