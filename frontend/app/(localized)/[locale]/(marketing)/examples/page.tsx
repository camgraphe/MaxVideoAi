import clsx from 'clsx';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExamples, type ExampleSort } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { normalizeEngineId } from '@/lib/engine-alias';

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
    }
  >();
  listFalEngines().forEach((entry) => {
    const identity = {
      id: entry.id,
      label: entry.engine.label,
      brandId: entry.engine.brandId ?? entry.brandId,
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
const ALLOWED_QUERY_KEYS = new Set(['sort', 'engine']);

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
  'minimax-hailuo-02-text': { id: 'minimax-hailuo-02', label: 'MiniMax Hailuo 02', brandId: 'minimax' },
  'minimax-hailuo-02-image': { id: 'minimax-hailuo-02', label: 'MiniMax Hailuo 02', brandId: 'minimax' },
  'minimax-hailuo-02': { id: 'minimax-hailuo-02', label: 'MiniMax Hailuo 02', brandId: 'minimax' },
  'pika-text-to-video': { id: 'pika-2-2', label: 'Pika 2.2', brandId: 'pika' },
  'pika-image-to-video': { id: 'pika-2-2', label: 'Pika 2.2', brandId: 'pika' },
  'pika-2-2': { id: 'pika-2-2', label: 'Pika 2.2', brandId: 'pika' },
};

function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'gallery.meta' });
  const metadataUrls = buildMetadataUrls(locale, GALLERY_SLUG_MAP);
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      type: 'website',
      url: metadataUrls.canonical,
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

function parseAspectRatio(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  if (normalized.includes(':')) {
    const [w, h] = normalized.split(':');
    const width = Number.parseFloat(w);
    const height = Number.parseFloat(h);
    if (Number.isFinite(width) && Number.isFinite(height) && height !== 0) {
      return width / height;
    }
    return null;
  }
  const ratio = Number.parseFloat(normalized);
  if (Number.isFinite(ratio) && ratio > 0) return ratio;
  return null;
}

function toISODuration(seconds?: number) {
  const s = Math.max(1, Math.round(Number(seconds || 0) || 6));
  return `PT${s}S`;
}

function toISODate(input?: Date | string) {
  const d = input ? new Date(input) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

const ENGINE_FILTER_LIMIT = 6;

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
  const override = ENGINE_FILTER_GROUPS[canonicalEngineId];
  const targetId = override?.id ?? canonicalEngineId;
  const targetOverride = ENGINE_FILTER_GROUPS[targetId];
  const label = override?.label ?? targetOverride?.label ?? engineMeta?.label ?? fallbackLabel ?? targetId;
  const brandId = override?.brandId ?? targetOverride?.brandId ?? engineMeta?.brandId;
  return { id: targetId, label, brandId };
}

export default async function ExamplesPage({ searchParams }: ExamplesPageProps) {
  const { dictionary } = await resolveDictionary();
  const content = dictionary.examples;
  const sortContent = (content as { sort?: Record<string, string> })?.sort;
  const sortLabel = (content as { sortLabel?: string })?.sortLabel ?? 'Sort';
  const countLabel = (content as { countLabel?: string })?.countLabel ?? 'curated renders';
  const engineFilterLabel = (content as { engineFilterLabel?: string })?.engineFilterLabel ?? 'Engines';
  const engineFilterAllLabel = (content as { engineFilterAllLabel?: string })?.engineFilterAllLabel ?? 'All';
  const sortLabels = sortContent ?? {
    newest: 'Newest',
    oldest: 'Oldest',
    longest: 'Longest',
    shortest: 'Shortest',
    engineAZ: 'Engine A->Z',
  };
  const SORT_OPTIONS: Array<{ id: ExampleSort; label: string }> = [
    { id: 'date-desc', label: sortLabels.newest ?? 'Newest' },
    { id: 'date-asc', label: sortLabels.oldest ?? 'Oldest' },
    { id: 'duration-desc', label: sortLabels.longest ?? 'Longest' },
    { id: 'duration-asc', label: sortLabels.shortest ?? 'Shortest' },
    { id: 'engine-asc', label: sortLabels.engineAZ ?? 'Engine A->Z' },
  ];
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const engineParam = Array.isArray(searchParams.engine) ? searchParams.engine[0] : searchParams.engine;
  const engineParamValue = typeof engineParam === 'string' ? engineParam.trim() : '';
  const canonicalEngineParam = engineParamValue ? normalizeEngineId(engineParamValue) ?? engineParamValue : '';
  const normalizedEngineParam = canonicalEngineParam.toLowerCase();
  const unsupportedQueryKeys = Object.keys(searchParams).filter((key) => !ALLOWED_QUERY_KEYS.has(key));

  if (unsupportedQueryKeys.length > 0) {
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
    if (canonicalEngineParam) {
      redirectedQuery.set('engine', canonicalEngineParam);
    }
    const target = redirectedQuery.toString() ? `${canonicalPath}?${redirectedQuery.toString()}` : canonicalPath;
    redirect(target);
  }

  const allVideos = await listExamples(sort, 60);

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

  let engineFilterOptions = Array.from(engineFilterMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  const selectedOption =
    normalizedEngineParam && engineFilterOptions.length
      ? engineFilterOptions.find((option) => option.key === normalizedEngineParam)
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

  engineFilterOptions = engineFilterOptions.slice(0, ENGINE_FILTER_LIMIT);
  if (selectedEngine && !engineFilterOptions.some((option) => option.key === selectedEngine.toLowerCase())) {
    const selectedMeta = engineFilterMap.get(selectedEngine.toLowerCase());
    if (selectedMeta) {
      engineFilterOptions = [...engineFilterOptions, selectedMeta];
    }
  }

  const buildQueryParams = (nextSort: ExampleSort, engineValue: string | null): Record<string, string> | undefined => {
    const query: Record<string, string> = {};
    if (nextSort !== DEFAULT_SORT) {
      query.sort = nextSort;
    }
    if (engineValue) {
      query.engine = engineValue;
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
      const engineSlug = canonicalEngineId ?? video.engineId ?? 'engine';
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
  const jsonLdChunks = (() => {
    if (!itemListJson) return [];
    const raw = JSON.stringify(itemListJson);
    const chunks: string[] = [];
    const CHUNK_SIZE = 50_000;
    for (let i = 0; i < raw.length; i += CHUNK_SIZE) {
      chunks.push(raw.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold uppercase tracking-micro text-text-muted">{sortLabel}</span>
          <nav className="flex gap-2 rounded-pill border border-hairline bg-white px-2 py-1">
            {SORT_OPTIONS.map((option) => {
              const isActive = option.id === sort;
              const queryParams = buildQueryParams(option.id, selectedEngine);
              return (
                <Link
                  key={option.id}
                  href={{ pathname: '/examples', query: queryParams }}
                  rel="nofollow"
                  className={clsx(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    isActive ? 'bg-text-primary text-white shadow-sm' : 'text-text-secondary hover:bg-accentSoft/20'
                  )}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
          {engineFilterOptions.length ? (
            <div className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-micro text-text-muted">{engineFilterLabel}</span>
              <div className="flex items-center gap-1">
                <Link
                  href={{ pathname: '/examples', query: buildQueryParams(sort, null) }}
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
                  return (
                    <Link
                      key={engine.id}
                      href={{ pathname: '/examples', query: buildQueryParams(sort, isActive ? null : engine.id) }}
                      rel="nofollow"
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                        isActive
                          ? 'border-transparent bg-text-primary text-white shadow-card'
                          : 'border-hairline bg-white text-text-secondary hover:border-accent hover:text-text-primary'
                      )}
                      aria-label={engine.label}
                    >
                      <EngineIcon
                        engine={{ id: engine.id, label: engine.label, brandId: engine.brandId }}
                        size={20}
                        rounded="full"
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-text-muted">
          {videos.length} {countLabel}
        </span>
      </section>

      <section className="mt-8 overflow-hidden rounded-[32px] border border-hairline bg-white/80 shadow-card">
        <div className="columns-1 gap-[2px] bg-white/60 p-[2px] sm:columns-2 lg:columns-3 xl:columns-4">
          {videos.map((video) => {
            const canonicalEngineId = resolveEngineLinkId(video.engineId);
            const href =
              canonicalEngineId && canonicalEngineId.length
                ? `/generate?from=${encodeURIComponent(video.id)}&engine=${encodeURIComponent(canonicalEngineId)}`
                : `/generate?from=${encodeURIComponent(video.id)}`;
            const engineKey = canonicalEngineId?.toLowerCase() ?? '';
            const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
            const priceLabel = formatPrice(video.finalPriceCents ?? null, video.currency ?? null);
            const promptDisplay = formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render');
            const rawRatio = parseAspectRatio(video.aspectRatio) ?? 16 / 9;
            const clampedRatio = Math.min(Math.max(rawRatio, 0.68), 1.35);
            const displayAspect = `${clampedRatio} / 1`;

            return (
              <article
                key={video.id}
                className="group relative mb-[2px] break-inside-avoid overflow-hidden bg-neutral-900/5"
              >
                <div className="relative">
                  <div className="relative w-full overflow-hidden" style={{ aspectRatio: displayAspect }}>
                    {video.videoUrl ? (
                      <video
                        className="absolute inset-0 h-full w-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        poster={video.thumbUrl}
                      >
                        <source src={video.videoUrl} type="video/mp4" />
                      </video>
                    ) : video.thumbUrl ? (
                      <Image
                        src={video.thumbUrl}
                        alt={promptDisplay}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 320px, (min-width: 768px) 280px, 100vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-xs font-semibold uppercase tracking-micro text-text-muted">
                        Preview unavailable
                      </div>
                    )}
                    {video.hasAudio ? <AudioEqualizerBadge tone="light" size="sm" label="Audio available on playback" /> : null}
                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/20 via-black/60 to-black/85 opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <div className="space-y-2.5 p-5 text-white">
                        <div className="flex items-center gap-2 text-white">
                          <EngineIcon
                            engine={{
                              id: engineMeta?.id ?? video.engineId ?? '',
                              label: engineMeta?.label ?? video.engineLabel ?? 'Engine',
                              brandId: engineMeta?.brandId,
                            }}
                            size={24}
                            rounded="full"
                          />
                          <h2 className="text-base font-semibold leading-tight sm:text-lg">
                            {engineMeta?.label ?? video.engineLabel ?? 'Engine'}
                          </h2>
                          {priceLabel ? (
                            <span className="ml-auto text-[11px] font-medium text-white/70 sm:text-xs">{priceLabel}</span>
                          ) : null}
                        </div>
                        <p className="text-[10px] font-medium leading-snug text-white/75 sm:text-[11px]">{promptDisplay}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-5 text-[10px] text-white/70 sm:text-xs">
                        <Link
                          href={href}
                          className="pointer-events-auto rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-micro text-white transition hover:bg-white/40 sm:text-[10px]"
                        >
                          Generate like this
                        </Link>
                        <span className="text-white/60">{video.aspectRatio ?? 'Auto'} · {video.durationSec}s</span>
                      </div>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Link
                      href={`/video/${encodeURIComponent(video.id)}`}
                      locale={false}
                      className="pointer-events-auto inline-flex h-16 w-16 items-center justify-center text-white/30 transition hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      aria-label="View this video"
                    >
                      <svg width="32" height="36" viewBox="0 0 18 20" fill="currentColor" aria-hidden>
                        <path d="M16.5 9.134c1 0.577 1 2.155 0 2.732L2.5 20.014C1.5 20.59 0 19.812 0 18.548V2.452C0 1.188 1.5 0.41 2.5 0.986l14 8.148z" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {jsonLdChunks.map((chunk, index) => (
        <script
          key={`examples-jsonld-${index}`}
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: chunk }}
        />
      ))}
    </div>
  );
}
