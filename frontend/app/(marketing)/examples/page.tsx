import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { resolveDictionary } from '@/lib/i18n/server';
import { ENGINE_CAP_INDEX } from '@/fixtures/engineCaps';
import { listExamples, type ExampleSort } from '@/server/videos';

const ADDITIONAL_ENGINE_ALIASES: Record<string, string> = {
  'pika-22': 'pika22',
  'fal-ai/pika/v2.2/text-to-video': 'pika22',
  'fal-ai/pika/v2.2/image-to-video': 'pika22',
  'fal-ai/luma-dream-machine': 'lumaDM',
  'fal-ai/luma-dream-machine/image-to-video': 'lumaDM',
  'fal-ai/luma-dream-machine/modify': 'lumaDM',
  'fal-ai/minimax/hailuo-02/pro': 'minimax_hailuo_02_pro',
  'fal-ai/hunyuan-video/image-to-video': 'hunyuan_video',
};

const ENGINE_LINK_ALIASES = (() => {
  const map = new Map<string, string>();
  const register = (key: string | null | undefined, alias: string) => {
    if (!key) return;
    const normalized = key.trim().toLowerCase();
    if (!normalized) return;
    map.set(normalized, alias);
  };

  Object.entries(ENGINE_CAP_INDEX).forEach(([alias, modeMap]) => {
    register(alias, alias);
    Object.values(modeMap ?? {}).forEach((engineId) => register(engineId ?? null, alias));
  });

  Object.entries(ADDITIONAL_ENGINE_ALIASES).forEach(([key, value]) => register(key, value));

  return map;
})();

function resolveEngineLinkId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const alias = ENGINE_LINK_ALIASES.get(engineId.trim().toLowerCase());
  if (alias) return alias;
  return engineId;
}

export const metadata: Metadata = {
  title: 'Examples — MaxVideo AI',
  description: 'Explore real outputs from routed models across use cases and aspect ratios.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Examples — MaxVideo AI',
    description: 'Real AI video outputs with hover loops and engine routing annotations.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Examples grid preview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/examples',
    languages: {
      en: 'https://maxvideoai.com/examples',
      fr: 'https://maxvideoai.com/examples?lang=fr',
    },
  },
};

type ExamplesPageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

const SORT_OPTIONS: Array<{ id: ExampleSort; label: string }> = [
  { id: 'date-desc', label: 'Newest' },
  { id: 'date-asc', label: 'Oldest' },
  { id: 'duration-desc', label: 'Longest' },
  { id: 'duration-asc', label: 'Shortest' },
  { id: 'engine-asc', label: 'Engine A→Z' },
];

function getSort(value: string | undefined): ExampleSort {
  if (value === 'date-asc' || value === 'duration-asc' || value === 'duration-desc' || value === 'engine-asc') {
    return value;
  }
  return 'date-desc';
}

export default async function ExamplesPage({ searchParams }: ExamplesPageProps) {
  const { dictionary } = resolveDictionary();
  const content = dictionary.examples;
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const videos = await listExamples(sort, 60);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <div className="mt-10 flex items-center justify-between gap-4">
        <p className="text-xs text-text-muted">{videos.length} public renders</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold uppercase tracking-micro text-text-muted">Sort</span>
          <nav className="flex gap-1 rounded-pill border border-hairline bg-white p-1">
            {SORT_OPTIONS.map((option) => {
              const isActive = option.id === sort;
              const query = new URLSearchParams({ sort: option.id }).toString();
              return (
                <Link
                  key={option.id}
                  href={`/examples?${query}`}
                  className={`rounded-pill px-2 py-1 transition ${
                    isActive ? 'bg-text-primary text-white' : 'text-text-secondary hover:bg-accentSoft/20'
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => {
          const canonicalEngineId = resolveEngineLinkId(video.engineId);
          const href =
            canonicalEngineId && canonicalEngineId.length
              ? `/generate?from=${encodeURIComponent(video.id)}&engine=${encodeURIComponent(canonicalEngineId)}`
              : `/generate?from=${encodeURIComponent(video.id)}`;
          return (
            <article key={video.id} className="group overflow-hidden rounded-card border border-hairline bg-white shadow-card">
              <Link href={href} className="block">
                <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-200 via-white to-amber-50">
                  {video.videoUrl ? (
                    <video
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={video.thumbUrl}
                      aria-label={video.promptExcerpt}
                    >
                      <source src={video.videoUrl} type="video/mp4" />
                    </video>
                  ) : video.thumbUrl ? (
                    <Image
                      src={video.thumbUrl}
                      alt={video.promptExcerpt}
                      fill
                      className="object-cover"
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-micro text-text-muted">
                      Preview unavailable
                    </div>
                  )}
                </div>
                <div className="space-y-2 border-t border-hairline p-4">
                  <h2 className="text-lg font-semibold text-text-primary">{video.engineLabel}</h2>
                  <p className="text-xs font-medium uppercase tracking-micro text-text-muted">
                    Duration {video.durationSec}s · Ratio {video.aspectRatio ?? 'Auto'}
                  </p>
                  <p className="text-sm text-text-secondary">{video.promptExcerpt}</p>
                  <span className="inline-flex items-center rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary">
                    {content.cta}
                  </span>
                </div>
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
