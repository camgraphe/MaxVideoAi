import { listFalEngines } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getHomepageSlotsCached, getSuccessfulGenerationCountCached, type HomepageSlotWithVideo } from '@/server/homepage';
import type { GalleryVideo } from '@/server/videos';
import type { HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';
import type { HomeHeroContent } from '@/components/marketing/home/HomeRedesignSections';
import type { Mode } from '@/types/engines';
import {
  FALLBACK_MODE_BY_ENGINE,
  HERO_ENGINE_TARGETS,
  HERO_VIDEO_CHIPS,
  type HeroEngineId,
} from './constants';
import { formatCurrency, formatStartingPrice, formatVideoTime, resolveModeLabel } from './formatting';
import type { HomepageExampleFamily, RedesignContent } from './types';

const IS_PRODUCTION_BUILD = process.env.NEXT_PHASE === 'phase-production-build';

type HeroEngineLinks = {
  name: string;
  modeLabel: string | null;
  examplesHref?: LocalizedLinkHref;
  modelHref: LocalizedLinkHref;
  examplesLabel?: string;
  modelLabel: string;
  mode?: Mode;
};

export function buildHeroContent(locale: AppLocale, content: RedesignContent): HomeHeroContent {
  const engines = listFalEngines();
  const engineById = new Map(engines.flatMap((entry) => [[entry.id, entry], [entry.modelSlug, entry]]));

  return {
    ...content.hero,
    mockup: {
      ...content.hero.mockup,
      engineRecommendations: content.hero.mockup.engineRecommendations.map((recommendation) => {
        const engine = engineById.get(recommendation.engineId);
        const linkMeta = buildHeroEngineLinks(locale, recommendation.engineId, recommendation.name);
        const modeLabel = linkMeta.mode ? resolveModeLabel(linkMeta.mode, content) : null;
        const pricing = engine?.pricingHint;
        const formattedPrice =
          pricing && pricing.amountCents > 0
            ? formatStartingPrice(locale, pricing.currency, pricing.amountCents, pricing.durationSeconds)
            : recommendation.fallbackPrice;

        return {
          ...recommendation,
          name: linkMeta.name,
          provider: engine?.provider ?? recommendation.provider,
          price: formattedPrice || recommendation.fallbackPrice,
          modeLabel: modeLabel ?? undefined,
          examplesHref: linkMeta.examplesHref,
          modelHref: linkMeta.modelHref,
          examplesLabel: linkMeta.examplesLabel,
          modelLabel: linkMeta.modelLabel,
        };
      }),
    },
  };
}

function heroExampleLabel(locale: AppLocale, name: string, family: HomepageExampleFamily) {
  const familyLabel = family === 'ltx' ? 'LTX' : name;
  if (locale === 'fr') return `Voir les exemples ${familyLabel}`;
  if (locale === 'es') return `Ver ejemplos ${familyLabel}`;
  return `View ${familyLabel} examples`;
}

function heroModelLabel() {
  return 'Specs & pricing';
}

function buildHeroEngineLinks(locale: AppLocale, engineId: string, fallbackName: string): HeroEngineLinks {
  const normalizedEngineId = normalizeEngineId(engineId) ?? engineId;
  const target = HERO_ENGINE_TARGETS[normalizedEngineId as HeroEngineId];
  if (!target) {
    const family = resolveExampleCanonicalSlug(normalizedEngineId) as HomepageExampleFamily | null;
    const modelSlug = normalizedEngineId;
    return {
      name: fallbackName,
      modeLabel: null,
      examplesHref: family ? ({ pathname: '/examples/[model]', params: { model: family } } satisfies LocalizedLinkHref) : undefined,
      modelHref: { pathname: '/models/[slug]', params: { slug: modelSlug } } satisfies LocalizedLinkHref,
      examplesLabel: family ? heroExampleLabel(locale, fallbackName, family) : undefined,
      modelLabel: heroModelLabel(),
    };
  }
  return {
    name: target.name,
    modeLabel: null,
    examplesHref: target.exampleFamily
      ? ({ pathname: '/examples/[model]', params: { model: target.exampleFamily } } satisfies LocalizedLinkHref)
      : undefined,
    modelHref: { pathname: '/models/[slug]', params: { slug: target.modelSlug } } satisfies LocalizedLinkHref,
    examplesLabel: target.exampleFamily ? heroExampleLabel(locale, target.name, target.exampleFamily) : undefined,
    modelLabel: heroModelLabel(),
    mode: target.mode,
  };
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

export async function loadProgrammedHomepageHeroSlots(): Promise<HomepageSlotWithVideo[]> {
  if (IS_PRODUCTION_BUILD) return [];
  try {
    const slots = await getHomepageSlotsCached();
    return slots.hero;
  } catch (error) {
    console.warn('[home] failed to load programmed homepage hero slots', error);
    return [];
  }
}

export async function loadSuccessfulGenerationCount(): Promise<number | null> {
  if (IS_PRODUCTION_BUILD) return null;
  try {
    return await getSuccessfulGenerationCountCached();
  } catch (error) {
    console.warn('[home] failed to load successful generation count', error);
    return null;
  }
}

export function buildProgrammedHeroItems(
  locale: AppLocale,
  content: RedesignContent,
  slots: HomepageSlotWithVideo[]
): HeroVideoShowcaseItem[] {
  const engines = listFalEngines();
  const engineById = new Map(
    engines.flatMap((entry) => {
      const normalizedId = normalizeEngineId(entry.id) ?? entry.id;
      return [
        [entry.id, entry],
        [entry.modelSlug, entry],
        [normalizedId, entry],
      ] as const;
    })
  );

  return slots
    .filter((slot) => Boolean(slot.video?.thumbUrl || slot.video?.videoUrl))
    .map((slot) => {
      const video = slot.video!;
      const normalizedEngineId = normalizeEngineId(video.engineId) ?? video.engineId;
      const engine = engineById.get(video.engineId) ?? engineById.get(normalizedEngineId);
      const linkMeta = buildHeroEngineLinks(locale, normalizedEngineId, video.engineLabel);
      const durationSeconds = video.durationSec || engine?.pricingHint?.durationSeconds || null;
      const duration = formatVideoTime(durationSeconds);
      const resolution = video.aspectRatio ?? '1080p';
      const mode = resolveModeLabel(linkMeta.mode ?? extractMode(video), content);
      const recommended = content.hero.mockup.engineRecommendations.find((recommendation) => recommendation.engineId === normalizedEngineId);
      const durationLabel = typeof video.durationSec === 'number' ? `${video.durationSec}s` : `${Number(duration.replace(/^0:/, ''))}s`;
      const mediaInfo = [mode, durationLabel, video.aspectRatio ?? null].filter(Boolean).join(' · ');
      const chips = HERO_VIDEO_CHIPS[normalizedEngineId] ?? (recommended?.bestFor ? [recommended.bestFor] : [mode]);
      const startingPrice =
        (engine?.pricingHint
          ? formatStartingPrice(locale, engine.pricingHint.currency, engine.pricingHint.amountCents, engine.pricingHint.durationSeconds)
          : null) ??
        formatStartingPrice(locale, video.currency, video.finalPriceCents, video.durationSec) ??
        content.hero.mockup.engineRecommendations.find((recommendation) => recommendation.engineId === normalizedEngineId)?.fallbackPrice ??
        content.hero.mockup.quoteValue;
      const finalQuote = formatCurrency(locale, video.currency, video.finalPriceCents);

      return {
        id: `programmed-${slot.key}-${video.id}`,
        engineId: normalizedEngineId,
        name: linkMeta.name,
        provider: engine?.provider ?? video.engineLabel,
        bestFor: chips[0] ?? mode,
        chips,
        mediaInfo,
        price: startingPrice,
        estimateLabel: content.hero.mockup.quoteLabel,
        estimateValue: finalQuote ?? startingPrice,
        estimateMeta: typeof video.durationSec === 'number' ? `${video.durationSec}s generation` : `${duration} generation`,
        examplesHref: linkMeta.examplesHref,
        modelHref: linkMeta.modelHref,
        examplesLabel: linkMeta.examplesLabel,
        modelLabel: linkMeta.modelLabel,
        posterSrc: video.thumbUrl ?? '/assets/placeholders/preview-16x9.png',
        videoSrc: video.videoUrl ?? null,
        duration,
        resolution,
        imageAlt: `${video.engineLabel} AI video programmed for the MaxVideoAI homepage.`,
      };
    });
}
