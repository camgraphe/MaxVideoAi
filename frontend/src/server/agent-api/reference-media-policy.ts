export const SUPPORTED_REFERENCE_RASTER_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type SupportedReferenceRasterMime =
  (typeof SUPPORTED_REFERENCE_RASTER_MIME_TYPES)[number];

const REFERENCE_RASTER_MIME_ALIASES = new Map<string, SupportedReferenceRasterMime>([
  ['image/avif', 'image/avif'],
  ['image/gif', 'image/gif'],
  ['image/jpeg', 'image/jpeg'],
  ['image/jpg', 'image/jpeg'],
  ['image/pjpeg', 'image/jpeg'],
  ['image/png', 'image/png'],
  ['image/webp', 'image/webp'],
]);

export function normalizeSupportedReferenceRasterMime(
  value: unknown,
): SupportedReferenceRasterMime | null {
  if (typeof value !== 'string') return null;
  const mimeType = value.split(';')[0]?.trim().toLowerCase() ?? '';
  return REFERENCE_RASTER_MIME_ALIASES.get(mimeType) ?? null;
}
