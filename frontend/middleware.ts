import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { isbot as detectBot } from 'isbot';
import { routing } from '@/i18n/routing';
import { defaultLocale, localePathnames, locales } from '@/i18n/locales';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';
import { getUserIdFromSupabase } from '@/lib/supabase';

const LOGIN_PATH = '/login';
const PROTECTED_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings'];
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
  '/settings',
  '/video',
  '/sitemap-video.xml',
  '/app',
  '/_next',
  '/_vercel',
];
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
    'pricing-calculator',
    'status',
    'video',
    'workflows',
    'v',
    '404',
  ].map((segment) => segment.toLowerCase())
);
const EXACT_PATH_REDIRECTS: Record<string, string> = {
  '/a': '/',
  '/ai': '/',
  '/video': '/',
  '/pika': '/models/pika-image-to-video',
  '/pikavideo': '/models/pika-image-to-video',
  '/sora2': '/models/sora-2',
  '/sora-2': '/models/sora-2',
};
const FUZZY_REDIRECT_TARGETS: Array<{ slug: string; destination: string }> = [
  { slug: 'models', destination: '/models' },
  { slug: 'pricing', destination: '/pricing' },
  { slug: 'examples', destination: '/examples' },
  { slug: 'docs', destination: '/docs' },
  { slug: 'workflows', destination: '/workflows' },
  { slug: 'sora-2', destination: '/models/sora-2' },
  { slug: 'sora-2-pro', destination: '/models/sora-2-pro' },
  { slug: 'pika-image-to-video', destination: '/models/pika-image-to-video' },
  { slug: 'pika-text-to-video', destination: '/models/pika-text-to-video' },
];

const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
  alternateLinks: true,
});

const LOCALIZED_PREFIXES = locales
  .map((locale) => localePathnames[locale])
  .filter((prefix): prefix is string => Boolean(prefix && prefix.length));
const LOCALIZED_PREFIX_SET = new Set(LOCALIZED_PREFIXES);
const LOCALE_PREFIX_REGEX = LOCALIZED_PREFIXES.length
  ? new RegExp(`^/(${LOCALIZED_PREFIXES.join('|')})(/|$)`)
  : null;

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

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  if (host.startsWith('www.')) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, '');
    return NextResponse.redirect(url, 308);
  }

  const pathname = req.nextUrl.pathname;
  const isMarketingPath = shouldHandleLocale(pathname);
  const isBotRequest = detectBot(req.headers.get('user-agent') ?? '');

  if (isMarketingPath) {
    const marketingResponse = handleMarketingSlug(req, pathname);
    if (marketingResponse) {
      return marketingResponse;
    }
  }

  let response: NextResponse;

  if (isMarketingPath) {
    if (isBotRequest && !hasLocalePrefix(pathname)) {
      const rewriteUrl = req.nextUrl.clone();
      const defaultPrefix = localePathnames[defaultLocale];
      if (defaultPrefix) {
        const suffix = pathname === '/' ? '' : pathname;
        rewriteUrl.pathname = `/${defaultPrefix}${suffix}`;
      } else {
        rewriteUrl.pathname = pathname || '/';
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
      extractLocale(response.headers.get('location') ?? '') ??
      extractLocale(req.nextUrl.toString()) ??
      (hasLocalePrefix(pathname) ? pathname.split('/')[1] : null);
    if (resolvedLocale) {
      response.cookies.set(LOCALE_COOKIE, resolvedLocale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
      });
    }
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtectedRoute) {
    return response;
  }

  try {
    const userId = await getUserIdFromSupabase(req);
    if (userId) {
      return response;
    }
  } catch {
    // ignore and fall through to redirect
  }

  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = LOGIN_PATH;
  redirectUrl.search = '';

  const target =
    req.nextUrl.pathname + (req.nextUrl.search && req.nextUrl.search !== '?' ? req.nextUrl.search : '');
  if (target && target !== LOGIN_PATH) {
    redirectUrl.searchParams.set('next', target);
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*|api).*)'],
};

function handleMarketingSlug(req: NextRequest, pathname: string): NextResponse | null {
  const { localePrefix, pathWithoutLocale } = splitLocaleFromPath(pathname);
  const normalizedPath = normalizePath(pathWithoutLocale);
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
  if (segments.length && LOCALIZED_PREFIX_SET.has(segments[0])) {
    const localeSegment = segments[0];
    const rest = segments.slice(1);
    return {
      localePrefix: `/${localeSegment}`,
      pathWithoutLocale: rest.length ? `/${rest.join('/')}` : '/',
    };
  }
  return { localePrefix: '', pathWithoutLocale: trimmed };
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
