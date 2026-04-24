export type GptImage2Quality = 'low' | 'medium' | 'high';

export type GptImage2ImageSize = {
  width: number;
  height: number;
};

export type GptImage2PricingTier = {
  billingKey: string;
  requestedKey: string;
  width: number;
  height: number;
  prices: Record<GptImage2Quality, number>;
  estimatedFromNearestCanonical: boolean;
};

export const GPT_IMAGE_2_DEFAULT_QUALITY: GptImage2Quality = 'high';
export const GPT_IMAGE_2_DEFAULT_IMAGE_SIZE = 'landscape_4_3';

export const GPT_IMAGE_2_SIZE_CONSTRAINTS = {
  defaultWidth: 1024,
  defaultHeight: 768,
  minPixels: 655_360,
  maxPixels: 8_294_400,
  maxEdge: 3840,
  maxAspectRatio: 3,
  multipleOf: 16,
} as const;

export const GPT_IMAGE_2_CANONICAL_SIZE_VALUES = [
  '1024x768',
  '1024x1024',
  '1024x1536',
  '1920x1080',
  '2560x1440',
  '3840x2160',
] as const;

export const GPT_IMAGE_2_PRICE_TABLE_CENTS: Record<string, Record<GptImage2Quality, number>> = {
  '1024x768': { low: 1, medium: 4, high: 15 },
  '1024x1024': { low: 1, medium: 6, high: 22 },
  '1024x1536': { low: 1, medium: 5, high: 17 },
  '1920x1080': { low: 1, medium: 4, high: 16 },
  '2560x1440': { low: 1, medium: 6, high: 23 },
  '3840x2160': { low: 2, medium: 11, high: 41 },
};

const GPT_IMAGE_2_PRESET_SIZE_MAP: Record<string, GptImage2ImageSize & { billingKey: string }> = {
  auto: { width: 1024, height: 1024, billingKey: '1024x1024' },
  square: { width: 1024, height: 1024, billingKey: '1024x1024' },
  square_hd: { width: 1024, height: 1024, billingKey: '1024x1024' },
  portrait_4_3: { width: 768, height: 1024, billingKey: '1024x768' },
  landscape_4_3: { width: 1024, height: 768, billingKey: '1024x768' },
  portrait_16_9: { width: 1024, height: 1536, billingKey: '1024x1536' },
  landscape_16_9: { width: 1920, height: 1080, billingKey: '1920x1080' },
};

const GPT_IMAGE_2_CANONICAL_SIZES = GPT_IMAGE_2_CANONICAL_SIZE_VALUES.map((key) => {
  const [width, height] = key.split('x').map(Number);
  return {
    key,
    width,
    height,
    area: width * height,
    aspect: Math.max(width, height) / Math.min(width, height),
    prices: GPT_IMAGE_2_PRICE_TABLE_CENTS[key],
  };
});

export function normalizeGptImage2Quality(value: string | null | undefined): GptImage2Quality {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'low' || normalized === 'medium' || normalized === 'high'
    ? normalized
    : GPT_IMAGE_2_DEFAULT_QUALITY;
}

export function parseGptImage2SizeKey(value: string | null | undefined): GptImage2ImageSize | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const match = /^(\d{2,5})x(\d{2,5})$/.exec(normalized);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

export function formatGptImage2SizeKey(size: GptImage2ImageSize): string {
  return `${Math.round(size.width)}x${Math.round(size.height)}`;
}

export function getGptImage2PresetSize(value: string | null | undefined): GptImage2ImageSize | null {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const preset = GPT_IMAGE_2_PRESET_SIZE_MAP[normalized];
  return preset ? { width: preset.width, height: preset.height } : null;
}

export function validateGptImage2CustomImageSize(value: unknown):
  | { ok: true; size: GptImage2ImageSize }
  | { ok: false; code: string; message: string; detail: Record<string, unknown> } {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const width = typeof record?.width === 'number' ? record.width : Number(record?.width);
  const height = typeof record?.height === 'number' ? record.height : Number(record?.height);
  const constraints = GPT_IMAGE_2_SIZE_CONSTRAINTS;

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return {
      ok: false,
      code: 'image_size_missing',
      message: 'Custom image size requires numeric width and height.',
      detail: { constraints },
    };
  }

  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  const size = { width: roundedWidth, height: roundedHeight };
  const area = roundedWidth * roundedHeight;
  const maxEdge = Math.max(roundedWidth, roundedHeight);
  const minEdge = Math.min(roundedWidth, roundedHeight);
  const aspectRatio = maxEdge / Math.max(1, minEdge);

  if (roundedWidth <= 0 || roundedHeight <= 0) {
    return {
      ok: false,
      code: 'image_size_positive',
      message: 'Custom image width and height must be positive.',
      detail: { size, constraints },
    };
  }

  if (roundedWidth % constraints.multipleOf !== 0 || roundedHeight % constraints.multipleOf !== 0) {
    return {
      ok: false,
      code: 'image_size_multiple',
      message: `GPT Image 2 custom sizes must use dimensions divisible by ${constraints.multipleOf}.`,
      detail: { size, constraints },
    };
  }

  if (maxEdge > constraints.maxEdge) {
    return {
      ok: false,
      code: 'image_size_max_edge',
      message: `GPT Image 2 custom sizes support a maximum edge of ${constraints.maxEdge}px.`,
      detail: { size, constraints },
    };
  }

  if (area < constraints.minPixels || area > constraints.maxPixels) {
    return {
      ok: false,
      code: 'image_size_area',
      message: `GPT Image 2 custom sizes must be between ${constraints.minPixels} and ${constraints.maxPixels} pixels.`,
      detail: { size, area, constraints },
    };
  }

  if (aspectRatio > constraints.maxAspectRatio) {
    return {
      ok: false,
      code: 'image_size_aspect_ratio',
      message: `GPT Image 2 custom sizes must keep aspect ratio within ${constraints.maxAspectRatio}:1.`,
      detail: { size, aspectRatio, constraints },
    };
  }

  return { ok: true, size };
}

function findExactCanonicalSize(size: GptImage2ImageSize) {
  return GPT_IMAGE_2_CANONICAL_SIZES.find(
    (candidate) =>
      (candidate.width === size.width && candidate.height === size.height) ||
      (candidate.width === size.height && candidate.height === size.width)
  );
}

function findNearestCanonicalSize(size: GptImage2ImageSize) {
  const area = size.width * size.height;
  const aspect = Math.max(size.width, size.height) / Math.min(size.width, size.height);
  return GPT_IMAGE_2_CANONICAL_SIZES.reduce((best, candidate) => {
    const areaDistance = Math.abs(Math.log(area / candidate.area));
    const aspectDistance = Math.abs(Math.log(aspect / candidate.aspect));
    const score = areaDistance + aspectDistance * 3;
    if (!best || score < best.score) {
      return { candidate, score };
    }
    return best;
  }, null as { candidate: (typeof GPT_IMAGE_2_CANONICAL_SIZES)[number]; score: number } | null)?.candidate;
}

export function resolveGptImage2PricingTier(
  imageSize: string | null | undefined,
  customImageSize?: GptImage2ImageSize | null
): GptImage2PricingTier {
  const normalized = typeof imageSize === 'string' ? imageSize.trim().toLowerCase() : '';
  const parsedSize = parseGptImage2SizeKey(normalized);
  const preset = GPT_IMAGE_2_PRESET_SIZE_MAP[normalized] ?? GPT_IMAGE_2_PRESET_SIZE_MAP[GPT_IMAGE_2_DEFAULT_IMAGE_SIZE];
  const requestedSize =
    customImageSize && normalized === 'custom'
      ? customImageSize
      : parsedSize ?? { width: preset.width, height: preset.height };
  const exact = normalized !== 'custom' && !parsedSize ? null : findExactCanonicalSize(requestedSize);
  const presetBilling = !parsedSize && normalized !== 'custom' ? preset.billingKey : null;
  const canonical = presetBilling
    ? GPT_IMAGE_2_CANONICAL_SIZES.find((candidate) => candidate.key === presetBilling)
    : exact ?? findNearestCanonicalSize(requestedSize);
  const fallback = GPT_IMAGE_2_CANONICAL_SIZES[0];
  const billing = canonical ?? fallback;

  return {
    billingKey: billing.key,
    requestedKey: normalized || GPT_IMAGE_2_DEFAULT_IMAGE_SIZE,
    width: requestedSize.width,
    height: requestedSize.height,
    prices: billing.prices,
    estimatedFromNearestCanonical: Boolean(!presetBilling && !exact),
  };
}
