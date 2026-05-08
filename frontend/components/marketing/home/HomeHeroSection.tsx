import Image from 'next/image';
import { BadgeDollarSign, CircleDollarSign, RefreshCcw, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { UIIcon } from '@/components/ui/UIIcon';
import { HeroVideoShowcase, type HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';
import {
  HERO_ENGINE_MEDIA,
  HERO_VIDEO_CHIPS,
  HERO_VIDEO_MODE_LABELS,
  HERO_VIDEO_ORDER,
  HOME_HERO_IMAGE_URL,
  KLING_3_PRO_HERO_RENDER,
  PROOF_ICONS,
} from '@/components/marketing/home/home-redesign-visuals';
import type { HomeExampleCard, HomeHeroContent, ProofStat } from '@/components/marketing/home/home-redesign-types';

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
  const proofGridColumnsClass = proofStats.length >= 8 ? 'xl:grid-cols-8' : 'xl:grid-cols-7';

  return (
    <section className="home-hero-section dark-section-neon relative overflow-hidden border-b border-hairline bg-bg">
      <Image
        src={HOME_HERO_IMAGE_URL}
        alt=""
        aria-hidden="true"
        fill
        fetchPriority="low"
        sizes="100vw"
        className="pointer-events-none hidden object-cover object-center opacity-65 dark:brightness-[0.58] dark:contrast-110 dark:invert dark:opacity-[0.34] md:block"
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
          <HeroVideoShowcase items={videoItems} playLabel={copy.mockup.playLabel} pauseLabel={copy.mockup.pauseLabel} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3 min-[900px]:col-start-1 min-[900px]:row-start-3">
          {copy.valueCards.map((card) => (
            <div
              key={card.title}
              className="dark-neon-panel min-h-[86px] rounded-[14px] border border-black/[0.07] bg-white/68 p-3 text-left backdrop-blur transition hover:border-black/[0.12] hover:bg-white/82 dark:border-white/[0.10] dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.78),rgba(30,41,59,0.32))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_50px_-34px_rgba(0,0,0,0.9)] dark:hover:border-white/[0.16] dark:hover:bg-[linear-gradient(135deg,rgba(20,31,50,0.86),rgba(37,52,78,0.36))] sm:min-h-[112px] sm:rounded-[18px] sm:p-4"
            >
              <span className="block text-[13px] font-semibold leading-4 text-text-primary sm:text-[15px] sm:leading-5">{card.title}</span>
              <span className="mt-1.5 block max-w-[18rem] text-[11px] leading-4 text-text-secondary line-clamp-2 sm:mt-2 sm:text-xs sm:leading-5">{card.body}</span>
            </div>
          ))}
        </div>
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
