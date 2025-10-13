function resolveBaseUrl(): string {
  const explicit = process.env.FAL_PROXY_BASE_URL;
  if (explicit && explicit.trim().length) {
    return explicit.replace(/\/$/, '');
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  const base = siteUrl && siteUrl.trim().length ? siteUrl : 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

export function getFalProxyBase(): string {
  return resolveBaseUrl();
}

export function buildFalProxyUrl(pathname: string): string {
  return `${getFalProxyBase()}/api/fal/proxy${pathname}`;
}

