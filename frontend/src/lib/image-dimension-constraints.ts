export type ImageDimensions = {
  width: number;
  height: number;
};

export type ImageDimensionViolation = ImageDimensions & {
  minimumSidePx: number;
  message: string;
};

export function normalizeMinimumImageSide(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

export function normalizeImageDimension(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function getImageDimensionViolation(params: {
  width: unknown;
  height: unknown;
  minimumSidePx: unknown;
  engineLabel: string;
}): ImageDimensionViolation | null {
  const width = normalizeImageDimension(params.width);
  const height = normalizeImageDimension(params.height);
  const minimumSidePx = normalizeMinimumImageSide(params.minimumSidePx);
  if (width == null || height == null || minimumSidePx == null) return null;
  if (width >= minimumSidePx && height >= minimumSidePx) return null;

  return {
    width,
    height,
    minimumSidePx,
    message:
      `This image is ${width} x ${height} px. ` +
      `${params.engineLabel} requires at least ${minimumSidePx} x ${minimumSidePx} px. ` +
      'Choose a larger image and try again.',
  };
}
