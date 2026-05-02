export function normalizeMediaUrl(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    const rewritten = rewriteManagedStorageUrl(trimmed);
    return rewritten ?? trimmed;
  }
  if (trimmed.startsWith('//')) {
    const absolute = `https:${trimmed}`;
    return rewriteManagedStorageUrl(absolute) ?? absolute;
  }
  if (trimmed.startsWith('/')) return trimmed;
  if (!trimmed.includes('://')) {
    return `/${trimmed.replace(/^\/+/, '')}`;
  }
  return trimmed;
}

function rewriteManagedStorageUrl(url: string): string | null {
  const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  if (!publicBase || !bucket) return null;

  try {
    const parsed = new URL(url);
    const base = new URL(publicBase);
    if (parsed.host === base.host) return url;

    const region = process.env.S3_REGION?.trim();
    const managedHosts = new Set([
      `${bucket}.s3.amazonaws.com`,
      `${bucket}.s3.${region}.amazonaws.com`,
    ]);
    if (!managedHosts.has(parsed.host)) return null;

    return `${publicBase.replace(/\/+$/, '')}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
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

export function resolvePreferredMediaUrl(...candidates: Array<string | null | undefined>): string | null {
  let fallback: string | null = null;
  for (const candidate of candidates) {
    const normalized = normalizeMediaUrl(candidate);
    if (!normalized) continue;
    if (!fallback) {
      fallback = normalized;
    }
    if (!isPlaceholderMediaUrl(normalized)) {
      return normalized;
    }
  }
  return fallback;
}
