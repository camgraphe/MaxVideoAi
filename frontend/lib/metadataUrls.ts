import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, localePathnames, localeRegions, locales } from '@/i18n/locales';

function resolveSiteBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'https://maxvideoai.com';
  try {
    const normalized = new URL(configured);
    normalized.pathname = '/';
    normalized.search = '';
    normalized.hash = '';
    return normalized.origin;
  } catch {
    return 'https://maxvideoai.com';
  }
}

export const SITE_BASE_URL = resolveSiteBaseUrl();

export type LocaleSlugMap = Record<AppLocale, string>;

function buildLocalePath(target: AppLocale, slug?: string) {
  const prefix = localePathnames[target] ? `/${localePathnames[target]}` : '';
  const normalizedSlug = slug ? `/${slug.replace(/^\/+/, '')}` : '';
  const pathname = `${prefix}${normalizedSlug}` || '';
  return pathname || '';
}

function buildAbsoluteUrl(pathname: string) {
  const normalized = pathname || '';
  if (!normalized || normalized === '/') {
    return `${SITE_BASE_URL}/`;
  }
  return `${SITE_BASE_URL}${normalized}`;
}

export function buildMetadataUrls(locale: AppLocale, slugMap?: LocaleSlugMap) {
  const resolveRegion = (target: AppLocale) => localeRegions[target] ?? localeRegions[defaultLocale];
  const buildUrl = (target: AppLocale) => {
    const slug = slugMap?.[target];
    const path = buildLocalePath(target, slug) || '/';
    return buildAbsoluteUrl(path === '/' ? '' : path);
  };

  const urls = {
    en: buildUrl('en'),
    fr: buildUrl('fr'),
    es: buildUrl('es'),
  };

  const languages = {
    en: urls.en,
    fr: urls.fr,
    es: urls.es,
    'x-default': urls.en,
  };

  const ogLocale = resolveRegion(locale).replace('-', '_');
  const alternateOg = locales
    .filter((code) => code !== locale)
    .map((code) => resolveRegion(code).replace('-', '_'));

  return {
    urls,
    languages,
    canonical: urls[locale],
    ogLocale,
    alternateOg,
  };
}
