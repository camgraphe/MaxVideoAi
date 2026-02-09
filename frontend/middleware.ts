import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { isbot as detectBot } from 'isbot';
import { routing } from '@/i18n/routing';
import { defaultLocale, localePathnames, locales, type AppLocale } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import localizedSlugConfig from '@/config/localized-slugs.json';
import { updateSession } from '@/lib/supabase-ssr';
import { LOGOUT_INTENT_COOKIE } from '@/lib/logout-intent-cookie';

const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';
const LOGIN_PATH = '/login';
const PROTECTED_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/admin'];
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
  '/login',
  '/auth',
  '/settings',
  '/video',
  '/sitemap-video.xml',
  '/app',
  '/_next',
  '/_vercel',
  '/apple-app-site-association',
];
const LOCALE_STRIPPABLE_PREFIXES = NON_LOCALIZED_PREFIXES.filter((prefix) => prefix !== '/legal');
const PLACEHOLDER_SEGMENTS = new Set(['[locale]', '[lang]', '[language]']);
const LOCALIZED_SEGMENT_VALUES = Array.from(
  new Set(
    Object.values(localizedSlugConfig as Record<string, Record<string, string>>)
      .flatMap((entry) => Object.values(entry))
      .filter((segment): segment is string => Boolean(segment && segment.length))
      .map((segment) => segment.toLowerCase())
  )
);

const KNOWN_MARKETING_SEGMENTS = new Set(
  [
    '',
    'about',
    'ai-video-engines',
    'blog',
    'changelog',
    'contact',
    'docs',
    'examples',
    'legal',
    'models',
    'pricing',
    'status',
    'video',
    'workflows',
    'v',
    '404',
    ...LOCALIZED_SEGMENT_VALUES,
  ].map((segment) => segment.toLowerCase())
);
const EXACT_PATH_REDIRECTS: Record<string, string> = {
  '/ai': '/',
  '/video': '/',
  '/pika': '/models/pika-text-to-video',
  '/pikavideo': '/models/pika-text-to-video',
  '/sora2': '/models/sora-2',
  '/sora-2': '/models/sora-2',
  '/models/luma-dream-machine': '/models',
  '/models/pika-image-to-video': '/models/pika-text-to-video',
  '/models/pika-image-video': '/models/pika-text-to-video',
};
const GONE_MARKETING_PATHS = new Set(['/a']);
const QUERY_PARAM_STRIP_PREFIXES = [
  '/models',
  '/pricing',
  '/examples',
  '/blog',
  '/legal',
  '/docs',
  '/workflows',
  '/status',
  '/ai-video-engines',
  '/changelog',
  '/contact',
  '/about',
  '/video',
  '/login',
];
const QUERY_PARAM_ALLOWLISTS = {
  examples: new Set(['sort', 'engine', 'page']),
  login: new Set(['next']),
  video: new Set(['from']),
  compare: new Set(['order']),
};
const FUZZY_REDIRECT_TARGETS: Array<{ slug: string; destination: string }> = [
  { slug: 'models', destination: '/models' },
  { slug: 'pricing', destination: '/pricing' },
  { slug: 'examples', destination: '/examples' },
  { slug: 'docs', destination: '/docs' },
  { slug: 'workflows', destination: '/workflows' },
  { slug: 'sora-2', destination: '/models/sora-2' },
  { slug: 'sora-2-pro', destination: '/models/sora-2-pro' },
  { slug: 'pika-image-to-video', destination: '/models/pika-text-to-video' },
  { slug: 'pika-text-to-video', destination: '/models/pika-text-to-video' },
];

const EXACT_LOCALE_REDIRECTS: Record<string, string> = {
  // Compare AI video engines
  '/fr/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika':
    '/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
  '/es/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika':
    '/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika',
  '/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika': '/blog/compare-ai-video-engines',
  '/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika': '/blog/compare-ai-video-engines',
  // Sora 2 sequenced prompts
  '/es/blog/invites-sequencees-sora-2-avec-son-et-image-de-marque':
    '/blog/indicaciones-secuenciadas-de-sora-2-con-sonido-e-identidad-de-marca',
  '/blog/invites-sequencees-sora-2-avec-son-et-image-de-marque': '/blog/sora-2-sequenced-prompts',
  '/fr/blog/indicaciones-secuenciadas-de-sora-2-con-sonido-e-identidad-de-marca':
    '/blog/invites-sequencees-sora-2-avec-son-et-image-de-marque',
  '/blog/indicaciones-secuenciadas-de-sora-2-con-sonido-e-identidad-de-marca': '/blog/sora-2-sequenced-prompts',
  // Access Sora 2 without invite
  '/blog/accede-a-sora-2-sin-invitacion': '/blog/access-sora-2-without-invite',
  '/es/blog/acceder-a-sora-2-sans-invitation': '/blog/accede-a-sora-2-sin-invitacion',
  '/fr/blog/accede-a-sora-2-sin-invitacion': '/blog/acceder-a-sora-2-sans-invitation',
  '/blog/acceder-a-sora-2-sans-invitation': '/blog/access-sora-2-without-invite',
  // Veo 3 updates
  '/blog/les-mises-a-jour-de-veo-3-apportent-des-controles-cinematographiques': '/blog/veo-3-updates',
  '/es/blog/les-mises-a-jour-de-veo-3-apportent-des-controles-cinematographiques':
    '/blog/las-actualizaciones-de-veo-3-traen-controles-cinematograficos',
  '/fr/blog/las-actualizaciones-de-veo-3-traen-controles-cinematograficos':
    '/blog/les-mises-a-jour-de-veo-3-apportent-des-controles-cinematographiques',
  '/blog/las-actualizaciones-de-veo-3-traen-controles-cinematograficos': '/blog/veo-3-updates',
};

const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
  alternateLinks: false,
});

const LOCALE_SET = new Set(locales);
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
const LOCALIZED_PREFIX_SET = new Set(LOCALIZED_PREFIXES.map((value) => value.toLowerCase()));
const LOCALE_PREFIX_REGEX = LOCALIZED_PREFIXES.length
  ? new RegExp(`^/(${LOCALIZED_PREFIXES.join('|')})(/|$)`)
  : null;
const APP_NOINDEX_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/connect'];
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

function hasLocalePrefix(pathname: string) {
  if (!LOCALE_PREFIX_REGEX) {
    return false;
  }
  return LOCALE_PREFIX_REGEX.test(pathname);
}

function shouldHandleLocale(pathname: string) {
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

function extractLocale(pathValue: string): string | null {
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

function extractLocaleFromPathname(pathname: string): string | null {
  if (!LOCALE_PREFIX_REGEX) return null;
  const match = LOCALE_PREFIX_REGEX.exec(pathname);
  if (!match) {
    return null;
  }
  const prefix = match[1]?.toLowerCase();
  if (!prefix) return null;
  return PREFIX_TO_LOCALE.get(prefix) ?? null;
}

function setLocaleCookies(response: NextResponse, locale: string) {
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

function getPreferredLocale(req: NextRequest): (typeof locales)[number] {
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

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const isLighthouseAudit = /lighthouse/i.test(userAgent);
  const bypassLocaleRedirect = isLighthouseAudit || req.nextUrl.searchParams.get('nolocale') === '1';
  const logoutIntentCookieValue = req.cookies.get(LOGOUT_INTENT_COOKIE)?.value;
  const hasLogoutIntentCookie = logoutIntentCookieValue === '1';
  if (host.startsWith('www.')) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, '');
    return finalizeResponse(NextResponse.redirect(url, 308), hasLogoutIntentCookie);
  }
  const authCode = req.nextUrl.searchParams.get('code');
  if (authCode && req.nextUrl.pathname !== '/auth/callback') {
    const callbackUrl = req.nextUrl.clone();
    callbackUrl.pathname = '/auth/callback';
    callbackUrl.search = '';
    callbackUrl.searchParams.set('code', authCode);

    const nextUrl = req.nextUrl.clone();
    nextUrl.searchParams.delete('code');
    nextUrl.searchParams.delete('state');
    nextUrl.searchParams.delete('error');
    nextUrl.searchParams.delete('error_description');
    nextUrl.searchParams.delete('redirect_to');
    nextUrl.searchParams.delete('next');
    const nextPath =
      nextUrl.pathname + (nextUrl.search && nextUrl.search !== '?' ? nextUrl.search : '');
    if (nextPath && nextPath !== '/' && nextPath !== '/auth/callback') {
      callbackUrl.searchParams.set('next', nextPath);
    }

    return finalizeResponse(NextResponse.redirect(callbackUrl), hasLogoutIntentCookie);
  }

  const originalPathname = req.nextUrl.pathname;
  let pathname = originalPathname;
  const detectedLocale =
    req.nextUrl.locale && LOCALE_SET.has(req.nextUrl.locale as (typeof locales)[number])
      ? (req.nextUrl.locale as (typeof locales)[number])
      : null;
  let localeFromPath = extractLocaleFromPathname(pathname);

  if (containsLocalePlaceholder(pathname)) {
    const { localePrefix } = splitLocaleFromPath(pathname);
    return finalizeResponse(rewriteToNotFound(req, localePrefix), hasLogoutIntentCookie);
  }

  const sanitizedLocalePath = normalizeLeadingLocaleSegments(pathname);
  if (sanitizedLocalePath) {
    pathname = sanitizedLocalePath;
  }

  const langRedirect = resolveLangParamRedirect(req, pathname);
  if (langRedirect) {
    return finalizeResponse(langRedirect, hasLogoutIntentCookie);
  }

  const { localePrefix, pathWithoutLocale } = splitLocaleFromPath(pathname);
  const hasNonLocalizedPrefix =
    Boolean(localePrefix) &&
    Boolean(pathWithoutLocale) &&
    LOCALE_STRIPPABLE_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));

  const canonicalPathname = hasNonLocalizedPrefix ? pathWithoutLocale || '/' : pathname;
  const normalizedPathname = (canonicalPathname || '/').replace(/\/{2,}/g, '/') || '/';

  if (normalizedPathname !== originalPathname) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = normalizedPathname;
    redirectUrl.search = req.nextUrl.search;
    return finalizeResponse(NextResponse.redirect(redirectUrl, 301), hasLogoutIntentCookie);
  }

  pathname = normalizedPathname;
  localeFromPath = extractLocaleFromPathname(pathname);
  const isAdminRoute = pathname.toLowerCase() === '/admin' || pathname.toLowerCase().startsWith('/admin/');
  const appNoindex = shouldMarkAppNoindex(pathname);
  const trackingNoindex = shouldMarkTrackingNoindex(req, pathname, isAdminRoute);
  const queryCleanup = normalizePublicQueryParams(req, pathname);
  if (queryCleanup) {
    return finalizeResponse(queryCleanup, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  const isMarketingPath = shouldHandleLocale(pathname);
  const isBotRequest = detectBot(userAgent);

  const marketingResponse = isMarketingPath ? handleMarketingSlug(req, pathname) : null;
  if (marketingResponse) {
    return finalizeResponse(marketingResponse, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  if (isMarketingPath && !localeFromPath && !isBotRequest && !bypassLocaleRedirect) {
    const preferredLocale = detectedLocale ?? getPreferredLocale(req);
    const prefix = localePathnames[preferredLocale];
    if (typeof prefix === 'string') {
      const suffix = pathname === '/' ? '' : pathname;
      const targetPath = prefix.length ? `/${prefix}${suffix}` : suffix || '/';
      const normalizedTarget = targetPath.replace(/\/{2,}/g, '/') || '/';
      if (normalizedTarget !== pathname) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = normalizedTarget;
        return finalizeResponse(
          NextResponse.redirect(redirectUrl, 307),
          hasLogoutIntentCookie,
          trackingNoindex,
          appNoindex
        );
      }
    }
  }

  let response: NextResponse;

  if (isMarketingPath) {
    const defaultPrefix = localePathnames[defaultLocale];
    if (!hasLocalePrefix(pathname) && !localeFromPath && !defaultPrefix) {
      const rewriteUrl = req.nextUrl.clone();
      const suffix = pathname === '/' ? '' : pathname;
      rewriteUrl.pathname = `/${defaultLocale}${suffix}`;
      if (bypassLocaleRedirect) {
        rewriteUrl.searchParams.delete('nolocale');
      }
      response = NextResponse.rewrite(rewriteUrl);
    } else if ((isBotRequest || bypassLocaleRedirect) && !hasLocalePrefix(pathname)) {
      const rewriteUrl = req.nextUrl.clone();
      if (defaultPrefix) {
        const suffix = pathname === '/' ? '' : pathname;
        rewriteUrl.pathname = `/${defaultPrefix}${suffix}`;
      } else {
        rewriteUrl.pathname = pathname || '/';
      }
      if (bypassLocaleRedirect) {
        rewriteUrl.searchParams.delete('nolocale');
      }
      response = NextResponse.rewrite(rewriteUrl);
    } else {
      response = handleI18nRouting(req);
    }
  } else {
    response = NextResponse.next();
  }

  if (isMarketingPath) {
    const resolvedLocale =
      localeFromPath ??
      detectedLocale ??
      extractLocale(response.headers.get('location') ?? '') ??
      extractLocale(req.nextUrl.toString());
    if (resolvedLocale) {
      setLocaleCookies(response, resolvedLocale);
    }
  }

  const { userId } = await updateSession(req, response);

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtectedRoute) {
    return finalizeResponse(response, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  if (isAdminRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.append('Vary', 'Cookie');
  }

  if (userId) {
    return finalizeResponse(response, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  if (isAdminRoute) {
    const unauthorized = new NextResponse(null, { status: 401 });
    unauthorized.headers.set('X-Robots-Tag', 'noindex, nofollow');
    unauthorized.headers.set('Cache-Control', 'private, no-store, max-age=0');
    unauthorized.headers.set('Pragma', 'no-cache');
    unauthorized.headers.append('Vary', 'Cookie');
    mergeResponseCookies(unauthorized, response);
    return finalizeResponse(unauthorized, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  if (hasLogoutIntentCookie) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.search = '';
    const logoutResponse = NextResponse.redirect(redirectUrl);
    mergeResponseCookies(logoutResponse, response);
    return finalizeResponse(logoutResponse, true, trackingNoindex, appNoindex);
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;
  redirectUrl.search = '';

  const target =
    req.nextUrl.pathname + (req.nextUrl.search && req.nextUrl.search !== '?' ? req.nextUrl.search : '');
  if (target && target !== LOGIN_PATH) {
    redirectUrl.searchParams.set('next', target);
  }

  const loginResponse = NextResponse.redirect(redirectUrl);
  mergeResponseCookies(loginResponse, response);
  return finalizeResponse(loginResponse, false, trackingNoindex, appNoindex);
}

export const config = {
  matcher: ['/admin/:path*', '/((?!_next|.*\\..*|api).*)'],
};

function finalizeResponse(res: NextResponse, clearLogoutIntent: boolean, trackingNoindex = false, appNoindex = false) {
  if ((trackingNoindex || appNoindex) && !res.headers.has('X-Robots-Tag')) {
    res.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  if (clearLogoutIntent) {
    res.cookies.set(LOGOUT_INTENT_COOKIE, '', { path: '/', maxAge: 0 });
  }
  return res;
}

function handleMarketingSlug(req: NextRequest, pathname: string): NextResponse | null {
  const { localePrefix, pathWithoutLocale } = splitLocaleFromPath(pathname);
  const normalizedPath = normalizePath(pathWithoutLocale);
  if (GONE_MARKETING_PATHS.has(normalizedPath)) {
    return new NextResponse('Gone', { status: 410 });
  }
  const localeAwareKey = `${(localePrefix || '').toLowerCase()}${normalizedPath}`;
  const localeAwareRedirect = resolveExactLocaleRedirect(req, localeAwareKey, localePrefix);
  if (localeAwareRedirect) {
    return localeAwareRedirect;
  }
  const exactRedirect = resolveExactRedirect(req, normalizedPath, localePrefix);
  if (exactRedirect) {
    return exactRedirect;
  }
  const segments = normalizedPath.split('/').filter(Boolean);
  if (!segments.length) {
    return null;
  }
  const primarySegment = segments[0].toLowerCase();
  if (KNOWN_MARKETING_SEGMENTS.has(primarySegment)) {
    return null;
  }
  const fuzzyRedirect = resolveFuzzyRedirect(req, segments[0], localePrefix);
  if (fuzzyRedirect) {
    return fuzzyRedirect;
  }
  return rewriteToNotFound(req, localePrefix);
}

function splitLocaleFromPath(pathname: string) {
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

function containsLocalePlaceholder(pathname: string) {
  return pathname
    .split('/')
    .filter(Boolean)
    .some((segment) => PLACEHOLDER_SEGMENTS.has(segment.toLowerCase()));
}

function normalizeLeadingLocaleSegments(pathname: string) {
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

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  const withoutMultipleSlashes = pathname.replace(/\/+/g, '/');
  const withoutTrailing = withoutMultipleSlashes.endsWith('/') ? withoutMultipleSlashes.slice(0, -1) : withoutMultipleSlashes;
  if (!withoutTrailing) {
    return '/';
  }
  return withoutTrailing.startsWith('/') ? withoutTrailing.toLowerCase() : `/${withoutTrailing.toLowerCase()}`;
}

function resolveLocaleFromSegment(segment: string): AppLocale | null {
  if (!segment) return null;
  return LOCALE_SEGMENT_TO_LOCALE.get(segment.toLowerCase()) ?? null;
}

function buildPathForLocale(locale: AppLocale, restSegments: string[]): string {
  const prefix = localePathnames[locale];
  const prefixPath = prefix ? `/${prefix}` : '';
  const restPath = restSegments.length ? `/${restSegments.join('/')}` : '';
  const combined = `${prefixPath}${restPath}` || '/';
  return combined.replace(/\/{2,}/g, '/') || '/';
}

function shouldStripQueryParams(pathWithoutLocale: string): boolean {
  if (pathWithoutLocale === '/') {
    return true;
  }
  return QUERY_PARAM_STRIP_PREFIXES.some((prefix) => pathWithoutLocale.startsWith(prefix));
}

function isTrackingParam(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.startsWith('utm_') ||
    normalized === 'gclid' ||
    normalized === 'fbclid' ||
    normalized === 'nolocale'
  );
}

function hasTrackingParams(params: URLSearchParams): boolean {
  for (const key of params.keys()) {
    if (isTrackingParam(key)) {
      return true;
    }
  }
  return false;
}

function shouldMarkTrackingNoindex(req: NextRequest, pathname: string, isAdminRoute: boolean): boolean {
  if (isAdminRoute) {
    return false;
  }
  if (!hasTrackingParams(req.nextUrl.searchParams)) {
    return false;
  }
  const { pathWithoutLocale } = splitLocaleFromPath(pathname);
  return shouldStripQueryParams(pathWithoutLocale);
}

function shouldMarkAppNoindex(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  if (normalized.startsWith('/video/job_')) {
    return true;
  }
  return APP_NOINDEX_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
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

function resolveLangParamRedirect(req: NextRequest, pathname: string): NextResponse | null {
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

function resolveQueryAllowlist(pathWithoutLocale: string): Set<string> | null {
  if (pathWithoutLocale === '/examples') {
    return QUERY_PARAM_ALLOWLISTS.examples;
  }
  if (
    pathWithoutLocale.startsWith('/ai-video-engines') ||
    pathWithoutLocale.startsWith('/comparatif') ||
    pathWithoutLocale.startsWith('/comparativa')
  ) {
    return QUERY_PARAM_ALLOWLISTS.compare;
  }
  if (pathWithoutLocale === '/login') {
    return QUERY_PARAM_ALLOWLISTS.login;
  }
  if (pathWithoutLocale.startsWith('/video')) {
    return QUERY_PARAM_ALLOWLISTS.video;
  }
  return null;
}

function normalizePublicQueryParams(req: NextRequest, pathname: string): NextResponse | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return null;
  }
  const { pathWithoutLocale } = splitLocaleFromPath(pathname);
  if (!shouldStripQueryParams(pathWithoutLocale)) {
    return null;
  }
  const params = req.nextUrl.searchParams;
  if (!params.size) {
    return null;
  }
  const allowlist = resolveQueryAllowlist(pathWithoutLocale);
  let changed = false;
  const cleanedParams = new URLSearchParams();
  params.forEach((value, key) => {
    if ((allowlist && allowlist.has(key)) || isTrackingParam(key)) {
      cleanedParams.append(key, value);
    } else {
      changed = true;
    }
  });
  if (!changed) {
    return null;
  }
  const cleaned = req.nextUrl.clone();
  const nextQuery = cleanedParams.toString();
  cleaned.search = nextQuery ? `?${nextQuery}` : '';
  return NextResponse.redirect(cleaned, 301);
}

function resolveExactRedirect(req: NextRequest, normalizedPath: string, localePrefix: string) {
  const destination = EXACT_PATH_REDIRECTS[normalizedPath];
  if (!destination) {
    return null;
  }
  const destinationPath = withLocalePrefix(destination, localePrefix);
  return buildRedirectResponse(req, destinationPath);
}

function resolveFuzzyRedirect(req: NextRequest, segment: string, localePrefix: string) {
  const candidate = normalizeSlug(segment);
  if (!candidate) {
    return null;
  }
  let best: { destination: string; distance: number } | null = null;
  for (const target of FUZZY_REDIRECT_TARGETS) {
    const normalizedTarget = normalizeSlug(target.slug);
    if (!normalizedTarget) {
      continue;
    }
    const distance = levenshtein(candidate, normalizedTarget);
    if (distance > getFuzzyThreshold(normalizedTarget.length)) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { destination: target.destination, distance };
    }
  }
  if (!best) {
    return null;
  }
  const destinationPath = withLocalePrefix(best.destination, localePrefix);
  return buildRedirectResponse(req, destinationPath);
}

function withLocalePrefix(path: string, localePrefix: string) {
  if (!localePrefix) {
    return normalizeDestinationPath(path);
  }
  if (path === '/' || path === '') {
    return localePrefix;
  }
  const normalized = normalizeDestinationPath(path);
  return `${localePrefix}${normalized}`.replace(/\/{2,}/g, '/');
}

function normalizeDestinationPath(path: string) {
  if (!path || path === '/') {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function buildRedirectResponse(req: NextRequest, destinationPath: string) {
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = destinationPath || '/';
  redirectUrl.search = '';
  return NextResponse.redirect(redirectUrl, 301);
}

function resolveExactLocaleRedirect(req: NextRequest, key: string, localePrefix: string) {
  const destination = EXACT_LOCALE_REDIRECTS[key];
  if (!destination) {
    return null;
  }
  const destinationPath = withLocalePrefix(destination, localePrefix);
  return buildRedirectResponse(req, destinationPath);
}

function rewriteToNotFound(req: NextRequest, localePrefix: string) {
  const notFoundUrl = req.nextUrl.clone();
  const targetPath = localePrefix ? `${localePrefix}/404` : '/404';
  notFoundUrl.pathname = targetPath.replace(/\/{2,}/g, '/');
  notFoundUrl.search = '';
  return NextResponse.rewrite(notFoundUrl, { status: 404 });
}

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFuzzyThreshold(length: number) {
  if (length <= 4) {
    return 1;
  }
  if (length <= 8) {
    return 2;
  }
  return 3;
}

function mergeResponseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

function levenshtein(a: string, b: string) {
  if (a === b) {
    return 0;
  }
  if (!a.length) {
    return b.length;
  }
  if (!b.length) {
    return a.length;
  }
  const prev = Array.from({ length: b.length + 1 }, (_, idx) => idx);
  let current = new Array(b.length + 1);
  for (let i = 0; i < a.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const cost = a[i] === b[j] ? 0 : 1;
      current[j + 1] = Math.min(
        current[j] + 1, // insertion
        prev[j + 1] + 1, // deletion
        prev[j] + cost // substitution
      );
    }
    for (let k = 0; k < prev.length; k += 1) {
      prev[k] = current[k];
    }
    current = new Array(b.length + 1);
  }
  return prev[b.length];
}
