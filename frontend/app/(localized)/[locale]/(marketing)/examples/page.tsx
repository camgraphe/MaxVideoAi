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
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
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
const DEFAULT_SORT: ExampleSort = 'date-desc';
const ALLOWED_QUERY_KEYS = new Set(['sort', 'engine', 'page']);
const EXAMPLES_PAGE_SIZE = 60;
const EXAMPLES_INITIAL_BATCH = 12;

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
  kling: { id: 'kling', label: 'Kling', brandId: 'kling' },
  'wan-2-5': { id: 'wan', label: 'Wan 2.5', brandId: 'wan' },
  wan: { id: 'wan', label: 'Wan 2.5', brandId: 'wan' },
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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: AppLocale };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'gallery.meta' });
  const metadataUrls = buildMetadataUrls(locale, GALLERY_SLUG_MAP);
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : NaN;
  const normalizedPage = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : null;
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const canonical = normalizedPage ? `${metadataUrls.canonical}?page=${normalizedPage}` : metadataUrls.canonical;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: 'MaxVideoAI',
      title: t('title'),
      description: t('description'),
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: 'MaxVideo AI — Examples gallery preview',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

type ExamplesPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

// Labels will be localized from dictionary at render time

export const revalidate = 60;

function getSort(value: string | undefined): ExampleSort {
  if (value === 'date-asc' || value === 'duration-asc' || value === 'duration-desc' || value === 'engine-asc') {
    return value;
  }
  return 'date-desc';
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
  const { dictionary } = await resolveDictionary();
  const content = dictionary.examples;
  const engineFilterLabel = (content as { engineFilterLabel?: string })?.engineFilterLabel ?? 'Engines';
  const engineFilterAllLabel = (content as { engineFilterAllLabel?: string })?.engineFilterAllLabel ?? 'All';
  const paginationContent =
    (content as { pagination?: { prev?: string; next?: string; page?: string; loadMore?: string } })?.pagination ?? {};
  const paginationPrevLabel = paginationContent.prev ?? 'Previous';
  const paginationNextLabel = paginationContent.next ?? 'Next';
  const paginationPageLabel = paginationContent.page ?? 'Page';
  const loadMoreLabel = paginationContent.loadMore ?? 'Load more examples';
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const engineParam = Array.isArray(searchParams.engine) ? searchParams.engine[0] : searchParams.engine;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  const canonicalEngineParam = engineParamValue ? normalizeEngineId(engineParamValue) ?? engineParamValue : '';
  const collapsedEngineParam = (() => {
    if (!canonicalEngineParam) return '';
    const engineMeta = ENGINE_META.get(canonicalEngineParam.toLowerCase()) ?? null;
    const descriptor = resolveFilterDescriptor(canonicalEngineParam, engineMeta, canonicalEngineParam);
    return descriptor?.id.toLowerCase() ?? canonicalEngineParam.toLowerCase();
  })();
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
  const unsupportedQueryKeys = Object.keys(searchParams).filter((key) => !ALLOWED_QUERY_KEYS.has(key));

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

const PREFERRED_ENGINE_ORDER = ['sora-2', 'veo', 'kling', 'wan', 'pika', 'hailuo'];
const normalizeFilterId = (value: string) => value.trim().toLowerCase();

const ENGINE_FILTER_STYLES: Record<string, { bg: string; text: string }> = {
  'sora-2': { bg: 'bg-[#F4EEFF]', text: 'text-[#5C3DC4]' },
  veo: { bg: 'bg-[#E7F1FF]', text: 'text-[#1A4D91]' },
  pika: { bg: 'bg-[#FFEFF8]', text: 'text-[#C42F7A]' },
  hailuo: { bg: 'bg-[#FFF4E6]', text: 'text-[#B05600]' },
  kling: { bg: 'bg-[#E6F4FF]', text: 'text-[#0F4C81]' },
  wan: { bg: 'bg-[#F2EAFE]', text: 'text-[#6B2BAA]' },
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
const clientVideos: ExampleGalleryVideo[] = videos.map((video) => {
  const canonicalEngineId = resolveEngineLinkId(video.engineId);
  const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
  const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
  const engineSlug = engineMeta?.modelSlug ?? canonicalEngineId ?? video.engineId ?? null;
  const href =
    engineSlug && engineSlug.length
      ? `/models/${encodeURIComponent(engineSlug)}?ref=examples`
      : '/models?ref=examples';
  const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
  const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
  return {
    id: video.id,
    href,
    engineLabel: engineMeta?.label ?? video.engineLabel ?? 'Engine',
    engineIconId: engineMeta?.id ?? canonicalEngineId ?? video.engineId ?? 'engine',
    engineBrandId: engineMeta?.brandId,
    priceLabel,
    prompt: promptDisplay,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    optimizedPosterUrl: buildOptimizedPosterUrl(video.thumbUrl),
    rawPosterUrl: video.thumbUrl ?? null,
    videoUrl: video.videoUrl ?? null,
  };
});
const initialClientVideos = clientVideos.slice(0, EXAMPLES_INITIAL_BATCH);
const remainingClientVideos = clientVideos.slice(EXAMPLES_INITIAL_BATCH);
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
      const engineSlug = ENGINE_META.get(engineKey)?.modelSlug ?? canonicalEngineId ?? video.engineId ?? 'engine';
      const detailPath =
        engineSlug && engineSlug.length
          ? `/generate?from=${encodeURIComponent(video.id)}&engine=${encodeURIComponent(engineSlug)}`
          : `/generate?from=${encodeURIComponent(video.id)}`;
      const absoluteUrl = `https://maxvideoai.com${detailPath}`;
      const description =
        video.promptExcerpt || video.prompt || `AI video example generated with ${engineLabel} in MaxVideo AI.`;
      const item: Record<string, unknown> = {
        '@type': 'VideoObject',
        name: video.promptExcerpt || video.prompt || `${engineLabel} example`,
        description,
        thumbnailUrl: video.thumbUrl!,
        uploadDate: toISODate(video.createdAt),
        duration: toISODuration(video.durationSec),
        inLanguage: 'en',
        engine: engineLabel,
        publisher: {
          '@type': 'Organization',
          name: 'MaxVideo AI',
        },
      };
      if (video.videoUrl) {
        item.contentUrl = video.videoUrl;
      }
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl,
        item,
      };
    });
  const itemListJson =
    itemListElements.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
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
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
        <header className="max-w-3xl space-y-4">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
          <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
          <p className="text-sm leading-relaxed text-text-secondary/90">
            Browse a curated gallery of AI video examples generated with engines like Sora 2, Veo, Pika, Kling, Wan and
            more. Each clip shows the prompt, aspect ratio and duration so you can quickly understand how different
            models handle camera moves, product shots, selfie framing or cinematic storytelling. MaxVideoAI lets you mix
            and match engines, styles and formats on a simple pay‑as‑you‑go model, so professional creators and teams can
            test ideas, compare quality and ship production‑ready videos without committing to a single vendor.
          </p>
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
                  'flex h-9 items-center justify-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-micro transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                  selectedEngine
                    ? 'border-hairline bg-white text-text-secondary hover:border-accent hover:text-text-primary'
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
                      'flex h-9 items-center justify-center rounded-full border px-4 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                      isActive
                        ? 'border-transparent bg-text-primary text-white shadow-card'
                        : palette
                          ? clsx('border border-black/10 hover:opacity-90', palette.bg, palette.text)
                          : 'border-hairline bg-white text-text-secondary hover:border-accent hover:text-text-primary'
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

      <section className="mt-8 overflow-hidden rounded-[12px] border border-hairline bg-white/80 shadow-card">
        <ExamplesGalleryGrid
          initialVideos={initialClientVideos}
          remainingVideos={remainingClientVideos}
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
                className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
                className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
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
          <p>
            These AI video renders cover a range of formats including selfie talking heads, cinematic establishing shots,
            product close‑ups, mobile‑first ads and social‑ready loops. Explore how each engine handles motion, lighting
            and composition for storytelling, performance marketing, product launches or UGC‑style content. MaxVideoAI
            routes your prompts to the best engines for your use case, with transparent pricing and pro‑grade controls so
            creatives, studios and growth teams can move from concept to final export in a single workspace.
          </p>
        </section>

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
