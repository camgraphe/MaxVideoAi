const PROTECTED_PREFIXES = [
  '/account', '/app', '/dashboard', '/generate', '/jobs', '/billing',
  '/settings', '/video', '/library', '/connect', '/admin',
];

export function isFocusResyncPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldResyncKey(key: unknown): boolean {
  if (typeof key === 'string') {
    if (key.startsWith('/api/media-library/')) return false;
    return key.startsWith('/api/') || key.startsWith('static-engines:');
  }
  if (Array.isArray(key)) {
    const head = key[0];
    return head === 'engines' || head === 'jobs' || head === 'image-pricing';
  }
  return false;
}
