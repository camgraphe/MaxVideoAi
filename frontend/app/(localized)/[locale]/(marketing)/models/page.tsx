import type { Metadata } from 'next';
import Script from 'next/script';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Link } from '@/i18n/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { ModelsGallery } from '@/components/marketing/ModelsGallery';
import { getEnginePictogram } from '@/lib/engine-branding';
import { getEngineLocalized } from '@/lib/models/i18n';
import engineCatalog from '@/config/engine-catalog.json';
import compareConfig from '@/config/compare-config.json';

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

type EngineCatalogEntry = (typeof engineCatalog)[number];

type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
};

type EngineKeySpecsFile = {
  specs?: EngineKeySpecsEntry[];
};

async function loadEngineKeySpecs(): Promise<Map<string, Record<string, unknown>>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, Record<string, unknown>>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key && entry.keySpecs) {
          map.set(key, entry.keySpecs);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

function getCatalogBySlug() {
  return new Map<string, EngineCatalogEntry>(engineCatalog.map((entry) => [entry.modelSlug, entry]));
}

function resolveSupported(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'supported' || normalized === 'yes' || normalized === 'true') return true;
  if (normalized === 'not supported' || normalized === 'no' || normalized === 'false') return false;
  return null;
}

function extractMaxResolution(value?: string | null, fallback?: string[]) {
  const candidates = [value ?? '', ...(fallback ?? [])];
  let max = 0;
  candidates.forEach((entry) => {
    const normalized = entry.toLowerCase();
    if (normalized.includes('4k')) {
      max = Math.max(max, 2160);
      return;
    }
    const matches = normalized.match(/(\d{3,4})/g) ?? [];
    matches.forEach((match) => {
      const num = Number(match);
      if (!Number.isNaN(num)) max = Math.max(max, num);
    });
  });
  if (!max) return { label: 'Data pending', value: null };
  return { label: `${max}p`, value: max };
}

function extractMaxDuration(value?: string | null, fallback?: number | null) {
  if (typeof value === 'string') {
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num)) return { label: `${num}s`, value: num };
    }
  }
  if (typeof fallback === 'number') {
    return { label: `${fallback}s`, value: fallback };
  }
  return { label: 'Data pending', value: null };
}

function getMinPricePerSecond(entry?: EngineCatalogEntry | null) {
  if (!entry?.engine) return null;
  const perSecond = entry.engine.pricingDetails?.perSecondCents;
  const candidates: number[] = [];
  if (typeof perSecond?.default === 'number') {
    candidates.push(perSecond.default);
    const audioOffDelta = entry.engine.pricingDetails?.addons?.audio_off?.perSecondCents;
    if (typeof audioOffDelta === 'number') {
      candidates.push(perSecond.default + audioOffDelta);
    }
  }
  if (perSecond?.byResolution) {
    Object.values(perSecond.byResolution).forEach((value) => {
      if (typeof value === 'number') candidates.push(value);
    });
  }
  if (typeof entry.engine.pricing?.base === 'number') {
    candidates.push(Math.round(entry.engine.pricing.base * 100));
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function formatPriceFrom(entry?: EngineCatalogEntry | null) {
  const cents = getMinPricePerSecond(entry);
  if (typeof cents === 'number') {
    return `$${(cents / 100).toFixed(2)}/s`;
  }
  return 'Data pending';
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'models.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'models',
    slugMap: MODELS_SLUG_MAP,
    imageAlt: 'Model lineup overview with Price-Before chip.',
  });
}

type EngineTypeKey = 'textImage' | 'text' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'image', 'default'];

function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasText = modes.has('t2v');
  const hasImage = modes.has('i2v');
  const hasImageGen = modes.has('t2i') || modes.has('i2i');
  if (hasText && hasImage) return 'textImage';
  if (hasText) return 'text';
  if (hasImage || hasImageGen) return 'image';
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
  const { locale, dictionary } = await resolveDictionary();
  const activeLocale = locale as AppLocale;
  const breadcrumbLabels = getBreadcrumbLabels(activeLocale);
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const modelsPath = `${localePrefix}/${MODELS_SLUG_MAP[activeLocale] ?? MODELS_SLUG_MAP.en ?? 'models'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const modelsUrl = `${SITE_BASE_URL}${modelsPath}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.models,
        item: modelsUrl,
      },
    ],
  };
  const content = dictionary.models;
  const heroTitle = content.hero?.title ?? 'AI Video Engines – Sora, Veo, Pika & More';
  const HERO_BODY_FALLBACK =
    'Browse every AI video engine available in MaxVideoAI, including Sora 2, Veo 3.1, Pika 2.2, Kling, Luma, Wan and MiniMax Hailuo. Each model page includes real examples, specs, pricing and prompt tips so you can choose the right engine for your shot.';
  const heroBody =
    typeof content.hero?.body === 'string' && content.hero.body.trim().length ? content.hero.body : HERO_BODY_FALLBACK;
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
  const cardCtaLabel = content.cardCtaLabel ?? 'Explore model';
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
  const keySpecsMap = await loadEngineKeySpecs();
  const catalogBySlug = getCatalogBySlug();

  const priorityOrder = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-fast',
    'veo-3-1-first-last',
    'pika-text-to-video',
    'wan-2-6',
    'wan-2-5',
    'kling-2-5-turbo',
    'kling-2-6-pro',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'nano-banana',
    'nano-banana-pro',
  ];

  const engineIndex = new Map<string, FalEngineEntry>(listFalEngines().map((entry) => [entry.modelSlug, entry]));
  const priorityEngines = priorityOrder
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));
  const remainingEngines = listFalEngines()
    .filter((entry) => !priorityOrder.includes(entry.modelSlug))
    .sort((a, b) => getEngineDisplayName(a).localeCompare(getEngineDisplayName(b)));
  const engines = [...priorityEngines, ...remainingEngines];

  const popularComparisonSlugs = (compareConfig.trophyComparisons as string[] | undefined)?.slice(0, 6) ?? [];
  const popularComparisons = popularComparisonSlugs
    .map((slug) => {
      const parts = slug.split('-vs-');
      if (parts.length !== 2) return null;
      const [leftSlug, rightSlug] = parts;
      const leftName =
        catalogBySlug.get(leftSlug)?.marketingName ??
        engineIndex.get(leftSlug)?.marketingName ??
        engineIndex.get(leftSlug)?.engine.label ??
        leftSlug;
      const rightName =
        catalogBySlug.get(rightSlug)?.marketingName ??
        engineIndex.get(rightSlug)?.marketingName ??
        engineIndex.get(rightSlug)?.engine.label ??
        rightSlug;
      return {
        slug,
        label: `${leftName} vs ${rightName}`,
      };
    })
    .filter((entry): entry is { slug: string; label: string } => Boolean(entry));

  const localizedMap = new Map<string, Awaited<ReturnType<typeof getEngineLocalized>>>(
    await Promise.all(
      engines.map(async (engine) => {
        const localized = await getEngineLocalized(engine.modelSlug, activeLocale);
        return [engine.modelSlug, localized] as const;
      })
    )
  );

  const quickLinkSlugs = [
    'sora-2',
    'sora-2-pro',
    'veo-3-1',
    'veo-3-1-first-last',
    'pika-text-to-video',
    'kling-2-5-turbo',
    'kling-2-6-pro',
    'wan-2-6',
    'wan-2-5',
    'ltx-2-fast',
    'ltx-2',
    'minimax-hailuo-02-text',
    'nano-banana',
    'nano-banana-pro',
  ];
  const quickLinks = quickLinkSlugs
    .map((slug) => engineIndex.get(slug))
    .filter((entry): entry is FalEngineEntry => Boolean(entry));

  const modelCards = engines.map((engine) => {
    const meta = engineMetaCopy[engine.modelSlug] ?? engineMetaCopy[engine.id] ?? null;
    const localized = localizedMap.get(engine.modelSlug);
    const engineTypeKey = getEngineTypeKey(engine);
    const engineType = engineTypeLabels[engineTypeKey] ?? DEFAULT_ENGINE_TYPE_LABELS[engineTypeKey];
    const versionLabel = localized?.versionLabel ?? meta?.versionLabel ?? engine.versionLabel ?? '';
    const displayName =
      localized?.marketingName ?? meta?.displayName ?? engine.cardTitle ?? getEngineDisplayName(engine);
    const description = localized?.hero?.intro ?? localized?.overview ?? meta?.description ?? engineType;
    const catalogEntry = catalogBySlug.get(engine.modelSlug) ?? null;
    const keySpecs = keySpecsMap.get(engine.modelSlug) ?? {};
    const modes = new Set(catalogEntry?.engine?.modes ?? engine.engine.modes ?? []);
    const t2v = resolveSupported((keySpecs as Record<string, unknown>).textToVideo) ?? modes.has('t2v');
    const i2v = resolveSupported((keySpecs as Record<string, unknown>).imageToVideo) ?? modes.has('i2v');
    const v2v = resolveSupported((keySpecs as Record<string, unknown>).videoToVideo) ?? modes.has('v2v');
    const firstLast =
      resolveSupported((keySpecs as Record<string, unknown>).firstLastFrame) ??
      Boolean(catalogEntry?.engine?.keyframes);
    const lipSync = resolveSupported((keySpecs as Record<string, unknown>).lipSync);
    const audioSupported =
      resolveSupported((keySpecs as Record<string, unknown>).audioOutput) ??
      (catalogEntry?.engine?.audio == null ? null : Boolean(catalogEntry.engine.audio));
    const maxResolution = extractMaxResolution(
      (keySpecs as Record<string, string>).maxResolution,
      catalogEntry?.engine?.resolutions
    );
    const maxDuration = extractMaxDuration(
      (keySpecs as Record<string, string>).maxDuration,
      catalogEntry?.engine?.maxDurationSec ?? null
    );
    const priceFrom = formatPriceFrom(catalogEntry);
    const capabilities = [
      t2v ? 'T2V' : null,
      i2v ? 'I2V' : null,
      v2v ? 'V2V' : null,
      firstLast ? 'First/Last' : null,
      lipSync ? 'Lip sync' : null,
    ].filter(Boolean) as string[];
    const compareDisabled = ['nano-banana', 'nano-banana-pro'].includes(engine.modelSlug);
    const strengths = catalogEntry?.bestFor ?? null;
    const pictogram = getEnginePictogram({
      id: engine.engine.id,
      brandId: engine.brandId ?? engine.engine.brandId,
      label: displayName,
    });

    return {
      id: engine.modelSlug,
      label: displayName,
      description,
      versionLabel,
      priceNote: null,
      priceNoteHref: null,
      href: { pathname: '/models/[slug]', params: { slug: engine.modelSlug } },
      backgroundColor: pictogram.backgroundColor,
      textColor: pictogram.textColor,
      strengths,
      capabilities: capabilities.slice(0, 3),
      snapshot: {
        priceFrom: priceFrom === 'Data pending' ? null : priceFrom,
        maxDuration: maxDuration.label === 'Data pending' ? null : maxDuration.label,
        maxResolution: maxResolution.label === 'Data pending' ? null : maxResolution.label,
        audio: audioSupported == null ? 'Data pending' : audioSupported ? 'Yes' : 'No',
      },
      compareDisabled,
      filterMeta: {
        t2v,
        i2v,
        v2v,
        firstLast,
        extend,
        lipSync,
        audio: Boolean(audioSupported),
        maxResolution: maxResolution.value,
        maxDuration: maxDuration.value,
        priceFrom: (() => {
          const cents = getMinPricePerSecond(catalogEntry);
          return typeof cents === 'number' ? cents / 100 : null;
        })(),
      },
    };
  });

  return (
    <main className="container-page max-w-5xl section">
      <div className="stack-gap-lg">
        <header className="stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            Compare all AI video models available in MaxVideoAI
          </h2>
          <p className="sm:max-w-[62ch] text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
          <p className="sm:max-w-[62ch] text-sm text-text-secondary">{heroBody}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={{ pathname: '/models', query: { compare: '1' } }}
              className="inline-flex items-center rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-micro text-bg shadow-card transition hover:opacity-90"
            >
              Compare
            </Link>
            <span className="inline-flex items-center rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary">
              Watermark-free exports on MaxVideoAI
            </span>
          </div>
        </header>
        <section className="stack-gap-lg rounded-3xl border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
          {introParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <ModelsGallery cards={modelCards} ctaLabel={cardCtaLabel} />
          {popularComparisons.length ? (
            <div className="rounded-3xl border border-hairline bg-surface/80 p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Popular comparisons</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {popularComparisons.map((entry) => (
                  <Link
                    key={entry.slug}
                    href={{ pathname: '/ai-video-engines/[slug]', params: { slug: entry.slug } }}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                  >
                    {entry.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-gap-sm lg:grid-cols-3">
            {introCards.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border border-hairline bg-gradient-to-br from-bg via-surface to-bg p-5 shadow-card"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-lg">
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
              <Link href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }} className="font-semibold text-brand hover:text-brandHover">
                {introCta.comparisonLabel}
              </Link>
              {introCta.middle}
              <Link href="/examples" className="font-semibold text-brand hover:text-brandHover">
                {introCta.examplesLabel}
              </Link>
              {introCta.after}
            </p>
          </div>

          {quickLinks.length ? (
            <div className="rounded-3xl border border-hairline bg-surface/80 p-4 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">Popular engines</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quickLinks.map((entry) => (
                  <Link
                    key={entry.modelSlug}
                    href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
                    prefetch={false}
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                    aria-label={`View ${entry.marketingName ?? entry.engine.label}`}
                  >
                    {entry.marketingName ?? entry.engine.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
        {content.note ? (
          <p className="rounded-3xl border border-dashed border-hairline bg-bg/70 px-6 py-4 text-sm text-text-secondary">
            {content.note}
          </p>
        ) : null}
      </div>
      <Script id="models-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
    </main>
  );
}
