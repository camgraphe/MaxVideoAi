import clsx from 'clsx';
import type { Metadata } from 'next';
import Head from 'next/head';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExamples, listExamplesPage, type ExampleSort } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';
import { ExamplesGalleryGrid, type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { localePathnames, localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { normalizeEngineId } from '@/lib/engine-alias';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';

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
const DEFAULT_SORT: ExampleSort = 'playlist';
const ALLOWED_QUERY_KEYS = new Set(['sort', 'engine', 'page']);
const EXAMPLES_PAGE_SIZE = 60;
const POSTER_PLACEHOLDERS: Record<string, string> = {
  '9:16': '/assets/frames/thumb-9x16.svg',
  '16:9': '/assets/frames/thumb-16x9.svg',
  '1:1': '/assets/frames/thumb-1x1.svg',
};

function getPlaceholderPoster(aspect?: string | null): string {
  if (!aspect) return POSTER_PLACEHOLDERS['16:9'];
  const normalized = aspect.trim();
  return POSTER_PLACEHOLDERS[normalized] ?? POSTER_PLACEHOLDERS['16:9'];
}
const EXAMPLES_INITIAL_BATCH = 12;

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

function isTrackingParam(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.startsWith('utm_') || normalized === 'gclid' || normalized === 'fbclid';
}

const ENGINE_FILTER_GROUPS: Record<
  string,
  {
    id: string;
    label: string;
    brandId?: string;
  }
> = {
  'sora-2': { id: 'sora-2', label: 'Sora 2' },
  'sora-2-pro': { id: 'sora-2', label: 'Sora 2' },
  'veo-3-1': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-first-last': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-1-first-last-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'veo-3-fast': { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  veo: { id: 'veo', label: 'Veo', brandId: 'google-veo' },
  'minimax-hailuo-02-text': { id: 'hailuo', label: 'MiniMax Hailuo', brandId: 'minimax' },
  'minimax-hailuo-02-image': { id: 'hailuo', label: 'MiniMax Hailuo', brandId: 'minimax' },
  'minimax-hailuo-02': { id: 'hailuo', label: 'MiniMax Hailuo', brandId: 'minimax' },
  hailuo: { id: 'hailuo', label: 'MiniMax Hailuo', brandId: 'minimax' },
  'pika-text-to-video': { id: 'pika', label: 'Pika', brandId: 'pika' },
  'pika-image-to-video': { id: 'pika', label: 'Pika', brandId: 'pika' },
  'pika-2-2': { id: 'pika', label: 'Pika', brandId: 'pika' },
  pika: { id: 'pika', label: 'Pika', brandId: 'pika' },
  'kling-2-5-turbo': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-2-6-pro': { id: 'kling', label: 'Kling', brandId: 'kling' },
  kling: { id: 'kling', label: 'Kling', brandId: 'kling' },
  'kling-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.5-turbo/pro/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.5-turbo/pro/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.6/pro/text-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
  'fal-ai/kling-video/v2.6/pro/image-to-video': { id: 'kling', label: 'Kling', brandId: 'kling' },
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

function buildExamplesCanonical(baseCanonical: string, engineParam: string, page: number | null): string {
  const params = new URLSearchParams();
  if (engineParam) {
    params.set('engine', engineParam);
  }
  if (page && page > 1) {
    params.set('page', String(page));
  }
  const suffix = params.toString();
  return suffix ? `${baseCanonical}?${suffix}` : baseCanonical;
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
  const metadataUrls = buildMetadataUrls(locale, GALLERY_SLUG_MAP, { englishPath: '/examples' });
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const engineLabel = resolveEngineLabel(searchParams.engine);
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : NaN;
  const normalizedPage = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : null;
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const canonical = buildExamplesCanonical(metadataUrls.canonical, collapsedEngineParam, normalizedPage);
  const title = engineLabel ? t('title_engine', { engineName: engineLabel }) : t('title');
  const description = engineLabel ? t('description_engine', { engineName: engineLabel }) : t('description');

  return buildSeoMetadata({
    locale,
    title,
    description,
    hreflangGroup: 'examples',
    slugMap: GALLERY_SLUG_MAP,
    image: ogImage,
    imageAlt: 'MaxVideo AI — Examples gallery preview',
    canonicalOverride: canonical,
    robots: {
      index: true,
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

function toISODuration(seconds?: number) {
  const s = Math.max(1, Math.round(Number(seconds || 0) || 6));
  return `PT${s}S`;
}

function toISODate(input?: Date | string) {
  const d = input ? new Date(input) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
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
    } else if (normalized.startsWith('sora-2')) {
      group = ENGINE_FILTER_GROUPS['sora-2'];
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
  const { locale, dictionary } = await resolveDictionary();
  const content = dictionary.examples;
  const engineFilterLabel = (content as { engineFilterLabel?: string })?.engineFilterLabel ?? 'Engines';
  const engineFilterAllLabel = (content as { engineFilterAllLabel?: string })?.engineFilterAllLabel ?? 'All';
  const paginationContent =
    (content as { pagination?: { prev?: string; next?: string; page?: string; loadMore?: string } })?.pagination ?? {};
  const paginationPrevLabel = paginationContent.prev ?? 'Previous';
  const paginationNextLabel = paginationContent.next ?? 'Next';
  const paginationPageLabel = paginationContent.page ?? 'Page';
  const loadMoreLabel = paginationContent.loadMore ?? 'Load more examples';
  const longDescription =
    locale === 'fr'
      ? "Ces rendus vidéo IA couvrent selfie face caméra, plans d'établissement cinématographiques, packs produit, formats mobiles et boucles sociales. Comparez comment chaque moteur gère le mouvement, la lumière et la composition pour le storytelling, le marketing de performance, les lancements ou le contenu UGC. MaxVideoAI oriente vos prompts vers les meilleurs moteurs avec des prix transparents et des contrôles pro, pour passer du concept à l'export final dans un seul workspace."
      : locale === 'es'
        ? 'Estos renders de video IA cubren talking heads, planos generales cinematográficos, close-ups de producto, formatos móviles y bucles listos para redes. Compara cómo cada motor maneja movimiento, iluminación y composición para storytelling, performance marketing, lanzamientos o contenido UGC. MaxVideoAI dirige tus prompts al mejor motor con precios transparentes y controles pro para pasar de concepto a exportación final en un solo workspace.'
        : 'These AI video renders cover a range of formats including selfie talking heads, cinematic establishing shots, product close-ups, mobile-first ads and social-ready loops. Explore how each engine handles motion, lighting and composition for storytelling, performance marketing, product launches or UGC-style content. MaxVideoAI routes your prompts to the best engines for your use case, with transparent pricing and pro-grade controls so creatives, studios and growth teams can move from concept to final export in a single workspace.';
  const recentAccessTitle =
    locale === 'fr' ? 'Accès direct aux rendus récents' : locale === 'es' ? 'Acceso directo a los renders recientes' : 'Direct access to recent renders';
  const recentAccessBody =
    locale === 'fr'
      ? 'Ces liens garantissent que chaque exemple public listé dans notre sitemap reste accessible en HTML standard pour le crawl.'
      : locale === 'es'
        ? 'Estos enlaces garantizan que cada ejemplo público de nuestro sitemap sea accesible en HTML estándar para el rastreo.'
        : 'These links ensure every public example listed in our sitemap is also reachable through standard HTML so search engines can explore them without JavaScript.';
  const showLabel = locale === 'fr' ? 'Afficher' : locale === 'es' ? 'Mostrar' : 'Show';
  const HERO_BODY_FALLBACK =
    'Browse AI video examples generated with Sora 2, Veo 3.1, Pika 2.2, Kling, Wan and more. Each clip shows the prompt, format and duration so you can compare how different engines handle camera moves, product shots, selfies and cinematic storytelling in one gallery.';
  const heroBody =
    typeof content.hero?.body === 'string' && content.hero.body.trim().length ? content.hero.body : HERO_BODY_FALLBACK;
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const engineLabel = resolveEngineLabel(searchParams.engine);
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
  const unsupportedQueryKeys = Object.keys(searchParams).filter(
    (key) => !ALLOWED_QUERY_KEYS.has(key) && !isTrackingParam(key),
  );

  const redirectToNormalized = (targetPage: number) => {
    const headerList = headers();
    const rawPath =
      headerList.get('x-pathname') ??
      headerList.get('x-invoke-path') ??
      headerList.get('x-matched-path') ??
      '/examples';
    const canonicalPath = rawPath.split('?')[0] || '/examples';
    const redirectedQuery = new URLSearchParams();
    if (sort !== DEFAULT_SORT) {
      redirectedQuery.set('sort', sort);
    }
    if (collapsedEngineParam) {
      redirectedQuery.set('engine', collapsedEngineParam);
    }
    if (targetPage > 1) {
      redirectedQuery.set('page', String(targetPage));
    }
    const target = redirectedQuery.toString() ? `${canonicalPath}?${redirectedQuery.toString()}` : canonicalPath;
    redirect(target);
  };

  if (unsupportedQueryKeys.length > 0 || hasInvalidPageParam) {
    redirectToNormalized(1);
  }

  const offset = (currentPage - 1) * EXAMPLES_PAGE_SIZE;
  const pageResult = await listExamplesPage({ sort, limit: EXAMPLES_PAGE_SIZE, offset });
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

const PREFERRED_ENGINE_ORDER = ['sora-2', 'veo', 'kling', 'wan', 'pika', 'hailuo', 'ltx-2'];
const normalizeFilterId = (value: string) => value.trim().toLowerCase();

const ENGINE_FILTER_STYLES: Record<string, { bg: string; text: string }> = {
  'sora-2': { bg: 'bg-[#F4EEFF]', text: 'text-[#5C3DC4]' },
  veo: { bg: 'bg-[#E7F1FF]', text: 'text-[#1A4D91]' },
  pika: { bg: 'bg-[#FFEFF8]', text: 'text-[#C42F7A]' },
  hailuo: { bg: 'bg-[#FFF4E6]', text: 'text-[#B05600]' },
  kling: { bg: 'bg-[#E6F4FF]', text: 'text-[#0F4C81]' },
  wan: { bg: 'bg-[#F2EAFE]', text: 'text-[#6B2BAA]' },
  'ltx-2': { bg: 'bg-[#E6F9FF]', text: 'text-[#0A6C80]' },
};

const ENGINE_MODEL_LINKS: Record<string, string> = {
  'sora-2': 'sora-2',
  veo: 'veo-3-1',
  kling: 'kling-2-5-turbo',
  wan: 'wan-2-6',
  pika: 'pika-text-to-video',
  hailuo: 'minimax-hailuo-02-text',
  'ltx-2': 'ltx-2',
};

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
  const selectedEngineLabel = selectedOption?.label ?? 'Model';
  const modelSlug = selectedEngine ? ENGINE_MODEL_LINKS[selectedEngine.toLowerCase()] ?? null : null;
  const modelPath = modelSlug ? { pathname: '/models/[slug]', params: { slug: modelSlug } } : null;
  const pricingPath = { pathname: '/pricing' };
  const engineModelLinkLabel =
    locale === 'fr'
      ? `Voir le modèle ${selectedEngineLabel}`
      : locale === 'es'
        ? `Ver modelo ${selectedEngineLabel}`
        : `View ${selectedEngineLabel} model`;
  const pricingLinkLabel = locale === 'fr' ? 'Comparer les tarifs' : locale === 'es' ? 'Comparar precios' : 'Compare pricing';

const videos = selectedEngine
  ? allVideos.filter((video) => {
      const canonicalEngineId = resolveEngineLinkId(video.engineId);
      if (!canonicalEngineId) return false;
      const engineMeta = ENGINE_META.get(canonicalEngineId.toLowerCase()) ?? null;
      const descriptor = resolveFilterDescriptor(canonicalEngineId, engineMeta, video.engineLabel);
      if (!descriptor) return false;
      return descriptor.id.toLowerCase() === selectedEngine.toLowerCase();
    })
  : allVideos;
const videoLinkEntries = videos.slice(0, 120).map((video) => {
  const excerpt = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render', 12);
  const suffix = video.id.replace(/^[^a-z0-9]+/gi, '').slice(-6).toUpperCase();
  return {
    id: video.id,
    label: excerpt.length ? excerpt : `MaxVideoAI render ${suffix}`,
  };
});

const clientVideos: ExampleGalleryVideo[] = videos.map((video) => {
  const canonicalEngineId = resolveEngineLinkId(video.engineId);
  const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
  const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
  const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
  const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
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
  };
});
const initialClientVideos = clientVideos.slice(0, EXAMPLES_INITIAL_BATCH);
const lcpPosterSrc = initialClientVideos[0]?.optimizedPosterUrl ?? initialClientVideos[0]?.rawPosterUrl ?? null;
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
    if (engineValue) {
      query.engine = engineValue;
    }
    if (pageValue && pageValue > 1) {
      query.page = String(pageValue);
    }
    return Object.keys(query).length ? query : undefined;
  };

  const itemListElements = videos
    .filter((video) => Boolean(video.thumbUrl))
    .map((video, index) => {
      const canonicalEngineId = resolveEngineLinkId(video.engineId);
      const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
      const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
      const engineLabel = engineMeta?.label ?? video.engineLabel ?? canonicalEngineId ?? 'Engine';
      const detailPath = `/video/${encodeURIComponent(video.id)}`;
      const absoluteUrl = `${SITE}${detailPath}`;
      const embedUrl = absoluteUrl;
      const contentUrl = video.videoUrl ? toAbsoluteUrl(video.videoUrl) ?? video.videoUrl : undefined;
      const fallbackLabel = `MaxVideoAI example ${video.id}`;
      const name = video.promptExcerpt || video.prompt || engineLabel || fallbackLabel;
      const description =
        video.promptExcerpt || video.prompt || `AI video example generated with ${engineLabel} in MaxVideoAI.`;
      const videoObject = {
        '@type': 'VideoObject',
        name: name || fallbackLabel,
        description,
        thumbnailUrl: video.thumbUrl!,
        url: absoluteUrl,
        embedUrl,
        contentUrl,
        uploadDate: toISODate(video.createdAt),
        duration: toISODuration(video.durationSec),
        inLanguage: localeRegions[locale as AppLocale] ?? 'en-US',
        publisher: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
          url: SITE,
          logo: `${SITE}/favicon-512.png`,
        },
      };
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl,
        item: videoObject,
      };
    });

  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const canonicalPath = `${localePrefix}/${GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en ?? 'examples'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const canonicalUrl = buildExamplesCanonical(
    `${SITE}${canonicalPath}`,
    collapsedEngineParam,
    currentPage > 1 ? currentPage : null
  );
  const baseExamplesUrl = `${SITE}${canonicalPath}`;
  const breadcrumbLabels = getBreadcrumbLabels(locale as AppLocale);
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
  if (engineLabel) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: engineLabel,
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
          url: canonicalUrl,
          itemListElement: itemListElements,
        }
      : null;

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://videohub-uploads-us.s3.amazonaws.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://v3b.fal.media" crossOrigin="anonymous" />
        {lcpPosterSrc ? <link rel="preload" as="image" href={lcpPosterSrc} fetchPriority="high" /> : null}
      </Head>
      <main className="container-page max-w-7xl section">
      <header className="max-w-3xl stack-gap">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
          <p className="text-sm leading-relaxed text-text-secondary/90">{heroBody}</p>
        </header>

      <section className="mt-8 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        {engineFilterOptions.length ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold uppercase tracking-micro text-text-muted">{engineFilterLabel}</span>
            <div className="flex flex-wrap items-center gap-1">
              <Link
                href={{ pathname: '/examples', query: buildQueryParams(DEFAULT_SORT, null, 1) }}
                rel="nofollow"
                className={clsx(
                  'flex h-9 items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectedEngine
                    ? 'border-hairline bg-white text-text-secondary hover:border-text-muted hover:text-text-primary'
                    : 'border-transparent bg-text-primary text-white shadow-card'
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
                    href={{ pathname: '/examples', query: buildQueryParams(DEFAULT_SORT, engine.id, 1) }}
                    rel="nofollow"
                    className={clsx(
                      'flex h-9 items-center justify-center rounded-full border px-4 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'border-transparent bg-text-primary text-white shadow-card'
                        : palette
                          ? clsx('border border-black/10 hover:opacity-90', palette.bg, palette.text)
                          : 'border-hairline bg-white text-text-secondary hover:border-text-muted hover:text-text-primary'
                    )}
                  >
                    {engine.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
      {selectedEngine && modelPath ? (
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-text-secondary">
          <Link href={modelPath} className="font-semibold text-brand hover:text-brandHover">
            {engineModelLinkLabel}
          </Link>
          <Link href={pricingPath} className="font-semibold text-brand hover:text-brandHover">
            {pricingLinkLabel}
          </Link>
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-[12px] border border-hairline bg-white/80 shadow-card">
        <ExamplesGalleryGrid
          examples={clientVideos}
          loadMoreLabel={loadMoreLabel}
        />
      </section>

      {totalPages > 1 ? (
        <nav className="mt-6 flex flex-col items-center justify-between gap-4 rounded-[24px] border border-hairline bg-white/70 px-4 py-4 text-sm text-text-secondary sm:flex-row">
          <div>
            {hasPreviousPage ? (
              <Link
                href={{
                  pathname: '/examples',
                  query: buildQueryParams(sort, selectedEngine, currentPage - 1),
                }}
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
                href={{
                  pathname: '/examples',
                  query: buildQueryParams(sort, selectedEngine, currentPage + 1),
                }}
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

        <section className="mt-10 max-w-4xl text-sm leading-relaxed text-text-secondary/90">
          <p>{longDescription}</p>
        </section>

        {videoLinkEntries.length ? (
          <details className="mt-10 rounded-[16px] border border-hairline bg-white/70 px-4 py-5 text-sm text-text-secondary/90">
            <summary className="flex cursor-pointer items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="text-base font-semibold text-text-primary">{recentAccessTitle}</span>
              <span className="text-xs uppercase tracking-micro text-text-muted">{showLabel}</span>
            </summary>
            <div className="mt-3">
              <p className="text-xs text-text-muted">{recentAccessBody}</p>
              <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {videoLinkEntries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/video/${encodeURIComponent(entry.id)}`}
                      className="text-text-secondary transition hover:text-text-primary"
                    >
                      {entry.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        <section className="mt-10">
          <details className="rounded-[16px] border border-hairline bg-white/80 px-4 py-5 shadow-card">
            <summary className="flex cursor-pointer items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  {locale === 'fr'
                    ? "Plus d'exemples vidéo IA"
                    : locale === 'es'
                      ? 'Más ejemplos de video IA'
                      : 'More AI video examples'}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {locale === 'fr'
                    ? 'Explorez davantage de rendus publics créés avec MaxVideoAI.'
                    : locale === 'es'
                      ? 'Explora más renderizados públicos creados con MaxVideoAI.'
                      : 'Browse more public renders created with MaxVideoAI.'}
                </p>
              </div>
              <span className="text-xs uppercase tracking-micro text-text-muted">
                {locale === 'fr' ? 'Afficher' : locale === 'es' ? 'Mostrar' : 'Show'}
              </span>
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                'job_5b9191d8-7f7c-4947-b007-c6aa384d97c1',
                'job_1d93e1b7-e4d4-4ae3-a2f3-421ffb4615c0',
                'job_0775869a-2386-40d4-9753-25083bf0f6b2',
                'job_5efdec94-0818-466b-b570-9898192b4f24',
                'job_c9abd206-c515-45f2-bb5a-dc5b18e35eeb',
                'job_45d957eb-e943-4838-b6f0-50a1b006687d',
                'job_71905754-c5e6-4078-864d-f17cd7f62d95',
                'job_27680a77-1690-4856-b188-5fd6d359d2f8',
                'job_1ecfbd83-2a68-4196-a453-a3e81e8a0623',
                'job_17214ed3-acbc-41b5-8528-59dce5f236a5',
                'job_3f4474d3-7481-4362-8fd9-a90d41853231',
                'job_93c9f857-1e89-4551-ba70-4619770a6cb1',
                'job_c1311458-e35c-4e4d-b791-488c14fc395e',
                'job_a1662b5f-8b50-465e-9af6-aba585e1d807',
                'job_9dda92fc-830a-41c4-88d4-44967acc8875',
                'job_19bc2180-5d30-458c-9034-610396cb9255',
                'job_c637ef05-1f9a-43b6-aeec-8b1bcf60e684',
                'job_f4b0fd07-cbd8-4f48-8e7c-3145d8063a99',
                'job_3676559d-d828-46c8-adc6-6dd0255f9e0a',
                'job_d5a3c272-4e3d-4932-b39b-837ac8aa462b',
                'job_948ac337-d8a4-40fe-9583-1995cdab75d1',
              ].map((id, index) => (
                <Link
                  key={id}
                  href={`/video/${encodeURIComponent(id)}`}
                  className="block rounded-lg border border-hairline bg-white/80 p-4 text-sm font-semibold text-text-primary shadow-card transition hover:border-text-muted hover:text-text-primary"
                >
                  {locale === 'fr'
                    ? `Exemple ${index + 1}`
                    : locale === 'es'
                      ? `Ejemplo ${index + 1}`
                      : `Example ${index + 1}`}
                </Link>
              ))}
            </div>
          </details>
        </section>

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
      </main>
    </>
  );
}
