import type { AppLocale } from '@/i18n/locales';
import { defaultLocale, localePathnames, localeRegions, locales } from '@/i18n/locales';
import { HREFLANG_VARIANTS } from '@/lib/seo/alternateLocales';

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

export type LocaleSlugMap = Partial<Record<AppLocale, string>>;

type MetadataUrlOptions = {
  availableLocales?: AppLocale[];
};

function buildLocalePath(target: AppLocale, slug?: string) {
  const prefix = localePathnames[target] ? `/${localePathnames[target]}` : '';
  const normalizedSlug = slug ? `/${slug.replace(/^\/+/, '')}` : '';
  const pathname = `${prefix}${normalizedSlug}` || '';
  return pathname || '';
}

function buildAbsoluteUrl(pathname: string) {
  const normalized = pathname || '';
  if (!normalized || normalized === '/' || normalized === '') {
    return SITE_BASE_URL;
  }
  return `${SITE_BASE_URL}${normalized}`;
}

export function buildMetadataUrls(locale: AppLocale, slugMap?: LocaleSlugMap, options?: MetadataUrlOptions) {
  const resolveRegion = (target: AppLocale) => localeRegions[target] ?? localeRegions[defaultLocale];
  const publishable = new Set<AppLocale>((options?.availableLocales ?? locales) as AppLocale[]);
  const allowed = new Set<AppLocale>(publishable);
  allowed.add(locale);

  const urls: Partial<Record<AppLocale, string>> = {};
  Array.from(allowed).forEach((target) => {
    const slug = slugMap?.[target];
    const path = buildLocalePath(target, slug) || '/';
    urls[target] = buildAbsoluteUrl(path);
  });

  const canonical = urls[locale] ?? buildAbsoluteUrl('/');
  const languages: Record<string, string> = {};
  HREFLANG_VARIANTS.forEach((variant) => {
    if (!publishable.has(variant.locale)) {
      return;
    }
    const href = urls[variant.locale];
    if (href) {
      languages[variant.hreflang] = href;
    }
  });
  languages['x-default'] = urls[defaultLocale] ?? buildAbsoluteUrl('/');

  const ogLocale = resolveRegion(locale).replace('-', '_');
  const alternateOg = Array.from(allowed)
    .filter((code) => code !== locale)
    .map((code) => resolveRegion(code).replace('-', '_'));

  return {
    urls,
    languages,
    canonical,
    ogLocale,
    alternateOg,
  };
}
