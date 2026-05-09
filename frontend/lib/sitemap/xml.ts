import { SITE_ORIGIN } from '@/lib/siteOrigin';

const SITE_URL = SITE_ORIGIN.replace(/\/+$/, '');

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function buildAbsoluteUrl(pathname: string): string {
  const normalized = pathname === '/' ? '/' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (normalized === '/' || normalized === '') {
    return SITE_URL;
  }
  return `${SITE_URL}${normalized}`;
}
