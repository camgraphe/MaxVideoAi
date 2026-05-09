export function comparePaths(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a === '/') {
    return -1;
  }
  if (b === '/') {
    return 1;
  }
  return a.localeCompare(b);
}

export function canonicalizeCompareSlug(slug: string): string {
  const parts = slug.split('-vs-');
  if (parts.length !== 2) return slug;
  const [left, right] = parts;
  return [left, right].sort().join('-vs-');
}

export function normalizeCompareEnglishPath(pathname: string): string {
  if (!pathname.startsWith('/ai-video-engines/')) {
    return pathname;
  }
  const trimmed = pathname.split('?')[0]?.replace(/\/+$/, '') || '';
  if (!trimmed) {
    return pathname;
  }
  const slug = trimmed.slice('/ai-video-engines/'.length);
  if (!slug || slug.includes('/')) {
    return pathname;
  }
  if (!slug.includes('-vs-')) {
    return pathname;
  }
  const canonicalSlug = canonicalizeCompareSlug(slug);
  return `/ai-video-engines/${canonicalSlug}`;
}
