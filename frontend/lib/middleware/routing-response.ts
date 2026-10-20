import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { LOGOUT_INTENT_COOKIE } from '@/lib/logout-intent-cookie';
import { LOCALE_COOKIE } from '@/lib/i18n/constants';

export function middlewareAuthUnavailableResponse(req: NextRequest, sessionResponse?: NextResponse): NextResponse {
  const locale = req.cookies.get(LOCALE_COOKIE)?.value ?? req.cookies.get('NEXT_LOCALE')?.value ?? 'en';
  const message = locale === 'fr'
    ? 'La vérification de connexion est temporairement indisponible. Votre session est conservée. Réessayez dans quelques instants.'
    : locale === 'es'
      ? 'La verificación de acceso no está disponible temporalmente. Tu sesión se ha conservado. Inténtalo de nuevo en unos momentos.'
      : 'Sign-in verification is temporarily unavailable. Your session has been preserved. Please try again in a few moments.';
  const response = new NextResponse(message, { status: 503, headers: {
    'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0',
    'Vercel-CDN-Cache-Control': 'no-store', 'Retry-After': '10', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Cookie',
  } });
  if (sessionResponse) mergeResponseCookies(response, sessionResponse);
  return response;
}

export const LOGIN_PATH = '/login';
const LOCAL_ADMIN_BYPASS_COOKIE = 'mva_local_admin_bypass';
export const PROTECTED_PREFIXES = ['/app', '/dashboard', '/jobs', '/billing', '/settings', '/account', '/admin'];
const MARKETING_EDGE_CACHE_CONTROL = 'public, max-age=0, must-revalidate';
const MARKETING_VERCEL_CDN_CACHE_CONTROL = 'max-age=300, stale-while-revalidate=60';
const CACHEABLE_MARKETING_PATHS = new Set([
  '/',
  '/pricing',
  '/models',
  '/fr',
  '/es',
  '/fr/tarifs',
  '/es/precios',
]);

export function applyMarketingEdgeCacheHeaders(res: NextResponse, pathname: string): NextResponse {
  const isCacheableModelPath =
    pathname.startsWith('/models/') ||
    pathname.startsWith('/fr/modeles/') ||
    pathname.startsWith('/es/modelos/');
  if (!CACHEABLE_MARKETING_PATHS.has(pathname) && !isCacheableModelPath) {
    return res;
  }

  res.headers.set('Cache-Control', MARKETING_EDGE_CACHE_CONTROL);
  res.headers.set('Vercel-CDN-Cache-Control', MARKETING_VERCEL_CDN_CACHE_CONTROL);
  return res;
}
export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase().split(':')[0] ?? '';
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

export function hasLocalAdminBypass(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') return false;
  if ((process.env.LOCAL_ADMIN_BYPASS ?? '').trim() !== '1') return false;
  if (!isLoopbackHost(req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) return false;
  return req.cookies.get(LOCAL_ADMIN_BYPASS_COOKIE)?.value === '1';
}

export function canUseLocalAdminBypassForProtectedPath(
  req: NextRequest,
  pathname: string,
  studioAdminOnly: boolean,
): boolean {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const isAdminPath = normalized === '/admin' || normalized.startsWith('/admin/');
  const isStudioPath = normalized === '/app/studio' || normalized.startsWith('/app/studio/');
  return (isAdminPath || (studioAdminOnly && isStudioPath)) && hasLocalAdminBypass(req);
}

export function finalizeResponse(res: NextResponse, clearLogoutIntent: boolean, trackingNoindex = false, appNoindex = false) {
  if ((trackingNoindex || appNoindex) && !res.headers.has('X-Robots-Tag')) {
    res.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  if (clearLogoutIntent) {
    res.cookies.set(LOGOUT_INTENT_COOKIE, '', { path: '/', maxAge: 0 });
  }
  if (clearLogoutIntent || res.headers.has('set-cookie') || (res.status >= 300 && res.status < 400)) {
    res.headers.set('Cache-Control', 'private, no-store, max-age=0');
    res.headers.set('Vercel-CDN-Cache-Control', 'no-store');
    // Middleware redirects are not stored. A rendered page may reuse cached public HTML;
    // its per-request logout cookie clearing still runs before the cached response.
    res.headers.set('Vary', '*');
  }
  return res;
}

export function mergeResponseCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}
