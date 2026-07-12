import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveRuntimePublicSlug } from '@/config/model-runtime';
import type { AppLocale } from '@/i18n/locales';
import { LOCALIZED_SEGMENT_VALUES, splitLocaleFromPath } from './routing-locale';

const KNOWN_MARKETING_SEGMENTS = new Set(
  [
    '',
    'about',
    'ai-video-engines',
    'benchmarks',
    'blog',
    'changelog',
    'company',
    'contact',
    'docs',
    'examples',
    'legal',
    'models',
    'pay-as-you-go-ai-video-generator',
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
};
const GONE_MARKETING_PATHS = new Set(['/a']);
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
const NON_PREFIXED_LOCALIZED_EXAMPLES_PREFIXES = {
  fr: '/galerie',
  es: '/galeria',
} as const;

type PublicModelResolver = typeof resolveRuntimePublicSlug;
const NON_PREFIXED_LOCALIZED_BLOG_SLUGS = {
  fr: new Set([
    'acceder-a-sora-2-sans-invitation',
    'comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
    'comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video',
    'explorer-plusieurs-angles-de-camera-a-partir-dune-image-approuvee',
    'generateur-de-fiche-personnage-ia',
    'invites-sequencees-sora-2-avec-son-et-image-de-marque',
    'les-mises-a-jour-de-veo-3-apportent-des-controles-cinematographiques',
    'lia-peut-elle-changer-langle-de-camera-dune-photo',
  ]),
  es: new Set([
    'accede-a-sora-2-sin-invitacion',
    'como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika',
    'como-crear-personajes-de-ia-coherentes-en-imagenes-y-video',
    'como-explorar-multiples-angulos-de-camara-desde-una-imagen-aprobada',
    'generador-de-fichas-de-personaje-con-ia',
    'indicaciones-secuenciadas-de-sora-2-con-sonido-e-identidad-de-marca',
    'la-ia-puede-cambiar-el-angulo-de-camara-de-una-foto',
    'las-actualizaciones-de-veo-3-traen-controles-cinematograficos',
  ]),
} as const;

const EXACT_LOCALE_REDIRECTS: Record<string, string> = {
  '/fr/about': '/a-propos',
  '/es/about': '/acerca-de',
  '/fr/company': '/entreprise',
  '/es/company': '/empresa',
  '/fr/status': '/statut',
  '/es/status': '/estado',
  // Compare AI video engines
  '/fr/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika':
    '/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
  '/es/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika':
    '/blog/como-comparar-motores-de-video-con-ia-sora-vs-veo-vs-pika',
  '/fr/blog/comment-comparer-les-modèles-video-dia-sora-vs-veo-vs-pika':
    '/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
  '/fr/blog/comment-comparer-les-mod%c3%a8les-video-dia-sora-vs-veo-vs-pika':
    '/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
  '/blog/comment-comparer-les-modèles-video-dia-sora-vs-veo-vs-pika':
    '/fr/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
  '/blog/comment-comparer-les-mod%c3%a8les-video-dia-sora-vs-veo-vs-pika':
    '/fr/blog/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika',
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
  // Localized blog posts that were previously crawled without locale prefixes.
  '/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video':
    '/fr/blog/comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video',
  '/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video':
    '/es/blog/como-crear-personajes-de-ia-coherentes-en-imagenes-y-video',
};

function resolveLocalizedEnglishModelSegment(
  req: NextRequest,
  normalizedPath: string,
  localePrefix: string,
  resolvePublicSlug: PublicModelResolver
): NextResponse | null {
  if (localePrefix !== '/fr' && localePrefix !== '/es') return null;
  if (!normalizedPath.startsWith('/models/')) return null;
  const slug = normalizedPath.slice('/models/'.length);
  if (!slug || slug.includes('/')) return null;
  const model = resolvePublicSlug(slug);
  if (!model) return null;
  const localizedBase = localePrefix === '/fr' ? 'modeles' : 'modelos';
  const redirectUrl = req.nextUrl.clone();
  redirectUrl.pathname = `${localePrefix}/${localizedBase}/${model.slug}`;
  return NextResponse.redirect(redirectUrl, 301);
}

export function isDottedLocalizedEnglishModelCompatibilityPath(
  pathname: string,
  resolvePublicSlug: PublicModelResolver = resolveRuntimePublicSlug
): boolean {
  const { localePrefix, pathWithoutLocale } = splitLocaleFromPath(pathname);
  if (localePrefix !== '/fr' && localePrefix !== '/es') return false;
  const normalizedPath = normalizePath(pathWithoutLocale);
  if (!normalizedPath.startsWith('/models/')) return false;
  const slug = normalizedPath.slice('/models/'.length);
  if (!slug || slug.includes('/') || !slug.includes('.')) return false;
  return resolvePublicSlug(slug) !== null;
}

export function handleMarketingSlug(
  req: NextRequest,
  pathname: string,
  resolvePublicSlug: PublicModelResolver = resolveRuntimePublicSlug
): NextResponse | null {
  const { localePrefix, pathWithoutLocale } = splitLocaleFromPath(pathname);
  const normalizedPath = normalizePath(pathWithoutLocale);
  const localizedEnglishModelRedirect = resolveLocalizedEnglishModelSegment(
    req,
    normalizedPath,
    localePrefix,
    resolvePublicSlug
  );
  if (localizedEnglishModelRedirect) {
    return localizedEnglishModelRedirect;
  }
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

export function resolveNonPrefixedLocalizedMarketingRedirect(req: NextRequest, pathname: string): NextResponse | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return null;
  }

  for (const [locale, prefix] of Object.entries(NON_PREFIXED_LOCALIZED_EXAMPLES_PREFIXES) as Array<
    [Exclude<AppLocale, 'en'>, string]
  >) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${locale}${pathname}`;
      return NextResponse.redirect(redirectUrl, 301);
    }
  }

  if (!pathname.startsWith('/blog/')) {
    return null;
  }

  const slug = pathname.slice('/blog/'.length);
  if (!slug || slug.includes('/')) {
    return null;
  }

  for (const [locale, slugs] of Object.entries(NON_PREFIXED_LOCALIZED_BLOG_SLUGS) as Array<
    [Exclude<AppLocale, 'en'>, Set<string>]
  >) {
    if (slugs.has(slug)) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${locale}/blog/${slug}`;
      return NextResponse.redirect(redirectUrl, 301);
    }
  }

  return null;
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

export function rewriteToNotFound(req: NextRequest, localePrefix: string) {
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
        current[j] + 1,
        prev[j + 1] + 1,
        prev[j] + cost
      );
    }
    for (let k = 0; k < prev.length; k += 1) {
      prev[k] = current[k];
    }
    current = new Array(b.length + 1);
  }
  return prev[b.length];
}
