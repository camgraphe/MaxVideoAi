import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { defaultLocale, localePathnames, locales, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import localizedSlugConfig from '@/config/localized-slugs.json';

const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';
const NON_LOCALIZED_PREFIXES = [
  '/api',
  '/trpc',
  '/admin',
  '/billing',
  '/connect',
  '/dashboard',
  '/generate',
  '/jobs',
  '/legal',
  '/return-policy',
  '/refund-policy',
  '/login',
  '/auth',
  '/settings',
  '/video',
  '/sitemap-video-pages.xml',
  '/sitemap-video.xml',
  '/app',
  '/_next',
  '/_vercel',
  '/apple-app-site-association',
];
export const LOCALE_STRIPPABLE_PREFIXES = NON_LOCALIZED_PREFIXES.filter((prefix) => prefix !== '/legal');
const PLACEHOLDER_SEGMENTS = new Set(['[locale]', '[lang]', '[language]']);
export const LOCALIZED_SEGMENT_VALUES = Array.from(
  new Set(
    Object.values(localizedSlugConfig as Record<string, Record<string, string>>)
      .flatMap((entry) => Object.values(entry))
      .filter((segment): segment is string => Boolean(segment && segment.length))
      .map((segment) => segment.toLowerCase())
  )
);

export const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
  alternateLinks: false,
});

export const LOCALE_SET = new Set(locales);
const LOCALIZED_PREFIXES = locales
  .map((locale) => localePathnames[locale])
  .filter((prefix): prefix is string => Boolean(prefix && prefix.length));
const PREFIX_TO_LOCALE = new Map<string, (typeof locales)[number]>();
locales.forEach((locale) => {
  const prefix = localePathnames[locale];
  if (prefix) {
    PREFIX_TO_LOCALE.set(prefix.toLowerCase(), locale);
  }
});
const LOCALE_SEGMENT_TO_LOCALE = new Map<string, (typeof locales)[number]>();
locales.forEach((locale) => {
  LOCALE_SEGMENT_TO_LOCALE.set(locale.toLowerCase(), locale);
  const prefix = localePathnames[locale];
  if (prefix) {
    LOCALE_SEGMENT_TO_LOCALE.set(prefix.toLowerCase(), locale);
  }
});
export const LOCALIZED_PREFIX_SET = new Set(LOCALIZED_PREFIXES.map((value) => value.toLowerCase()));
const LOCALE_PREFIX_REGEX = LOCALIZED_PREFIXES.length
  ? new RegExp(`^/(${LOCALIZED_PREFIXES.join('|')})(/|$)`)
  : null;

const ENGLISH_SEGMENT_TO_LOCALIZED = new Map<string, Record<AppLocale, string>>();
const LOCALIZED_SEGMENT_TO_ENGLISH = new Map<string, string>();
Object.values(localizedSlugConfig as Record<string, Record<string, string>>).forEach((entry) => {
  const english = entry.en?.toLowerCase?.() ?? '';
  if (!english) return;
  const localized: Record<AppLocale, string> = {
    en: entry.en,
    fr: entry.fr ?? entry.en,
    es: entry.es ?? entry.en,
  };
  ENGLISH_SEGMENT_TO_LOCALIZED.set(english, localized);
  Object.values(entry).forEach((value) => {
    if (typeof value === 'string' && value.trim().length) {
      LOCALIZED_SEGMENT_TO_ENGLISH.set(value.toLowerCase(), english);
    }
  });
});

export function hasLocalePrefix(pathname: string) {
  if (!LOCALE_PREFIX_REGEX) {
    return false;
  }
  return LOCALE_PREFIX_REGEX.test(pathname);
}

export function shouldHandleLocale(pathname: string) {
  if (pathname === '/' || pathname === '') {
    return true;
  }
  if (pathname.includes('.') && !pathname.startsWith('/.well-known')) {
    return false;
  }
  if (hasLocalePrefix(pathname)) {
    return true;
  }
  return !NON_LOCALIZED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function extractLocale(pathValue: string): string | null {
  if (!pathValue) {
    return null;
  }

  try {
    const url = pathValue.startsWith('http') ? new URL(pathValue) : new URL(pathValue, 'https://example.com');
    const match = LOCALE_PREFIX_REGEX?.exec(url.pathname);
    if (match) {
      const candidate = match[1] as (typeof locales)[number];
      if (localePathnames[candidate]) {
        return candidate;
      }
    }
  } catch {
    // ignore parsing errors
  }
  return null;
}

export function extractLocaleFromPathname(pathname: string): string | null {
  if (!LOCALE_PREFIX_REGEX) return null;
  const match = LOCALE_PREFIX_REGEX.exec(pathname);
  if (!match) {
    return null;
  }
  const prefix = match[1]?.toLowerCase();
  if (!prefix) return null;
  return PREFIX_TO_LOCALE.get(prefix) ?? null;
}

export function setLocaleCookies(response: NextResponse, locale: string) {
  const maxAge = 60 * 60 * 24 * 365;
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge,
    sameSite: 'lax',
  });
  response.cookies.set(NEXT_LOCALE_COOKIE, locale, {
    path: '/',
    maxAge,
    sameSite: 'lax',
  });
}

export function getPreferredLocale(req: NextRequest): (typeof locales)[number] {
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && LOCALE_SET.has(cookieLocale as (typeof locales)[number])) {
    return cookieLocale as (typeof locales)[number];
  }
  const nextLocale = req.cookies.get(NEXT_LOCALE_COOKIE)?.value;
  if (nextLocale && LOCALE_SET.has(nextLocale as (typeof locales)[number])) {
    return nextLocale as (typeof locales)[number];
  }
  return defaultLocale;
}

export function splitLocaleFromPath(pathname: string) {
  const trimmed = pathname || '/';
  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length && LOCALIZED_PREFIX_SET.has(segments[0].toLowerCase())) {
    const localeSegment = segments[0];
    const rest = segments.slice(1);
    return {
      localePrefix: `/${localeSegment}`,
      pathWithoutLocale: rest.length ? `/${rest.join('/')}` : '/',
    };
  }
  return { localePrefix: '', pathWithoutLocale: trimmed };
}

export function containsLocalePlaceholder(pathname: string) {
  return pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => PLACEHOLDER_SEGMENTS.has(segment.toLowerCase()));
}

export function normalizeLeadingLocaleSegments(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const localeRun: AppLocale[] = [];
  for (const segment of segments) {
    const locale = resolveLocaleFromSegment(segment);
    if (!locale) break;
    localeRun.push(locale);
  }
  if (localeRun.length < 2) {
    return null;
  }
  const targetLocale = localeRun[localeRun.length - 1];
  const rest = segments.slice(localeRun.length);
  return buildPathForLocale(targetLocale, rest);
}

function resolveLocaleFromSegment(segment: string): AppLocale | null {
  if (!segment) return null;
  return LOCALE_SEGMENT_TO_LOCALE.get(segment.toLowerCase()) ?? null;
}

export function buildPathForLocale(locale: AppLocale, restSegments: string[]): string {
  const prefix = localePathnames[locale];
  const prefixPath = prefix ? `/${prefix}` : '';
  const restPath = restSegments.length ? `/${restSegments.join('/')}` : '';
  const combined = `${prefixPath}${restPath}` || '/';
  return combined.replace(/\/{2,}/g, '/') || '/';
}

function stripLegacyEnPrefix(pathname: string): string {
  if (pathname === '/en') {
    return '/';
  }
  if (pathname.startsWith('/en/')) {
    return pathname.slice(3) || '/';
  }
  return pathname;
}

function localizePathForLocale(targetLocale: AppLocale, pathWithoutLocale: string): string {
  const trimmed = stripLegacyEnPrefix(pathWithoutLocale || '/');
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (normalized === '/' || normalized === '') {
    return buildPathForLocale(targetLocale, []);
  }
  const segments = normalized.split('/').filter(Boolean);
  if (!segments.length) {
    return buildPathForLocale(targetLocale, []);
  }
  const [first, ...rest] = segments;
  const english = LOCALIZED_SEGMENT_TO_ENGLISH.get(first.toLowerCase()) ?? first;
  const localizedFirst = ENGLISH_SEGMENT_TO_LOCALIZED.get(english.toLowerCase())?.[targetLocale] ?? english;
  return buildPathForLocale(targetLocale, [localizedFirst, ...rest]);
}

export function resolveLangParamRedirect(req: NextRequest, pathname: string): NextResponse | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return null;
  }
  const langRaw = req.nextUrl.searchParams.get('lang');
  if (!langRaw) {
    return null;
  }
  const lang = langRaw.trim().toLowerCase();
  if (!LOCALE_SET.has(lang as AppLocale)) {
    return null;
  }
  const targetLocale = lang as AppLocale;
  const { pathWithoutLocale } = splitLocaleFromPath(pathname);
  const localizedPath = localizePathForLocale(targetLocale, pathWithoutLocale);
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = localizedPath;
  redirectUrl.searchParams.delete('lang');
  return NextResponse.redirect(redirectUrl, 301);
}
