export function normalizeMediaUrl(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('/')) return trimmed;
  if (!trimmed.includes('://')) {
    return `/${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

export function isPlaceholderMediaUrl(value?: string | null): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('data:') || normalized.startsWith('blob:')) return false;
  return (
    normalized.startsWith('/assets/') ||
    normalized.includes('/assets/frames/') ||
    normalized.includes('/assets/gallery/')
  );
}
