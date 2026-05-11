export const SEEDREAM_BASE_RESOLUTION_VALUES = ['2K', '3K', '4K'] as const;

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

export function resolveSeedreamProviderSize(resolution: string, aspectRatio?: string | null): string {
  const normalizedResolution = resolution.trim();
  const baseResolution = normalizeSeedreamBaseResolution(normalizedResolution);
  const normalizedAspectRatio = normalizeSeedreamAspectRatio(aspectRatio);
  if (!baseResolution || !normalizedAspectRatio) {
    return normalizedResolution;
  }
  return SEEDREAM_RECOMMENDED_SIZE_BY_RESOLUTION[baseResolution][normalizedAspectRatio] ?? normalizedResolution;
}
