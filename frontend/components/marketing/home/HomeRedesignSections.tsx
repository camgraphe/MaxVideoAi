import Image from 'next/image';
import {
  BadgeDollarSign,
  Clock,
  CircleDollarSign,
  ImageIcon,
  Layers3,
  RefreshCcw,
  Sparkles,
  Type,
  Video,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { UIIcon } from '@/components/ui/UIIcon';
import { HeroVideoShowcase, type HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';
import {
  BEST_FOR_CARD_VISUALS,
  HERO_ENGINE_MEDIA,
  HERO_VIDEO_CHIPS,
  HERO_VIDEO_MODE_LABELS,
  HERO_VIDEO_ORDER,
  HOME_HERO_IMAGE_URL,
  KLING_3_PRO_HERO_RENDER,
  PROOF_ICONS,
} from '@/components/marketing/home/home-redesign-visuals';
import type {
  HomeExampleCard,
  HomeHeroContent,
  ProofStat,
  ProviderItem,
  SectionCopy,
  ShotTypeCard,
} from '@/components/marketing/home/home-redesign-types';

export { WorkflowSeoSummary } from '@/components/marketing/home/HomeWorkflowSeoSummary';

export type {
  ComparisonCard,
  FaqItem,
  HomeCta,
  HomeExampleCard,
  HomeHeroContent,
  ProofStat,
  ProviderItem,
  ShotTypeCard,
  ToolCard,
  TrustCard,
  WorkflowSeoSummaryCopy,
  WorkflowStep,
} from '@/components/marketing/home/home-redesign-types';

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

export {
  AiVideoToolbox,
  ComparisonPreview,
  HomeFaq,
  ProviderEngineStrip,
  ReferenceWorkflow,
  TransparentPricingBlock,
} from '@/components/marketing/home/HomeConversionSections';
