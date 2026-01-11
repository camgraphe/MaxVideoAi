type OptimizedPosterOptions = {
  width?: number;
  quality?: number;
};

const DEFAULT_POSTER_WIDTH = 1200;
const DEFAULT_POSTER_QUALITY = 70;

export function buildOptimizedPosterUrl(src?: string | null, options: OptimizedPosterOptions = {}): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('/_next/image')) return trimmed;
  if (/\.svg($|[?#])/.test(trimmed)) return trimmed;
  const width = Math.max(1, Math.round(options.width ?? DEFAULT_POSTER_WIDTH));
  const quality = Math.min(100, Math.max(1, Math.round(options.quality ?? DEFAULT_POSTER_QUALITY)));
  return `/_next/image?url=${encodeURIComponent(trimmed)}&w=${width}&q=${quality}`;
}
