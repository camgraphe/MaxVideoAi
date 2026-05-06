const PRODUCTION_SITE_ORIGIN = 'https://maxvideoai.com';

function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.pathname = '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveSiteOrigin(): string {
  const vercelEnv = process.env.VERCEL_ENV?.trim().toLowerCase() ?? '';
  const configuredOrigin =
    toOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    toOrigin(process.env.SITE_URL) ??
    toOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  if (vercelEnv === 'production') {
    return PRODUCTION_SITE_ORIGIN;
  }

  return configuredOrigin ?? PRODUCTION_SITE_ORIGIN;
}

export const SITE_ORIGIN = resolveSiteOrigin();
export const CANONICAL_PRODUCTION_ORIGIN = PRODUCTION_SITE_ORIGIN;

export function shouldCanonicalizeBrowserAuthOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.toLowerCase() === 'www.maxvideoai.com';
}

export function canonicalizeBrowserAuthOrigin(): boolean {
  if (!shouldCanonicalizeBrowserAuthOrigin()) return false;
  const url = new URL(window.location.href);
  url.hostname = new URL(CANONICAL_PRODUCTION_ORIGIN).hostname;
  window.location.replace(url.toString());
  return true;
}
