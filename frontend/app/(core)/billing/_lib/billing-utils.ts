export function formatReceiptSurfaceLabel(surface?: string | null): string | null {
  switch ((surface ?? '').toLowerCase()) {
    case 'video':
      return 'Video';
    case 'image':
      return 'Image';
    case 'character':
      return 'Character';
    case 'angle':
      return 'Angle';
    case 'upscale':
      return 'Upscale';
    case 'audio':
      return 'Audio';
    default:
      return null;
  }
}

export function parseAmountToCents(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}
