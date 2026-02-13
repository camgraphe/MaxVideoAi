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
  const configuredOrigin =
    toOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
    toOrigin(process.env.SITE_URL) ??
    toOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    toOrigin(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_SITE_ORIGIN;
  }

  return configuredOrigin ?? PRODUCTION_SITE_ORIGIN;
}

export const SITE_ORIGIN = resolveSiteOrigin();
export const CANONICAL_PRODUCTION_ORIGIN = PRODUCTION_SITE_ORIGIN;
