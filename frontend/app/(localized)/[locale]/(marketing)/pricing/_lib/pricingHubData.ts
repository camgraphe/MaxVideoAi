import type { AppLocale } from '@/i18n/locales';
import { localePathnames } from '@/i18n/locales';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { listUpscaleToolEngines } from '@/config/tools-upscale-engines';
import type { EngineCaps, EnginePricingDetails, Resolution } from '@/types/engines';
import { CHARACTER_FORMAT_OPTIONS } from '@/lib/character-builder';
import { buildAudioPricingSnapshot, type AudioPackId, type AudioVoiceMode } from '@/lib/audio-generation';
import { resolveGptImage2PricingTier, type GptImage2Quality } from '@/lib/image/gptImage2';
import { getLumaRay2DurationInfo, getLumaRay2ResolutionInfo, isLumaRay2EngineId } from '@/lib/luma-ray2';
import { calculateLumaRay2Price } from '@/lib/luma-ray2-pricing';
import { supportsImageGeneration, supportsVideoGeneration } from '@/lib/models/catalog';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import { getLumaRay2BasePriceEnv } from '@/lib/pricing-specialized-snapshots';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { buildSlugMap, type LocalizedSlugKey } from '@/lib/i18nSlugs';
import { formatCurrencyForLocale } from './pricingPageContent';
import { getPricingHubCopy } from './pricingHubCopy';

const FALLBACK_CURRENCY = 'USD';

const PRICING_DISPLAY_MODEL_ORDER = [
  'seedance-2-0',
  'seedance-2-0-fast',
  'kling-3-pro',
  'kling-3-4k',
  'kling-3-standard',
  'veo-3-1',
  'veo-3-1-lite',
  'veo-3-1-fast',
  'happy-horse-1-0',
  'ltx-2-3-fast',
  'ltx-2-3-pro',
  'wan-2-6',
  'minimax-hailuo-02-text',
  'luma-ray-2',
  'luma-ray-2-flash',
] as const;

const PRICING_DISPLAY_FAMILY_ORDER = ['seedance', 'kling', 'veo', 'happy-horse', 'ltx', 'wan', 'hailuo', 'luma'] as const;
const PRICING_DISPLAY_MODEL_RANK = new Map<string, number>(
  PRICING_DISPLAY_MODEL_ORDER.map((slug, index) => [slug, index] as const)
);
const PRICING_DISPLAY_FAMILY_RANK = new Map<string, number>(
  PRICING_DISPLAY_FAMILY_ORDER.map((family, index) => [family, index] as const)
);
const LOCALIZED_BASE_SLUGS: Record<
  Extract<LocalizedSlugKey, 'models' | 'gallery' | 'compare' | 'pricing'>,
  Record<AppLocale, string>
> = {
  models: buildSlugMap('models'),
  gallery: buildSlugMap('gallery'),
  compare: buildSlugMap('compare'),
  pricing: buildSlugMap('pricing'),
};

export type VideoPriceScenario = {
  id: string;
  label: string;
  subLabel: string;
  resolution: Resolution;
  durationSec: number | null;
  audio: boolean;
};

export type ImagePriceScenario = {
  id: string;
  resolution: string;
  quality?: GptImage2Quality;
  quantity?: number;
};

export const VIDEO_PRICE_PRESETS = [
  { id: '5s-720p', label: '5s 720p', subLabel: 'Draft', resolution: '720p', durationSec: 5, audio: false },
  { id: '8s-1080p', label: '8s 1080p', subLabel: 'Premium', resolution: '1080p', durationSec: 8, audio: false },
  { id: '10s-1080p', label: '10s 1080p', subLabel: 'Standard', resolution: '1080p', durationSec: 10, audio: false },
  {
    id: '10s-1080p-audio',
    label: '10s + audio',
    subLabel: 'Narrative',
    resolution: '1080p',
    durationSec: 10,
    audio: true,
  },
  { id: '4k-route', label: '4K output', subLabel: 'Native / route', resolution: '4k', durationSec: null, audio: false },
] as const satisfies readonly VideoPriceScenario[];

export type VideoPricePreset = (typeof VIDEO_PRICE_PRESETS)[number];
export type VideoPricePresetId = VideoPricePreset['id'];

export const DEFAULT_VIDEO_PRICE_PRESET_ID: VideoPricePresetId = '10s-1080p';

const PRICING_HIGHLIGHT_EXCLUDED_ENGINE_IDS = new Set(['seedance-1-5-pro']);
const PREVIOUS_GENERATION_PRICING_ENGINE_IDS = new Set([
  'seedance-1-5-pro',
  'ltx-2',
  'ltx-2-fast',
  'kling-2-5-turbo',
  'kling-2-6-pro',
  'pika-text-to-video',
  'wan-2-5',
]);

export type PricingHubLink = {
  href: string;
  label: string;
};

export type PresetQuote = {
  status: 'exact' | 'unsupported' | 'closest' | 'live_quote';
  amountCents?: number;
  display?: string;
  note?: string;
  rateDisplay?: string;
  closest?: {
    label: string;
    amountCents: number;
    display: string;
  };
  sortValue?: number;
  isCheapest?: boolean;
};

export type VideoPricingRow = {
  id: string;
  anchorId: string;
  family: string;
  engineIcon: {
    id: string;
    label: string;
    brandId?: string;
  };
  engineName: string;
  variant: string | null;
  pricingGroup: 'recommended' | 'legacy';
  highlightEligible: boolean;
  notes: string[];
  links: PricingHubLink[];
  limitsLabel: string;
  quotes: Record<VideoPricePresetId, PresetQuote>;
  sortValue: number;
};

export type VideoPricingHighlight = {
  label: string;
  value: string;
  href?: string;
};

export type VideoPricingMatrixData = {
  presets: readonly VideoPricePreset[];
  rows: VideoPricingRow[];
  highlights: VideoPricingHighlight[];
};

export type PopularPriceCheckRow = {
  id: string;
  priceCheck: string;
  engine: string;
  price: string;
  link: PricingHubLink;
};

export type ImagePricingRow = {
  id: string;
  anchorId: string;
  engine: string;
  standardImage: string;
  highQualityImage: string;
  reference: string;
  sizes: string;
  links: PricingHubLink[];
};

export type AudioPricingRow = {
  id: string;
  anchorId: string;
  mode: string;
  thirtySeconds: string;
  sixtySeconds: string;
  oneTwentySeconds: string;
  voiceClone: string;
  links: PricingHubLink[];
};

export type ToolPricingRow = {
  id: string;
  anchorId: string;
  tool: string;
  standardOutput: string;
  proOutput: string;
  bestUsedBefore: string;
  links: PricingHubLink[];
};

export type OtherSurfacePricingData = {
  imageRows: ImagePricingRow[];
  audioRows: AudioPricingRow[];
  toolRows: ToolPricingRow[];
};

export type PricingHubData = {
  video: VideoPricingMatrixData;
  popularChecks: PopularPriceCheckRow[];
  otherSurfaces: OtherSurfacePricingData;
};

type AudioRateMode = 'default' | 'audio_off';

function formatPrice(locale: AppLocale, cents: number | null | undefined, currency = FALLBACK_CURRENCY) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return getPricingHubCopy(locale).liveQuote;
  return formatCurrencyForLocale(locale, currency, cents / 100);
}

function formatRateDisplay(locale: AppLocale, cents: number | null | undefined, currency = FALLBACK_CURRENCY) {
  const price = formatPrice(locale, cents, currency);
  const copy = getPricingHubCopy(locale);
  return price === copy.liveQuote ? price : copy.quote.perSecond(price);
}

function formatCompactSeconds(locale: AppLocale, seconds: number) {
  return locale === 'en' ? `${seconds}s` : `${seconds} s`;
}

function anchorFromSlug(slug: string) {
  return `${slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}-pricing`;
}

function isPublicMarketingEntry(entry: FalEngineEntry) {
  if (entry.availability !== 'available') return false;
  const surfaces = entry.surfaces;
  return Boolean(
    surfaces.pricing.includeInEstimator ||
      surfaces.modelPage.indexable ||
      surfaces.compare.includeInHub ||
      surfaces.app.enabled
  );
}

function collectFields(engine: EngineCaps) {
  return [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
}

function findField(engine: EngineCaps, id: string) {
  return collectFields(engine).find((field) => field.id === id);
}

function parseDurationValue(value: number | string | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function collectDurationOptions(entry: FalEngineEntry) {
  const durations = new Set<number>();
  entry.modes.forEach((mode) => {
    const duration = mode.ui.duration;
    if (duration && 'options' in duration) {
      duration.options.forEach((option) => {
        const parsed = parseDurationValue(option);
        if (parsed != null) durations.add(parsed);
      });
    }
  });
  const durationField = findField(entry.engine, 'duration');
  durationField?.values?.forEach((value) => {
    const parsed = parseDurationValue(value);
    if (parsed != null) durations.add(parsed);
  });
  return [...durations].sort((a, b) => a - b);
}

function getEngineMaxDurationSec(entry: FalEngineEntry) {
  return entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec;
}

function resolveDurationSupport(entry: FalEngineEntry, requestedDurationSec: number | null, locale: AppLocale) {
  const copy = getPricingHubCopy(locale);
  if (requestedDurationSec == null) return { supported: true, durationSec: null, note: null as string | null };
  const options = collectDurationOptions(entry);
  if (options.length) {
    if (options.includes(requestedDurationSec)) {
      return { supported: true, durationSec: requestedDurationSec, note: null as string | null };
    }
    const maxOption = Math.max(...options);
    const minOption = Math.min(...options);
    const closest = options.reduce((best, option) =>
      Math.abs(option - requestedDurationSec) < Math.abs(best - requestedDurationSec) ? option : best
    );
    if (maxOption < requestedDurationSec) {
      return { supported: false, durationSec: closest, note: copy.quote.maxDuration(maxOption) };
    }
    if (minOption > requestedDurationSec) {
      return { supported: false, durationSec: closest, note: copy.quote.minDuration(minOption) };
    }
    return { supported: false, durationSec: closest, note: copy.quote.durationsOnly(options.slice(0, 3)) };
  }
  const maxDurationSec = getEngineMaxDurationSec(entry);
  if (requestedDurationSec <= maxDurationSec) {
    return { supported: true, durationSec: requestedDurationSec, note: null as string | null };
  }
  return { supported: false, durationSec: maxDurationSec, note: copy.quote.maxDuration(maxDurationSec) };
}

function chooseFourKDuration(entry: FalEngineEntry) {
  const options = collectDurationOptions(entry);
  const preferred = [10, 8, 5];
  const exactPreferred = preferred.find((duration) => options.includes(duration));
  if (exactPreferred != null) return exactPreferred;
  if (options.length) {
    return options.find((duration) => duration >= 5) ?? options[0] ?? null;
  }
  const maxDurationSec = getEngineMaxDurationSec(entry);
  if (maxDurationSec >= 10) return 10;
  if (maxDurationSec >= 8) return 8;
  if (maxDurationSec >= 5) return 5;
  return maxDurationSec > 0 ? maxDurationSec : null;
}

function resolveResolutionSupport(engine: EngineCaps, requestedResolution: string, locale: AppLocale) {
  const copy = getPricingHubCopy(locale);
  const normalizedRequested = requestedResolution.toLowerCase();
  const resolutions = engine.resolutions.map(String);
  const exactResolution = resolutions.find((resolution) => resolution.toLowerCase() === normalizedRequested);
  if (exactResolution) {
    return { supported: true, resolution: exactResolution, note: null as string | null };
  }
  const preferredClosest =
    normalizedRequested === '720p'
      ? resolutions.find((resolution) => resolution.toLowerCase() === '1080p') ??
        resolutions.find((resolution) => resolution.toLowerCase() === '768p')
      : normalizedRequested === '4k'
        ? resolutions.find((resolution) => resolution.toLowerCase() === '1440p') ??
          resolutions.find((resolution) => resolution.toLowerCase() === '1080p')
        : resolutions.find((resolution) => resolution.toLowerCase() === '720p') ??
          resolutions.find((resolution) => resolution.toLowerCase() === '768p');
  const closest = preferredClosest ?? resolutions[0] ?? requestedResolution;
  const note =
    resolutions.length === 1
      ? copy.quote.resolutionOnly(formatResolutionLabel(closest))
      : copy.quote.resolutionUnavailable(formatResolutionLabel(requestedResolution));
  return { supported: false, resolution: closest, note };
}

function formatResolutionLabel(resolution: string) {
  return resolution.toLowerCase() === '4k' ? '4K' : resolution;
}

function readResolutionRate(pricingDetails: EnginePricingDetails | undefined, resolution?: string) {
  const perSecond = pricingDetails?.perSecondCents;
  if (!perSecond) return null;
  const byResolution = perSecond.byResolution;
  const exactRate = resolution && byResolution ? byResolution[resolution] : undefined;
  const fallbackRate = perSecond.default ?? (byResolution ? Math.min(...Object.values(byResolution)) : undefined);
  return typeof exactRate === 'number' ? exactRate : typeof fallbackRate === 'number' ? fallbackRate : null;
}

function readAudioDelta(pricingDetails: EnginePricingDetails | undefined, resolution: string, audioMode: AudioRateMode) {
  if (audioMode !== 'audio_off') return 0;
  const audioOff = pricingDetails?.addons?.audio_off;
  if (!audioOff) return 0;
  return audioOff.perSecondCentsByResolution?.[resolution] ?? audioOff.perSecondCents ?? 0;
}

function readPerSecondRateCents(engine: EngineCaps, resolution: string, audioMode: AudioRateMode = 'default') {
  const pricingDetails = engine.pricingDetails;
  if (pricingDetails && isSeedance2TokenPricing(pricingDetails)) {
    const quote = computeSeedance2TokenQuote({
      details: pricingDetails,
      durationSec: 1,
      resolution: resolution as Resolution,
      aspectRatio: pricingDetails.tokenPricing.defaultAspectRatio,
    });
    return quote.vendorCostPerSecondUsd * 100;
  }

  const detailsRate = readResolutionRate(pricingDetails, resolution);
  const fallbackRate =
    engine.pricing?.byResolution?.[resolution] != null
      ? engine.pricing.byResolution[resolution] * 100
      : typeof engine.pricing?.base === 'number'
        ? engine.pricing.base * 100
        : null;
  const baseRate = detailsRate ?? fallbackRate;
  if (typeof baseRate !== 'number' || !Number.isFinite(baseRate) || baseRate <= 0) return null;
  return Math.max(0, baseRate + readAudioDelta(pricingDetails, resolution, audioMode));
}

function readScenarioVendorCents(
  engine: EngineCaps,
  resolution: string,
  durationSec: number,
  audioMode: AudioRateMode = 'default'
) {
  const pricingDetails = engine.pricingDetails;
  if (pricingDetails && isSeedance2TokenPricing(pricingDetails)) {
    try {
      const quote = computeSeedance2TokenQuote({
        details: pricingDetails,
        durationSec,
        resolution: resolution as Resolution,
        aspectRatio: pricingDetails.tokenPricing.defaultAspectRatio,
      });
      return quote.vendorCostUsd * 100;
    } catch {
      return null;
    }
  }

  const perSecondRate = readPerSecondRateCents(engine, resolution, audioMode);
  return perSecondRate == null ? null : perSecondRate * durationSec;
}

function displayedScenarioCents(
  engine: EngineCaps,
  resolution: string,
  durationSec: number,
  audioMode: AudioRateMode = 'default'
) {
  const vendorCents = readScenarioVendorCents(engine, resolution, durationSec, audioMode);
  return vendorCents == null ? null : applyDisplayedPriceMarginCents(vendorCents);
}

function displayedLumaRay2ScenarioCents(engine: EngineCaps, resolution: string, durationSec: number) {
  if (!isLumaRay2EngineId(engine.id)) return null;

  const baseUsd = Number(getLumaRay2BasePriceEnv(engine.id));
  const durationInfo = getLumaRay2DurationInfo(durationSec);
  const resolutionInfo = getLumaRay2ResolutionInfo(resolution);

  if (!Number.isFinite(baseUsd) || baseUsd <= 0 || !durationInfo || !resolutionInfo) {
    return null;
  }

  const quote = calculateLumaRay2Price({
    engineId: engine.id === 'lumaRay2_flash' ? 'luma-ray2-flash' : 'luma-ray2',
    baseUsd,
    duration: durationInfo.label,
    resolution: resolutionInfo.value,
  });

  return applyDisplayedPriceMarginCents(quote.totalUsd * 100);
}

function supportsAudioOff(engine: EngineCaps) {
  return Boolean(engine.pricingDetails?.addons?.audio_off);
}

function resolvePresetDuration(entry: FalEngineEntry, preset: VideoPriceScenario) {
  if (preset.id === '4k-route') return chooseFourKDuration(entry);
  return preset.durationSec;
}

export function getPresetQuote(entry: FalEngineEntry, preset: VideoPriceScenario, locale: AppLocale): PresetQuote {
  const copy = getPricingHubCopy(locale);
  const engine = entry.engine;
  const resolution = resolveResolutionSupport(engine, preset.resolution, locale);
  const currency = engine.pricingDetails?.currency ?? engine.pricing?.currency ?? FALLBACK_CURRENCY;
  const audioMode: AudioRateMode = preset.audio ? 'default' : supportsAudioOff(engine) ? 'audio_off' : 'default';
  const canExactAudio = preset.audio ? engine.audio : true;
  const requestedDurationSec = resolvePresetDuration(entry, preset);
  const duration = resolveDurationSupport(entry, requestedDurationSec, locale);
  const exact = resolution.supported && duration.supported && canExactAudio && requestedDurationSec != null;

  const exactCents =
    exact && duration.durationSec != null
      ? displayedLumaRay2ScenarioCents(engine, resolution.resolution, duration.durationSec) ??
        displayedScenarioCents(engine, resolution.resolution, duration.durationSec, audioMode)
      : null;
  if (exact) {
    if (exactCents == null || duration.durationSec == null) {
      return {
        status: 'live_quote',
        display: copy.liveQuote,
        note:
          preset.id === '4k-route' && duration.durationSec != null
            ? copy.quote.fourKNote(duration.durationSec)
            : undefined,
        sortValue: Number.POSITIVE_INFINITY,
      };
    }
    const rateCents = duration.durationSec > 0 ? exactCents / duration.durationSec : null;
    return {
      status: 'exact',
      amountCents: exactCents ?? undefined,
      display: formatPrice(locale, exactCents, currency),
      note:
        preset.id === '4k-route'
          ? copy.quote.fourKNote(duration.durationSec)
          : !preset.audio && engine.audio && !supportsAudioOff(engine)
            ? copy.quote.audioIncluded
            : undefined,
      rateDisplay: formatRateDisplay(locale, rateCents, currency),
      sortValue: exactCents ?? Number.POSITIVE_INFINITY,
    };
  }

  const note = !canExactAudio
    ? copy.quote.audioUnavailable
    : !duration.supported
      ? duration.note
      : resolution.note ?? copy.quote.unsupported;
  return {
    status: 'unsupported',
    display: '—',
    note: note ?? undefined,
    sortValue: Number.POSITIVE_INFINITY,
  };
}

function buildLocalizedMarketingHref(locale: AppLocale, key: keyof typeof LOCALIZED_BASE_SLUGS, slug?: string) {
  const prefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const segment = LOCALIZED_BASE_SLUGS[key][locale] ?? LOCALIZED_BASE_SLUGS[key].en;
  return `${prefix}/${segment}${slug ? `/${slug}` : ''}`.replace(/\/{2,}/g, '/');
}

function buildPricingAnchorHref(locale: AppLocale, anchorId: string) {
  return `${buildLocalizedMarketingHref(locale, 'pricing')}#${anchorId}`;
}

function buildVideoLinks(entry: FalEngineEntry, locale: AppLocale): PricingHubLink[] {
  const copy = getPricingHubCopy(locale);
  const links: PricingHubLink[] = [];
  if (entry.surfaces.modelPage.indexable) {
    links.push({ label: copy.links.model, href: buildLocalizedMarketingHref(locale, 'models', entry.modelSlug) });
  }
  if (entry.surfaces.examples.includeInFamilyResolver && entry.family) {
    links.push({ label: copy.links.examples, href: buildLocalizedMarketingHref(locale, 'gallery', entry.family) });
  }
  const compareSlug = entry.surfaces.compare.suggestOpponents?.[0] ?? entry.surfaces.compare.publishedPairs?.[0];
  if (entry.surfaces.compare.includeInHub && compareSlug) {
    links.push({
      label: copy.links.compare,
      href: buildLocalizedMarketingHref(locale, 'compare', `${entry.modelSlug}-vs-${compareSlug}`),
    });
  }
  links.push({ label: copy.links.livePrice, href: `/app?engine=${encodeURIComponent(entry.modelSlug)}` });
  return links;
}

function buildVideoNotes(entry: FalEngineEntry, locale: AppLocale) {
  const copy = getPricingHubCopy(locale);
  const engine = entry.engine;
  const notes = new Set<string>();
  if (engine.audio) notes.add(supportsAudioOff(engine) ? copy.quote.audioOptional : copy.quote.audioIncluded);
  else notes.add(copy.quote.silent);
  if (engine.resolutions.length === 1 && engine.resolutions[0].toLowerCase() === '4k') notes.add('4K');
  if (engine.modes.includes('t2v')) notes.add('T2V');
  if (engine.modes.includes('i2v') || engine.modes.includes('ref2v')) notes.add('I2V');
  if (engine.latencyTier === 'fast') notes.add(copy.quote.fast);
  return [...notes].slice(0, 5);
}

function formatDurationCap(entry: FalEngineEntry, locale: AppLocale) {
  const options = collectDurationOptions(entry);
  const seconds = options.length ? Math.max(...options) : getEngineMaxDurationSec(entry);
  return formatCompactSeconds(locale, seconds);
}

function getMaxResolutionLabel(resolutions: string[]) {
  const normalized = resolutions.map((resolution) => resolution.toLowerCase());
  const priority = ['4k', '1440p', '1080p', '768p', '720p', '512p', '480p'];
  const match = priority.find((resolution) => normalized.includes(resolution));
  if (match) return match === '4k' ? '4K' : match;
  const fallback = resolutions[resolutions.length - 1] ?? '';
  return fallback.toLowerCase() === '4k' ? '4K' : fallback;
}

function buildCapsLabel(entry: FalEngineEntry, locale: AppLocale) {
  const copy = getPricingHubCopy(locale);
  const engine = entry.engine;
  const resolutions = engine.resolutions.map(String);
  const onlyFourK = resolutions.length === 1 && resolutions[0].toLowerCase() === '4k';
  const modes = [
    engine.modes.includes('t2v') ? 'T2V' : null,
    engine.modes.includes('i2v') || engine.modes.includes('ref2v') ? 'I2V' : null,
  ].filter(Boolean);
  const tokens = [
    formatDurationCap(entry, locale),
    getMaxResolutionLabel(resolutions),
    onlyFourK ? copy.quote.dedicated : engine.audio ? (supportsAudioOff(engine) ? copy.quote.audioOptional : copy.quote.audio) : copy.quote.silent,
    modes.length ? modes.join('/') : null,
    engine.latencyTier === 'fast' ? copy.quote.fast : null,
  ].filter((token): token is string => Boolean(token));
  return tokens.slice(0, 5).join(' · ');
}

function getEntryPricingIdentity(entry: FalEngineEntry) {
  return entry.modelSlug || entry.id || entry.engine.id;
}

function isLegacyPricingEngine(entry: FalEngineEntry) {
  const identity = getEntryPricingIdentity(entry);
  return Boolean(entry.isLegacy) || PREVIOUS_GENERATION_PRICING_ENGINE_IDS.has(identity);
}

function isPricingHighlightEligible(entry: FalEngineEntry) {
  const identity = getEntryPricingIdentity(entry);
  return !isLegacyPricingEngine(entry) && !PRICING_HIGHLIGHT_EXCLUDED_ENGINE_IDS.has(identity);
}

function formatPricingEngineName(entry: FalEngineEntry) {
  return (entry.marketingName || entry.engine.label)
    .replace(/^MiniMax\s+(?=Hailuo\b)/i, '')
    .replace(/\s+Text\s*&\s*Image\s+to\s+Video$/i, '');
}

function getPricingDisplayRank(entry: FalEngineEntry) {
  const modelRank = PRICING_DISPLAY_MODEL_RANK.get(entry.modelSlug);
  if (modelRank != null) return modelRank;
  const familyRank = PRICING_DISPLAY_FAMILY_RANK.get(entry.family ?? entry.provider);
  if (familyRank != null) return PRICING_DISPLAY_MODEL_ORDER.length + familyRank * 100;
  return 9_000;
}

function markCheapestQuotes(rows: VideoPricingRow[]) {
  VIDEO_PRICE_PRESETS.forEach((preset) => {
    const exactQuotes = rows
      .map((row) => ({ row, quote: row.quotes[preset.id] }))
      .filter(
        (item) =>
          item.row.highlightEligible && item.quote.status === 'exact' && typeof item.quote.amountCents === 'number'
      );
    const cheapest = exactQuotes.reduce(
      (best, item) => (!best || item.quote.amountCents! < best.quote.amountCents! ? item : best),
      null as { row: VideoPricingRow; quote: PresetQuote } | null
    );
    if (cheapest) {
      cheapest.quote.isCheapest = true;
    }
  });
  return rows;
}

function buildVideoPricingRows(locale: AppLocale) {
  const rows = listFalEngines()
    .filter((entry) => supportsVideoGeneration(entry) && isPublicMarketingEntry(entry))
    .map((entry): VideoPricingRow => {
      const quotes = Object.fromEntries(
        VIDEO_PRICE_PRESETS.map((preset) => [preset.id, getPresetQuote(entry, preset, locale)])
      ) as Record<VideoPricePresetId, PresetQuote>;
      const defaultQuote = quotes[DEFAULT_VIDEO_PRICE_PRESET_ID];
      const exactRank =
        defaultQuote.status === 'exact'
          ? 0
          : defaultQuote.status === 'closest'
            ? 1
            : defaultQuote.status === 'live_quote'
              ? 2
              : 3;
      const pricedRank = typeof defaultQuote.amountCents === 'number' ? defaultQuote.amountCents : 99_999;
      const pricingGroup = isLegacyPricingEngine(entry) ? 'legacy' : 'recommended';
      const highlightEligible = isPricingHighlightEligible(entry);
      const displayRank = getPricingDisplayRank(entry);
      return {
        id: entry.id ?? entry.engine.id ?? entry.modelSlug,
        anchorId: anchorFromSlug(entry.modelSlug),
        family: entry.family ?? entry.provider,
        engineName: formatPricingEngineName(entry),
        engineIcon: {
          id: entry.engine.id || entry.id,
          label: formatPricingEngineName(entry),
          brandId: entry.brandId ?? entry.engine.brandId ?? undefined,
        },
        variant: entry.versionLabel ?? entry.engine.variant ?? null,
        pricingGroup,
        highlightEligible,
        limitsLabel: buildCapsLabel(entry, locale),
        notes: buildVideoNotes(entry, locale),
        links: buildVideoLinks(entry, locale),
        quotes,
        sortValue:
          (pricingGroup === 'legacy' ? 1 : 0) * 1_000_000_000 +
          exactRank * 1_000_000 +
          pricedRank * 100 +
          displayRank,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue || a.engineName.localeCompare(b.engineName));

  return markCheapestQuotes(rows);
}

function cheapestExactRow(rows: VideoPricingRow[], presetId: VideoPricePresetId) {
  return rows.reduce(
    (best, row) => {
      const quote = row.quotes[presetId];
      if (quote.status !== 'exact' || typeof quote.amountCents !== 'number') return best;
      if (!best || quote.amountCents < best.quote.amountCents!) return { row, quote };
      return best;
    },
    null as { row: VideoPricingRow; quote: PresetQuote } | null
  );
}

function buildVideoHighlights(rows: VideoPricingRow[], locale: AppLocale): VideoPricingHighlight[] {
  const copy = getPricingHubCopy(locale);
  const eligibleRows = rows.filter((row) => row.highlightEligible);
  const bestDraft = cheapestExactRow(eligibleRows, '5s-720p');
  const cheapest8s = cheapestExactRow(eligibleRows, '8s-1080p');
  const cheapest10s = cheapestExactRow(eligibleRows, '10s-1080p');
  const cheapestAudio = cheapestExactRow(eligibleRows, '10s-1080p-audio');
  const cheapest4k = cheapestExactRow(eligibleRows, '4k-route');
  const dedicated4k = cheapestExactRow(
    eligibleRows.filter((row) => row.limitsLabel.toLowerCase().includes(copy.quote.dedicated.toLowerCase()) || row.engineName.toLowerCase().includes('4k')),
    '4k-route'
  );
  const currentGenCount = eligibleRows.length;
  return [
    {
      label: copy.video.highlights.bestDraft,
      value: bestDraft ? `${bestDraft.row.engineName} · ${bestDraft.quote.display}` : copy.liveQuote,
      href: bestDraft ? `#${bestDraft.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.cheapest8s,
      value: cheapest8s ? `${cheapest8s.row.engineName} · ${cheapest8s.quote.display}` : copy.liveQuote,
      href: cheapest8s ? `#${cheapest8s.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.cheapest10s,
      value: cheapest10s ? `${cheapest10s.row.engineName} · ${cheapest10s.quote.display}` : copy.liveQuote,
      href: cheapest10s ? `#${cheapest10s.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.cheapestAudio,
      value: cheapestAudio ? `${cheapestAudio.row.engineName} · ${cheapestAudio.quote.display}` : copy.liveQuote,
      href: cheapestAudio ? `#${cheapestAudio.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.cheapest4k,
      value: cheapest4k ? `${cheapest4k.row.engineName} · ${cheapest4k.quote.display}` : copy.noExactRoute,
      href: cheapest4k ? `#${cheapest4k.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.dedicated4k,
      value: dedicated4k ? `${dedicated4k.row.engineName} · ${dedicated4k.quote.display}` : copy.noExactRoute,
      href: dedicated4k ? `#${dedicated4k.row.anchorId}` : undefined,
    },
    {
      label: copy.video.highlights.currentGenCount,
      value: copy.video.highlights.currentGenValue(currentGenCount),
    },
  ];
}

function flatImageCents(engine: EngineCaps, resolution: string, quality: GptImage2Quality = 'medium') {
  if (engine.id === 'gpt-image-2') {
    const tier = resolveGptImage2PricingTier(resolution);
    return applyDisplayedPriceMarginCents(tier.prices[quality]);
  }
  const flat = engine.pricingDetails?.flatCents;
  const base = flat?.byResolution?.[resolution] ?? flat?.default ?? readResolutionRate(engine.pricingDetails, resolution);
  return typeof base === 'number' ? applyDisplayedPriceMarginCents(base) : null;
}

function formatImageQuantityNote(locale: AppLocale, quantity: number, resolution: string) {
  const label =
    locale === 'fr'
      ? quantity > 1
        ? 'images'
        : 'image'
      : locale === 'es'
        ? quantity > 1
          ? 'imágenes'
          : 'imagen'
        : quantity > 1
          ? 'images'
          : 'image';
  return `${quantity} ${label} · ${resolution}`;
}

export function getImagePresetQuote(
  entry: FalEngineEntry,
  preset: ImagePriceScenario,
  locale: AppLocale
): PresetQuote {
  const copy = getPricingHubCopy(locale);
  const engine = entry.engine;
  const currency = engine.pricingDetails?.currency ?? engine.pricing?.currency ?? FALLBACK_CURRENCY;
  const quantity = Math.max(1, Math.floor(preset.quantity ?? 1));

  if (!supportsImageGeneration(entry)) {
    return {
      status: 'unsupported',
      display: '—',
      note: copy.quote.unsupported,
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  const perImageCents = flatImageCents(engine, preset.resolution, preset.quality ?? 'medium');
  if (perImageCents == null) {
    return {
      status: 'live_quote',
      display: copy.liveQuote,
      note: preset.resolution,
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  const totalCents = perImageCents * quantity;
  return {
    status: 'exact',
    amountCents: totalCents,
    display: formatPrice(locale, totalCents, currency),
    note: quantity > 1 ? formatImageQuantityNote(locale, quantity, preset.resolution) : preset.resolution,
    sortValue: totalCents,
  };
}

function buildImageLinks(entry: FalEngineEntry, locale: AppLocale): PricingHubLink[] {
  const copy = getPricingHubCopy(locale);
  const links: PricingHubLink[] = [];
  if (entry.surfaces.modelPage.indexable) {
    links.push({ label: copy.links.model, href: buildLocalizedMarketingHref(locale, 'models', entry.modelSlug) });
  }
  links.push({ label: copy.links.imageApp, href: '/app/image' });
  return links;
}

function formatImageSizeSummary(resolutions: string[], locale: AppLocale) {
  const copy = getPricingHubCopy(locale);
  const normalized = resolutions.map((resolution) => resolution.toLowerCase());
  const labels = new Set<string>();
  if (normalized.some((resolution) => resolution.includes('square') || resolution.includes('1:1'))) labels.add(copy.quote.square);
  if (normalized.some((resolution) => resolution.includes('portrait') || resolution.includes('9:16'))) labels.add(copy.quote.portrait);
  if (normalized.some((resolution) => resolution.includes('landscape') || resolution.includes('16:9'))) labels.add(copy.quote.landscape);
  if (normalized.includes('1k') || normalized.some((resolution) => resolution.includes('1024'))) labels.add('1K');
  if (normalized.includes('2k') || normalized.some((resolution) => resolution.includes('2048'))) labels.add('2K');
  if (
    normalized.includes('4k') ||
    normalized.includes('4K'.toLowerCase()) ||
    normalized.some((resolution) => resolution.includes('4096'))
  ) {
    labels.add('4K');
  }
  if (!labels.size && resolutions.length) return resolutions.slice(0, 3).join(' · ');
  return labels.size ? [...labels].join(' · ') : copy.quote.appPresets;
}

function buildImagePricingRows(locale: AppLocale): ImagePricingRow[] {
  return listFalEngines()
    .filter((entry) => supportsImageGeneration(entry) && isPublicMarketingEntry(entry))
    .map((entry): ImagePricingRow => {
      const engine = entry.engine;
      const resolutions = engine.resolutions.map(String);
      const standardResolution =
        engine.id === 'gpt-image-2'
          ? '1024x768'
          : resolutions.includes('1k')
            ? '1k'
            : resolutions.includes('square_hd')
              ? 'square_hd'
              : resolutions[0] ?? 'auto';
      const highResolution =
        engine.id === 'gpt-image-2'
          ? '3840x2160'
          : resolutions.includes('4k')
            ? '4k'
            : resolutions.includes('2k')
              ? '2k'
              : resolutions[resolutions.length - 1] ?? standardResolution;
      return {
        id: entry.id,
        anchorId: anchorFromSlug(entry.modelSlug),
        engine: entry.marketingName || engine.label,
        standardImage: formatPrice(locale, flatImageCents(engine, standardResolution, 'medium')),
        highQualityImage: formatPrice(locale, flatImageCents(engine, highResolution, 'high')),
        reference: engine.modes.includes('i2i') ? getPricingHubCopy(locale).quote.supported : '—',
        sizes: formatImageSizeSummary(resolutions, locale),
        links: buildImageLinks(entry, locale),
      };
    })
    .sort((a, b) => a.engine.localeCompare(b.engine));
}

function audioPrice(locale: AppLocale, pack: AudioPackId, durationSec: number, voiceMode?: AudioVoiceMode) {
  const snapshot = buildAudioPricingSnapshot({
    pack,
    durationSec,
    voiceMode,
    script: null,
    musicEnabled: true,
  });
  return formatPrice(locale, snapshot.totalCents, snapshot.currency);
}

function buildAudioPricingRows(locale: AppLocale): AudioPricingRow[] {
  const copy = getPricingHubCopy(locale);
  const appLink = [{ label: copy.links.audioApp, href: '/app/audio' }];
  return [
    {
      id: 'audio-music-only',
      anchorId: 'audio-music-only-pricing',
      mode: `${copy.audioModes.musicOnly} · MiniMax Music 2.6 / Stable Audio 2.5`,
      thirtySeconds: audioPrice(locale, 'music_only', 30),
      sixtySeconds: audioPrice(locale, 'music_only', 60),
      oneTwentySeconds: audioPrice(locale, 'music_only', 120),
      voiceClone: '—',
      links: appLink,
    },
    {
      id: 'audio-voice-only',
      anchorId: 'audio-voice-over-pricing',
      mode: `${copy.audioModes.voiceOnly} · Gemini 3.1 Flash TTS`,
      thirtySeconds: audioPrice(locale, 'voice_only', 30),
      sixtySeconds: audioPrice(locale, 'voice_only', 60),
      oneTwentySeconds: audioPrice(locale, 'voice_only', 120),
      voiceClone: copy.quote.optional,
      links: appLink,
    },
    {
      id: 'audio-cinematic',
      anchorId: 'audio-cinematic-pricing',
      mode: `${copy.audioModes.cinematic} · Mirelo SFX + ${copy.audioModes.musicOnly.toLowerCase()}`,
      thirtySeconds: audioPrice(locale, 'cinematic', 30),
      sixtySeconds: audioPrice(locale, 'cinematic', 60),
      oneTwentySeconds: audioPrice(locale, 'cinematic', 120),
      voiceClone: '—',
      links: appLink,
    },
    {
      id: 'audio-cinematic-voice',
      anchorId: 'audio-cinematic-voice-pricing',
      mode: `${copy.audioModes.cinematicVoice} · Mirelo SFX + Gemini 3.1 Flash TTS`,
      thirtySeconds: audioPrice(locale, 'cinematic_voice', 30),
      sixtySeconds: audioPrice(locale, 'cinematic_voice', 60),
      oneTwentySeconds: audioPrice(locale, 'cinematic_voice', 120),
      voiceClone: copy.quote.optional,
      links: appLink,
    },
    {
      id: 'audio-voice-clone',
      anchorId: 'minimax-voice-clone-pricing',
      mode: copy.audioModes.voiceClone,
      thirtySeconds: audioPrice(locale, 'voice_only', 30, 'clone'),
      sixtySeconds: audioPrice(locale, 'voice_only', 60, 'clone'),
      oneTwentySeconds: audioPrice(locale, 'voice_only', 120, 'clone'),
      voiceClone: copy.quote.sampleRequired,
      links: appLink,
    },
  ];
}

function buildToolPricingRows(locale: AppLocale): ToolPricingRow[] {
  const copy = getPricingHubCopy(locale);
  const fourKFormat = CHARACTER_FORMAT_OPTIONS.find((option) => option.id === '4k');
  const angleEngines = listAngleToolEngines();
  const upscaleImageEngines = listUpscaleToolEngines('image');
  const upscaleVideoEngines = listUpscaleToolEngines('video');
  const fluxAngle = angleEngines.find((engine) => engine.id === 'flux-multiple-angles');
  const qwenAngle = angleEngines.find((engine) => engine.id === 'qwen-multiple-angles');
  const seedvrImage = upscaleImageEngines.find((engine) => engine.id === 'seedvr-image');
  const topazImage = upscaleImageEngines.find((engine) => engine.id === 'topaz-image');
  const seedvrVideo = upscaleVideoEngines.find((engine) => engine.id === 'seedvr-video');
  const topazVideo = upscaleVideoEngines.find((engine) => engine.id === 'topaz-video');

  return [
    {
      id: 'character-builder-draft',
      anchorId: 'character-builder-pricing',
      tool: copy.tools.characterBuilderDraft,
      standardOutput: formatPrice(locale, 8),
      proOutput: `${fourKFormat?.label ?? '4K'}: ${formatPrice(locale, 24)}`,
      bestUsedBefore: copy.tools.imageToVideoReferences,
      links: [
        { label: copy.links.tool, href: '/tools/character-builder' },
        { label: copy.links.livePrice, href: '/app/tools/character-builder' },
      ],
    },
    {
      id: 'character-builder-final',
      anchorId: 'character-builder-final-pricing',
      tool: copy.tools.characterBuilderFinal,
      standardOutput: formatPrice(locale, 15),
      proOutput: `${fourKFormat?.label ?? '4K'}: ${formatPrice(locale, 30)}`,
      bestUsedBefore: copy.tools.finalCharacterReferences,
      links: [
        { label: copy.links.tool, href: '/tools/character-builder' },
        { label: copy.links.livePrice, href: '/app/tools/character-builder' },
      ],
    },
    {
      id: 'change-camera-angle',
      anchorId: 'change-camera-angle-pricing',
      tool: copy.tools.changeCameraAngle,
      standardOutput: `${fluxAngle?.label ?? 'FLUX'}: ${formatPrice(locale, 4)}`,
      proOutput: `${qwenAngle?.label ?? 'Qwen'}: ${formatPrice(locale, 7)}`,
      bestUsedBefore: copy.tools.imageToVideoSetup,
      links: [
        { label: copy.links.tool, href: '/tools/angle' },
        { label: copy.links.livePrice, href: '/app/tools' },
      ],
    },
    {
      id: 'generate-best-angles',
      anchorId: 'generate-best-angles-pricing',
      tool: copy.tools.generateBestAngles,
      standardOutput: `${fluxAngle?.label ?? 'FLUX'}: ${formatPrice(locale, 24)}`,
      proOutput: `${qwenAngle?.label ?? 'Qwen'}: ${formatPrice(locale, 40)}`,
      bestUsedBefore: copy.tools.storyboardCoverage,
      links: [
        { label: copy.links.tool, href: '/tools/angle' },
        { label: copy.links.livePrice, href: '/app/tools' },
      ],
    },
    {
      id: 'image-upscale',
      anchorId: 'upscale-pricing',
      tool: copy.tools.imageUpscale,
      standardOutput: `${seedvrImage?.label ?? '2x'}: ${formatPrice(locale, 4)}`,
      proOutput: `${topazImage?.label ?? '4x'}: ${formatPrice(locale, 12)}`,
      bestUsedBefore: copy.tools.imageToVideoSourceCleanup,
      links: [
        { label: copy.links.tool, href: '/tools/upscale' },
        { label: copy.links.livePrice, href: '/app/tools' },
      ],
    },
    {
      id: 'video-upscale',
      anchorId: 'video-upscale-pricing',
      tool: copy.tools.videoUpscale,
      standardOutput: `${seedvrVideo?.label ?? '1080p'}: ${formatPrice(locale, 25)}`,
      proOutput: `${topazVideo?.label ?? '4K'}: ${formatPrice(locale, 80)}`,
      bestUsedBefore: copy.tools.finalExport,
      links: [
        { label: copy.links.tool, href: '/tools/upscale' },
        { label: copy.links.livePrice, href: '/app/tools' },
      ],
    },
  ];
}

function buildPopularChecks(
  locale: AppLocale,
  videoRows: VideoPricingRow[],
  imageRows: ImagePricingRow[],
  audioRows: AudioPricingRow[],
  toolRows: ToolPricingRow[]
): PopularPriceCheckRow[] {
  const copy = getPricingHubCopy(locale);
  const currentRows = videoRows.filter((row) => row.highlightEligible);
  const rowFor = (presetId: VideoPricePresetId) => cheapestExactRow(currentRows, presetId);
  const draft720 = rowFor('5s-720p');
  const premium8s = rowFor('8s-1080p');
  const video1080 = rowFor('10s-1080p');
  const audio1080 = rowFor('10s-1080p-audio');
  const imageRow = imageRows[0];
  const voiceRow = audioRows.find((row) => row.id === 'audio-voice-only');
  const upscaleRow = toolRows.find((row) => row.id === 'video-upscale');
  return [
    {
      id: '5s-720p-video',
      priceCheck: copy.popularChecks.rows.draft720,
      engine: draft720?.row.engineName ?? copy.liveQuote,
      price: draft720?.quote.display ?? copy.liveQuote,
      link: { label: copy.links.viewRow, href: draft720 ? buildPricingAnchorHref(locale, draft720.row.anchorId) : '/app' },
    },
    {
      id: '8s-1080p-premium-video',
      priceCheck: copy.popularChecks.rows.premium8s,
      engine: premium8s?.row.engineName ?? copy.liveQuote,
      price: premium8s?.quote.display ?? copy.liveQuote,
      link: { label: copy.links.viewRow, href: premium8s ? buildPricingAnchorHref(locale, premium8s.row.anchorId) : '/app' },
    },
    {
      id: '10s-1080p-video',
      priceCheck: copy.popularChecks.rows.video1080,
      engine: video1080?.row.engineName ?? copy.liveQuote,
      price: video1080?.quote.display ?? copy.liveQuote,
      link: { label: copy.links.viewRow, href: video1080 ? buildPricingAnchorHref(locale, video1080.row.anchorId) : '/app' },
    },
    {
      id: '10s-1080p-audio-video',
      priceCheck: copy.popularChecks.rows.audio1080,
      engine: audio1080?.row.engineName ?? copy.liveQuote,
      price: audio1080?.quote.display ?? copy.liveQuote,
      link: { label: copy.links.viewRow, href: audio1080 ? buildPricingAnchorHref(locale, audio1080.row.anchorId) : '/app' },
    },
    {
      id: 'one-image-generation',
      priceCheck: copy.popularChecks.rows.image,
      engine: imageRow?.engine ?? copy.liveQuote,
      price: imageRow?.standardImage ?? copy.liveQuote,
      link: {
        label: copy.links.imagePricing,
        href: buildPricingAnchorHref(locale, 'image-pricing'),
      },
    },
    {
      id: '30s-voice-over',
      priceCheck: copy.popularChecks.rows.voiceOver,
      engine: voiceRow?.mode ?? copy.audioModes.voiceOnly,
      price: voiceRow?.thirtySeconds ?? audioPrice(locale, 'voice_only', 30),
      link: { label: copy.links.audioPricing, href: buildPricingAnchorHref(locale, 'audio-pricing') },
    },
    {
      id: '4k-upscale',
      priceCheck: copy.popularChecks.rows.upscale4k,
      engine: upscaleRow?.tool ?? copy.tools.videoUpscale,
      price: upscaleRow?.proOutput ?? copy.liveQuote,
      link: { label: copy.links.toolPricing, href: buildPricingAnchorHref(locale, 'upscale-pricing') },
    },
  ];
}

export function buildPricingHubData(locale: AppLocale): PricingHubData {
  const videoRows = buildVideoPricingRows(locale);
  const imageRows = buildImagePricingRows(locale);
  const audioRows = buildAudioPricingRows(locale);
  const toolRows = buildToolPricingRows(locale);

  return {
    video: {
      presets: VIDEO_PRICE_PRESETS,
      rows: videoRows,
      highlights: buildVideoHighlights(videoRows, locale),
    },
    popularChecks: buildPopularChecks(locale, videoRows, imageRows, audioRows, toolRows),
    otherSurfaces: {
      imageRows,
      audioRows,
      toolRows,
    },
  };
}
