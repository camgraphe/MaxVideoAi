import Image from 'next/image';
import {
  BadgeCheck,
  BadgeDollarSign,
  Atom,
  AudioWaveform,
  BarChart3,
  Box,
  Clock,
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
  Scale,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Link, type LocalizedLinkHref } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { EngineIcon } from '@/components/ui/EngineIcon';
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

export type BestForTopPick = {
  slug: string;
  label: string;
  brandId?: string;
  provider?: string;
};

export type ShotTypeCard = {
  id: string;
  slug: string;
  title: string;
  body: string;
  cta: string;
  href: LocalizedLinkHref;
  tier: number;
  topPicks: BestForTopPick[];
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
  examplesCtaVisible?: boolean;
  modelCtaLabel?: string;
  cloneLabel?: string;
};

export type ComparisonCard = {
  id: string;
  title: string;
  body: string;
  badges: string[];
  cta: string;
  href: LocalizedLinkHref;
  imageSrc?: string;
  imageAlt?: string;
  media?: Array<{
    imageSrc: string;
    imageAlt: string;
    label?: string;
  }>;
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
  shortBody?: string;
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
  eyebrow?: string;
  cta?: string;
  primaryCta?: string;
  secondaryCta?: string;
  scorecardTitle?: string;
  scorecardSubtitle?: string;
  scorecardLeftLabel?: string;
  scorecardRightLabel?: string;
  scorecardCriteriaLabel?: string;
  scorecardRows?: Array<{ label: string; left: number; right: number }>;
  featureCards?: Array<{ title: string; body: string }>;
  modelsCta?: string;
  libraryTitle?: string;
  libraryBody?: string;
  providerLabel?: string;
  hubCtaTitle?: string;
  hubCtaBody?: string;
  guideLabel?: string;
  topPicksLabel?: string;
  moreGuidesTitle?: string;
  supportingText?: string;
  modelsLink?: string;
  examplesLink?: string;
  compareLink?: string;
};

export type WorkflowSeoSummaryCopy = {
  heroParagraph?: string;
  heroPoints?: string[];
  definition?: {
    title?: string;
    body?: string;
  };
  generateWays?: {
    title?: string;
    items?: Array<{
      title: string;
      body: string;
    }>;
  };
};

function isWorkspaceHref(href: LocalizedLinkHref): boolean {
  const pathname = typeof href === 'string' ? href : 'pathname' in href && typeof href.pathname === 'string' ? href.pathname : '';
  return pathname === '/app' || pathname.startsWith('/app?') || pathname.startsWith('/app/');
}

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

const TOOLBOX_VISUALS: Record<string, string> = {
  'text-to-video':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a89d8b58-3c6b-4de6-bf1d-88982b2a33da.jpg',
  'image-to-video':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/b527318e-2b66-4da2-8ac3-e82155c9806b.jpg',
  'video-to-video':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/84413a86-180e-4b46-81f8-0459fb0e905f.jpg',
  'generate-image':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/3bfdfcb2-3c20-4b84-9fd5-e3645810d45a.jpg',
  'character-builder':
    'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/d9851ed8-4db8-4f0c-a547-39d972bd9b64.webp',
  'angle-tool':
    'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/c82407ca-701a-447a-878f-491338658cd0.webp',
  upscale:
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/06c83b77-46aa-4aff-b687-dbeeb6bcbf22.jpg',
  'compare-engines':
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/de3b13d9-e5b0-4c09-993e-89039642f9fa.jpg',
};

const REFERENCE_WORKFLOW_VISUALS = [
  '/assets/marketing/reference-workflow-source-image.webp',
  '/assets/marketing/reference-workflow-character-consistency.webp',
  '/assets/marketing/reference-workflow-angle-composition.webp',
  '/assets/marketing/reference-workflow-final-video.webp',
] as const;

const HERO_VIDEO_ORDER = ['seedance-2-0', 'kling-3-pro', 'veo-3-1-lite', 'ltx-2-3-pro', 'happy-horse-1-0'] as const;
const HOME_HERO_IMAGE_URL = '/assets/home/home-hero-reference.webp';
const HERO_VIDEO_MODE_LABELS: Record<string, string> = {
  'kling-3-pro': 'image-to-video',
  'seedance-2-0': 'image-to-video',
  'veo-3-1-lite': 'image-to-video',
  'ltx-2-3-pro': 'audio-to-video',
  'happy-horse-1-0': 'reference-to-video',
};
const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'seedance-2-0': ['Cinematic', 'Realism'],
  'veo-3-1-lite': ['Realistic', 'Premium'],
  'ltx-2-3-pro': ['Audio', 'Retake'],
  'happy-horse-1-0': ['Lip-sync', 'Unified'],
};

const PROOF_ICONS: Record<string, LucideIcon> = {
  engines: Atom,
  providers: Box,
  textToVideo: Type,
  imageToVideo: ImageIcon,
  videoToVideo: Video,
  audio: AudioWaveform,
  fourK: BadgeCheck,
  successfulGenerations: BarChart3,
};

const KLING_3_PRO_HERO_RENDER = {
  posterSrc:
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/01245e62-6bb2-4d5d-89c6-c60923a004ad.jpg',
  videoSrc:
    'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/7b1f1c7b-f7f0-473e-9610-82723604b690.mp4',
  resolution: '16:9',
  duration: '0:12',
  estimateValue: '$2.63',
  estimateMeta: '12s generation',
} as const;

const HERO_ENGINE_MEDIA: Record<
  string,
  {
    posterSrc: string;
    videoSrc?: string;
    resolution: string;
    duration: string;
    estimateValue?: string;
    estimateMeta?: string;
    price?: string;
  }
> = {
  'kling-3-pro': {
    ...KLING_3_PRO_HERO_RENDER,
  },
  'seedance-2-0': {
    posterSrc: '/hero/showcase-seedance-2-0.webp',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1': {
    posterSrc: '/hero/showcase-veo-3-1.webp',
    resolution: '16:9',
    duration: '0:05',
  },
  'veo-3-1-lite': {
    posterSrc: '/hero/showcase-veo-3-1.webp',
    resolution: '16:9',
    duration: '0:05',
  },
  'ltx-2-3-pro': {
    posterSrc:
      'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/983f1a91-97d7-40bf-b857-3c5fdbfa6162.jpg',
    videoSrc: 'https://v3b.fal.media/files/b/0a92e777/yOJovcho63SdNjNfVunD-_kXUBqX1L.mp4',
    resolution: '16:9',
    duration: '0:10',
    estimateValue: '$0.78',
    estimateMeta: '10s generation',
  },
  'happy-horse-1-0': {
    posterSrc:
      'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a3182fc5-e993-4a3b-9b5a-805997bd3e68.jpg',
    videoSrc: 'https://v3b.fal.media/files/b/0a980ba7/aoVrsYYBEf6002D3i48f9_6vQQ9p2k.mp4',
    resolution: '16:9',
    duration: '0:10',
    estimateValue: '$1.82',
    estimateMeta: '10s generation',
    price: '$0.18/sec',
  },
  'sora-2': {
    posterSrc: '/hero/showcase-sora-2.webp',
    resolution: '16:9',
    duration: '0:05',
  },
};

const BEST_FOR_CARD_VISUALS: Record<string, { imageSrc: string; icon: LucideIcon }> = {
  'cinematic-realism': { imageSrc: '/hero/best-for-cinematic-realism.webp', icon: Clapperboard },
  'image-to-video': { imageSrc: '/hero/best-for-image-to-video.webp', icon: ImageIcon },
  'fast-drafts': { imageSrc: '/hero/best-for-fast-drafts-city.webp', icon: Sparkles },
  ads: { imageSrc: '/hero/best-for-product-ads.webp', icon: BadgeDollarSign },
};

const COMPARISON_CARD_MEDIA: Record<string, { imageSrc: string; imageAlt: string }> = {
  'seedance-upgrade': {
    imageSrc: '/hero/best-for-cinematic-realism.webp',
    imageAlt: 'Cinematic AI video comparison preview for Seedance models.',
  },
  'ltx-legacy-fast': {
    imageSrc: '/hero/best-for-fast-drafts-city.webp',
    imageAlt: 'Fast draft AI video comparison preview for LTX models.',
  },
  'ltx-seedance': {
    imageSrc: '/hero/showcase-seedance-2-0.webp',
    imageAlt: 'AI video comparison preview between LTX and Seedance.',
  },
  'ltx-veo': {
    imageSrc: '/hero/best-for-image-to-video.webp',
    imageAlt: 'AI video comparison preview between LTX and Veo.',
  },
  'kling-ltx': {
    imageSrc: '/hero/showcase-kling-3-pro.webp',
    imageAlt: 'Camera motion AI video comparison preview between Kling and LTX.',
  },
  'sora-standard-pro': {
    imageSrc: '/hero/showcase-sora-2.webp',
    imageAlt: 'AI video comparison preview for Sora models.',
  },
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
      price: fallbackMedia.price ?? engine.price ?? engine.fallbackPrice,
      estimateLabel: copy.quoteLabel,
      estimateValue: fallbackMedia.estimateValue ?? copy.quoteValue,
      estimateMeta: fallbackMedia.estimateMeta ?? '5s generation',
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

function renderBestForTitle(title: string) {
  const highlightTargets = ['use case.', 'l’usage.', 'cas d’usage.', 'caso de uso.'];
  const target = highlightTargets.find((candidate) => title.toLowerCase().endsWith(candidate));

  if (!target) return title;

  const start = title.length - target.length;
  return (
    <>
      {title.slice(0, start)}
      <span className="text-brand">{title.slice(start)}</span>
    </>
  );
}

export function StartupFameLink({ label = 'Featured on Startup Fame', className }: { label?: string; className?: string }) {
  const classes = [
    'inline-flex items-center justify-center rounded-pill px-2.5 py-1 text-[10px] font-semibold uppercase tracking-micro text-text-muted/70 transition hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:text-white/45 dark:hover:text-white/70',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <a
      href="https://startupfa.me/s/maxvideoai?utm_source=maxvideoai.com"
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
      aria-label={label}
    >
      {label}
    </a>
  );
}

function formatBestForPickLabel(label: string) {
  return label
    .replace(/^Seedance 2\.0 Fast$/i, 'Seedance Fast')
    .replace(/^Seedance 2\.0$/i, 'Seedance')
    .replace(/^Kling 3 (Pro|Standard)$/i, 'Kling')
    .replace(/^Veo 3\.1 Fast$/i, 'Veo Fast')
    .replace(/^Veo 3\.1$/i, 'Veo')
    .replace(/^LTX 2\.3 Fast$/i, 'LTX')
    .replace(/^LTX 2\.3 Pro$/i, 'LTX');
}

function applyHeroMediaOverride(item: HeroVideoShowcaseItem): HeroVideoShowcaseItem {
  const engineId = item.engineId ?? item.id;
  if (engineId !== 'kling-3-pro') return item;

  const modeLabel = item.mediaInfo?.split(' · ')[0] ?? HERO_VIDEO_MODE_LABELS['kling-3-pro'];
  const durationLabel = `${Number(KLING_3_PRO_HERO_RENDER.duration.slice(2))}s`;

  return {
    ...item,
    posterSrc: KLING_3_PRO_HERO_RENDER.posterSrc,
    videoSrc: KLING_3_PRO_HERO_RENDER.videoSrc,
    duration: KLING_3_PRO_HERO_RENDER.duration,
    resolution: KLING_3_PRO_HERO_RENDER.resolution,
    mediaInfo: [modeLabel, durationLabel, KLING_3_PRO_HERO_RENDER.resolution].join(' · '),
    estimateValue: KLING_3_PRO_HERO_RENDER.estimateValue,
    estimateMeta: KLING_3_PRO_HERO_RENDER.estimateMeta,
    imageAlt: 'Kling 3 Pro AI video preview in MaxVideoAI.',
  };
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
    return item ? [applyHeroMediaOverride(item)] : [];
  });
  const valueCards = (
    <>
      {copy.valueCards.map((card) => (
        <div
          key={card.title}
          className="dark-neon-panel min-h-[86px] rounded-[14px] border border-black/[0.07] bg-white/68 p-3 text-left backdrop-blur transition hover:border-black/[0.12] hover:bg-white/82 dark:border-white/[0.10] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.78),rgba(30,41,59,0.32))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_-34px_rgba(0,0,0,0.9)] dark:hover:border-white/[0.16] dark:hover:bg-[linear-gradient(135deg,rgba(20,31,50,0.86),rgba(37,52,78,0.36))] sm:min-h-[112px] sm:rounded-[18px] sm:p-4"
        >
          <span className="block text-[13px] font-semibold leading-4 text-text-primary sm:text-[15px] sm:leading-5">{card.title}</span>
          <span className="mt-1.5 block max-w-[18rem] text-[11px] leading-4 text-text-secondary line-clamp-2 sm:mt-2 sm:text-xs sm:leading-5">{card.body}</span>
        </div>
      ))}
    </>
  );
  const proofGridColumnsClass = proofStats.length >= 8 ? 'xl:grid-cols-8' : 'xl:grid-cols-7';

  return (
    <section className="home-hero-section dark-section-neon relative overflow-hidden border-b border-hairline bg-bg">
      <Image
        src={HOME_HERO_IMAGE_URL}
        alt=""
        aria-hidden="true"
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="pointer-events-none object-cover object-center opacity-65 dark:brightness-[0.58] dark:contrast-110 dark:invert dark:opacity-[0.34]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_18%,rgba(255,255,255,0.76),transparent_30%),radial-gradient(circle_at_46%_88%,rgba(255,255,255,0.42),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.18)_58%,rgba(255,255,255,0)_100%)] dark:bg-[radial-gradient(ellipse_at_78%_16%,rgba(255,255,255,0.055),transparent_46%),radial-gradient(ellipse_at_94%_26%,rgba(125,211,252,0.035),transparent_42%),linear-gradient(180deg,rgba(3,7,18,0.99)_0%,rgba(4,8,22,0.96)_48%,rgba(3,7,18,0.92)_100%)]" />
      <div className="home-hero-dark-grid pointer-events-none absolute inset-x-0 bottom-0 hidden h-[38%] dark:block" aria-hidden="true" />
      <div className="container-page relative grid max-w-[1400px] gap-7 py-10 min-[900px]:grid-cols-[minmax(340px,0.88fr)_minmax(0,1.12fr)] min-[900px]:items-start min-[900px]:gap-6 min-[900px]:py-12 lg:grid-cols-[minmax(380px,0.92fr)_minmax(0,1.08fr)] lg:gap-7 xl:grid-cols-[minmax(450px,0.95fr)_minmax(0,1.05fr)] xl:gap-8 xl:py-14 2xl:grid-cols-[minmax(500px,1fr)_minmax(0,0.96fr)]">
        <div className="flex min-w-0 flex-wrap gap-2 overflow-visible sm:flex-nowrap sm:overflow-x-auto min-[900px]:col-span-2">
          {(copy.badgeChips?.length ? copy.badgeChips : [copy.eyebrow]).map((badge, index) => (
            <span
              key={badge}
              className="inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-normal rounded-pill border border-brand/15 bg-brand/10 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase leading-4 tracking-[0.06em] text-brand shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-white/88 sm:gap-2 sm:px-3 sm:text-[11px] sm:tracking-[0.08em]"
            >
              <UIIcon icon={index === 1 ? CircleDollarSign : index === 2 ? RefreshCcw : BadgeDollarSign} size={14} />
              {badge}
            </span>
          ))}
        </div>
        <div className="min-w-0 min-[900px]:col-start-1 min-[900px]:row-start-2 min-[900px]:pr-1">
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
        <div className="min-w-0 min-[900px]:col-start-2 min-[900px]:row-span-2 min-[900px]:row-start-2 min-[900px]:self-center">
          <HeroVideoShowcase
            items={videoItems}
            playLabel={copy.mockup.playLabel}
            pauseLabel={copy.mockup.pauseLabel}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 min-[900px]:col-start-1 min-[900px]:row-start-3">{valueCards}</div>
      </div>
      <div className="container-page relative max-w-[1460px] pb-9">
        <div className="scrollbar-rail overflow-x-auto pb-1">
          <div className={`dark-neon-panel inline-grid min-w-full auto-cols-[116px] grid-flow-col overflow-hidden rounded-[24px] border border-black/[0.08] bg-white/72 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-glass-80 sm:grid sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-4 ${proofGridColumnsClass}`}>
          {proofStats.map((stat) => {
            const content = (
              <>
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-text-primary/90 sm:h-[18px] sm:w-[18px]">
                  <UIIcon icon={PROOF_ICONS[stat.id] ?? Sparkles} size={16} strokeWidth={1.75} className="sm:h-[18px] sm:w-[18px]" />
                </span>
                <span className="min-w-0 text-center">
                  <span className="block text-lg font-semibold leading-none tracking-tight text-text-primary sm:text-xl">{stat.value}</span>
                  <span className="mt-1 block text-[10px] font-medium leading-3 text-text-secondary sm:text-[11px] sm:leading-4">{stat.label}</span>
                </span>
              </>
            );

            return stat.href ? (
              <Link
                key={stat.label}
                href={stat.href}
                className="relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-3 py-3 transition hover:bg-white/52 focus:outline-none focus:ring-2 focus:ring-brand/30 dark:hover:bg-white/[0.045] sm:min-h-[76px] sm:py-3 [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:right-0 [&:not(:last-child)]:after:top-4 [&:not(:last-child)]:after:h-[calc(100%-2rem)] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-black/[0.08] dark:[&:not(:last-child)]:after:bg-white/[0.07]"
              >
                {content}
              </Link>
            ) : (
              <div key={stat.label} className="relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 px-3 py-3 sm:min-h-[76px] sm:py-3 [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:right-0 [&:not(:last-child)]:after:top-4 [&:not(:last-child)]:after:h-[calc(100%-2rem)] [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-black/[0.08] dark:[&:not(:last-child)]:after:bg-white/[0.07]">
                {content}
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProofBar({ stats }: { stats: ProofStat[] }) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-surface">
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

export function ShotTypeEngineSelector({
  copy,
  cards,
  startupFameLabel,
}: {
  copy: SectionCopy;
  cards: ShotTypeCard[];
  startupFameLabel?: string;
}) {
  const guideLabel = copy.guideLabel ?? 'Best-for guide';
  const topPicksLabel = copy.topPicksLabel ?? 'Top picks';

  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg py-12 sm:py-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(17,24,39,0.08),transparent_34%),linear-gradient(180deg,rgba(248,250,252,0.94),rgba(255,255,255,0)_48%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.035),transparent_40%),linear-gradient(180deg,rgba(3,7,18,0.95),rgba(3,7,18,0)_56%)]" />
      <div className="container-page relative max-w-[1360px] stack-gap-lg">
        <div className="mx-auto max-w-4xl text-center">
          {copy.eyebrow ? (
            <span className="inline-flex rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-brand">
              {copy.eyebrow}
            </span>
          ) : null}
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-text-primary sm:text-4xl md:text-5xl">
            {renderBestForTitle(copy.title)}
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-text-secondary sm:mt-4 sm:text-base sm:leading-7">{copy.subtitle}</p>
        </div>
        <div className="grid grid-cols-2 items-stretch gap-3 sm:gap-5 xl:grid-cols-4">
          {cards.map((card) => {
            const visual = BEST_FOR_CARD_VISUALS[card.slug] ?? {
              imageSrc: '/assets/placeholders/preview-16x9.png',
              icon: Sparkles,
            };

            return (
              <Link
                key={card.id}
                href={card.href}
                className="dark-neon-panel group flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-hairline bg-white/88 shadow-[0_12px_32px_rgba(15,23,42,0.055),0_3px_10px_rgba(15,23,42,0.03)] transition hover:-translate-y-1 hover:border-text-muted/35 hover:shadow-[0_26px_62px_rgba(15,23,42,0.11)] focus:outline-none focus:ring-2 focus:ring-brand/35 dark:bg-surface-glass-80 dark:shadow-[0_24px_70px_rgba(0,0,0,0.28)] dark:hover:border-white/20 dark:hover:bg-surface-glass-70 sm:rounded-[20px]"
                data-analytics-event="shot_type_card_click"
                data-analytics-cta-name={card.id}
                data-analytics-cta-location="shot_type_selector"
                data-analytics-target-family="best-for"
              >
                <div className="relative aspect-[16/9.8] overflow-hidden bg-surface-3 sm:aspect-[16/8.2]">
                  <Image
                    src={visual.imageSrc}
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 1279px) 50vw, 320px"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/32 via-black/5 to-black/12" />
                  <span className="absolute left-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/18 bg-[#111827]/90 text-white shadow-[0_12px_28px_rgba(0,0,0,0.28)] backdrop-blur sm:left-4 sm:top-4 sm:h-11 sm:w-11">
                    <UIIcon icon={visual.icon} size={18} strokeWidth={1.75} className="sm:h-[22px] sm:w-[22px]" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3 sm:p-4">
                  <span className="inline-flex w-fit rounded-full bg-brand/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-brand sm:px-2.5 sm:py-1 sm:text-[10px] sm:tracking-[0.08em]">
                    {guideLabel}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-tight text-text-primary sm:mt-3 sm:text-lg">{card.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-text-secondary sm:mt-2 sm:text-sm sm:leading-5">{card.body}</p>
                  <div className="mt-3 border-t border-hairline pt-2 sm:mt-4 sm:pt-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-text-muted sm:text-[10px] sm:tracking-[0.08em]">{topPicksLabel}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1 sm:mt-2 sm:gap-1.5">
                      {card.topPicks.slice(0, 3).map((pick) => (
                        <span
                          key={pick.slug}
                          className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-text-primary sm:gap-1.5 sm:px-2 sm:py-1 sm:text-[11px]"
                        >
                          <EngineIcon engine={{ id: pick.slug, label: pick.label, brandId: pick.brandId }} size={16} rounded="full" />
                          <span className="truncate">{formatBestForPickLabel(pick.label)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-auto pt-3 text-xs font-semibold text-brand transition group-hover:text-brandHover sm:pt-4 sm:text-sm">
                    {card.cta} <span aria-hidden="true">→</span>
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        {copy.cta ? (
          <div className="mx-auto flex max-w-[620px] flex-col items-center gap-2">
            <Link
              href={{ pathname: '/ai-video-engines/best-for' }}
              className="dark-neon-panel group flex w-full items-center gap-4 rounded-[22px] border border-hairline bg-white/82 p-4 text-left shadow-[0_18px_50px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-text-muted/35 hover:shadow-[0_24px_64px_rgba(15,23,42,0.1)] focus:outline-none focus:ring-2 focus:ring-brand/35 dark:bg-surface-glass-80 dark:hover:bg-surface-glass-70"
              data-analytics-event="shot_type_card_click"
              data-analytics-cta-name="best-for-hub"
              data-analytics-cta-location="shot_type_hub_cta"
              data-analytics-target-family="best-for"
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-brand/10 text-brand">
                <UIIcon icon={Layers3} size={24} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-text-primary">{copy.hubCtaTitle ?? copy.cta}</span>
                {copy.hubCtaBody ? (
                  <span className="mt-1 block text-sm leading-5 text-text-secondary">{copy.hubCtaBody}</span>
                ) : null}
              </span>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-primary transition group-hover:translate-x-1 group-hover:text-brand">
                <span aria-hidden="true">→</span>
              </span>
            </Link>
            {startupFameLabel ? <StartupFameLink label={startupFameLabel} /> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function RealExamplesPreview({
  copy,
  examples,
  providers,
}: {
  copy: SectionCopy & { viewPrompt?: string };
  examples: HomeExampleCard[];
  providers?: ProviderItem[];
}) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-surface py-14 sm:py-16">
      <div className="container-page max-w-[1200px]">
        <div className="mx-auto max-w-[880px] text-center">
          <p className="text-xs font-semibold uppercase tracking-micro text-brand">{copy.eyebrow ?? 'AI video examples'}</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight text-text-primary sm:text-4xl">{copy.title}</h2>
          <p className="mx-auto mt-3 max-w-[780px] text-base leading-7 text-text-secondary">{copy.subtitle}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink
              href={{ pathname: '/examples' }}
              linkComponent={Link}
              size="md"
              data-analytics-event="example_category_click"
              data-analytics-cta-name="all_examples"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="examples"
            >
              {copy.cta ?? 'Browse all examples'}
              <span aria-hidden="true">→</span>
            </ButtonLink>
            <ButtonLink
              href={{ pathname: '/models' }}
              linkComponent={Link}
              variant="outline"
              size="md"
              data-analytics-event="model_card_click"
              data-analytics-cta-name="all_models"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="models"
            >
              {copy.modelsCta ?? 'View all model specs'}
              <span aria-hidden="true">→</span>
            </ButtonLink>
            <Link
              href={{ pathname: '/ai-video-engines' }}
              className="inline-flex min-h-10 items-center gap-2 rounded-input px-2 text-sm font-semibold text-brand transition hover:text-brandHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              data-analytics-event="comparison_card_click"
              data-analytics-cta-name="compare_engines"
              data-analytics-cta-location="examples_preview_header"
              data-analytics-target-family="compare"
            >
              {copy.compareLink ?? 'Compare engines'}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="dark-neon-panel mt-7 overflow-hidden rounded-[20px] border border-hairline bg-bg shadow-sm dark:border-white/[0.08]">
          <div className="divide-y divide-hairline dark:divide-white/[0.07]">
            {examples.map((example) => {
              const modeIcon = example.mode.toLowerCase().startsWith('text') ? Type : example.mode.toLowerCase().startsWith('video') ? Video : ImageIcon;
              const showExamplesCta = example.examplesCtaVisible !== false;
              const modelHref = example.modelHref ?? example.href;
              return (
                <article
                  key={example.id}
                  className="grid grid-cols-[112px_1fr] gap-3 px-3 py-3 lg:grid-cols-[132px_220px_165px_72px_82px_170px] lg:items-center lg:gap-3 lg:px-5"
                >
                  <Link
                    href={showExamplesCta ? example.href : modelHref}
                    className="group relative row-span-4 h-[106px] overflow-hidden rounded-[10px] bg-surface-3 lg:row-span-1 lg:h-[72px] lg:w-[132px]"
                    data-analytics-event={showExamplesCta ? 'example_category_click' : 'model_card_click'}
                    data-analytics-cta-name={example.id}
                    data-analytics-cta-location="examples_preview"
                    data-analytics-target-family={showExamplesCta ? 'examples' : 'models'}
                  >
                    <span className="sr-only">{showExamplesCta ? example.ctaLabel : example.modelCtaLabel ?? 'Specs & pricing'}</span>
                    <Image
                      src={example.imageSrc}
                      alt={example.imageAlt}
                      fill
                      sizes="(max-width: 1023px) 112px, 132px"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  </Link>

                  <div className="min-w-0">
                    <h3 className="text-base font-semibold leading-5 text-text-primary">{example.engine}</h3>
                    <p className="mt-1 text-sm leading-5 text-text-secondary">{example.useCase}</p>
                  </div>

                  <div className="flex min-w-0 items-center gap-2 text-sm text-text-secondary">
                    <UIIcon icon={modeIcon} size={16} strokeWidth={1.9} />
                    <span className="truncate">{example.mode}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    {example.duration ? (
                      <>
                        <UIIcon icon={Clock} size={16} strokeWidth={1.9} />
                        <span>{example.duration}</span>
                      </>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>

                  <div>
                    {example.price && /[$€£]|\d/.test(example.price) ? (
                      <span className="inline-flex rounded-pill border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-text-primary dark:border-white/[0.08] dark:bg-white/[0.035]">
                        {example.price}
                      </span>
                    ) : (
                      <span className="text-sm text-text-muted">—</span>
                    )}
                  </div>

                  <div className="col-span-2 grid grid-cols-2 gap-2 border-t border-hairline pt-3 dark:border-white/[0.07] lg:col-span-1 lg:col-start-auto lg:grid-cols-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    {showExamplesCta ? (
                      <Link
                        href={example.href}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-input border border-hairline bg-surface px-2 text-center text-xs font-semibold text-brand hover:text-brandHover sm:text-sm lg:min-h-0 lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:text-left"
                        data-analytics-event="example_category_click"
                        data-analytics-cta-name={example.id}
                        data-analytics-cta-location="examples_preview_cta"
                        data-analytics-target-family="examples"
                      >
                        {example.ctaLabel}
                        <span aria-hidden="true">→</span>
                      </Link>
                    ) : (
                      <span className="hidden text-sm text-text-muted lg:inline">—</span>
                    )}

                    <Link
                      href={modelHref}
                      aria-label={example.engine === 'Seedance 2.0' ? 'View Seedance 2.0 specs, limits and pricing' : `View ${example.engine} specs, limits and pricing`}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-input border border-hairline bg-surface px-2 text-center text-xs font-semibold text-text-secondary hover:text-text-primary sm:text-sm lg:min-h-0 lg:justify-start lg:border-0 lg:bg-transparent lg:px-0 lg:text-left"
                      data-analytics-event="model_card_click"
                      data-analytics-cta-name={example.id}
                      data-analytics-cta-location="examples_preview_model"
                      data-analytics-target-family="models"
                    >
                      {example.modelCtaLabel ?? 'Specs & pricing'}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {providers?.length ? (
          <div className="dark-neon-panel mt-3 flex flex-wrap items-center gap-2 rounded-card border border-hairline bg-white/70 px-4 py-3 text-sm shadow-sm dark:border-white/[0.08] dark:bg-surface-glass-70">
            <span className="font-semibold text-text-primary">{copy.providerLabel ?? 'Supported engines'}</span>
            {providers.map((item) =>
              item.href ? (
                <Link
                  key={`${item.provider}-${item.model}`}
                  href={item.href}
                  className="rounded-pill border border-hairline bg-surface px-3 py-1 font-medium text-text-secondary transition hover:border-text-muted hover:text-text-primary dark:border-white/[0.08] dark:bg-white/[0.035] dark:hover:border-white/[0.16]"
                >
                  {item.model}
                </Link>
              ) : (
                <span
                  key={`${item.provider}-${item.model}`}
                  className="rounded-pill border border-hairline bg-surface px-3 py-1 font-medium text-text-secondary dark:border-white/[0.08] dark:bg-white/[0.035]"
                >
                  {item.model}
                </span>
              )
            )}
            <Link href={{ pathname: '/models' }} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brandHover">
              {copy.modelsCta ?? 'View all model specs'} <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ComparisonScorecard({ copy }: { copy: SectionCopy }) {
  return (
    <div
      className="relative flex min-h-[190px] items-center justify-center overflow-visible rounded-[32px] bg-[radial-gradient(circle_at_50%_44%,rgba(59,130,246,0.12),transparent_62%)] sm:min-h-[260px] lg:min-h-[360px]"
      role="img"
      aria-label={`${copy.scorecardTitle ?? 'Scorecard'}: ${copy.scorecardLeftLabel ?? 'Seedance 1.5 Pro'} compared with ${copy.scorecardRightLabel ?? 'Seedance 2.0'}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.72),transparent)] dark:bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      <Image
        src="/assets/marketing/comparison-scorecard-transparent.webp"
        alt="Side-by-side AI video model scorecard comparing Seedance 1.5 Pro and Seedance 2.0 across prompt adherence, visual quality, motion, audio and pricing."
        width={1280}
        height={853}
        sizes="(max-width: 1023px) 92vw, 700px"
        className="relative z-10 h-auto max-h-[210px] w-full max-w-[640px] object-contain drop-shadow-[0_28px_70px_rgba(15,23,42,0.13)] sm:max-h-[300px] lg:max-h-[390px] lg:max-w-[720px]"
        loading="lazy"
      />
    </div>
  );
}

export function ComparisonPreview({ copy, comparisons }: { copy: SectionCopy; comparisons: ComparisonCard[] }) {
  const featureCards =
    copy.featureCards && copy.featureCards.length > 0
      ? copy.featureCards
      : [
          { title: '11 comparison criteria', body: 'Quality, motion, audio, cost and more' },
          { title: 'Real outputs', body: 'See examples from each model' },
          { title: 'Live pricing', body: 'Know the cost before you generate' },
          { title: 'Updated often', body: 'Benchmarks refresh as models evolve' },
        ];

  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(15,23,42,0.05),transparent_26%),linear-gradient(90deg,transparent,rgba(148,163,184,0.09),transparent)] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.030),transparent_32%)]" />
      <div className="container-page max-w-[1280px] stack-gap-lg">
        <div className="relative grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            {copy.eyebrow ? (
              <span className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold uppercase tracking-micro text-brand shadow-sm">
                <UIIcon icon={Scale} size={15} strokeWidth={1.9} />
                {copy.eyebrow}
              </span>
            ) : null}
            <h2 className="mt-5 max-w-[620px] text-4xl font-semibold leading-[1.04] text-text-primary sm:text-5xl">
              {copy.title}
            </h2>
            <p className="mt-5 max-w-[560px] text-base leading-7 text-text-secondary">{copy.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink
                href={{ pathname: '/ai-video-engines' }}
                linkComponent={Link}
                size="lg"
                data-analytics-event="comparison_card_click"
                data-analytics-cta-name="all_comparisons"
                data-analytics-cta-location="comparison_intro"
                data-analytics-target-family="compare"
              >
                {copy.primaryCta ?? 'Explore all comparisons'}
                <span aria-hidden="true">→</span>
              </ButtonLink>
              <ButtonLink
                href={{ pathname: '/models' }}
                linkComponent={Link}
                variant="outline"
                size="lg"
                data-analytics-event="model_card_click"
                data-analytics-cta-name="all_models"
                data-analytics-cta-location="comparison_intro"
                data-analytics-target-family="models"
              >
                {copy.secondaryCta ?? 'View all models'}
              </ButtonLink>
            </div>
          </div>
          <ComparisonScorecard copy={copy} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {comparisons.map((comparison) => (
            <Link
              key={comparison.id}
              href={comparison.href}
              className="dark-neon-panel group flex h-full flex-col rounded-[20px] border border-hairline bg-surface p-2 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float sm:p-2.5"
              data-analytics-event="comparison_card_click"
              data-analytics-cta-name={comparison.id}
              data-analytics-cta-location="comparison_preview"
              data-analytics-target-family="compare"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[124px_minmax(0,1fr)] sm:items-stretch sm:gap-3 lg:grid-cols-[132px_minmax(0,1fr)]">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-surface-3 sm:h-[124px] sm:aspect-auto lg:h-[132px]">
                  {comparison.media && comparison.media.length >= 2 ? (
                    <div className="absolute inset-0 grid grid-cols-2 gap-px bg-black/20">
                      {comparison.media.slice(0, 2).map((media) => (
                        <div key={`${comparison.id}-${media.imageSrc}`} className="relative min-w-0 overflow-hidden">
                          <Image
                            src={media.imageSrc}
                            alt={media.imageAlt}
                            fill
                            sizes="(max-width: 639px) 25vw, (max-width: 1023px) 110px, 66px"
                            className="object-cover transition duration-500 group-hover:scale-[1.05]"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Image
                      src={comparison.imageSrc ?? COMPARISON_CARD_MEDIA[comparison.id]?.imageSrc ?? '/hero/showcase-seedance-2-0.webp'}
                      alt={comparison.imageAlt ?? COMPARISON_CARD_MEDIA[comparison.id]?.imageAlt ?? `${comparison.title} AI video comparison preview.`}
                      fill
                      sizes="(max-width: 639px) 50vw, (max-width: 1023px) 220px, 132px"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="overflow-hidden text-sm font-semibold leading-[1.18] text-text-primary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:text-[17px]">{comparison.title}</h3>
                    <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-bg text-brand sm:inline-flex">
                      <UIIcon icon={Scale} size={16} strokeWidth={1.9} />
                    </span>
                  </div>
                  <p className="mt-1 overflow-hidden text-xs leading-5 text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-1.5 sm:text-sm">{comparison.body}</p>
                  <div className="mt-2 flex min-w-0 flex-nowrap gap-1 overflow-hidden">
                    {comparison.badges.slice(0, 3).map((badge) => (
                      <span key={badge} className="min-w-0 truncate rounded-pill border border-hairline bg-bg px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-text-primary last:hidden sm:last:inline-block sm:px-2 sm:text-[11px] sm:leading-5">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="dark-neon-panel grid gap-3 rounded-[20px] border border-hairline bg-surface/85 p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature, index) => {
            const icons = [BarChart3, Video, CircleDollarSign, RefreshCcw] as const;
            return (
              <div key={feature.title} className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-hairline bg-bg text-text-primary">
                  <UIIcon icon={icons[index] ?? BarChart3} size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text-primary">{feature.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-text-secondary">{feature.body}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ReferenceWorkflow({ copy, steps }: { copy: SectionCopy; steps: WorkflowStep[] }) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {steps.map((step, index) => (
            <Link
              key={step.title}
              href={step.href}
              prefetch={isWorkspaceHref(step.href) ? false : undefined}
              className="dark-neon-panel group relative flex min-h-[178px] flex-col overflow-hidden rounded-card border border-hairline bg-bg p-3 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:bg-surface-glass-80 dark:hover:bg-surface-glass-70 sm:min-h-[218px] sm:p-5"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={step.toolLabel}
              data-analytics-cta-location="reference_workflow"
              data-analytics-tool-name={step.toolLabel}
              data-analytics-tool-surface="public"
            >
              <Image
                src={REFERENCE_WORKFLOW_VISUALS[index] ?? REFERENCE_WORKFLOW_VISUALS[0]}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 639px) 50vw, (max-width: 1023px) 50vw, 300px"
                className="object-cover transition duration-500 group-hover:scale-[1.04] dark:opacity-[0.28] dark:brightness-[0.72] dark:saturate-[1.18]"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-gradient-to-b from-white/92 via-white/78 to-white/55 dark:bg-[linear-gradient(180deg,rgba(3,7,18,0.96)_0%,rgba(4,8,22,0.93)_52%,rgba(3,7,18,0.88)_100%)]" />
              <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/60 to-transparent dark:from-[rgba(8,16,31,0.76)] dark:via-[rgba(8,16,31,0.24)]" />
              <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-card border border-hairline bg-white/78 text-xs font-semibold text-text-primary shadow-sm backdrop-blur dark:border-white/12 dark:bg-white/[0.08] sm:h-9 sm:w-9 sm:text-sm">
                {index + 1}
              </span>
              <div className="relative z-10 mt-5 flex flex-1 flex-col sm:mt-6">
                <h3 className="min-h-[40px] text-sm font-semibold leading-5 text-text-primary sm:min-h-[48px] sm:text-lg sm:leading-6">{step.title}</h3>
                <p className="mt-1.5 overflow-hidden text-xs leading-5 text-text-secondary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:mt-2 sm:text-sm sm:leading-6 sm:[-webkit-line-clamp:3]">{step.body}</p>
                <p className="mt-auto pt-3 text-xs font-semibold text-text-primary group-hover:text-brand sm:pt-5 sm:text-sm">
                  {step.toolLabel}
                  <span aria-hidden="true" className="ml-2 transition group-hover:translate-x-1">→</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AiVideoToolbox({ copy, tools }: { copy: SectionCopy; tools: ToolCard[] }) {
  return (
    <section className="dark-section-neon relative overflow-hidden border-b border-hairline bg-bg section">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(15,23,42,0.055),transparent_34%),linear-gradient(180deg,transparent,rgba(148,163,184,0.08))] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.030),transparent_38%)]" />
      <div className="container-page relative max-w-[1200px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              prefetch={isWorkspaceHref(tool.href) ? false : undefined}
              className="dark-neon-panel group relative min-h-[158px] overflow-hidden rounded-card border border-hairline bg-surface p-3 pb-11 shadow-card transition hover:-translate-y-0.5 hover:border-text-muted/40 hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:min-h-[188px] sm:p-4 sm:pb-12"
              data-analytics-event="tool_card_click"
              data-analytics-cta-name={tool.id}
              data-analytics-cta-location="toolbox"
              data-analytics-tool-name={tool.id}
              data-analytics-tool-surface="public"
            >
              <Image
                src={TOOLBOX_VISUALS[tool.id] ?? '/hero/showcase-seedance-2-0.webp'}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 767px) 50vw, (max-width: 1199px) 25vw, 280px"
                className="object-cover saturate-[1.06] contrast-[1.06] transition duration-500 group-hover:scale-[1.04]"
                loading="lazy"
              />
              <span className="absolute inset-0 bg-[linear-gradient(112deg,rgba(3,7,18,0.66)_0%,rgba(3,7,18,0.48)_42%,rgba(3,7,18,0.22)_72%,rgba(3,7,18,0.10)_100%)]" />
              <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/58 via-black/18 to-transparent" />
              <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur dark:bg-white/10 sm:h-9 sm:w-9">
                <UIIcon icon={TOOL_ICONS[tool.icon]} size={18} strokeWidth={1.9} />
              </span>
              <h3 className="relative z-10 mt-4 pr-6 text-sm font-semibold leading-5 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.48)] sm:text-base">{tool.title}</h3>
              <p className="relative z-10 mt-1.5 pr-6 text-xs leading-5 text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.42)] sm:hidden">{tool.shortBody ?? tool.body}</p>
              <p className="relative z-10 mt-2 hidden pr-7 text-sm leading-6 text-white/80 drop-shadow-[0_1px_6px_rgba(0,0,0,0.42)] sm:block">{tool.body}</p>
              <span className="absolute bottom-3 right-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white shadow-sm backdrop-blur transition group-hover:translate-x-0.5 group-hover:bg-white/20">
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink
            href="/app"
            prefetch={false}
            linkComponent={Link}
            size="lg"
            data-analytics-event="tool_card_click"
            data-analytics-cta-name="open_workspace"
            data-analytics-cta-location="toolbox_cta"
            data-analytics-target-family="workspace"
          >
            {copy.primaryCta ?? 'Open workspace'}
          </ButtonLink>
          <ButtonLink
            href={{ pathname: '/tools' }}
            linkComponent={Link}
            variant="outline"
            size="lg"
            data-analytics-event="tool_card_click"
            data-analytics-cta-name="browse_tools"
            data-analytics-cta-location="toolbox_cta"
            data-analytics-target-family="tools"
          >
            {copy.secondaryCta ?? 'Browse all tools'}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function TransparentPricingBlock({ copy, cards }: { copy: SectionCopy; cards: TrustCard[] }) {
  const icons = [BadgeDollarSign, CircleDollarSign, RefreshCcw, ClipboardList] as const;
  const footerLinks = [
    { href: { pathname: '/models' } as const, label: copy.modelsLink ?? 'Models' },
    { href: { pathname: '/examples' } as const, label: copy.examplesLink ?? 'Examples' },
    { href: { pathname: '/ai-video-engines' } as const, label: copy.compareLink ?? 'Compare engines' },
  ];

  return (
    <section className="dark-section-neon border-b border-hairline bg-surface section">
      <div className="container-page max-w-[1280px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.86fr)_1px_minmax(0,1.14fr)] lg:items-center lg:gap-12">
          <div className="max-w-[520px]">
            <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl lg:text-5xl lg:leading-[1.08]">
              {copy.title}
            </h2>
            {copy.subtitle ? (
              <p className="mt-5 max-w-[480px] text-base leading-8 text-text-secondary sm:text-lg">{copy.subtitle}</p>
            ) : null}
            <ButtonLink
              href={{ pathname: '/pricing' }}
              linkComponent={Link}
              size="lg"
              className="mt-7"
              data-analytics-event="pricing_cta_click"
              data-analytics-cta-name="view_pricing"
              data-analytics-cta-location="transparent_pricing"
              data-analytics-target-family="pricing"
            >
              {copy.cta ?? 'View pricing'}
            </ButtonLink>
          </div>
          <span aria-hidden="true" className="hidden h-full min-h-[240px] w-px bg-hairline lg:block" />
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:gap-x-12 lg:gap-y-12">
            {cards.map((card, index) => (
              <article key={card.title} className="grid grid-cols-[44px_minmax(0,1fr)] gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-brand/20 bg-brand/10 text-brand shadow-sm">
                  <UIIcon icon={icons[index] ?? CircleDollarSign} size={21} strokeWidth={1.9} />
                </span>
                <span>
                  <h3 className="text-base font-semibold leading-6 text-text-primary sm:text-lg">{card.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary sm:text-[15px]">{card.body}</p>
                </span>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-5 border-t border-hairline pt-5 md:flex-row md:items-center md:justify-between">
          <p className="flex max-w-[720px] items-start gap-3 text-sm leading-7 text-text-secondary">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/10 text-brand">
              <UIIcon icon={BadgeCheck} size={17} strokeWidth={1.9} />
            </span>
            <span>
              {copy.supportingText ??
                'MaxVideoAI is a pay-as-you-go multi-engine AI video generator for Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.'}
            </span>
          </p>
          <nav aria-label="Pricing section links" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold text-brand">
            {footerLinks.map((item, index) => (
              <Link
                key={item.label}
                href={item.href}
                className="inline-flex items-center gap-2 transition hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <span>{item.label}</span>
                <span aria-hidden="true">→</span>
                {index < footerLinks.length - 1 ? <span aria-hidden="true" className="ml-3 h-4 w-px bg-hairline" /> : null}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

type WorkflowBasicsLocale = 'en' | 'fr' | 'es';

const WORKFLOW_BASICS_COPY: Record<
  WorkflowBasicsLocale,
  {
    title: string;
    paragraph: string;
    cards: Array<{ title: string; body: string }>;
  }
> = {
  en: {
    title: 'AI video generator basics',
    paragraph:
      'MaxVideoAI is a pay-as-you-go AI video generator for creating videos from text, images, or existing clips. Compare leading models, preview real examples, and see the cost before you generate.',
    cards: [
      { title: 'Text-to-video', body: 'Generate scenes from prompts.' },
      { title: 'Image-to-video', body: 'Animate a still image.' },
      { title: 'Video-to-video', body: 'Transform existing footage.' },
    ],
  },
  fr: {
    title: 'Bases du générateur de vidéos IA',
    paragraph:
      'MaxVideoAI est un générateur de vidéos IA à l’usage pour créer depuis du texte, des images ou des clips existants. Comparez les modèles, consultez des exemples réels et voyez le coût avant de générer.',
    cards: [
      { title: 'Texte-vers-vidéo', body: 'Générez des scènes depuis des prompts.' },
      { title: 'Image-vers-vidéo', body: 'Animez une image fixe.' },
      { title: 'Vidéo-vers-vidéo', body: 'Transformez une vidéo existante.' },
    ],
  },
  es: {
    title: 'Conceptos básicos del generador de video IA',
    paragraph:
      'MaxVideoAI es un generador de video IA de pago por uso para crear desde texto, imágenes o clips existentes. Compara modelos, revisa ejemplos reales y ve el coste antes de generar.',
    cards: [
      { title: 'Texto a video', body: 'Genera escenas desde prompts.' },
      { title: 'Imagen a video', body: 'Anima una imagen fija.' },
      { title: 'Video a video', body: 'Transforma metraje existente.' },
    ],
  },
};

function resolveWorkflowBasicsLocale(copy: WorkflowSeoSummaryCopy): WorkflowBasicsLocale {
  const text = [copy.heroParagraph, copy.definition?.title, copy.definition?.body, copy.generateWays?.title].filter(Boolean).join(' ').toLowerCase();

  if (text.includes('générateur') || text.includes('générez')) return 'fr';
  if (text.includes('generador') || text.includes('genera videos')) return 'es';
  return 'en';
}

export function WorkflowSeoSummary({ copy }: { copy: WorkflowSeoSummaryCopy }) {
  const workflowItems = copy.generateWays?.items ?? [];
  const hasDefinition = Boolean(copy.definition?.title || copy.definition?.body || copy.heroParagraph);
  const locale = resolveWorkflowBasicsLocale(copy);
  const basicsCopy = WORKFLOW_BASICS_COPY[locale];
  const cardIcons = [
    { icon: Type, className: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-200' },
    { icon: ImageIcon, className: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-200' },
    { icon: Video, className: 'bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-200' },
  ] as const;

  if (!hasDefinition && workflowItems.length === 0) return null;

  return (
    <section className="dark-section-neon border-y border-hairline bg-surface py-6 sm:py-8">
      <div className="container-page max-w-[1280px]">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-8">
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 sm:grid-cols-[52px_minmax(0,1fr)] sm:items-start sm:gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-bg text-text-primary shadow-sm dark:bg-white/[0.04] dark:text-white/88 sm:h-12 sm:w-12">
              <UIIcon icon={Sparkles} size={20} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{basicsCopy.title}</h2>
              <p className="mt-2 max-w-[620px] text-sm leading-6 text-text-secondary">{basicsCopy.paragraph}</p>
            </div>
          </div>
          {workflowItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {workflowItems.slice(0, 3).map((item, index) => {
                const summary = basicsCopy.cards[index] ?? { title: item.title.replace(/\s+AI$/i, ''), body: item.body };
                const iconConfig = cardIcons[index] ?? cardIcons[0];

                return (
                  <article key={item.title} className="min-w-0 rounded-[12px] border border-hairline bg-bg/85 p-2.5 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.45)] dark-neon-panel dark:bg-white/[0.035] sm:rounded-[14px] sm:p-3">
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] sm:h-9 sm:w-9 ${iconConfig.className}`}>
                      <UIIcon icon={iconConfig.icon} size={18} strokeWidth={1.85} />
                    </span>
                    <h3 className="mt-2 break-words text-[11px] font-semibold leading-4 text-text-primary sm:mt-3 sm:text-sm sm:leading-5">{summary.title}</h3>
                    <p className="mt-1 text-[10px] leading-4 text-text-secondary sm:mt-1.5 sm:text-sm sm:leading-5">{summary.body}</p>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function ProviderEngineStrip({ copy, providers }: { copy: SectionCopy; providers: ProviderItem[] }) {
  return (
    <section className="dark-section-neon border-b border-hairline bg-bg section-compact">
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
                className="dark-neon-panel rounded-card border border-hairline bg-surface p-4 shadow-card transition hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {content}
              </Link>
            ) : (
              <div key={`${item.provider}-${item.model}`} className="dark-neon-panel rounded-card border border-hairline bg-surface p-4 shadow-card">
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
    <section className="dark-section-neon bg-bg section">
      <div className="container-page max-w-[900px] stack-gap-lg">
        <SectionHeader title={copy.title} subtitle={copy.subtitle} />
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.question} className="dark-neon-panel group rounded-card border border-hairline bg-surface p-5">
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
