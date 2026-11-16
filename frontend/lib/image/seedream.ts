export const SEEDREAM_BASE_RESOLUTION_VALUES = ['2K', '3K', '4K'] as const;
export const SEEDREAM_MAX_REFERENCE_IMAGES = 10;
export const SEEDREAM_MAX_IMAGE_SET_IMAGES = 15;
export const SEEDREAM_SINGLE_IMAGE_RESOLUTION_VALUES = ['1K', '1.5K', '2K'] as const;

export function isSeedreamSingleImageEngineId(id: string): boolean {
  return id === 'seedream-5-0-pro' || id === 'seedream-5-0-flash' || id === 'seedream-5-5';
}

export function isSeedreamEngineId(id: string): boolean {
  return id === 'seedream' || isSeedreamSingleImageEngineId(id);
}

export function seedreamOutputSettingsError(
  engineId: string,
  settings: { background?: string | null; outputFormat?: string | null },
): 'transparent_requires_png' | null {
  return engineId === 'seedream-5-5' && settings.background?.trim().toLowerCase() === 'transparent'
    && settings.outputFormat != null && settings.outputFormat.trim().toLowerCase() !== 'png'
    ? 'transparent_requires_png' : null;
}

/** Input images is the submitted total; references are additional images beyond the main edit source. */
export function seedreamPricingInputCount(context: { mode?: string; inputImageCount?: number; referenceImageCount?: number }): number {
  if (context.mode !== 'i2i') return 0;
  const count = Math.max(1, context.inputImageCount ?? 1) + (context.referenceImageCount ?? 0);
  if (!Number.isSafeInteger(count) || count > SEEDREAM_MAX_REFERENCE_IMAGES) throw new Error('Invalid Seedream input image count.');
  return count;
}

export const SEEDREAM_ASPECT_RATIO_VALUES = [
  'auto',
  '1:1',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
  '3:2',
  '2:3',
  '21:9',
] as const;

export const SEEDREAM_RECOMMENDED_SIZE_VALUES = [
  '2048x2048',
  '2304x1728',
  '1728x2304',
  '2848x1600',
  '1600x2848',
  '2496x1664',
  '1664x2496',
  '3136x1344',
  '3072x3072',
  '3456x2592',
  '2592x3456',
  '4096x2304',
  '2304x4096',
  '2496x3744',
  '3744x2496',
  '4704x2016',
  '4096x4096',
  '3520x4704',
  '4704x3520',
  '5504x3040',
  '3040x5504',
  '3328x4992',
  '4992x3328',
  '6240x2656',
] as const;

export const SEEDREAM_SIZE_VALUES = [
  ...SEEDREAM_BASE_RESOLUTION_VALUES,
  ...SEEDREAM_RECOMMENDED_SIZE_VALUES,
] as const;

const SEEDREAM_RECOMMENDED_SIZE_BY_RESOLUTION = {
  '2K': {
    '1:1': '2048x2048',
    '4:3': '2304x1728',
    '3:4': '1728x2304',
    '16:9': '2848x1600',
    '9:16': '1600x2848',
    '3:2': '2496x1664',
    '2:3': '1664x2496',
    '21:9': '3136x1344',
  },
  '3K': {
    '1:1': '3072x3072',
    '4:3': '3456x2592',
    '3:4': '2592x3456',
    '16:9': '4096x2304',
    '9:16': '2304x4096',
    '2:3': '2496x3744',
    '3:2': '3744x2496',
    '21:9': '4704x2016',
  },
  '4K': {
    '1:1': '4096x4096',
    '3:4': '3520x4704',
    '4:3': '4704x3520',
    '16:9': '5504x3040',
    '9:16': '3040x5504',
    '2:3': '3328x4992',
    '3:2': '4992x3328',
    '21:9': '6240x2656',
  },
} as const;

type SeedreamBaseResolution = keyof typeof SEEDREAM_RECOMMENDED_SIZE_BY_RESOLUTION;
type SeedreamAspectRatio = Exclude<(typeof SEEDREAM_ASPECT_RATIO_VALUES)[number], 'auto'>;

// The latest direct BytePlus models use a different bounded raster table from Lite.
const SEEDREAM_LATEST_SIZE_BY_RESOLUTION = {
  '1K': {
    '1:1': '1024x1024', '4:3': '1152x864', '3:4': '864x1152', '16:9': '1424x800',
    '9:16': '800x1424', '3:2': '1248x832', '2:3': '832x1248', '21:9': '1568x672',
  },
  '1.5K': {
    '1:1': '1536x1536', '4:3': '1792x1344', '3:4': '1344x1792', '16:9': '2048x1152',
    '9:16': '1152x2048', '3:2': '1872x1248', '2:3': '1248x1872', '21:9': '2352x1008',
  },
  '2K': {
    '1:1': '2048x2048', '4:3': '2368x1776', '3:4': '1776x2368', '16:9': '2816x1584',
    '9:16': '1584x2816', '3:2': '2496x1664', '2:3': '1664x2496', '21:9': '3136x1344',
  },
} as const;

function normalizeSeedreamBaseResolution(value: string): SeedreamBaseResolution | null {
  const normalized = value.trim().toUpperCase();
  return normalized === '2K' || normalized === '3K' || normalized === '4K' ? normalized : null;
}

function normalizeSeedreamAspectRatio(value: string | null | undefined): SeedreamAspectRatio | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized === 'auto') return null;
  return SEEDREAM_ASPECT_RATIO_VALUES.includes(normalized as (typeof SEEDREAM_ASPECT_RATIO_VALUES)[number])
    ? (normalized as SeedreamAspectRatio)
    : null;
}

export function resolveSeedreamProviderSize(
  resolution: string,
  aspectRatio?: string | null,
  engineId?: string,
): string {
  const normalizedResolution = resolution.trim();
  const normalizedAspectRatio = normalizeSeedreamAspectRatio(aspectRatio);
  if (engineId === 'seedream-5-5' || engineId === 'seedream-5-0-flash') {
    const tier = normalizedResolution.toUpperCase() as keyof typeof SEEDREAM_LATEST_SIZE_BY_RESOLUTION;
    const sizes = SEEDREAM_LATEST_SIZE_BY_RESOLUTION[tier];
    return sizes && normalizedAspectRatio ? sizes[normalizedAspectRatio] : normalizedResolution;
  }
  const baseResolution = normalizeSeedreamBaseResolution(normalizedResolution);
  if (!baseResolution || !normalizedAspectRatio) {
    return normalizedResolution;
  }
  return SEEDREAM_RECOMMENDED_SIZE_BY_RESOLUTION[baseResolution][normalizedAspectRatio] ?? normalizedResolution;
}
