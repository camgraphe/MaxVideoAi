import { localizePathFromEnglish } from '@/lib/i18n/paths';
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
  englishPath?: string;
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

function normalizeEnglishPath(path: string | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const normalized = withLeading.replace(/\/{2,}/g, '/');
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '') || '/';
}

function resolveLocalizedPath(target: AppLocale, slugMap?: LocaleSlugMap, englishPath?: string | null) {
  if (englishPath) {
    return localizePathFromEnglish(target, englishPath);
  }
  const slug = slugMap?.[target] ?? slugMap?.[defaultLocale];
  return buildLocalePath(target, slug) || '/';
}

export function getLocalizedUrl(locale: AppLocale, englishPath: string): string {
  const normalizedEnglish = normalizeEnglishPath(englishPath) ?? '/';
  const localizedPath = resolveLocalizedPath(locale, undefined, normalizedEnglish);
  return buildAbsoluteUrl(localizedPath);
}

export function getHreflangAlternates(englishPath: string, options?: MetadataUrlOptions) {
  const normalizedEnglish = normalizeEnglishPath(englishPath) ?? '/';
  const publishable = new Set<AppLocale>((options?.availableLocales ?? locales) as AppLocale[]);
  const languages: Record<string, string> = {};

  publishable.forEach((locale) => {
    languages[locale] = getLocalizedUrl(locale, normalizedEnglish);
  });

  const xDefaultHref =
    languages[defaultLocale] ?? getLocalizedUrl(defaultLocale, normalizedEnglish);
  languages['x-default'] = xDefaultHref;

  const alternates = Object.entries(languages).map(([hreflang, href]) => ({ hreflang, href }));

  return { languages, alternates, xDefaultHref };
}

export function buildMetadataUrls(locale: AppLocale, slugMap?: LocaleSlugMap, options?: MetadataUrlOptions) {
  const resolveRegion = (target: AppLocale) => localeRegions[target] ?? localeRegions[defaultLocale];
  const publishable = new Set<AppLocale>((options?.availableLocales ?? locales) as AppLocale[]);
  const allowed = new Set<AppLocale>(publishable);
  allowed.add(locale);
  const englishPath = normalizeEnglishPath(options?.englishPath);

  const urls: Partial<Record<AppLocale, string>> = {};
  const localizedHrefByLocale = new Map<AppLocale, string>();
  Array.from(allowed).forEach((target) => {
    const path = resolveLocalizedPath(target, slugMap, englishPath);
    const absolute = buildAbsoluteUrl(path);
    urls[target] = absolute;
    localizedHrefByLocale.set(target, absolute);
  });

  const canonical = urls[locale] ?? buildAbsoluteUrl('/');
  const languages: Record<string, string> = {};
  HREFLANG_VARIANTS.forEach((variant) => {
    if (!publishable.has(variant.locale)) {
      return;
    }
    const href = localizedHrefByLocale.get(variant.locale) ?? urls[variant.locale];
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
