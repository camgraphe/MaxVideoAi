type OptimizedPosterOptions = {
  width?: number;
  quality?: number;
};

export function buildOptimizedPosterUrl(src?: string | null, options?: OptimizedPosterOptions): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  if (!options) return trimmed;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/_next/image') || /\.svg($|[?#])/.test(trimmed)) {
    return trimmed;
  }
  const width = Math.max(1, Math.round(options.width ?? 1200));
  const quality = Math.min(100, Math.max(1, Math.round(options.quality ?? 65)));
  return `/_next/image?url=${encodeURIComponent(trimmed)}&w=${width}&q=${quality}`;
}
