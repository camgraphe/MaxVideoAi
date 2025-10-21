import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExamples, type ExampleSort } from '@/server/videos';

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
        {videos.map((video) => (
          <article key={video.id} className="group overflow-hidden rounded-card border border-hairline bg-white shadow-card">
            <Link href={`/generate?from=${encodeURIComponent(video.id)}`} className="block">
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
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold uppercase tracking-micro text-white opacity-0 transition duration-200 group-hover:opacity-100">
                  {dictionary.home.gallery.hoverLabel}
                </span>
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
        ))}
      </section>
    </div>
  );
}
