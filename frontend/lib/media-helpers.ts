export function buildOptimizedPosterUrl(src?: string | null): string | null {
  if (!src) return null;
  return src;
}

export function buildNextImageProxyUrl(
  src?: string | null,
  options?: { width?: number; quality?: number }
): string | null {
  if (!src) return null;
  const width = options?.width ?? 1200;
  const quality = options?.quality ?? 80;
  const encoded = encodeURIComponent(src);
  return `/_next/image?url=${encoded}&w=${width}&q=${quality}`;
}
