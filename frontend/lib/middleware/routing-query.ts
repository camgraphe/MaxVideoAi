import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { splitLocaleFromPath } from './routing-locale';

const QUERY_PARAM_STRIP_PREFIXES = [
  '/models',
  '/pricing',
  '/examples',
  '/blog',
  '/legal',
  '/docs',
  '/workflows',
  '/status',
  '/tools',
  '/ai-video-engines',
  '/changelog',
  '/contact',
  '/about',
  '/company',
  '/video',
  '/login',
];
const QUERY_PARAM_ALLOWLISTS = {
  examples: new Set(['sort', 'engine', 'page']),
  login: new Set(['next', 'mode', 'authError', 'code', 'state']),
  video: new Set(['from']),
  compare: new Set(['order']),
};
const APP_NOINDEX_PREFIXES = ['/app', '/generate', '/dashboard', '/jobs', '/billing', '/settings', '/connect'];

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
    normalized === 'nolocale' ||
    normalized === 'nxtplocale'
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

export function shouldMarkTrackingNoindex(req: NextRequest, pathname: string, isAdminRoute: boolean): boolean {
  if (isAdminRoute) {
    return false;
  }
  const trackingSource = req.nextUrl.searchParams.get('utm_source')?.toLowerCase();
  if (trackingSource === 'startupfa.me') {
    return false;
  }
  if (!hasTrackingParams(req.nextUrl.searchParams)) {
    return false;
  }
  const { pathWithoutLocale } = splitLocaleFromPath(pathname);
  return shouldStripQueryParams(pathWithoutLocale);
}

export function shouldMarkAppNoindex(pathname: string): boolean {
  const normalized = pathname.toLowerCase();
  return APP_NOINDEX_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function resolveQueryAllowlist(pathWithoutLocale: string): Set<string> | null {
  if (
    pathWithoutLocale === '/examples' ||
    pathWithoutLocale.startsWith('/examples/') ||
    pathWithoutLocale === '/galerie' ||
    pathWithoutLocale.startsWith('/galerie/') ||
    pathWithoutLocale === '/galeria' ||
    pathWithoutLocale.startsWith('/galeria/')
  ) {
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

function isExamplesGalleryPath(pathWithoutLocale: string): boolean {
  return (
    pathWithoutLocale === '/examples' ||
    pathWithoutLocale.startsWith('/examples/') ||
    pathWithoutLocale === '/galerie' ||
    pathWithoutLocale.startsWith('/galerie/') ||
    pathWithoutLocale === '/galeria' ||
    pathWithoutLocale.startsWith('/galeria/')
  );
}

export function normalizePublicQueryParams(req: NextRequest, pathname: string): NextResponse | null {
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
  if (isExamplesGalleryPath(pathWithoutLocale)) {
    // Examples pages implement route-aware canonicalization in app code.
    // Skip middleware-level cleanup to avoid multi-hop redirects.
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
