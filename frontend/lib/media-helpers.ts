import imageOptimizer from '@/config/image-optimizer.json';

export type OptimizedPosterOptions = {
  width?: number;
  quality?: number;
};

export const HERO_POSTER_OPTIONS = { width: 1080, quality: 75 } as const;
export const GALLERY_POSTER_OPTIONS = { width: 640, quality: 75 } as const;

const allowedWidths = [...imageOptimizer.imageSizes, ...imageOptimizer.deviceSizes].sort((a, b) => a - b);

function normalizeWidth(width?: number): number {
  if (!Number.isFinite(width) || (width as number) <= 0) return imageOptimizer.defaultWidth;
  return allowedWidths.find((allowedWidth) => allowedWidth >= (width as number)) ?? allowedWidths[allowedWidths.length - 1];
}

// Select the nearest admitted quality; equal distances prefer the lower value.
function normalizeQuality(quality?: number): number {
  if (!Number.isFinite(quality) || (quality as number) <= 0) return imageOptimizer.defaultQuality;
  return imageOptimizer.qualities.reduce((nearest, candidate) =>
    Math.abs(candidate - (quality as number)) < Math.abs(nearest - (quality as number)) ? candidate : nearest
  );
}

export function buildOptimizedPosterUrl(
  src?: string | null,
  options?: OptimizedPosterOptions
): string | null {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.includes('/_next/image')) return src;
  if (!options || (options.width === undefined && options.quality === undefined)) return src;

  const width = normalizeWidth(options.width);
  const quality = normalizeQuality(options.quality);
  const encoded = encodeURIComponent(src);
  return `/_next/image?url=${encoded}&w=${width}&q=${quality}`;
}

export function buildExamplePosterProjection(src: string | null | undefined, fallback: string) {
  return {
    heroPosterUrl: buildOptimizedPosterUrl(src, HERO_POSTER_OPTIONS),
    optimizedPosterUrl: buildOptimizedPosterUrl(src, GALLERY_POSTER_OPTIONS),
    rawPosterUrl: src ?? fallback,
  };
}

/** Private, signed and unknown sources must not pass through the public image optimizer. */
export function isOptimizablePublicMediaUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.origin === 'https://media.maxvideoai.com' && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}

/** Native posters have no srcset; optimize only the public, unsigned media CDN. */
export function buildPublicVideoPosterUrl(src?: string | null): string | null {
  if (!src) return null;
  return isOptimizablePublicMediaUrl(src) ? buildOptimizedPosterUrl(src, HERO_POSTER_OPTIONS) : src;
}
