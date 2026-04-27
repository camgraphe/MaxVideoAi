import Image from 'next/image';
import {
  BadgeCheck,
  BadgeDollarSign,
  Atom,
  AudioWaveform,
  Box,
  CircleDollarSign,
  Clapperboard,
  ClipboardList,
  Film,
  ImageIcon,
  Images,
  Layers3,
  Mic2,
  RefreshCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Tag,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { HeroVideoShowcase, type HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';

type AnalyticsProps = {
  'data-analytics-event'?: string;
  'data-analytics-cta-name'?: string;
  'data-analytics-cta-location'?: string;
  'data-analytics-target-family'?: string;
  'data-analytics-tool-name'?: string;
  'data-analytics-tool-surface'?: string;
};

export type HomeCta = {
  label: string;
  href: LocalizedLinkHref;
  analytics?: AnalyticsProps;
};

export type HomeHeroContent = {
  eyebrow: string;
  badgeChips: string[];
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  examplesCta: string;
  trustBadges: string[];
  valueCards: Array<{
    title: string;
    body: string;
  }>;
  mockup: {
    promptLabel: string;
    prompt: string;
    shotTypeLabel: string;
    shotTypes: string[];
    engineLabel: string;
    engineRecommendations: Array<{
      engineId: string;
      name: string;
      provider: string;
      bestFor: string;
      fallbackPrice: string;
      price?: string;
      modeLabel?: string;
      rateLabel?: string;
      examplesHref?: LocalizedLinkHref;
      modelHref?: LocalizedLinkHref;
      examplesLabel?: string;
      modelLabel?: string;
      selected?: boolean;
      scores: Array<{ label: string; value: number }>;
      tags: string[];
    }>;
    quoteLabel: string;
    quoteValue: string;
    quoteMeta: string;
    outputLabel: string;
    queueLabel: string;
    queueItems: string[];
    generateCta: string;
    refundNote: string;
    playLabel: string;
    pauseLabel: string;
  };
};

export type ProofStat = {
  id: string;
  value: string;
  label: string;
  href?: LocalizedLinkHref;
};

export type ShotTypeCard = {
  id: string;
  title: string;
  body: string;
  engines: string[];
  cta: string;
  href: LocalizedLinkHref;
};

export type HomeExampleCard = {
  id: string;
  title: string;
  engineId?: string;
  engine: string;
  mode: string;
  duration: string;
  price?: string | null;
  useCase: string;
  imageSrc: string;
  videoSrc?: string | null;
  imageAlt: string;
  href: LocalizedLinkHref;
  modelHref?: LocalizedLinkHref;
  cloneHref?: LocalizedLinkHref;
  ctaLabel: string;
  cloneLabel?: string;
};

export type ComparisonCard = {
  id: string;
  title: string;
  body: string;
  badges: string[];
  cta: string;
  href: LocalizedLinkHref;
};

export type WorkflowStep = {
  title: string;
  body: string;
  toolLabel: string;
  href: LocalizedLinkHref;
};

export type ToolCard = {
  id: string;
  title: string;
  body: string;
  href: LocalizedLinkHref;
  icon: ToolIconKey;
};

export type TrustCard = {
  title: string;
  body: string;
};

export type ProviderItem = {
  provider: string;
  model: string;
  href?: LocalizedLinkHref;
};

export type FaqItem = {
  question: string;
  answer: string;
};

type SectionCopy = {
  title: string;
  subtitle: string;
  cta?: string;
};

type ToolIconKey =
  | 'text'
  | 'image'
  | 'video'
  | 'generateImage'
  | 'character'
  | 'angle'
  | 'extend'
  | 'retake'
  | 'audio'
  | 'compare';

const TOOL_ICONS: Record<ToolIconKey, LucideIcon> = {
  text: Film,
  image: Images,
  video: Clapperboard,
  generateImage: Sparkles,
  character: Layers3,
  angle: RotateCw,
  extend: SplitSquareHorizontal,
  retake: RefreshCcw,
  audio: Mic2,
  compare: SlidersHorizontal,
};

const HERO_VIDEO_ORDER = ['seedance-2-0', 'kling-3-pro', 'veo-3-1-lite', 'ltx-2-3-fast', 'wan-2-6'] as const;
const HERO_VIDEO_MODE_LABELS: Record<string, string> = {
  'kling-3-pro': 'image-to-video',
  'seedance-2-0': 'image-to-video',
  'veo-3-1-lite': 'image-to-video',
  'ltx-2-3-fast': 'text-to-video',
  'wan-2-6': 'video-to-video',
};
const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'seedance-2-0': ['Cinematic', 'Realism'],
  'veo-3-1-lite': ['Realistic', 'Premium'],
  'ltx-2-3-fast': ['Fast draft', 'Low cost'],
  'wan-2-6': ['Video-to-video', 'Structured'],
};

const PROOF_ICONS: Record<string, LucideIcon> = {
  engines: Atom,
  providers: Box,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  videoToVideo: Video,
  audio: AudioWaveform,
  fourK: BadgeCheck,
  pricing: Tag,
};

const HERO_ENGINE_MEDIA: Record<string, { posterSrc: string; videoSrc?: string; resolution: string; duration: string }> = {
  'kling-3-pro': {
    posterSrc: '/hero/showcase-kling-3-pro.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'seedance-2-0': {
    posterSrc: '/hero/showcase-seedance-2-0.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1': {
    posterSrc: '/hero/showcase-veo-3-1.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1-lite': {
    posterSrc: '/hero/showcase-veo-3-1.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'ltx-2-3-fast': {
    posterSrc: '/hero/showcase-ltx-2-3-fast.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'wan-2-6': {
    posterSrc: '/hero/wan-26.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
  'sora-2': {
    posterSrc: '/hero/showcase-sora-2.jpg',
    resolution: '16:9',
    duration: '0:05',
  },
};

const SHOT_TYPE_VISUALS: Record<string, { imageSrc: string; price: string }> = {
  'fast-drafts': { imageSrc: '/hero/luma-dream.jpg', price: 'from $0.07/s' },
  'cinematic-realism': { imageSrc: '/hero/kling-3-4k-demo.jpg', price: 'from $0.11/s' },
  'character-scenes': { imageSrc: '/hero/sora2.jpg', price: 'from $0.13/s' },
  'product-ads': { imageSrc: '/hero/veo-3-1-hero.jpg', price: 'from $0.17/s' },
  'camera-motion': { imageSrc: '/hero/kling-3-4k-demo.jpg', price: 'from $0.11/s' },
  'audio-native': { imageSrc: '/hero/seedance-2-0.jpg', price: 'from $0.18/s' },
};

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  align?: 'center' | 'left';
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-micro text-brand">{eyebrow}</p>
      ) : null}
      <h2 className="mt-3 text-3xl font-semibold text-text-primary sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-text-secondary">{subtitle}</p>
    </div>
  );
}

function normalizeHeroText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function findPreviewForEngine(engineId: string, engineName: string, previews: HomeExampleCard[]) {
  const normalizedId = normalizeHeroText(engineId);
  const normalizedName = normalizeHeroText(engineName);
  return previews.find((preview) => {
    const previewId = normalizeHeroText(preview.engineId ?? '');
    const previewEngine = normalizeHeroText(preview.engine);
    return (
      previewId === normalizedId ||
      previewEngine.includes(normalizedName) ||
      normalizedName.includes(previewEngine) ||
      previewEngine.includes(normalizedId)
    );
  });
}

function buildHeroVideoItems(copy: HomeHeroContent['mockup'], previews: HomeExampleCard[]): HeroVideoShowcaseItem[] {
  const orderedEngines = [...copy.engineRecommendations].sort((left, right) => {
    if (left.selected) return -1;
    if (right.selected) return 1;
    return 0;
  });

  return orderedEngines.map((engine) => {
    const preview = findPreviewForEngine(engine.engineId, engine.name, previews);
    const fallbackMedia = HERO_ENGINE_MEDIA[engine.engineId] ?? HERO_ENGINE_MEDIA['kling-3-pro'];
    const engineName = engine.engineId === 'kling-3-pro' ? 'Kling 3 Pro' : engine.name;
    const durationLabel = fallbackMedia.duration.startsWith('0:')
      ? `${Number(fallbackMedia.duration.slice(2))}s`
      : fallbackMedia.duration;

    return {
      id: engine.engineId,
      engineId: engine.engineId,
      name: engineName,
      provider: engine.provider,
      bestFor: engine.bestFor,
      chips: HERO_VIDEO_CHIPS[engine.engineId] ?? (engine.tags?.length ? engine.tags.slice(0, 2) : [engine.bestFor, engine.provider]),
      mediaInfo: [engine.modeLabel ?? HERO_VIDEO_MODE_LABELS[engine.engineId], durationLabel, fallbackMedia.resolution].filter(Boolean).join(' · '),
      price: engine.price ?? engine.fallbackPrice,
      estimateLabel: copy.quoteLabel,
      estimateValue: copy.quoteValue,
      estimateMeta: '5s render',
      examplesHref: engine.examplesHref,
      modelHref: engine.modelHref,
      examplesLabel: engine.examplesLabel,
      modelLabel: engine.modelLabel,
      posterSrc: fallbackMedia.posterSrc ?? preview?.imageSrc ?? '/assets/placeholders/preview-16x9.png',
      videoSrc: fallbackMedia.videoSrc ?? preview?.videoSrc ?? null,
      duration: fallbackMedia.duration,
      resolution: fallbackMedia.resolution,
      imageAlt: preview?.imageAlt ?? `${engineName} AI video preview in MaxVideoAI.`,
    };
  });
}

function renderHeroTitle(title: string) {
  const highlightTargets = ['to use.', 'utiliser.', 'usar.'];
  const target = highlightTargets.find((candidate) => title.toLowerCase().endsWith(candidate));

  if (!target) return title;

  const start = title.length - target.length;
  return (
    <>
      {title.slice(0, start)}
      <span className="bg-[linear-gradient(90deg,#111827,#4b5563,#9ca3af)] bg-clip-text text-transparent dark:bg-[linear-gradient(90deg,#ffffff,#d1d5db,#94a3b8)]">
        {title.slice(start)}
      </span>
    </>
  );
}

export function HomeHero({
  copy,
  proofStats,
  previews,
  programmedHeroItems = [],
}: {
  copy: HomeHeroContent;
  proofStats: ProofStat[];
  previews: HomeExampleCard[];
  programmedHeroItems?: HeroVideoShowcaseItem[];
}) {
  const fallbackItems = buildHeroVideoItems(copy.mockup, previews);
  const programmedByEngine = new Map<string, HeroVideoShowcaseItem>();
  programmedHeroItems.forEach((item) => {
    const engineId = item.engineId ?? item.id;
    if (HERO_VIDEO_ORDER.includes(engineId as (typeof HERO_VIDEO_ORDER)[number]) && !programmedByEngine.has(engineId)) {
      programmedByEngine.set(engineId, item);
    }
  });
  const fallbackByEngine = new Map(fallbackItems.map((item) => [item.engineId ?? item.id, item]));
  const videoItems = HERO_VIDEO_ORDER.flatMap((engineId) => {
    const item = programmedByEngine.get(engineId) ?? fallbackByEngine.get(engineId);
    return item ? [item] : [];
  });
  const valueCards = (
    <>
      {copy.valueCards.map((card) => (
        <div
          key={card.title}
          className="min-h-[112px] rounded-[18px] border border-black/[0.07] bg-white/68 p-4 text-left backdrop-blur transition hover:border-black/[0.12] hover:bg-white/82 dark:border-white/10 dark:bg-white/[0.055] dark:hover:border-white/15 dark:hover:bg-white/[0.075]"
        >
          <span className="block text-[15px] font-semibold leading-5 text-text-primary">{card.title}</span>
          <span className="mt-2 block max-w-[18rem] text-xs leading-5 text-text-secondary">{card.body}</span>
        </div>
      ))}
    </>
  );

  return (
    <section className="relative overflow-hidden border-b border-hairline bg-bg">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(17,24,39,0.12),transparent_30%),radial-gradient(circle_at_46%_88%,rgba(107,114,128,0.10),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0)_52%)] dark:bg-[radial-gradient(circle_at_72%_20%,rgba(255,255,255,0.10),transparent_32%),radial-gradient(circle_at_30%_78%,rgba(148,163,184,0.10),transparent_34%),linear-gradient(180deg,rgba(5,10,20,0.98),rgba(8,13,26,0.1)_58%)]" />
      <div className="container-page relative grid max-w-[1400px] gap-7 py-10 xl:grid-cols-[minmax(450px,0.95fr)_minmax(0,1.05fr)] xl:items-start xl:gap-8 xl:py-14 2xl:grid-cols-[minmax(500px,1fr)_minmax(0,0.96fr)]">
        <div className="scrollbar-rail -mx-1 flex min-w-0 flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0 xl:col-span-2 xl:pb-0">
          {(copy.badgeChips?.length ? copy.badgeChips : [copy.eyebrow]).map((badge, index) => (
            <span
              key={badge}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand/15 bg-brand/10 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand shadow-sm sm:gap-2 sm:px-3 sm:text-[11px] sm:tracking-[0.08em]"
            >
              <UIIcon icon={index === 1 ? CircleDollarSign : index === 2 ? RefreshCcw : BadgeDollarSign} size={14} />
              {badge}
            </span>
          ))}
        </div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2 xl:pr-1">
          <h1 className="mt-8 max-w-[20ch] text-4xl font-semibold leading-[1.04] text-text-primary sm:text-5xl md:text-[2.65rem] lg:text-[3.05rem] xl:text-[3.65rem]">
            {renderHeroTitle(copy.title)}
          </h1>
          <p className="mt-5 max-w-[42rem] text-base leading-7 text-text-secondary xl:text-lg xl:leading-8">{copy.subtitle}</p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <ButtonLink
              href="/app"
              prefetch={false}
              linkComponent={Link}
              size="lg"
              data-analytics-event="hero_start_render_click"
              data-analytics-cta-name="start_render"
              data-analytics-cta-location="home_hero"
            >
              {copy.primaryCta}
            </ButtonLink>
            <ButtonLink
              href={{ pathname: '/examples' }}
              linkComponent={Link}
              variant="outline"
              size="lg"
              data-analytics-event="hero_examples_click"
              data-analytics-cta-name="see_examples"
              data-analytics-cta-location="home_hero"
              data-analytics-target-family="examples"
            >
              {copy.secondaryCta}
            </ButtonLink>
            <Link
              href={{ pathname: '/ai-video-engines' }}
              className="inline-flex min-h-[48px] items-center gap-2 px-2 text-sm font-semibold text-brand underline decoration-transparent underline-offset-4 transition hover:text-brandHover hover:decoration-current"
              data-analytics-event="hero_compare_click"
              data-analytics-cta-name="compare_engines"
              data-analytics-cta-location="home_hero"
              data-analytics-target-family="compare"
            >
              {copy.examplesCta}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="min-w-0 xl:col-start-2 xl:row-span-2 xl:row-start-2 xl:self-center">
          <HeroVideoShowcase
          items={videoItems}
          playLabel={copy.mockup.playLabel}
          pauseLabel={copy.mockup.pauseLabel}
        />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-start-1 xl:row-start-3">{valueCards}</div>
      </div>
      <div className="container-page relative max-w-[1460px] pb-10">
        <div className="grid gap-px overflow-hidden rounded-[18px] border border-hairline bg-hairline shadow-card backdrop-blur sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          {proofStats.map((stat) => {
            const content = (
              <>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-text-primary">
                <UIIcon icon={PROOF_ICONS[stat.id] ?? Sparkles} size={25} strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-base font-semibold leading-none text-text-primary">{stat.value}</span>
                <span className="mt-1 block text-xs font-medium leading-4 text-text-secondary">{stat.label}</span>
              </span>
              </>
            );

            return stat.href ? (
              <Link
                key={stat.label}
                href={stat.href}
                className="flex items-center justify-center gap-3 bg-white/92 px-3 py-4 transition hover:bg-bg focus:outline-none focus:ring-2 focus:ring-brand/40 dark:bg-surface/72"
              >
                {content}
              </Link>
            ) : (
              <div key={stat.label} className="flex items-center justify-center gap-3 bg-white/92 px-3 py-4 dark:bg-surface/72">
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProofBar({ stats }: { stats: ProofStat[] }) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className="container-page grid max-w-[1200px] grid-cols-2 gap-px py-6 sm:grid-cols-4 lg:grid-cols-8">
        {stats.map((stat) => (
          <div key={stat.label} className="px-3 py-3 text-center">
            <p className="text-2xl font-semibold text-brand">{stat.value}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-micro text-text-muted">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ShotTypeEngineSelector({ copy, cards }: { copy: SectionCopy; cards: ShotTypeCard[] }) {
  return (
    <section className="border-b border-hairline bg-bg py-16 sm:py-20">
      <div className="container-page max-w-[1400px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="group relative min-h-[290px] overflow-hidden rounded-[18px] border border-white/12 bg-[#070b14] p-4 shadow-[0_24px_54px_-34px_rgba(15,23,42,0.76)] transition hover:-translate-y-1 hover:shadow-[0_30px_70px_-36px_rgba(3,7,18,0.55)]"
              data-analytics-event="shot_type_card_click"
              data-analytics-cta-name={card.id}
              data-analytics-cta-location="shot_type_selector"
              data-analytics-target-family="models"
            >
              <Image
                src={SHOT_TYPE_VISUALS[card.id]?.imageSrc ?? '/assets/placeholders/preview-16x9.png'}
                alt=""
                fill
                sizes="(max-width: 767px) 100vw, (max-width: 1279px) 33vw, 210px"
                className="object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,20,0.08)_0%,rgba(7,11,20,0.45)_44%,rgba(7,11,20,0.94)_100%)]" />
              <div className="relative z-10 flex h-full min-h-[258px] flex-col">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-black/48 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                    {SHOT_TYPE_VISUALS[card.id]?.price ?? 'Live price'}
                  </span>
                  <span className="rounded-full bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur">
                    {card.engines[0]}
                  </span>
                </div>
                <div className="mt-auto">
                  <h3 className="text-lg font-semibold leading-6 text-white">{card.title}</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                {card.engines.map((engine) => (
                  <span key={engine} className="rounded-pill border border-white/12 bg-white/12 px-2.5 py-1 text-[11px] font-semibold text-white/85">
                    {engine}
                  </span>
                ))}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-white/80">{card.body}</p>
                  <p className="mt-5 text-sm font-semibold text-white/84 group-hover:text-white">
                    {card.cta} <span aria-hidden="true">→</span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RealExamplesPreview({ copy, examples }: { copy: SectionCopy & { viewPrompt?: string }; examples: HomeExampleCard[] }) {
  return (
    <section className="border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {examples.map((example) => (
            <article key={example.id} className="overflow-hidden rounded-card border border-hairline bg-bg shadow-card">
              <Link
                href={example.href}
                className="group block"
                data-analytics-event="example_category_click"
                data-analytics-cta-name={example.id}
                data-analytics-cta-location="examples_preview"
                data-analytics-target-family="examples"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-surface-3">
                  <Image
                    src={example.imageSrc}
                    alt={example.imageAlt}
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 380px"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-3 text-on-inverse">
                    <div>
                      <p className="text-sm font-semibold">{example.engine}</p>
                      <p className="text-xs text-on-media-80">{example.mode} · {example.duration}</p>
                    </div>
                    {example.price ? (
                      <span className="rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-[#111827]">{example.price}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
              <div className="p-4">
                <h3 className="text-base font-semibold text-text-primary">{example.title}</h3>
                <p className="mt-2 min-h-[3rem] text-sm leading-6 text-text-secondary">{example.useCase}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={example.href}
                    className="text-sm font-semibold text-brand hover:text-brandHover"
                    data-analytics-event="example_category_click"
                    data-analytics-cta-name={example.id}
                    data-analytics-cta-location="examples_preview_cta"
                    data-analytics-target-family="examples"
                  >
                    {example.ctaLabel}
                  </Link>
                  {example.cloneHref ? (
                    <Link
                      href={example.cloneHref}
                      prefetch={false}
                      className="text-sm font-medium text-text-muted underline underline-offset-4 hover:text-text-primary"
                      data-analytics-event="example_clone_click"
                      data-analytics-cta-name={example.id}
                      data-analytics-cta-location="examples_preview_clone"
                      data-analytics-target-family="workspace"
                    >
                      {example.cloneLabel ?? copy.viewPrompt ?? 'Clone settings'}
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
        {copy.cta ? (
          <div className="flex justify-center">
            <ButtonLink href={{ pathname: '/examples' }} linkComponent={Link} variant="outline" size="lg">
              {copy.cta}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ComparisonPreview({ copy, comparisons }: { copy: SectionCopy; comparisons: ComparisonCard[] }) {
  return (
    <section className="border-b border-hairline bg-bg section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {comparisons.map((comparison) => (
            <Link
              key={comparison.id}
              href={comparison.href}
              className="group rounded-card border border-hairline bg-surface p-5 shadow-card transition hover:border-brand/40 hover:shadow-float"
              data-analytics-event="comparison_card_click"
              data-analytics-cta-name={comparison.id}
              data-analytics-cta-location="comparison_preview"
              data-analytics-target-family="compare"
            >
              <h3 className="text-xl font-semibold text-text-primary">{comparison.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{comparison.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {comparison.badges.map((badge) => (
                  <span key={badge} className="rounded-pill border border-brand/20 bg-brand/5 px-2.5 py-1 text-xs font-semibold text-brand">
                    {badge}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm font-semibold text-brand group-hover:text-brandHover">{comparison.cta}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ReferenceWorkflow({ copy, steps }: { copy: SectionCopy; steps: WorkflowStep[] }) {
  return (
    <section className="border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-4 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              className="group rounded-card border border-hairline bg-bg p-5 shadow-card transition hover:border-brand/40"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={step.toolLabel}
              data-analytics-cta-location="reference_workflow"
              data-analytics-tool-name={step.toolLabel}
              data-analytics-tool-surface="public"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-card border border-brand/20 bg-brand/10 text-sm font-semibold text-brand">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{step.body}</p>
              <p className="mt-5 text-sm font-semibold text-brand group-hover:text-brandHover">{step.toolLabel}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiVideoToolbox({ copy, tools }: { copy: SectionCopy; tools: ToolCard[] }) {
  return (
    <section className="border-b border-hairline bg-bg section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group rounded-card border border-hairline bg-surface p-4 shadow-card transition hover:border-brand/40"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={tool.id}
              data-analytics-cta-location="toolbox"
              data-analytics-tool-name={tool.id}
              data-analytics-tool-surface="public"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-card border border-brand/20 bg-brand/10 text-brand">
                <UIIcon icon={TOOL_ICONS[tool.icon]} size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold text-text-primary">{tool.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{tool.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TransparentPricingBlock({ copy, cards }: { copy: SectionCopy; cards: TrustCard[] }) {
  return (
    <section className="border-b border-hairline bg-surface section">
      <div className="container-page grid max-w-[1200px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <SectionHeader align="left" title={copy.title} subtitle={copy.subtitle} />
          <ButtonLink
            href={{ pathname: '/pricing' }}
            linkComponent={Link}
            size="lg"
            className="mt-6"
            data-analytics-event="pricing_cta_click"
            data-analytics-cta-name="view_pricing"
            data-analytics-cta-location="transparent_pricing"
            data-analytics-target-family="pricing"
          >
            {copy.cta ?? 'View pricing'}
          </ButtonLink>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card, index) => {
            const icons = [BadgeDollarSign, CircleDollarSign, RefreshCcw, ClipboardList] as const;
            return (
              <article key={card.title} className="rounded-card border border-hairline bg-bg p-5 shadow-card">
                <span className="flex h-10 w-10 items-center justify-center rounded-card border border-brand/20 bg-brand/10 text-brand">
                  <UIIcon icon={icons[index] ?? CircleDollarSign} size={20} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text-primary">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{card.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ProviderEngineStrip({ copy, providers }: { copy: SectionCopy; providers: ProviderItem[] }) {
  return (
    <section className="border-b border-hairline bg-bg section-compact">
      <div className="container-page max-w-[1200px] stack-gap">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((item) => {
            const content = (
              <>
                <p className="text-sm font-semibold text-text-primary">{item.provider}</p>
                <p className="mt-1 text-sm text-text-secondary">{item.model}</p>
              </>
            );

            return item.href ? (
              <Link
                key={`${item.provider}-${item.model}`}
                href={item.href}
                className="rounded-card border border-hairline bg-surface p-4 shadow-card transition hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {content}
              </Link>
            ) : (
              <div key={`${item.provider}-${item.model}`} className="rounded-card border border-hairline bg-surface p-4 shadow-card">
                {content}
              </div>
            );
          })}
        </div>
        <div className="flex justify-center">
          <ButtonLink href={{ pathname: '/models' }} linkComponent={Link} variant="outline" size="lg">
            {copy.cta ?? 'View all models'}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function HomeFaq({ copy, items }: { copy: SectionCopy; items: FaqItem[] }) {
  return (
    <section className="bg-surface section">
      <div className="container-page max-w-[900px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.question} className="group rounded-card border border-hairline bg-bg p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-text-primary">
                <span>{item.question}</span>
                <UIIcon icon={Box} size={18} className="text-text-muted transition group-open:rotate-45" />
              </summary>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SeoKeywordBlock({ text }: { text: string }) {
  return (
    <section className="border-b border-hairline bg-bg py-6">
      <div className="container-page max-w-[1000px]">
        <p className="text-center text-sm leading-7 text-text-secondary">{text}</p>
      </div>
    </section>
  );
}
