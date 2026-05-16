import type { GeneratePayload } from '@/lib/fal';
import type { Mode } from '@/types/engines';

export const GOOGLE_VERTEX_VEO_PROVIDER = 'google_vertex_veo_direct' as const;

export type GoogleVertexVeoEngineId = 'veo-3-1' | 'veo-3-1-fast' | 'veo-3-1-lite';
export type GoogleVertexVeoMode = Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'fl2v'>;

export type GoogleVertexVeoModelRoute = {
  engineId: GoogleVertexVeoEngineId;
  providerModel: string;
  launchStage: 'ga' | 'preview';
  supportedModes: GoogleVertexVeoMode[];
  supportsReferenceImages: boolean;
  supports4k: boolean;
  defaultAudioEnabled: boolean;
};

export type GoogleVertexVeoSupportResult =
  | { supported: true; route: GoogleVertexVeoModelRoute }
  | { supported: false; reason: string; route: GoogleVertexVeoModelRoute | null };

const GOOGLE_VERTEX_VEO_ROUTES: Record<GoogleVertexVeoEngineId, GoogleVertexVeoModelRoute> = {
  'veo-3-1': {
    engineId: 'veo-3-1',
    providerModel: 'veo-3.1-generate-001',
    launchStage: 'ga',
    supportedModes: ['t2v', 'i2v', 'ref2v', 'fl2v'],
    supportsReferenceImages: true,
    supports4k: true,
    defaultAudioEnabled: true,
  },
  'veo-3-1-fast': {
    engineId: 'veo-3-1-fast',
    providerModel: 'veo-3.1-fast-generate-001',
    launchStage: 'ga',
    supportedModes: ['t2v', 'i2v', 'ref2v', 'fl2v'],
    supportsReferenceImages: true,
    supports4k: true,
    defaultAudioEnabled: true,
  },
  'veo-3-1-lite': {
    engineId: 'veo-3-1-lite',
    providerModel: 'veo-3.1-lite-generate-001',
    launchStage: 'preview',
    supportedModes: ['t2v', 'i2v', 'fl2v'],
    supportsReferenceImages: false,
    supports4k: false,
    defaultAudioEnabled: true,
  },
};

const SUPPORTED_ASPECT_RATIOS = new Set(['16:9', '9:16']);
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export function isGoogleVertexVeoEngine(engineId: string): engineId is GoogleVertexVeoEngineId {
  return engineId in GOOGLE_VERTEX_VEO_ROUTES;
}

export function resolveGoogleVertexVeoModelRoute(engineId: string): GoogleVertexVeoModelRoute {
  if (!isGoogleVertexVeoEngine(engineId)) {
    throw new Error(`Unsupported Google Vertex Veo engine: ${engineId}`);
  }
  return GOOGLE_VERTEX_VEO_ROUTES[engineId];
}

export function isGoogleVertexVeoModeSupported(engineId: string, mode: Mode | string): boolean {
  if (!isGoogleVertexVeoEngine(engineId)) return false;
  return GOOGLE_VERTEX_VEO_ROUTES[engineId].supportedModes.includes(mode as GoogleVertexVeoMode);
}

export function isGoogleVertexVeoSupportedImageMime(mimeType: string | null | undefined): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has((mimeType ?? '').trim().toLowerCase());
}

export function resolveGoogleVertexVeoSupport(params: {
  engineId: string;
  mode: Mode | string;
  falPayload: GeneratePayload;
}): GoogleVertexVeoSupportResult {
  const route = isGoogleVertexVeoEngine(params.engineId) ? GOOGLE_VERTEX_VEO_ROUTES[params.engineId] : null;
  if (!route) {
    return { supported: false, route: null, reason: 'unsupported_engine' };
  }
  if (!route.supportedModes.includes(params.mode as GoogleVertexVeoMode)) {
    return { supported: false, route, reason: 'unsupported_mode' };
  }
  if (params.mode === 'extend') {
    return { supported: false, route, reason: 'extend_phase_1_fal_only' };
  }
  if (params.falPayload.multiPrompt?.length) {
    return { supported: false, route, reason: 'multi_prompt_not_supported' };
  }
  if (params.falPayload.elements?.length) {
    return { supported: false, route, reason: 'provider_elements_not_supported' };
  }
  if (params.falPayload.voiceIds?.length) {
    return { supported: false, route, reason: 'voice_ids_not_supported' };
  }
  if (params.falPayload.audioUrl) {
    return { supported: false, route, reason: 'audio_input_not_supported' };
  }
  if (typeof params.falPayload.cfgScale === 'number') {
    return { supported: false, route, reason: 'cfg_scale_not_supported' };
  }
  if (params.falPayload.cameraFixed != null) {
    return { supported: false, route, reason: 'camera_fixed_not_supported' };
  }
  if (params.falPayload.safetyChecker != null) {
    return { supported: false, route, reason: 'safety_checker_not_supported' };
  }

  const extraInputValues = params.falPayload.extraInputValues ?? {};
  if (extraInputValues.auto_fix === true || extraInputValues.auto_fix === 'true') {
    return { supported: false, route, reason: 'auto_fix_not_supported' };
  }

  const aspectRatio = params.falPayload.aspectRatio;
  if (aspectRatio && !SUPPORTED_ASPECT_RATIOS.has(aspectRatio)) {
    return { supported: false, route, reason: 'aspect_ratio_not_supported' };
  }

  const resolution = params.falPayload.resolution;
  if (resolution && !['720p', '1080p', '4k'].includes(resolution)) {
    return { supported: false, route, reason: 'resolution_not_supported' };
  }
  if (resolution === '4k' && !route.supports4k) {
    return { supported: false, route, reason: 'resolution_not_supported' };
  }

  const referenceImageCount = params.falPayload.referenceImages?.length ?? 0;
  if (params.mode === 'ref2v') {
    if (!route.supportsReferenceImages) {
      return { supported: false, route, reason: 'reference_images_not_supported' };
    }
    if (referenceImageCount > 3) {
      return { supported: false, route, reason: 'too_many_reference_images' };
    }
  }

  const unsupportedInput = params.falPayload.inputs?.find((input) => {
    if (input.kind !== 'image') return false;
    return input.type && !isGoogleVertexVeoSupportedImageMime(input.type);
  });
  if (unsupportedInput) {
    return { supported: false, route, reason: 'image_mime_not_supported' };
  }

  return { supported: true, route };
}

