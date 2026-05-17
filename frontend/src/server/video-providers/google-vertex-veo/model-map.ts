import type { GeneratePayload } from '@/lib/fal';
import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';

export const GOOGLE_VERTEX_VEO_PROVIDER = 'google_vertex_veo_direct' as const;

export type GoogleVertexVeoEngineId = 'veo-3-1' | 'veo-3-1-fast' | 'veo-3-1-lite';
export type GoogleVertexVeoMode = Extract<Mode, 't2v' | 'i2v' | 'ref2v' | 'fl2v' | 'extend'>;

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
    supportedModes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
    supportsReferenceImages: true,
    supports4k: true,
    defaultAudioEnabled: true,
  },
  'veo-3-1-fast': {
    engineId: 'veo-3-1-fast',
    providerModel: 'veo-3.1-fast-generate-001',
    launchStage: 'ga',
    supportedModes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
    supportsReferenceImages: true,
    supports4k: true,
    defaultAudioEnabled: true,
  },
  'veo-3-1-lite': {
    engineId: 'veo-3-1-lite',
    providerModel: 'veo-3.1-lite-generate-001',
    launchStage: 'preview',
    supportedModes: ['t2v', 'i2v', 'fl2v', 'extend'],
    supportsReferenceImages: false,
    supports4k: false,
    defaultAudioEnabled: true,
  },
};

const SUPPORTED_ASPECT_RATIOS = new Set(['16:9', '9:16']);
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const SUPPORTED_PERSON_GENERATION_VALUES = new Set(['allow_adult', 'dont_allow']);
const SUPPORTED_COMPRESSION_QUALITY_VALUES = new Set(['optimized', 'lossless']);
const SUPPORTED_RESIZE_MODE_VALUES = new Set(['pad', 'crop']);

const GOOGLE_VERTEX_VEO_ASPECT_RATIOS: EngineCaps['aspectRatios'] = ['16:9', '9:16'];
const GOOGLE_VERTEX_VEO_GENERATION_DURATIONS = ['4s', '6s', '8s'];

const GOOGLE_VERTEX_VEO_RUNTIME_OPTIONS: Record<
  GoogleVertexVeoEngineId,
  Pick<EngineCaps, 'modes' | 'resolutions'>
> = {
  'veo-3-1': {
    modes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
    resolutions: ['720p', '1080p', '4k'],
  },
  'veo-3-1-fast': {
    modes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
    resolutions: ['720p', '1080p', '4k'],
  },
  'veo-3-1-lite': {
    modes: ['t2v', 'i2v', 'fl2v', 'extend'],
    resolutions: ['720p', '1080p'],
  },
};

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

function syncGoogleVertexVeoInputField(
  field: EngineInputField,
  runtimeOptions: Pick<EngineCaps, 'modes' | 'resolutions'>
): EngineInputField | null {
  if (field.modes?.length && !field.modes.some((mode) => runtimeOptions.modes.includes(mode))) {
    return null;
  }
  if (field.id === 'image_urls') {
    return { ...field, minCount: 1, maxCount: 3 };
  }
  if (field.id === 'duration' && field.modes?.includes('extend')) {
    return {
      ...field,
      type: 'enum',
      values: ['7s'],
      default: '7s',
      min: undefined,
      max: undefined,
    };
  }
  if (field.id === 'duration') {
    return {
      ...field,
      type: 'enum',
      values: GOOGLE_VERTEX_VEO_GENERATION_DURATIONS,
      default:
        typeof field.default === 'string' && GOOGLE_VERTEX_VEO_GENERATION_DURATIONS.includes(field.default)
          ? field.default
          : '8s',
    };
  }
  if (field.id === 'resolution') {
    return {
      ...field,
      values: runtimeOptions.resolutions,
      default: runtimeOptions.resolutions.includes('720p') ? '720p' : runtimeOptions.resolutions[0] ?? field.default,
    };
  }
  if (field.id === 'aspect_ratio') {
    return {
      ...field,
      values: GOOGLE_VERTEX_VEO_ASPECT_RATIOS,
      default: '16:9',
    };
  }
  return field;
}

export function applyGoogleVertexVeoRuntimeOptions(engine: EngineCaps): EngineCaps {
  if (!isGoogleVertexVeoEngine(engine.id)) {
    return engine;
  }

  const runtimeOptions = GOOGLE_VERTEX_VEO_RUNTIME_OPTIONS[engine.id];
  const modeCaps = engine.modeCaps
    ? Object.fromEntries(
        Object.entries(engine.modeCaps)
          .filter(([mode]) => runtimeOptions.modes.includes(mode as Mode))
          .map(([mode, caps]) => {
            if (!caps) return [mode, caps];
            if (mode === 'extend') {
              return [
                mode,
                {
                  ...caps,
                  modes: ['extend'],
                  duration: { options: ['7s'], default: '7s' },
                  resolution: runtimeOptions.resolutions,
                  aspectRatio: GOOGLE_VERTEX_VEO_ASPECT_RATIOS,
                  audioToggle: true,
                },
              ];
            }
            return [
              mode,
              {
                ...caps,
                modes: [mode as Mode],
                resolution: runtimeOptions.resolutions,
                aspectRatio: GOOGLE_VERTEX_VEO_ASPECT_RATIOS,
                audioToggle: true,
                acceptsImageFormats: caps.acceptsImageFormats ? ['jpg', 'jpeg', 'png'] : caps.acceptsImageFormats,
                maxUploadMB: caps.maxUploadMB ? 20 : caps.maxUploadMB,
              },
            ];
          })
      )
    : engine.modeCaps;

  return {
    ...engine,
    modes: runtimeOptions.modes,
    maxDurationSec: 8,
    resolutions: runtimeOptions.resolutions,
    aspectRatios: GOOGLE_VERTEX_VEO_ASPECT_RATIOS,
    fps: [24],
    audio: true,
    extend: runtimeOptions.modes.includes('extend'),
    inputLimits: {
      ...engine.inputLimits,
      imageMaxMB: 20,
    },
    inputSchema: engine.inputSchema
      ? {
          ...engine.inputSchema,
          required: engine.inputSchema.required
            ?.map((field) => syncGoogleVertexVeoInputField(field, runtimeOptions))
            .filter((field): field is EngineInputField => field != null),
          optional: engine.inputSchema.optional
            ?.map((field) => syncGoogleVertexVeoInputField(field, runtimeOptions))
            .filter(
              (field): field is EngineInputField =>
                field != null && field.id !== 'auto_fix' && field.id !== 'enhance_prompt'
            ),
          constraints: {
            ...engine.inputSchema.constraints,
            supportedFormats: ['jpg', 'jpeg', 'png'],
          },
        }
      : engine.inputSchema,
    modeCaps,
  };
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
  if (params.mode === 'extend') {
    if (!params.falPayload.videoUrl) {
      return { supported: false, route, reason: 'extend_source_video_required' };
    }
  }

  const extraInputValues = params.falPayload.extraInputValues ?? {};
  if (extraInputValues.auto_fix === true || extraInputValues.auto_fix === 'true') {
    return { supported: false, route, reason: 'auto_fix_not_supported' };
  }
  const personGeneration = extraInputValues.person_generation ?? extraInputValues.personGeneration;
  if (typeof personGeneration === 'string' && !SUPPORTED_PERSON_GENERATION_VALUES.has(personGeneration)) {
    return { supported: false, route, reason: 'person_generation_not_supported' };
  }

  const compressionQuality = extraInputValues.compression_quality ?? extraInputValues.compressionQuality;
  if (typeof compressionQuality === 'string' && !SUPPORTED_COMPRESSION_QUALITY_VALUES.has(compressionQuality)) {
    return { supported: false, route, reason: 'compression_quality_not_supported' };
  }

  const resizeMode = extraInputValues.resize_mode ?? extraInputValues.resizeMode;
  if (typeof resizeMode === 'string') {
    if (!SUPPORTED_RESIZE_MODE_VALUES.has(resizeMode)) {
      return { supported: false, route, reason: 'resize_mode_not_supported' };
    }
    if (params.mode !== 'i2v' && params.mode !== 'fl2v') {
      return { supported: false, route, reason: 'resize_mode_not_supported' };
    }
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
