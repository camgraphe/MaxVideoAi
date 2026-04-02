const DURATION_LABELS = ['5s', '9s'] as const;
const RESOLUTION_VALUES = ['540p', '720p', '1080p'] as const;
const GENERATE_ASPECT_VALUES = ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'] as const;
const REFRAME_ASPECT_VALUES = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'] as const;
const LUMA_RAY2_ENGINE_IDS = ['lumaRay2', 'lumaRay2_flash'] as const;
const LUMA_RAY2_GENERATE_MODES = ['t2v', 'i2v'] as const;
const LUMA_RAY2_EDIT_MODES = ['v2v', 'reframe'] as const;

export type LumaRay2DurationLabel = (typeof DURATION_LABELS)[number];
export type LumaRay2ResolutionValue = (typeof RESOLUTION_VALUES)[number];
export type LumaRay2EngineId = (typeof LUMA_RAY2_ENGINE_IDS)[number];
export type LumaRay2GenerateMode = (typeof LUMA_RAY2_GENERATE_MODES)[number];
export type LumaRay2EditMode = (typeof LUMA_RAY2_EDIT_MODES)[number];

const DURATION_FACTORS: Record<LumaRay2DurationLabel, number> = {
  '5s': 1,
  '9s': 2,
};

const RESOLUTION_FACTORS: Record<LumaRay2ResolutionValue, number> = {
  '540p': 1,
  '720p': 2,
  '1080p': 4,
};

export const LUMA_RAY2_ERROR_UNSUPPORTED =
  'Luma Ray 2 and Ray 2 Flash support only 5 s / 9 s durations and 540p / 720p / 1080p resolutions.';

export function isLumaRay2EngineId(value: string | null | undefined): value is LumaRay2EngineId {
  if (!value) return false;
  return LUMA_RAY2_ENGINE_IDS.some((engineId) => engineId === value);
}

export function isLumaRay2GenerateMode(value: string | null | undefined): value is LumaRay2GenerateMode {
  if (!value) return false;
  return LUMA_RAY2_GENERATE_MODES.some((mode) => mode === value);
}

export function isLumaRay2EditMode(value: string | null | undefined): value is LumaRay2EditMode {
  if (!value) return false;
  return LUMA_RAY2_EDIT_MODES.some((mode) => mode === value);
}

export function getLumaRay2DurationInfo(
  raw: number | string | null | undefined
): { label: LumaRay2DurationLabel; seconds: number; factor: number } | null {
  if (raw == null) return null;
  const normalised = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  if (typeof normalised === 'number') {
    if (normalised === 5) {
      return { label: '5s', seconds: 5, factor: DURATION_FACTORS['5s'] };
    }
    if (normalised === 9) {
      return { label: '9s', seconds: 9, factor: DURATION_FACTORS['9s'] };
    }
    return null;
  }
  const label = normalised.endsWith('s') ? normalised : `${normalised}s`;
  if (label === '5s') {
    return { label: '5s', seconds: 5, factor: DURATION_FACTORS['5s'] };
  }
  if (label === '9s') {
    return { label: '9s', seconds: 9, factor: DURATION_FACTORS['9s'] };
  }
  return null;
}

export function getLumaRay2ResolutionInfo(
  raw: string | null | undefined
): { value: LumaRay2ResolutionValue; factor: number } | null {
  if (!raw) return null;
  const normalised = raw.trim().toLowerCase();
  for (const value of RESOLUTION_VALUES) {
    if (value.toLowerCase() === normalised) {
      return { value, factor: RESOLUTION_FACTORS[value] };
    }
  }
  return null;
}

export function isLumaRay2AspectRatio(
  value: string | null | undefined,
  options?: { includeSquare?: boolean }
): boolean {
  if (!value) return false;
  const normalised = value.trim().toLowerCase();
  const allowed = options?.includeSquare ? REFRAME_ASPECT_VALUES : GENERATE_ASPECT_VALUES;
  return allowed.some((entry) => entry.toLowerCase() === normalised);
}

export function listLumaRay2Durations(): LumaRay2DurationLabel[] {
  return [...DURATION_LABELS];
}

export function listLumaRay2Resolutions(): LumaRay2ResolutionValue[] {
  return [...RESOLUTION_VALUES];
}

export function listLumaRay2AspectRatios(): string[] {
  return [...GENERATE_ASPECT_VALUES];
}

export function listLumaRay2ReframeAspectRatios(): string[] {
  return [...REFRAME_ASPECT_VALUES];
}

export function toLumaRay2DurationLabel(
  seconds: number | null | undefined,
  fallback?: LumaRay2DurationLabel
): LumaRay2DurationLabel | null {
  if (seconds === 5) return '5s';
  if (seconds === 9) return '9s';
  return fallback ?? null;
}

export function normaliseLumaRay2Loop(value: unknown): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (normalised === 'true') return true;
    if (normalised === 'false') return false;
  }
  return undefined;
}

export function ensureLumaRay2Aspect(aspect: string | null | undefined): string {
  if (aspect && isLumaRay2AspectRatio(aspect)) return aspect;
  return '16:9';
}

export function ensureLumaRay2Resolution(resolution: string | null | undefined): LumaRay2ResolutionValue {
  const info = getLumaRay2ResolutionInfo(resolution);
  if (info) return info.value;
  return '540p';
}
