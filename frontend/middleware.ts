import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isbot as detectBot } from 'isbot';
import { defaultLocale, localePathnames, locales } from '@/i18n/locales';
import { LOGOUT_INTENT_COOKIE } from '@/lib/logout-intent-cookie';
import { canVisitorBrowseWorkspacePath } from '@/lib/visitor-access';
import {
  LOGIN_PATH,
  LOCALE_SET,
  LOCALE_STRIPPABLE_PREFIXES,
  PROTECTED_PREFIXES,
  applyMarketingEdgeCacheHeaders,
  containsLocalePlaceholder,
  extractLocaleFromPathname,
  finalizeResponse,
  getPreferredLocale,
  handleI18nRouting,
  handleMarketingSlug,
  hasLocalAdminBypass,
  hasLocalePrefix,
  isLoopbackHost,
  mergeResponseCookies,
  normalizeLeadingLocaleSegments,
  normalizePublicQueryParams,
  resolveLangParamRedirect,
  resolveNonPrefixedLocalizedMarketingRedirect,
  rewriteToNotFound,
  shouldHandleLocale,
  shouldMarkAppNoindex,
  shouldMarkTrackingNoindex,
  splitLocaleFromPath,
} from '@/lib/middleware/routing-helpers';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const userAgent = req.headers.get('user-agent') ?? '';
  const isLighthouseAudit = /lighthouse/i.test(userAgent);
  const isLoopbackRequest = isLoopbackHost(req.headers.get('x-forwarded-host') ?? host);
  const bypassLocaleRedirect =
    isLoopbackRequest ||
    isLighthouseAudit ||
    req.nextUrl.pathname === '/' ||
    req.nextUrl.searchParams.get('nolocale') === '1';
  const logoutIntentCookieValue = req.cookies.get(LOGOUT_INTENT_COOKIE)?.value;
  const hasLogoutIntentCookie = logoutIntentCookieValue === '1';
  if (host.startsWith('www.')) {
    const url = new URL(req.url);
    url.host = host.replace(/^www\./, '');
    return finalizeResponse(NextResponse.redirect(url, 308), hasLogoutIntentCookie);
  }
  const authCode = req.nextUrl.searchParams.get('code');
  if (authCode && req.nextUrl.pathname !== '/auth/callback' && req.nextUrl.pathname !== LOGIN_PATH) {
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
  const nonPrefixedLocalizedRedirect = resolveNonPrefixedLocalizedMarketingRedirect(req, pathname);
  if (nonPrefixedLocalizedRedirect) {
    return finalizeResponse(nonPrefixedLocalizedRedirect, hasLogoutIntentCookie);
  }
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
    const preferredLocale = getPreferredLocale(req) ?? detectedLocale ?? defaultLocale;
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
    if ((isBotRequest || bypassLocaleRedirect) && !hasLocalePrefix(pathname)) {
      if (defaultPrefix) {
        const rewriteUrl = req.nextUrl.clone();
        const suffix = pathname === '/' ? '' : pathname;
        rewriteUrl.pathname = `/${defaultPrefix}${suffix}`;
        if (bypassLocaleRedirect) {
          rewriteUrl.searchParams.delete('nolocale');
        }
        response = NextResponse.rewrite(rewriteUrl);
      } else {
        response = NextResponse.next();
      }
    } else {
      response = handleI18nRouting(req);
    }
  } else {
    response = NextResponse.next();
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtectedRoute) {
    if (
      isMarketingPath &&
      (req.method === 'GET' || req.method === 'HEAD') &&
      !hasLogoutIntentCookie &&
      !trackingNoindex &&
      !appNoindex
    ) {
      applyMarketingEdgeCacheHeaders(response, pathname);
    }
    return finalizeResponse(response, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  const { updateSession } = await import('@/lib/supabase-ssr');
  const { userId } = await updateSession(req, response);

  if (isAdminRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.append('Vary', 'Cookie');
  }

  if (userId) {
    return finalizeResponse(response, hasLogoutIntentCookie, trackingNoindex, appNoindex);
  }

  if (isAdminRoute && hasLocalAdminBypass(req)) {
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

  if (canVisitorBrowseWorkspacePath(pathname)) {
    return finalizeResponse(response, hasLogoutIntentCookie, trackingNoindex, appNoindex);
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
