import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { listFalEngines } from '@/config/falEngines';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveDictionary } from '@/lib/i18n/server';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { listExamples, type GalleryVideo } from '@/server/videos';
import type { Mode } from '@/types/engines';
import {
  AiVideoToolbox,
  ComparisonPreview,
  HomeFaq,
  HomeHero,
  ProviderEngineStrip,
  RealExamplesPreview,
  ReferenceWorkflow,
  SeoKeywordBlock,
  ShotTypeEngineSelector,
  TransparentPricingBlock,
  type ComparisonCard,
  type FaqItem,
  type HomeExampleCard,
  type HomeHeroContent,
  type ProviderItem,
  type ProofStat,
  type ShotTypeCard,
  type ToolCard,
  type TrustCard,
  type WorkflowStep,
} from '@/components/marketing/home/HomeRedesignSections';

export const revalidate = 60;

type ProofConfig = {
  liveValue: string;
  items: Array<{ id: string; label: string }>;
};

type FallbackExampleCard = {
  id: string;
  title: string;
  engine: string;
  engineId: string;
  mode: string;
  duration: string;
  price?: string;
  prompt: string;
  imageSrc: string;
  imageAlt: string;
  examplesSlug: string;
};

type ComparisonConfig = {
  id: string;
  slug: string;
  title: string;
  body: string;
  badges: string[];
};

type ProviderConfig = ProviderItem & {
  providerKey: string;
};

type RedesignContent = {
  hero: HomeHeroContent;
  proof: ProofConfig;
  shotTypes: {
    title: string;
    subtitle: string;
    cards: ShotTypeCard[];
  };
  examples: {
    title: string;
    subtitle: string;
    cta: string;
    viewPrompt: string;
    fallbackCards: FallbackExampleCard[];
  };
  comparisons: {
    title: string;
    subtitle: string;
    cta: string;
    cards: ComparisonConfig[];
  };
  workflow: {
    title: string;
    subtitle: string;
    steps: WorkflowStep[];
  };
  toolbox: {
    title: string;
    subtitle: string;
    cards: ToolCard[];
  };
  pricingTrust: {
    title: string;
    subtitle: string;
    cta: string;
    cards: TrustCard[];
  };
  providers: {
    title: string;
    subtitle: string;
    cta: string;
    items: ProviderConfig[];
  };
  faq: {
    title: string;
    subtitle: string;
    items: FaqItem[];
  };
  seoKeywordBlock: string;
  modeLabels: Partial<Record<Mode | 'unknown', string>>;
};

type EngineStats = {
  total: number;
  providers: number;
  textToVideo: number;
  imageToVideo: number;
  videoToVideo: number;
  audio: number;
  fourK: number;
  extend: number;
  retake: number;
  audioToVideo: number;
};

const EXAMPLE_ENGINE_PRIORITY = [
  'kling-3-pro',
  'ltx-2-3-fast',
  'sora-2',
  'seedance-2-0',
  'veo-3-1',
  'wan-2-6',
  'pika-text-to-video',
  'ltx-2-3-pro',
  'kling-3-standard',
] as const;

const FALLBACK_MODE_BY_ENGINE: Record<string, Mode> = {
  'sora-2': 't2v',
  'veo-3-1': 'i2v',
  'kling-3-pro': 'i2v',
  'kling-3-standard': 't2v',
  'seedance-2-0': 'ref2v',
  'ltx-2-3-fast': 't2v',
  'ltx-2-3-pro': 'a2v',
  'wan-2-6': 'r2v',
  'pika-text-to-video': 't2v',
};

function countMode(engines: ReturnType<typeof listFalEngines>, mode: Mode) {
  return engines.filter((entry) => entry.engine.modes.includes(mode)).length;
}

function computeEngineStats(): EngineStats {
  const engines = listFalEngines();
  return {
    total: engines.length,
    providers: new Set(engines.map((entry) => entry.provider)).size,
    textToVideo: countMode(engines, 't2v'),
    imageToVideo: countMode(engines, 'i2v'),
    videoToVideo: countMode(engines, 'v2v'),
    audio: engines.filter((entry) => entry.engine.audio).length,
    fourK: engines.filter((entry) =>
      (entry.engine.resolutions ?? []).some((resolution) => String(resolution).toLowerCase().includes('4k'))
    ).length,
    extend: engines.filter((entry) => entry.engine.extend || entry.engine.modes.includes('extend')).length,
    retake: countMode(engines, 'retake'),
    audioToVideo: countMode(engines, 'a2v'),
  };
}

function resolveProofValue(id: string, stats: EngineStats, proof: ProofConfig): string {
  switch (id) {
    case 'engines':
      return String(stats.total);
    case 'providers':
      return String(stats.providers);
    case 'textToVideo':
      return String(stats.textToVideo);
    case 'imageToVideo':
      return String(stats.imageToVideo);
    case 'videoToVideo':
      return String(stats.videoToVideo);
    case 'audio':
      return String(stats.audio);
    case 'fourK':
      return stats.fourK > 0 ? '4K' : '1080p+';
    case 'pricing':
      return proof.liveValue;
    default:
      return '';
  }
}

function buildProofStats(content: RedesignContent, stats: EngineStats): ProofStat[] {
  return content.proof.items.map((item) => ({
    id: item.id,
    value: resolveProofValue(item.id, stats, content.proof),
    label: item.label,
  }));
}

function buildHeroContent(locale: AppLocale, content: RedesignContent): HomeHeroContent {
  const engines = listFalEngines();
  const engineById = new Map(engines.flatMap((entry) => [[entry.id, entry], [entry.modelSlug, entry]]));

  return {
    ...content.hero,
    mockup: {
      ...content.hero.mockup,
      engineRecommendations: content.hero.mockup.engineRecommendations.map((recommendation) => {
        const engine = engineById.get(recommendation.engineId);
        const pricing = engine?.pricingHint;
        const formattedPrice =
          pricing && pricing.amountCents > 0
            ? [
                formatCurrency(locale, pricing.currency, pricing.amountCents),
                pricing.durationSeconds ? `/ ${pricing.durationSeconds}s` : null,
              ]
                .filter(Boolean)
                .join(' ')
            : recommendation.fallbackPrice;

        return {
          ...recommendation,
          provider: engine?.provider ?? recommendation.provider,
          price: formattedPrice || recommendation.fallbackPrice,
        };
      }),
    },
  };
}

function truncate(value: string, max = 120) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function formatCurrency(locale: AppLocale, currency: string | null | undefined, cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function resolveModeLabel(mode: string | null | undefined, content: RedesignContent) {
  const normalized = (mode ?? 'unknown') as Mode | 'unknown';
  return content.modeLabels[normalized] ?? content.modeLabels.unknown ?? 'AI video';
}

function extractMode(video: GalleryVideo): Mode | 'unknown' {
  const settings = video.settingsSnapshot;
  if (settings && typeof settings === 'object' && 'mode' in settings) {
    const mode = (settings as { mode?: unknown }).mode;
    if (typeof mode === 'string') return mode as Mode;
  }
  const canonical = normalizeEngineId(video.engineId) ?? video.engineId;
  return FALLBACK_MODE_BY_ENGINE[canonical] ?? 'unknown';
}

function sortExamplesByPriority(videos: GalleryVideo[]) {
  const priority = new Map<string, number>(EXAMPLE_ENGINE_PRIORITY.map((id, index) => [id, index]));
  return [...videos].sort((left, right) => {
    const leftId = normalizeEngineId(left.engineId) ?? left.engineId;
    const rightId = normalizeEngineId(right.engineId) ?? right.engineId;
    return (priority.get(leftId) ?? 99) - (priority.get(rightId) ?? 99);
  });
}

async function loadHomepageExamples(locale: AppLocale, content: RedesignContent): Promise<HomeExampleCard[]> {
  const videos = await listExamples('playlist', 40).catch(() => [] as GalleryVideo[]);
  const seen = new Set<string>();
  const realExamples = sortExamplesByPriority(videos)
    .filter((video) => {
      const engineId = normalizeEngineId(video.engineId) ?? video.engineId;
      if (!EXAMPLE_ENGINE_PRIORITY.includes(engineId as (typeof EXAMPLE_ENGINE_PRIORITY)[number])) return false;
      if (seen.has(engineId)) return false;
      seen.add(engineId);
      return Boolean(video.thumbUrl);
    })
    .slice(0, 7)
    .map<HomeExampleCard>((video) => {
      const mode = extractMode(video);
      const engineId = normalizeEngineId(video.engineId) ?? video.engineId;
      return {
        id: video.id,
        title: video.engineLabel,
        engineId,
        engine: video.engineLabel,
        mode: resolveModeLabel(mode, content),
        duration: `${video.durationSec}s`,
        price: formatCurrency(locale, video.currency, video.finalPriceCents),
        prompt: truncate(video.promptExcerpt || video.prompt, 118),
        imageSrc: video.thumbUrl ?? '/assets/placeholders/thumb-16x9.png',
        videoSrc: video.videoUrl ?? null,
        imageAlt: `${video.engineLabel} AI video example generated in MaxVideoAI.`,
        href: `/app?from=${encodeURIComponent(video.id)}`,
        promptHref: `/video/${encodeURIComponent(video.id)}`,
      };
    });

  const fallbackExamples = content.examples.fallbackCards.map<HomeExampleCard>((card) => ({
    id: card.id,
    title: card.title,
    engineId: card.engineId,
    engine: card.engine,
    mode: card.mode,
    duration: card.duration,
    price: card.price ?? null,
    prompt: card.prompt,
    imageSrc: card.imageSrc,
    imageAlt: card.imageAlt,
    href: `/app?engine=${encodeURIComponent(card.engineId)}`,
    promptHref: { pathname: '/examples/[model]', params: { model: card.examplesSlug } },
  }));

  const combined = [...realExamples];
  fallbackExamples.forEach((example) => {
    if (combined.length >= 9) return;
    if (combined.some((item) => item.engine === example.engine)) return;
    combined.push(example);
  });

  return combined.slice(0, 9);
}

function buildComparisonCards(content: RedesignContent): ComparisonCard[] {
  return content.comparisons.cards.map((card) => {
    const isPublished = isPublishedComparisonSlug(card.slug);
    return {
      id: card.id,
      title: card.title,
      body: card.body,
      badges: card.badges,
      cta: content.comparisons.cta,
      href: isPublished
        ? { pathname: '/ai-video-engines/[slug]', params: { slug: card.slug } }
        : { pathname: '/ai-video-engines' },
    };
  });
}

function filterProviderItems(content: RedesignContent): ProviderItem[] {
  const providers = new Set(listFalEngines().map((entry) => entry.provider.toLowerCase()));
  return content.providers.items
    .filter((item) => providers.has(item.providerKey.toLowerCase()))
    .map(({ provider, model }) => ({ provider, model }));
}

function filterToolCards(content: RedesignContent, stats: EngineStats): ToolCard[] {
  return content.toolbox.cards.filter((tool) => {
    if (tool.id === 'extend-video') return stats.extend > 0;
    if (tool.id === 'retake') return stats.retake > 0;
    if (tool.id === 'audio-to-video') return stats.audioToVideo > 0 || stats.audio > 0;
    if (tool.id === 'video-to-video') return stats.videoToVideo > 0;
    return true;
  });
}

function buildSoftwareSchema(content: RedesignContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'VideoEditorApplication',
    operatingSystem: 'Web',
    url: 'https://maxvideoai.com',
    description: content.hero.subtitle,
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: content.pricingTrust.subtitle,
    },
    featureList: [
      'Pay-as-you-go multi-engine AI video generation workspace',
      'Compare AI video models before rendering',
      'Live price before render',
      'Text-to-video, image-to-video, video-to-video and reference workflows',
      'Auto-refunds on failed generation jobs',
    ],
  };
}

function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function buildItemListSchema(content: RedesignContent, providers: ProviderItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: content.providers.title,
    itemListElement: providers.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${item.provider} ${item.model}`,
    })),
  };
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'home',
    image: '/og/home-hub.png',
    imageAlt: t('title'),
  });
}

export default async function HomePage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.home.redesign as RedesignContent;
  const stats = computeEngineStats();
  const proofStats = buildProofStats(content, stats);
  const hero = buildHeroContent(locale, content);
  const examples = await loadHomepageExamples(locale, content);
  const comparisons = buildComparisonCards(content);
  const providers = filterProviderItems(content);
  const tools = filterToolCards(content, stats);
  const softwareSchema = buildSoftwareSchema(content);
  const faqSchema = buildFaqSchema(content.faq.items);
  const itemListSchema = buildItemListSchema(content, providers);

  return (
    <div>
      <HomeHero copy={hero} proofStats={proofStats} previews={examples.slice(0, 5)} />
      <ShotTypeEngineSelector copy={content.shotTypes} cards={content.shotTypes.cards} />
      <RealExamplesPreview copy={content.examples} examples={examples} />
      <ComparisonPreview copy={content.comparisons} comparisons={comparisons} />
      <ReferenceWorkflow copy={content.workflow} steps={content.workflow.steps} />
      <AiVideoToolbox copy={content.toolbox} tools={tools} />
      <TransparentPricingBlock copy={content.pricingTrust} cards={content.pricingTrust.cards} />
      <ProviderEngineStrip copy={content.providers} providers={providers} />
      <SeoKeywordBlock text={content.seoKeywordBlock} />
      <HomeFaq copy={content.faq} items={content.faq.items} />
      <Script id="home-webapp-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>
      <Script id="home-provider-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListSchema)}
      </Script>
    </div>
  );
}
