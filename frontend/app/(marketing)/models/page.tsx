import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { getExampleDemos } from '@/server/engine-demos';

export const metadata: Metadata = {
  title: 'Models — MaxVideo AI',
  description: 'See the always-current lineup of AI video engines that MaxVideo AI routes across every project.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Models — MaxVideo AI',
    description: 'Always-current AI video engines with transparent pricing and independence from providers.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Model lineup overview with Price-Before chip.',
      },
    ],
  },
  alternates: {
    canonical: 'https://maxvideoai.com/models',
    languages: {
      en: 'https://maxvideoai.com/models',
      fr: 'https://maxvideoai.com/models?lang=fr',
    },
  },
};

function getEngineType(entry: FalEngineEntry): string {
  if (entry.type) return entry.type;
  const modes = new Set(entry.engine.modes);
  const hasText = modes.has('t2v');
  const hasImage = modes.has('i2v');
  if (hasText && hasImage) return 'Text + Image to Video';
  if (hasText) return 'Text to Video';
  if (hasImage) return 'Image to Video';
  return 'AI Video Engine';
}

function getEngineDisplayName(entry: FalEngineEntry): string {
  const name = entry.marketingName ?? entry.engine.label;
  return name
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+Text to Video$/i, '')
    .replace(/\s+Image to Video$/i, '')
    .trim();
}

export default async function ModelsPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.models;

  const priorityOrder = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-fast',
    'veo-3-1-fast',
    'pika-text-to-video',
    'pika-image-to-video',
    'minimax-hailuo-02-text',
    'minimax-hailuo-02-image',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const demos = await getExampleDemos();
  const engines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 space-y-5 rounded-3xl border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <p>
          Each engine in this catalog is wired into the MaxVideoAI workspace with monitored latency, price tracking, and
          fallbacks. We add models as soon as providers open real capacity—not waitlist demos—so you know what can ship
          to production today. Pick an engine to see the prompt presets, duration limits, and current route we use to
          keep renders flowing.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">When to choose Sora</h2>
            <p className="mt-2">
              Use Sora 2 or Sora 2 Pro when you need cinematic physics, character continuity, or audio baked directly
              into the render. Expect a higher credit cost but premium quality.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">When to choose Veo</h2>
            <p className="mt-2">
              Veo 3 tiers provide consistent framing, tone presets, and fast variants for iteration. Ideal for ad cuts,
              b-roll, and campaigns that demand controlled camera moves.
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-micro text-text-muted">When to choose Pika or MiniMax</h2>
            <p className="mt-2">
              Pika 2.2 excels at stylised loops and social edits, while MiniMax Hailuo 02 keeps budgets low for volume
              runs. Both are great complements when you need fast alternates.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-dashed border-hairline bg-bg/70 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">Need a side-by-side?</h3>
          <p className="mt-2">
            Read the <Link href="/blog/compare-ai-video-engines" className="font-semibold text-accent hover:text-accentSoft">Sora vs Veo vs Pika comparison guide</Link>{' '}
            for detailed quality notes, price ranges, and timing benchmarks, then clone any render from the{' '}
            <Link href="/examples" className="font-semibold text-accent hover:text-accentSoft">examples gallery</Link> to start with a proven prompt.
          </p>
        </div>
      </section>
      <section className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {engines.map((engine) => {
          const media = engine.media;
          const example = demos.get(engine.id);
          const videoUrl = example?.videoUrl ?? media?.videoUrl ?? null;
          const poster = example?.posterUrl ?? media?.imagePath ?? '/hero/veo3.jpg';
          const altText = media?.altText ?? `${engine.marketingName} demo preview`;
          const engineType = getEngineType(engine);
          const versionLabel = engine.versionLabel ?? '';
          const displayName = engine.cardTitle ?? getEngineDisplayName(engine);

          return (
            <Link
              key={engine.modelSlug}
              href={`/models/${engine.modelSlug}`}
              className="group relative overflow-hidden rounded-3xl border border-black/5 bg-white text-neutral-900 shadow-lg transition hover:border-black/10 hover:shadow-xl"
              aria-label={`Explore ${engine.marketingName}`}
            >
              <div className="relative aspect-video overflow-hidden">
                {videoUrl ? (
                  <video
                    className="h-full w-full object-cover opacity-10 transition duration-500 group-hover:scale-105 group-hover:opacity-25"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="none"
                    poster={poster}
                  >
                    <source src={videoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <Image
                    src={poster}
                    alt={altText}
                    fill
                    className="object-cover opacity-10"
                    sizes="(min-width: 1280px) 32rem, (min-width: 640px) 50vw, 100vw"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/50 opacity-95 transition group-hover:opacity-80" />
              </div>
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <span>{versionLabel}</span>
                  <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-neutral-500">MaxVideoAI</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-900 transition group-hover:text-neutral-800">{displayName}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{engineType}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-900/70 transition group-hover:translate-x-1 group-hover:text-neutral-900">
                    Explore →
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
