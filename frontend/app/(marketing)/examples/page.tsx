import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';

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
    canonical: 'https://www.maxvideo.ai/examples',
    languages: {
      en: 'https://www.maxvideo.ai/examples',
      fr: 'https://www.maxvideo.ai/examples?lang=fr',
    },
  },
};

function toAspectClass(aspect?: '16:9' | '9:16' | '1:1') {
  if (aspect === '9:16') return 'aspect-[9/16]';
  if (aspect === '1:1') return 'aspect-square';
  return 'aspect-video';
}

export default function ExamplesPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.examples;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {content.items.map((item) => {
          const aspectClass = toAspectClass(item.media?.aspectRatio);
          return (
            <article key={item.title} className="group overflow-hidden rounded-card border border-hairline bg-white shadow-card">
              <div className={`relative ${aspectClass} overflow-hidden bg-gradient-to-br from-slate-200 via-white to-amber-50`}>
                {item.media?.videoSrc ? (
                  <>
                    <video
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      poster={item.media.posterSrc}
                      aria-label={item.alt}
                    >
                      <source src={item.media.videoSrc} type="video/mp4" />
                    </video>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold uppercase tracking-micro text-white opacity-0 transition duration-200 group-hover:opacity-100">
                      {dictionary.home.gallery.hoverLabel}
                    </div>
                  </>
                ) : (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold uppercase tracking-micro text-text-muted opacity-80">
                    {dictionary.home.gallery.hoverLabel}
                  </div>
                )}
                <span className="sr-only">{item.alt}</span>
              </div>
              <div className="space-y-2 border-t border-hairline p-4">
                <h2 className="text-lg font-semibold text-text-primary">{item.title}</h2>
                <p className="text-xs font-medium uppercase tracking-micro text-text-muted">{dictionary.home.gallery.caption}</p>
                <p className="text-sm text-text-secondary">{item.engine}</p>
                <p className="text-xs text-text-muted">{item.description}</p>
                <Link
                  href="/app"
                  className="inline-flex items-center rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  {content.cta}
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
