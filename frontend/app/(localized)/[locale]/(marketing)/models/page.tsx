import type { Metadata } from 'next';
import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { getExampleDemos } from '@/server/engine-demos';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';

const MODELS_SLUG_MAP = buildSlugMap('models');
const DEFAULT_INTRO = {
  paragraphs: [
    'Each engine in this catalog is wired into the MaxVideoAI workspace with monitored latency, price tracking, and fallbacks. We add models as soon as providers open real capacity—not waitlist demos—so you know what can ship to production today.',
    'Pick an engine to see the prompt presets, duration limits, and current route we use to keep renders flowing, then duplicate it into your own workspace.',
  ],
  cards: [
    {
      emoji: '🎬',
      title: 'When to choose Sora',
      body: 'Reach for Sora 2 or Sora 2 Pro when you need cinematic physics, character continuity, or audio baked directly into the render. These tiers cost more per second but deliver hero-quality footage.',
    },
    {
      emoji: '🎯',
      title: 'When to choose Veo',
      body: 'Veo 3 tiers provide precise framing controls and tone presets, plus fast variants for iteration. They are ideal for ad cuts, b-roll, and campaigns that demand consistent camera moves.',
    },
    {
      emoji: '⚡',
      title: 'When to choose Pika or MiniMax',
      body: 'Pika 2.2 excels at stylised loops and social edits, while MiniMax Hailuo 02 keeps budgets low for volume runs. Both complement Sora and Veo when you need fast alternates or lightweight briefs.',
    },
    {
      emoji: '🖼️',
      title: 'When to choose Nano Banana',
      body: 'Storyboard or edit photoreal stills before jumping into motion. Nano Banana shares the same wallet and prompt lab, so you can prep Veo/Sora shots with text-to-image or reference edits.',
    },
  ],
  cta: {
    title: 'Need a side-by-side?',
    before: 'Read the ',
    comparisonLabel: 'Sora vs Veo vs Pika comparison guide',
    middle: ' for detailed quality notes, price ranges, and timing benchmarks, then clone any render from the ',
    examplesLabel: 'examples gallery',
    after: ' to start with a proven prompt.',
  },
} as const;

const DEFAULT_ENGINE_TYPE_LABELS = {
  textImage: 'Text + Image to Video',
  text: 'Text to Video',
  image: 'Image to Video',
  default: 'AI Video Engine',
} as const;

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'models.meta' });
  const metadataUrls = buildMetadataUrls(locale, MODELS_SLUG_MAP);

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'Model lineup overview with Price-Before chip.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

type EngineTypeKey = 'textImage' | 'text' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'image', 'default'];

function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasText = modes.has('t2v');
  const hasImage = modes.has('i2v');
  if (hasText && hasImage) return 'textImage';
  if (hasText) return 'text';
  if (hasImage) return 'image';
  return 'default';
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
  const { dictionary } = await resolveDictionary();
  const content = dictionary.models;
  const introContent = content.intro ?? null;
  const introParagraphs =
    Array.isArray(introContent?.paragraphs) && introContent.paragraphs.length
      ? introContent.paragraphs
      : DEFAULT_INTRO.paragraphs;
  const introCards =
    Array.isArray(introContent?.cards) && introContent.cards.length ? introContent.cards : DEFAULT_INTRO.cards;
  const introCta = {
    title: introContent?.cta?.title ?? DEFAULT_INTRO.cta.title,
    before: introContent?.cta?.before ?? DEFAULT_INTRO.cta.before,
    comparisonLabel: introContent?.cta?.comparisonLabel ?? DEFAULT_INTRO.cta.comparisonLabel,
    middle: introContent?.cta?.middle ?? DEFAULT_INTRO.cta.middle,
    examplesLabel: introContent?.cta?.examplesLabel ?? DEFAULT_INTRO.cta.examplesLabel,
    after: introContent?.cta?.after ?? DEFAULT_INTRO.cta.after,
  };
  const cardCtaLabel = content.cardCtaLabel ?? 'Explore →';
  const cardAriaPrefix = content.cardAriaPrefix ?? 'Explore';
  const engineTypeLabels = {
    ...DEFAULT_ENGINE_TYPE_LABELS,
    ...(content.engineTypeLabels ?? {}),
  };
  const engineMetaCopy = (content.meta ?? {}) as Record<
    string,
    {
      displayName?: string;
      description?: string;
      priceBefore?: string;
      versionLabel?: string;
    }
  >;

  const priorityOrder = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-fast',
    'pika-text-to-video',
    'wan-2-5',
    'kling-2-5-turbo',
    'minimax-hailuo-02-text',
    'nano-banana',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const demos = await getExampleDemos();
  const engines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const quickLinkSlugs = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'pika-text-to-video',
    'kling-2-5-turbo',
    'wan-2-5',
    'minimax-hailuo-02-text',
    'nano-banana',
  ];
  const quickLinks = quickLinkSlugs
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));

  return (
    <div className="mx-auto max-w-5xl px-4 pb-6 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="max-w-2xl text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-8 space-y-5 rounded-3xl border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        {introParagraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <div className="grid gap-4 lg:grid-cols-3">
          {introCards.map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-hairline bg-gradient-to-br from-bg via-white to-bg p-5 shadow-card"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-lg">
                  {card.emoji ?? '🎬'}
                </span>
                <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{card.title}</h3>
              </div>
              <p className="mt-3 text-sm">{card.body}</p>
            </div>
          ))}
        </div>
        <div className="rounded-3xl border border-dashed border-hairline bg-bg/70 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-micro text-text-muted">{introCta.title}</h3>
          <p className="mt-2">
            {introCta.before}
            <Link href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }} className="font-semibold text-accent hover:text-accentSoft">
              {introCta.comparisonLabel}
            </Link>
            {introCta.middle}
            <Link href="/examples" className="font-semibold text-accent hover:text-accentSoft">
              {introCta.examplesLabel}
            </Link>
            {introCta.after}
          </p>
        </div>

        {quickLinks.length ? (
          <div className="rounded-3xl border border-hairline bg-white/80 p-4 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Popular engines</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {quickLinks.map((entry) => (
                <Link
                  key={entry.modelSlug}
                  href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
                  className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-accent hover:text-accent"
                  aria-label={`View ${entry.marketingName ?? entry.engine.label}`}
                >
                  {entry.marketingName ?? entry.engine.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>
      <section className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {engines.map((engine) => {
          const media = engine.media;
          const example = demos.get(engine.id);
          const videoUrl = example?.videoUrl ?? media?.videoUrl ?? null;
          const poster = example?.posterUrl ?? media?.imagePath ?? '/hero/veo3.jpg';
          const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
          const altText = media?.altText ?? meta?.description ?? `${engine.marketingName} demo preview`;
          const engineTypeKey = getEngineTypeKey(engine);
          const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
          const versionLabel = meta?.versionLabel ?? engine.versionLabel ?? '';
          const displayName = meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
          const description = meta?.description ?? engineType;
          const priceNote = meta?.priceBefore ?? null;

          return (
            <article
              key={engine.modelSlug}
              className="group relative min-h-[26rem] overflow-hidden rounded-3xl border border-black/5 bg-white text-neutral-900 shadow-lg transition hover:border-black/10 hover:shadow-xl"
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
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-6 pb-24">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <span>{versionLabel}</span>
                  <span className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold text-neutral-500">MaxVideoAI</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-neutral-900 transition group-hover:text-neutral-800">{displayName}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{description}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-900/70 transition group-hover:translate-x-1 group-hover:text-neutral-900">
                  {cardCtaLabel}
                </span>
              </div>
              {priceNote ? (
                <Link
                  href="/generate"
                  className="absolute left-6 bottom-6 z-20 inline-flex text-xs font-semibold text-accent transition hover:text-accentSoft"
                >
                  {priceNote}
                </Link>
              ) : null}
              <Link
                href={{ pathname: '/models/[slug]', params: { slug: engine.modelSlug } }}
                className="absolute inset-0 z-10"
                aria-label={`${cardAriaPrefix} ${engine.marketingName}`}
              >
                <span className="sr-only">{cardCtaLabel}</span>
              </Link>
            </article>
          );
        })}
      </section>
      {content.note ? (
        <p className="mt-10 rounded-3xl border border-dashed border-hairline bg-bg/70 px-6 py-4 text-sm text-text-secondary">
          {content.note}
        </p>
      ) : null}
    </div>
  );
}
