export type AspectRatioParts = {
  width: number;
  height: number;
};

const NAMED_RATIOS: Record<string, AspectRatioParts> = {
  square: { width: 1, height: 1 },
  portrait: { width: 3, height: 4 },
  landscape: { width: 16, height: 9 },
};

function normalize(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export function parseAspectRatio(value?: string | null): AspectRatioParts | null {
  const normalized = normalize(value);
  if (!normalized || normalized === 'auto' || normalized === 'dynamic') return null;

  const named = NAMED_RATIOS[normalized];
  if (named) return named;

  const match = normalized.match(/^(\d+(?:\.\d+)?)[/:](\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

export function getAspectRatioNumber(value?: string | null, fallback = 16 / 9): number {
  const parsed = parseAspectRatio(value);
  if (!parsed) return fallback;
  return parsed.width / parsed.height;
}

export function getAspectRatioString(value?: string | null, fallback = '16 / 9'): string {
  const parsed = parseAspectRatio(value);
  if (!parsed) return fallback;
  return `${parsed.width} / ${parsed.height}`;
}
