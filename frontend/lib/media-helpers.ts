export type OptimizedPosterOptions = {
  width?: number;
  quality?: number;
};

export function buildOptimizedPosterUrl(
  src?: string | null,
  options?: OptimizedPosterOptions
): string | null {
  if (!src) return null;
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (src.includes('/_next/image')) return src;
  if (!options || (!options.width && !options.quality)) return src;

  const width = options.width ?? 1200;
  const quality = options.quality ?? 75;
  const encoded = encodeURIComponent(src);
  return `/_next/image?url=${encoded}&w=${width}&q=${quality}`;
}
