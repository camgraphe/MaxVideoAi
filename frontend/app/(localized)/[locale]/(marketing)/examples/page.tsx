import clsx from 'clsx';
import type { Metadata } from 'next';
import { permanentRedirect, redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExamples, listExamplesPage, type ExampleSort } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';
import { MARKETING_EXAMPLE_SLUGS } from '@/config/navigation';
import { ExamplesGalleryGrid, type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import {
  getExampleModelLanding,
  getHubExamplesFaq,
} from '@/lib/examples/modelLanding';

const ENGINE_LINK_ALIASES = (() => {
  const map = new Map<string, string>();
  const register = (key: string | null | undefined, alias: string) => {
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    map.set(normalized, alias);
  };

  listFalEngines().forEach((entry) => {
    register(entry.id, entry.id);
    register(entry.modelSlug, entry.id);
    register(entry.defaultFalModelId, entry.id);
    entry.modes.forEach((mode) => register(mode.falModelId, entry.id));
  });

  return map;
})();

function resolveEngineLinkId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = normalizeEngineId(engineId) ?? engineId;
  const alias = ENGINE_LINK_ALIASES.get(normalized.trim().toLowerCase());
  if (alias) return alias;
  const fallback = ENGINE_LINK_ALIASES.get(engineId.trim().toLowerCase());
  if (fallback) return fallback;
  return normalized;
}

const ENGINE_META = (() => {
  const map = new Map<
    string,
    {
      id: string;
      label: string;
      brandId?: string;
      modelSlug?: string;
    }
  >();
  listFalEngines().forEach((entry) => {
    const identity = {
      id: entry.id,
      label: entry.engine.label,
      brandId: entry.engine.brandId ?? entry.brandId,
      modelSlug: entry.modelSlug,
    };
    const register = (key: string | null | undefined) => {
      if (!key) return;
      map.set(key.toLowerCase(), identity);
    };
    register(entry.id);
    register(entry.modelSlug);
    register(entry.defaultFalModelId);
    entry.modes.forEach((mode) => register(mode.falModelId));
  });
  return map;
})();

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || SITE_BASE_URL;
const GALLERY_SLUG_MAP = buildSlugMap('gallery');
const MODEL_SLUG_MAP = buildSlugMap('models');
const EXAMPLE_MODEL_SLUG_SET = new Set(MARKETING_EXAMPLE_SLUGS);
const DEFAULT_SORT: ExampleSort = 'playlist';
const EXAMPLES_PAGE_SIZE = 60;
const POSTER_PLACEHOLDERS: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};
const PREFERRED_ENGINE_ORDER = ['sora', 'kling', 'veo', 'wan', 'seedance', 'ltx-2', 'pika', 'hailuo'];
const normalizeFilterId = (value: string) => value.trim().toLowerCase();

const ENGINE_FILTER_STYLES: Record<string, { bg: string; text: string }> = {
  sora: { bg: 'var(--engine-openai-bg)', text: 'var(--engine-openai-ink)' },
  veo: { bg: 'var(--engine-google-veo-bg)', text: 'var(--engine-google-veo-ink)' },
  pika: { bg: 'var(--engine-pika-bg)', text: 'var(--engine-pika-ink)' },
  hailuo: { bg: 'var(--engine-minimax-bg)', text: 'var(--engine-minimax-ink)' },
  seedance: { bg: 'var(--engine-bytedance-bg)', text: 'var(--engine-bytedance-ink)' },
  kling: { bg: 'var(--engine-kling-bg)', text: 'var(--engine-kling-ink)' },
  wan: { bg: 'var(--engine-wan-bg)', text: 'var(--engine-wan-ink)' },
  'ltx-2': { bg: 'var(--engine-lightricks-bg)', text: 'var(--engine-lightricks-ink)' },
};

const ENGINE_MODEL_LINKS_BY_GROUP: Record<string, string[]> = {
  sora: ['sora-2-pro', 'sora-2'],
  veo: ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-first-last'],
  seedance: ['seedance-1-5-pro'],
  kling: ['kling-3-pro', 'kling-3-standard', 'kling-2-6-pro', 'kling-2-5-turbo'],
  wan: ['wan-2-6', 'wan-2-5'],
  pika: ['pika-text-to-video'],
  hailuo: ['minimax-hailuo-02-text'],
  'ltx-2': ['ltx-2', 'ltx-2-fast'],
};
const ENGINE_MODEL_LINKS: Record<string, string> = Object.fromEntries(
  Object.entries(ENGINE_MODEL_LINKS_BY_GROUP).map(([key, slugs]) => [key, slugs[0]])
) as Record<string, string>;

const ENGINE_EXAMPLE_LINKS: Record<string, string> = {
  sora: 'sora',
  veo: 'veo',
  kling: 'kling',
  wan: 'wan',
  seedance: 'seedance',
  pika: 'pika',
  hailuo: 'hailuo',
  'ltx-2': 'ltx-2',
};

function getPlaceholderPoster(aspect?: string | null): string {
  if (!aspect) return POSTER_PLACEHOLDERS['16:9'];
  const normalized = aspect.trim();
  return POSTER_PLACEHOLDERS[normalized] ?? POSTER_PLACEHOLDERS['16:9'];
}

function buildModelHref(locale: AppLocale, slug: string): string {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = MODEL_SLUG_MAP[locale] ?? MODEL_SLUG_MAP.en ?? 'models';
  return `${prefix}/${segment}/${slug}`.replace(/\/{2,}/g, '/');
}

function formatModelSlugLabel(slug: string): string {
  return slug
    .split('-')
    .map((part) => (/\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const ENGINE_FILTER_GROUPS: Record<
  string,
  {
    id: string;
    label: string;
    brandId?: string;
  }
> = {
  sora: { id: 'sora', label: 'Sora' },
  'sora-2': { id: 'sora', label: 'Sora' },
  'sora-2-pro': { id: 'sora', label: 'Sora' },
  'veo-3-1': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-first-last': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-first-last-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  veo: { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'minimax-hailuo-02-text': { id: 'hailuo', label: 'Hailuo', brandId: 'minimax' },
  'minimax-hailuo-02-image': { id: 'hailuo', label: 'Hailuo', brandId: 'minimax' },
  'minimax-hailuo-02': { id: 'hailuo', label: 'Hailuo', brandId: 'minimax' },
  hailuo: { id: 'hailuo', label: 'Hailuo', brandId: 'minimax' },
  'pika-text-to-video': { id: 'pika', label: 'Pika', brandId: 'pika' },
  'pika-image-to-video': { id: 'pika', label: 'Pika', brandId: 'pika' },
  'pika-2-2': { id: 'pika', label: 'Pika', brandId: 'pika' },
  pika: { id: 'pika', label: 'Pika', brandId: 'pika' },
  'kling-2-5-turbo': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-2-6-pro': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-3-standard': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-3-pro': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'seedance-1-5-pro': { id: 'seedance', label: 'Seedance', brandId: 'bytedance' },
  seedance: { id: 'seedance', label: 'Seedance', brandId: 'bytedance' },
  kling: { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.6/pro/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.6/pro/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v3/pro/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v3/pro/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v3/standard/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v3/standard/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/bytedance/seedance/v1.5/pro/text-to-video': {
    id: 'seedance',
    label: 'Seedance',
    brandId: 'bytedance',
  },
  'fal-ai/bytedance/seedance/v1.5/pro/image-to-video': {
    id: 'seedance',
    label: 'Seedance',
    brandId: 'bytedance',
  },
  'ltx-2-fast': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'ltx-2': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'fal-ai/ltx-2/text-to-video': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'fal-ai/ltx-2/image-to-video': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'fal-ai/ltx-2/text-to-video/fast': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'fal-ai/ltx-2/image-to-video/fast': { id: 'ltx-2', label: 'LTX-2', brandId: 'lightricks' },
  'wan-2-5': { id: 'wan', label: 'Wan', brandId: 'wan' },
  'wan-2-6': { id: 'wan', label: 'Wan', brandId: 'wan' },
  'wan/v2.6/text-to-video': { id: 'wan', label: 'Wan', brandId: 'wan' },
  'wan/v2.6/image-to-video': { id: 'wan', label: 'Wan', brandId: 'wan' },
  'wan/v2.6/reference-to-video': { id: 'wan', label: 'Wan', brandId: 'wan' },
  wan: { id: 'wan', label: 'Wan', brandId: 'wan' },
};

function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function resolveCanonicalEngineParam(raw: string | string[] | undefined): string {
  const engineParam = Array.isArray(raw) ? raw[0] : raw;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  if (!engineParamValue) return '';
  const canonicalEngineParam = normalizeEngineId(engineParamValue) ?? engineParamValue;
  const engineMeta = ENGINE_META.get(canonicalEngineParam.toLowerCase()) ?? null;
  const descriptor = resolveFilterDescriptor(canonicalEngineParam, engineMeta, canonicalEngineParam);
  return descriptor?.id.toLowerCase() ?? canonicalEngineParam.toLowerCase();
}

function resolveEngineLabel(raw: string | string[] | undefined): string | null {
  const engineParam = Array.isArray(raw) ? raw[0] : raw;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  if (!engineParamValue) return null;
  const canonicalEngineParam = normalizeEngineId(engineParamValue) ?? engineParamValue;
  const engineMeta = ENGINE_META.get(canonicalEngineParam.toLowerCase()) ?? null;
  const descriptor = resolveFilterDescriptor(canonicalEngineParam, engineMeta, canonicalEngineParam);
  return descriptor?.label ?? engineMeta?.label ?? canonicalEngineParam;
}

function resolveExampleCanonicalSlug(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = engineId.trim().toLowerCase();
  const canonical = normalizeEngineId(normalized) ?? normalized;
  const engineMeta = ENGINE_META.get(canonical.toLowerCase()) ?? null;
  const descriptor = resolveFilterDescriptor(canonical, engineMeta, canonical);
  const groupId = descriptor?.id?.toLowerCase() ?? canonical.toLowerCase();
  const exampleSlug =
    ENGINE_EXAMPLE_LINKS[groupId] ?? ENGINE_EXAMPLE_LINKS[canonical.toLowerCase()] ?? null;
  if (!exampleSlug) return null;
  return EXAMPLE_MODEL_SLUG_SET.has(exampleSlug) ? exampleSlug : null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'gallery.meta' });
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const engineLabel = resolveEngineLabel(searchParams.engine);
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const hasNonDefaultSort = sort !== DEFAULT_SORT;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : NaN;
  const normalizedPage = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : null;
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const canonicalExampleSlug = resolveExampleCanonicalSlug(collapsedEngineParam);
  const hasPaginatedView = Boolean(normalizedPage && normalizedPage > 1);
  const shouldNoindex =
    hasNonDefaultSort || hasPaginatedView || Boolean(collapsedEngineParam && !canonicalExampleSlug);
  const effectiveEngineLabel = canonicalExampleSlug ? engineLabel : null;
  const title = effectiveEngineLabel ? t('title_engine', { engineName: effectiveEngineLabel }) : t('title');
  const description = effectiveEngineLabel
    ? t('description_engine', { engineName: effectiveEngineLabel })
    : t('description');

  if (canonicalExampleSlug) {
    return buildSeoMetadata({
      locale,
      title,
      description,
      englishPath: `/examples/${canonicalExampleSlug}`,
      image: ogImage,
      imageAlt: 'MaxVideo AI — Examples gallery preview',
      robots: {
        index: !shouldNoindex,
        follow: true,
      },
    });
  }

  const metadataUrls = buildMetadataUrls(locale, GALLERY_SLUG_MAP, { englishPath: '/examples' });
  return buildSeoMetadata({
    locale,
    title,
    description,
    hreflangGroup: 'examples',
    slugMap: GALLERY_SLUG_MAP,
    image: ogImage,
    imageAlt: 'MaxVideo AI — Examples gallery preview',
    canonicalOverride: metadataUrls.canonical,
    robots: {
      index: !shouldNoindex,
      follow: true,
    },
  });
}

type ExamplesPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

// Labels will be localized from dictionary at render time

export const revalidate = 60;

function getSort(value: string | undefined): ExampleSort {
  if (
    value === 'playlist' ||
    value === 'date-asc' ||
    value === 'date-desc' ||
    value === 'duration-asc' ||
    value === 'duration-desc' ||
    value === 'engine-asc'
  ) {
    return value;
  }
  return DEFAULT_SORT;
}

function formatPromptExcerpt(prompt: string, maxWords = 18): string {
  const words = prompt.trim().split(/\s+/);
  if (words.length <= maxWords) return prompt.trim();
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function formatPrice(priceCents: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof priceCents !== 'number' || Number.isNaN(priceCents)) {
    return null;
  }
  const normalizedCurrency = typeof currency === 'string' && currency.length ? currency.toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(priceCents / 100);
  } catch {
    return `${normalizedCurrency} ${(priceCents / 100).toFixed(2)}`;
  }
}

function compactLeadCopy(value: string, maxChars = 130): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  const sentenceBreak = normalized.slice(0, maxChars).lastIndexOf('.');
  if (sentenceBreak > Math.floor(maxChars * 0.45)) {
    return normalized.slice(0, sentenceBreak + 1);
  }
  const wordBreak = normalized.slice(0, maxChars).lastIndexOf(' ');
  const end = wordBreak > 0 ? wordBreak : maxChars;
  return `${normalized.slice(0, end).trim()}...`;
}

type EngineFilterOption = {
  id: string;
  key: string;
  label: string;
  brandId?: string;
  count: number;
};

function resolveFilterDescriptor(
  canonicalEngineId: string | null | undefined,
  engineMeta: { label?: string; brandId?: string | undefined } | null,
  fallbackLabel?: string | null
): { id: string; label: string; brandId?: string } | null {
  if (!canonicalEngineId) return null;
  const normalized = canonicalEngineId.trim().toLowerCase();
  const directMatch = ENGINE_FILTER_GROUPS[normalized];
  let group = directMatch;

  if (!group) {
    if (normalized.startsWith('veo-3') || normalized.startsWith('veo3')) {
      group = ENGINE_FILTER_GROUPS['veo'];
    } else if (normalized.startsWith('sora-2') || normalized.startsWith('sora')) {
      group = ENGINE_FILTER_GROUPS['sora'];
    } else if (normalized.startsWith('pika')) {
      group = ENGINE_FILTER_GROUPS['pika'];
    } else if (normalized.includes('hailuo')) {
      group = ENGINE_FILTER_GROUPS['hailuo'];
    } else if (normalized.startsWith('kling')) {
      group = ENGINE_FILTER_GROUPS['kling'];
    } else if (normalized.startsWith('wan')) {
      group = ENGINE_FILTER_GROUPS['wan'];
    }
  }

  const targetId = group?.id ?? normalized;
  const targetOverride = ENGINE_FILTER_GROUPS[targetId];
  const label = group?.label ?? targetOverride?.label ?? engineMeta?.label ?? fallbackLabel ?? canonicalEngineId;
  const brandId = group?.brandId ?? targetOverride?.brandId ?? engineMeta?.brandId;
  return { id: targetId, label, brandId };
}

export default async function ExamplesPage({ searchParams }: ExamplesPageProps) {
  const internalEngineFromPath = Array.isArray(searchParams.__engineFromPath)
    ? searchParams.__engineFromPath[0]
    : searchParams.__engineFromPath;
  const engineFromPath =
    typeof internalEngineFromPath === 'string' && internalEngineFromPath.trim().length
      ? internalEngineFromPath.trim().toLowerCase()
      : '';
  const { locale, dictionary } = await resolveDictionary();
  const appLocale = locale as AppLocale;
  const content = dictionary.examples;
  const modelLanding = engineFromPath ? getExampleModelLanding(appLocale, engineFromPath) : null;
  const isModelLanding = Boolean(modelLanding);
  const hubFaq = getHubExamplesFaq(appLocale);
  const faqBlock = modelLanding
    ? { title: modelLanding.faqTitle, items: modelLanding.faqItems }
    : { title: hubFaq.title, items: hubFaq.items };
  const engineFilterAllLabel = (content as { engineFilterAllLabel?: string })?.engineFilterAllLabel ?? 'All';
  const browseByModelLabel =
    locale === 'fr'
      ? 'Parcourir par marque'
      : locale === 'es'
        ? 'Explorar por marca'
        : 'Browse by brand';
  const paginationContent =
    (content as { pagination?: { prev?: string; next?: string; page?: string; loadMore?: string } })?.pagination ?? {};
  const paginationPrevLabel = paginationContent.prev ?? 'Previous';
  const paginationNextLabel = paginationContent.next ?? 'Next';
  const paginationPageLabel = paginationContent.page ?? 'Page';
  const loadMoreLabel = paginationContent.loadMore ?? 'Load more examples';
  const longDescription =
    locale === 'fr'
      ? "Parcourez des exemples de vidéo IA par marque, avec prompt, réglages, durée et prix par clip. Utilisez ce hub pour comparer mouvement, lumière et composition, puis ouvrez les pages modèles pour les caractéristiques, limites et détails de mode."
      : locale === 'es'
        ? 'Explora ejemplos de video con IA por marca, con prompt, ajustes, duración y precio por clip. Usa este hub para revisar movimiento, luz y composición, y abre las páginas de modelos para ver especificaciones, límites y detalles por modo.'
        : 'Browse AI video examples by model, including prompt, settings, duration, and price per clip. Use this hub to review motion, lighting, and composition across brands, then open model pages for specs, limits, and mode details.';
  const HERO_BODY_FALLBACK =
    'Browse AI video examples by model with prompt, format, duration, and price per clip. Use filters to review outputs and open model pages for specs and limits.';
  const hubHeroBody =
    typeof content.hero?.body === 'string' && content.hero.body.trim().length ? content.hero.body : HERO_BODY_FALLBACK;
  const heroTitle = modelLanding?.heroTitle ?? content.hero.title;
  const heroSubtitle = modelLanding?.heroSubtitle ?? content.hero.subtitle;
  const heroBody = modelLanding?.intro ?? hubHeroBody;
  const modelLandingSections = modelLanding?.sections.map((section) => ({
    ...section,
    body: compactLeadCopy(section.body, 118),
  }));
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = (() => {
    if (typeof pageParam !== 'string' || pageParam.trim().length === 0) {
      return 1;
    }
    const value = Number.parseInt(pageParam, 10);
    return Number.isFinite(value) ? value : Number.NaN;
  })();
  const hasInvalidPageParam = typeof pageParam !== 'undefined' && (!Number.isFinite(parsedPage) || parsedPage < 1);
  const currentPage = hasInvalidPageParam ? 1 : Math.max(1, parsedPage || 1);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const gallerySegment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en ?? 'examples';
  const galleryBasePath = `${localePrefix}/${gallerySegment}`.replace(/\/{2,}/g, '/');

  const redirectToNormalized = (targetPage: number) => {
    const redirectedQuery = new URLSearchParams();
    if (sort !== DEFAULT_SORT) {
      redirectedQuery.set('sort', sort);
    }
    if (targetPage > 1) {
      redirectedQuery.set('page', String(targetPage));
    }
    const target = redirectedQuery.toString() ? `${galleryBasePath}?${redirectedQuery.toString()}` : galleryBasePath;
    redirect(target);
  };

  if (hasInvalidPageParam) {
    redirectToNormalized(1);
  }

  const canonicalExampleSlug = resolveExampleCanonicalSlug(collapsedEngineParam);
  if (collapsedEngineParam && !engineFromPath) {
    if (canonicalExampleSlug) {
      const redirectedQuery = new URLSearchParams();
      if (sort !== DEFAULT_SORT) {
        redirectedQuery.set('sort', sort);
      }
      if (currentPage > 1) {
        redirectedQuery.set('page', String(currentPage));
      }
      const target = redirectedQuery.toString()
        ? `${galleryBasePath}/${canonicalExampleSlug}?${redirectedQuery.toString()}`
        : `${galleryBasePath}/${canonicalExampleSlug}`;
      permanentRedirect(target);
    }
    redirectToNormalized(currentPage);
  }

  const offset = (currentPage - 1) * EXAMPLES_PAGE_SIZE;
  const pageResult = await listExamplesPage({
    sort,
    limit: EXAMPLES_PAGE_SIZE,
    offset,
    engineGroup: collapsedEngineParam || undefined,
  });
  const allVideos = pageResult.items;
  const totalCount = pageResult.total;
  const totalPages = Math.max(1, Math.ceil(totalCount / EXAMPLES_PAGE_SIZE));

  if (currentPage > totalPages) {
    redirectToNormalized(Math.max(1, totalPages));
  }

  const engineFilterMap = allVideos.reduce<Map<string, EngineFilterOption>>((acc, video) => {
    const canonicalEngineId = resolveEngineLinkId(video.engineId);
    if (!canonicalEngineId) return acc;
    const engineMeta = ENGINE_META.get(canonicalEngineId.toLowerCase()) ?? null;
    const descriptor = resolveFilterDescriptor(canonicalEngineId, engineMeta, video.engineLabel);
    if (!descriptor) return acc;
    const filterKey = descriptor.id.toLowerCase();
    const existing = acc.get(filterKey);
    if (existing) {
      existing.count += 1;
      return acc;
    }
    acc.set(filterKey, {
      id: descriptor.id,
      key: filterKey,
      label: descriptor.label,
      brandId: descriptor.brandId,
      count: 1,
    });
    return acc;
  }, new Map());

  const engineFilterOptions = PREFERRED_ENGINE_ORDER.map((preferredId) => {
    const key = normalizeFilterId(preferredId);
    const existing = engineFilterMap.get(key);
    if (existing) {
      return existing;
    }
    const base = ENGINE_FILTER_GROUPS[preferredId] ?? { id: preferredId, label: preferredId };
    return {
      id: base.id,
      key,
      label: base.label,
      brandId: base.brandId,
      count: 0,
    };
  });
  const selectedOption =
    collapsedEngineParam && engineFilterOptions.length
      ? engineFilterOptions.find((option) => option.key === normalizeFilterId(collapsedEngineParam))
      : null;
  const selectedEngine = selectedOption?.id ?? null;
  const modelSlugs = selectedEngine
    ? ENGINE_MODEL_LINKS_BY_GROUP[selectedEngine.toLowerCase()] ?? []
    : [];
  const modelLinks = modelSlugs.map((slug) => {
    const label = ENGINE_META.get(slug)?.label ?? formatModelSlugLabel(slug);
    return {
      slug,
      label,
      href: { pathname: '/models/[slug]' as const, params: { slug } },
    };
  });
  const pricingPath = { pathname: '/pricing' };
  const modelPagesLabel =
    locale === 'fr'
      ? 'Pages modèles concernées'
      : locale === 'es'
        ? 'Páginas de modelo relacionadas'
        : 'Related model pages';
  const pricingLinkLabel =
    locale === 'fr' ? 'Comparer les tarifs' : locale === 'es' ? 'Comparar precios' : 'Compare pricing';

  const filteredEntries = selectedEngine
    ? allVideos
        .map((video, index) => {
          const canonicalEngineId = resolveEngineLinkId(video.engineId);
          if (!canonicalEngineId) return null;
          const engineMeta = ENGINE_META.get(canonicalEngineId.toLowerCase()) ?? null;
          const descriptor = resolveFilterDescriptor(canonicalEngineId, engineMeta, video.engineLabel);
          if (!descriptor) return null;
          if (descriptor.id.toLowerCase() !== selectedEngine.toLowerCase()) return null;
          return { video, index };
        })
        .filter((entry): entry is { video: typeof allVideos[number]; index: number } => Boolean(entry))
    : allVideos.map((video, index) => ({ video, index }));
  const videos = filteredEntries.map((entry) => entry.video);
  const clientVideos: ExampleGalleryVideo[] = filteredEntries.map(({ video, index }) => {
    const canonicalEngineId = resolveEngineLinkId(video.engineId);
    const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
    const engineMeta = engineKey ? ENGINE_META.get(engineKey) ?? null : null;
    const descriptor = canonicalEngineId ? resolveFilterDescriptor(canonicalEngineId, engineMeta, video.engineLabel) : null;
    const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
    const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
    const modelSlug =
      engineMeta?.modelSlug ?? (descriptor ? ENGINE_MODEL_LINKS[descriptor.id.toLowerCase()] : null);
    const modelHref = modelSlug ? buildModelHref(locale as AppLocale, modelSlug) : null;
    return {
      id: video.id,
      href: `/video/${encodeURIComponent(video.id)}`,
      engineLabel: engineMeta?.label ?? video.engineLabel ?? 'Engine',
      engineIconId: engineMeta?.id ?? canonicalEngineId ?? video.engineId ?? 'engine',
      engineBrandId: engineMeta?.brandId,
      priceLabel,
      prompt: promptDisplay,
      aspectRatio: video.aspectRatio ?? null,
      durationSec: video.durationSec,
      hasAudio: video.hasAudio,
      optimizedPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl) : null,
      rawPosterUrl: video.thumbUrl ?? getPlaceholderPoster(video.aspectRatio),
      videoUrl: video.videoUrl ?? null,
      modelHref,
      sourceIndex: index,
    };
  });
  const initialExamples = clientVideos.slice(0, 12);
  const initialMaxIndex = initialExamples.reduce((max, video) => Math.max(max, video.sourceIndex ?? -1), -1);
  const pageOffsetStart = offset;
  const pageOffsetEnd = offset + allVideos.length;
  const nextOffsetStart = pageOffsetStart + Math.max(0, initialMaxIndex + 1);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const buildQueryParams = (
    nextSort: ExampleSort,
    engineValue: string | null,
    pageValue?: number
  ): Record<string, string> | undefined => {
    const query: Record<string, string> = {};
    if (nextSort !== DEFAULT_SORT) {
      query.sort = nextSort;
    }
    if (engineValue && !engineFromPath) {
      query.engine = engineValue;
    }
    if (pageValue && pageValue > 1) {
      query.page = String(pageValue);
    }
    return Object.keys(query).length ? query : undefined;
  };
  const buildEngineFilterHref = (engineId: string | null): string => {
    if (!engineId) {
      return galleryBasePath;
    }
    const canonicalSlug = resolveExampleCanonicalSlug(engineId);
    if (canonicalSlug) {
      return `${galleryBasePath}/${canonicalSlug}`;
    }
    const query = new URLSearchParams();
    query.set('engine', engineId);
    const suffix = query.toString();
    return suffix ? `${galleryBasePath}?${suffix}` : galleryBasePath;
  };
  const buildPaginationHref = (targetPage: number) => {
    const query = buildQueryParams(sort, selectedEngine, targetPage);
    if (engineFromPath && modelLanding) {
      const modelPath = `${galleryBasePath}/${modelLanding.slug}`;
      if (!query) return modelPath;
      const params = new URLSearchParams(query);
      const suffix = params.toString();
      return suffix ? `${modelPath}?${suffix}` : modelPath;
    }
    return {
      pathname: '/examples' as const,
      query,
    };
  };

  const itemListElements = videos.map((video, index) => {
      const canonicalEngineId = resolveEngineLinkId(video.engineId);
      const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
      const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
      const engineLabel = engineMeta?.label ?? video.engineLabel ?? canonicalEngineId ?? 'Engine';
      const detailPath = `/video/${encodeURIComponent(video.id)}`;
      const absoluteUrl = `${SITE}${detailPath}`;
      const fallbackLabel = `MaxVideoAI example ${video.id}`;
      const name = video.promptExcerpt || video.prompt || `${engineLabel} video example` || fallbackLabel;
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl,
        name: name || fallbackLabel,
      };
    });

  const baseExamplesUrl = `${SITE}${galleryBasePath}`;
  const canonicalUrl = modelLanding
    ? `${SITE}${galleryBasePath}/${modelLanding.slug}`
    : baseExamplesUrl;
  const breadcrumbLabels = getBreadcrumbLabels(appLocale);
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: `${SITE}${localePrefix || ''}`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.examples,
      item: baseExamplesUrl,
    },
  ];
  if (modelLanding) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: modelLanding.label,
      item: canonicalUrl,
    });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const itemListJson =
    itemListElements.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: modelLanding
            ? `AI video examples for ${modelLanding.label} on MaxVideoAI`
            : 'AI video examples on MaxVideoAI',
          numberOfItems: itemListElements.length,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          url: canonicalUrl,
          itemListElement: itemListElements,
        }
      : null;
  const faqJsonLd = faqBlock.items.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqBlock.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <>
      <main className="container-page max-w-7xl section">
        <div className="stack-gap-lg">
          <section className="halo-hero halo-hero-offset stack-gap-lg text-center">
            <header className="mx-auto max-w-3xl stack-gap-sm text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
              <p className="text-base leading-relaxed text-text-secondary">{heroSubtitle}</p>
              <p className="text-sm leading-relaxed text-text-secondary/90">{heroBody}</p>
            </header>

            {isModelLanding && selectedEngine && modelLinks.length ? (
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-text-secondary">
                <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{modelPagesLabel}</span>
                {modelLinks.map((model) => (
                  <Link key={model.slug} href={model.href} className="font-semibold text-brand hover:text-brandHover">
                    {model.label}
                  </Link>
                ))}
                <Link href={pricingPath} className="font-semibold text-brand hover:text-brandHover">
                  {pricingLinkLabel}
                </Link>
              </div>
            ) : null}
          </section>

          {modelLandingSections?.length ? (
            <section className="w-full overflow-x-auto pb-1">
              <div className="inline-flex w-max min-w-full justify-center gap-2 px-1">
                {modelLandingSections.map((section) => (
                  <article
                    key={section.title}
                    className="inline-flex min-w-[230px] max-w-[280px] items-center rounded-2xl border border-hairline/80 bg-surface/85 px-3 py-2.5 text-center shadow-sm"
                  >
                    <div className="min-w-0">
                      <h2 className="text-[11px] font-semibold leading-tight text-text-primary">{section.title}</h2>
                      <p
                        className="mt-1 text-[11px] leading-snug text-text-secondary/90"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {section.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-secondary">
            {engineFilterOptions.length ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="font-semibold uppercase tracking-micro text-text-muted">{browseByModelLabel}</span>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <Link
                    href={buildEngineFilterHref(null)}
                    scroll={false}
                    className={clsx(
                      'flex h-9 items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectedEngine
                        ? 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
                        : 'border-hairline bg-surface-2 text-text-primary shadow-card'
                    )}
                  >
                    {engineFilterAllLabel}
                  </Link>
                  {engineFilterOptions.map((engine) => {
                    const isActive = selectedEngine === engine.id;
                    const palette = ENGINE_FILTER_STYLES[engine.id.toLowerCase()] ?? null;
                    return (
                      <Link
                        key={engine.id}
                        href={buildEngineFilterHref(engine.id)}
                        scroll={false}
                        className={clsx(
                          'flex h-9 items-center justify-center rounded-full border px-4 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isActive
                            ? 'border-transparent bg-text-primary text-bg shadow-card'
                            : palette
                              ? 'border border-surface-on-media-dark-10 hover:opacity-90'
                              : 'border-hairline bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary'
                        )}
                        style={!isActive && palette ? { backgroundColor: palette.bg, color: palette.text } : undefined}
                      >
                        {engine.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-[12px] border border-hairline bg-surface/80 shadow-card">
            <ExamplesGalleryGrid
              initialExamples={initialExamples}
              loadMoreLabel={loadMoreLabel}
              sort={sort}
              engineFilter={selectedEngine?.toLowerCase() ?? null}
              initialOffset={nextOffsetStart}
              pageOffsetEnd={pageOffsetEnd}
              locale={locale}
            />
          </section>

          {totalPages > 1 ? (
            <nav className="flex flex-col items-center justify-between gap-4 rounded-[24px] border border-hairline bg-surface/70 px-4 py-4 text-sm text-text-secondary sm:flex-row">
              <div>
                {hasPreviousPage ? (
                  <Link
                    href={buildPaginationHref(currentPage - 1)}
                    rel="prev"
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ← {paginationPrevLabel}
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
                    ← {paginationPrevLabel}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                {paginationPageLabel} {currentPage} / {totalPages}
              </span>
              <div>
                {hasNextPage ? (
                  <Link
                    href={buildPaginationHref(currentPage + 1)}
                    rel="next"
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {paginationNextLabel} →
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
                    {paginationNextLabel} →
                  </span>
                )}
              </div>
            </nav>
          ) : null}

          {!modelLanding ? (
            <section className="max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{longDescription}</p>
            </section>
          ) : (
            <section className="max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{modelLanding.summary}</p>
            </section>
          )}

          <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">
              {locale === 'fr'
                ? 'Aller plus loin'
                : locale === 'es'
                  ? 'Siguientes pasos'
                  : 'Next steps'}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link href="/models" className="font-semibold text-brand hover:text-brandHover">
                {locale === 'fr'
                  ? 'Voir les spécifications et limites des modèles'
                  : locale === 'es'
                    ? 'Ver especificaciones y límites de modelos'
                    : 'See model specs and limits'}
              </Link>
              <Link href="/ai-video-engines" className="font-semibold text-brand hover:text-brandHover">
                {locale === 'fr'
                  ? 'Choisir un moteur par use case'
                  : locale === 'es'
                    ? 'Elegir motor por caso de uso'
                    : 'Choose an engine by use case'}
              </Link>
              <Link href="/pricing" className="font-semibold text-brand hover:text-brandHover">
                {locale === 'fr' ? 'Comparer les tarifs vidéo' : locale === 'es' ? 'Comparar precios' : 'Compare pricing'}
              </Link>
              <Link href="/workflows" className="font-semibold text-brand hover:text-brandHover">
                {locale === 'fr' ? 'Voir les workflows IA vidéo' : locale === 'es' ? 'Ver workflows de video IA' : 'See AI video workflows'}
              </Link>
            </div>
          </section>

          {faqBlock.items.length ? (
            <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
              <h2 className="text-lg font-semibold text-text-primary">{faqBlock.title}</h2>
              <div className="mt-4 space-y-3">
                {faqBlock.items.map((item) => (
                  <details key={item.question} className="rounded-lg border border-hairline bg-surface px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-text-primary">{item.question}</summary>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

        </div>

        {breadcrumbJsonLd ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
          />
        ) : null}
        {itemListJson ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJson) }}
          />
        ) : null}
        {faqJsonLd ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
          />
        ) : null}
      </main>
    </>
  );
}
