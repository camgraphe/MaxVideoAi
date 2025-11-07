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

const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
  alternateLinks: true,
});

const LOCALIZED_PREFIXES = locales
  .map((locale) => localePathnames[locale])
  .filter((prefix): prefix is string => Boolean(prefix && prefix.length));
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
