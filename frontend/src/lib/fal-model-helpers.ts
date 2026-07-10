import { listFalEngines } from '@/config/falEngines';
import type { GeneratePayload } from '@/lib/fal-types';

const ENGINE_MODE_MODEL_MAP = (() => {
  const map = new Map<string, Map<string, string>>();
  listFalEngines().forEach((engine) => {
    const modeMap = new Map<string, string>();
    engine.modes.forEach((mode) => {
      modeMap.set(mode.mode, mode.falModelId);
    });
    map.set(engine.id, modeMap);
  });
  return map;
})();

const STRING_ENUM_DURATION_MODEL_PATTERN =
  /^(?:bytedance\/seedance-2\.0(?:\/fast)?\/|wan\/v2\.6\/(?:text-to-video|image-to-video|reference-to-video)$|fal-ai\/kling-video\/(?:v3|o3)\/(?:pro|standard|4k)\/(?:text-to-video|image-to-video|reference-to-video)$)/i;
const FAL_GOOGLE_VEO_31_EXTEND_MODEL_PATTERN = /^fal-ai\/veo3\.1(?:\/(?:fast|lite))?\/extend-video$/i;
const GOOGLE_VEO_31_ENGINE_PATTERN = /^veo-3-1(?:-(?:fast|lite))?$/i;
const FAL_GOOGLE_VEO_31_EXTEND_RESOLUTION = '720p';

function normalizeStringEnumDurationValue(duration: number | string): string {
  if (typeof duration === 'number') {
    return String(Math.round(duration));
  }

  const trimmed = duration.trim();
  if (/^\d+(?:\.\d+)?s?$/i.test(trimmed)) {
    return String(Math.round(Number(trimmed.replace(/s$/i, ''))));
  }
  return trimmed;
}

export function normalizeFalDurationValueForModel(
  engineId: string,
  modelSlug: string,
  duration: number | string
): number | string {
  if (
    STRING_ENUM_DURATION_MODEL_PATTERN.test(modelSlug) ||
    engineId === 'seedance-1-5-pro' ||
    engineId.startsWith('seedance-2-0') ||
    engineId === 'wan-2-6'
  ) {
    return normalizeStringEnumDurationValue(duration);
  }

  if (engineId.startsWith('kling-3') || engineId.startsWith('kling-o3')) {
    return normalizeStringEnumDurationValue(duration);
  }

  if (typeof duration === 'string') {
    return duration;
  }

  return duration;
}

function normalizeFalVideoResolution(value: string | undefined): string | undefined {
  if (!value) return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === '4k') return '2160p';
  return value;
}

export function resolveFalVideoResolutionInput(
  engineId: string,
  value: string | undefined,
  modelSlug?: string,
  mode?: string
): string | undefined {
  if (engineId.startsWith('kling-')) {
    return undefined;
  }
  if (
    GOOGLE_VEO_31_ENGINE_PATTERN.test(engineId) &&
    (mode === 'extend' || FAL_GOOGLE_VEO_31_EXTEND_MODEL_PATTERN.test(modelSlug ?? ''))
  ) {
    return FAL_GOOGLE_VEO_31_EXTEND_RESOLUTION;
  }
  return normalizeFalVideoResolution(value);
}

export function resolveFalModelSlug(payload: GeneratePayload, fallback?: string): string | undefined {
  const baseSlug = fallback;
  const modeKey = typeof payload.mode === 'string' ? payload.mode : undefined;
  const mapped =
    modeKey && payload.engineId ? ENGINE_MODE_MODEL_MAP.get(payload.engineId)?.get(modeKey) : undefined;
  if (mapped) {
    return mapped;
  }
  const mode = (() => {
    switch (payload.mode) {
      case 'i2v':
        return 'image-to-video';
      case 'ref2v':
        return 'reference-to-video';
      case 'fl2v':
        return 'first-last-frame-to-video';
      case 'v2v':
        return 'modify';
      case 'a2v':
        return 'audio-to-video';
      case 'extend':
        return 'extend-video';
      case 'retake':
        return 'retake-video';
      case 'reframe':
        return 'reframe';
      default:
        return 'text-to-video';
    }
  })();

  if (payload.engineId === 'sora-2') {
    return `fal-ai/sora-2/${mode}`;
  }

  if (payload.engineId === 'sora-2-pro') {
    return `fal-ai/sora-2/${mode}/pro`;
  }

  if (!baseSlug) {
    return undefined;
  }

  const stripVariantSuffix = (slug: string) => slug.replace(/\/(text-to-video|image-to-video|modify|reframe)$/i, '');
  const normalized = baseSlug.replace(/\/+$/, '');

  if (payload.engineId === 'lumaDM') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/luma-dream-machine') ? root : `${root}/luma-dream-machine`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/ray-2') ? root : `${root.replace(/\/ray-2$/, '')}/ray-2`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2_flash') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/ray-2-flash') ? root : `${root.replace(/\/ray-2-flash$/, '')}/ray-2-flash`;
    return mode === 'image-to-video' ? `${base}/image-to-video` : base;
  }

  if (payload.engineId === 'lumaRay2_modify') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/modify') ? root : `${root.replace(/\/modify$/, '')}/modify`;
    return base;
  }

  if (payload.engineId === 'lumaRay2_reframe') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/reframe') ? root : `${root.replace(/\/reframe$/, '')}/reframe`;
    return base;
  }

  if (payload.engineId === 'lumaRay2_flash_reframe') {
    const root = stripVariantSuffix(normalized);
    const base = root.endsWith('/reframe') ? root : `${root.replace(/\/reframe$/, '')}/reframe`;
    return base;
  }

  return baseSlug;
}
