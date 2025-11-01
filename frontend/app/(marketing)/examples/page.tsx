import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExamples, type ExampleSort } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { AudioEqualizerBadge } from '@/components/ui/AudioEqualizerBadge';

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
  const alias = ENGINE_LINK_ALIASES.get(engineId.trim().toLowerCase());
  if (alias) return alias;
  return engineId;
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

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

function toAbsoluteUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${SITE}${url}`;
  return `${SITE}/${url}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const title = 'Engine showcases — MaxVideo AI';
  const description =
    'A curated gallery of AI video renders across Sora, Veo, Pika, and MiniMax. Hover to loop, click to expand, and clone settings.';

  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE}/examples`,
      languages: {
        en: `${SITE}/examples`,
        fr: `${SITE}/examples?lang=fr`,
      },
    },
    openGraph: {
      type: 'website',
      url: `${SITE}/examples`,
      siteName: 'MaxVideo AI',
      title,
      description,
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
      title,
      description,
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

const SORT_OPTIONS: Array<{ id: ExampleSort; label: string }> = [
  { id: 'date-desc', label: 'Newest' },
  { id: 'date-asc', label: 'Oldest' },
  { id: 'duration-desc', label: 'Longest' },
  { id: 'duration-asc', label: 'Shortest' },
  { id: 'engine-asc', label: 'Engine A->Z' },
];

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

export default async function ExamplesPage({ searchParams }: ExamplesPageProps) {
  const { dictionary } = resolveDictionary();
  const content = dictionary.examples;
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const videos = await listExamples(sort, 60);
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
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-micro text-text-muted">Sort</span>
          <nav className="flex gap-2 rounded-pill border border-hairline bg-white px-2 py-1">
            {SORT_OPTIONS.map((option) => {
              const isActive = option.id === sort;
              const query = new URLSearchParams({ sort: option.id }).toString();
              return (
                <Link
                  key={option.id}
                  href={`/examples?${query}`}
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
        </div>
        <span className="text-xs text-text-muted">{videos.length} curated renders</span>
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
                  <Link
                    href={href}
                    className="relative block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                    aria-label={`Generate like this: ${promptDisplay}`}
                  >
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
                          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-micro text-white sm:text-[10px]">
                            Generate like this
                          </span>
                          <span className="text-white/60">{video.aspectRatio ?? 'Auto'} · {video.durationSec}s</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Link
                      href={`/video/${encodeURIComponent(video.id)}`}
                      className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/80 text-text-primary shadow-lg ring-1 ring-black/10 transition hover:bg-white hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      aria-label="View this video"
                    >
                      <svg width="18" height="20" viewBox="0 0 18 20" fill="currentColor" aria-hidden>
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
