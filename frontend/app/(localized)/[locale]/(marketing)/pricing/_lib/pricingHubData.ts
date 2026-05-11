import type { AppLocale } from '@/i18n/locales';
import { listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { listAngleToolEngines } from '@/config/tools-angle-engines';
import { listUpscaleToolEngines } from '@/config/tools-upscale-engines';
import type { EngineCaps, EnginePricingDetails, Resolution } from '@/types/engines';
import { CHARACTER_FORMAT_OPTIONS, CHARACTER_QUALITY_OPTIONS } from '@/lib/character-builder';
import { buildAudioPricingSnapshot, type AudioPackId, type AudioVoiceMode } from '@/lib/audio-generation';
import { resolveGptImage2PricingTier, type GptImage2Quality } from '@/lib/image/gptImage2';
import { supportsImageGeneration, supportsVideoGeneration } from '@/lib/models/catalog';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '@/lib/seedance-2-pricing';
import { formatCurrencyForLocale } from './pricingPageContent';

const FALLBACK_CURRENCY = 'USD';
const LIVE_QUOTE_LABEL = 'Live quote';

export const VIDEO_RATE_PRESETS = [
  { id: '720p-sec', label: '720p / sec', subLabel: 'Draft', resolution: '720p', audio: false },
  { id: '1080p-sec', label: '1080p / sec', subLabel: 'Standard', resolution: '1080p', audio: false },
  { id: '1080p-audio-sec', label: '1080p / sec + audio', subLabel: 'Audio', resolution: '1080p', audio: true },
] as const;

export type VideoRatePreset = (typeof VIDEO_RATE_PRESETS)[number];
export type VideoRatePresetId = VideoRatePreset['id'];

export type PricingHubLink = {
  href: string;
  label: string;
};

export type PresetQuote = {
  status: 'exact' | 'unsupported' | 'closest';
  amountCents?: number;
  display?: string;
  note?: string;
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
  engineName: string;
  variant: string | null;
  notes: string[];
  links: PricingHubLink[];
  maxDurationLabel: string;
  quotes: Record<VideoRatePresetId, PresetQuote>;
  sortValue: number;
};

export type VideoPricingHighlight = {
  label: string;
  value: string;
  href?: string;
};

export type VideoPricingMatrixData = {
  presets: readonly VideoRatePreset[];
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
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return LIVE_QUOTE_LABEL;
  return formatCurrencyForLocale(locale, currency, cents / 100);
}

function formatRate(locale: AppLocale, cents: number | null | undefined, currency = FALLBACK_CURRENCY) {
  const price = formatPrice(locale, cents, currency);
  return price === LIVE_QUOTE_LABEL ? price : `${price}/s`;
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

function formatDurationLabel(entry: FalEngineEntry) {
  const options = collectDurationOptions(entry);
  const maxDurationSec = entry.engine.pricingDetails?.maxDurationSec ?? entry.engine.maxDurationSec;
  if (options.length) {
    if (options.length <= 3) return options.map((option) => `${option}s`).join(' / ');
    return `Up to ${Math.max(...options)}s`;
  }
  return `Up to ${maxDurationSec}s`;
}

function resolveResolutionSupport(engine: EngineCaps, requestedResolution: string) {
  const resolutions = engine.resolutions.map(String);
  if (resolutions.includes(requestedResolution)) {
    return { supported: true, resolution: requestedResolution, note: null as string | null };
  }
  const preferredClosest =
    requestedResolution === '720p'
      ? resolutions.find((resolution) => resolution === '1080p') ?? resolutions.find((resolution) => resolution === '768P')
      : resolutions.find((resolution) => resolution === '720p') ?? resolutions.find((resolution) => resolution === '768P');
  const closest = preferredClosest ?? resolutions[0] ?? requestedResolution;
  const note =
    resolutions.length === 1
      ? `${closest} only`
      : requestedResolution === '720p' && closest === '1080p'
        ? '1080p route'
        : `${closest} closest`;
  return { supported: false, resolution: closest, note };
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

function displayedPerSecondRateCents(engine: EngineCaps, resolution: string, audioMode: AudioRateMode = 'default') {
  const rate = readPerSecondRateCents(engine, resolution, audioMode);
  return rate == null ? null : rate * 1.3;
}

function supportsAudioOff(engine: EngineCaps) {
  return Boolean(engine.pricingDetails?.addons?.audio_off);
}

export function getPresetRateQuote(entry: FalEngineEntry, preset: VideoRatePreset, locale: AppLocale): PresetQuote {
  const engine = entry.engine;
  const resolution = resolveResolutionSupport(engine, preset.resolution);
  const currency = engine.pricingDetails?.currency ?? engine.pricing?.currency ?? FALLBACK_CURRENCY;
  const audioMode: AudioRateMode = preset.audio ? 'default' : supportsAudioOff(engine) ? 'audio_off' : 'default';
  const canExactAudio = preset.audio ? engine.audio : true;
  const exact = resolution.supported && canExactAudio;

  const exactCents = exact ? displayedPerSecondRateCents(engine, preset.resolution, audioMode) : null;
  if (exact) {
    return {
      status: 'exact',
      amountCents: exactCents ?? undefined,
      display: formatRate(locale, exactCents, currency),
      note: !preset.audio && engine.audio && !supportsAudioOff(engine) ? 'audio included' : undefined,
      sortValue: exactCents ?? Number.POSITIVE_INFINITY,
    };
  }

  const closestCents = displayedPerSecondRateCents(engine, resolution.resolution, audioMode);
  const note = !canExactAudio ? 'audio unavailable' : resolution.note ?? 'unsupported';
  if (closestCents != null && (resolution.resolution !== preset.resolution || !canExactAudio)) {
    return {
      status: 'closest',
      display: '—',
      note,
      closest: {
        label: note,
        amountCents: closestCents,
        display: formatRate(locale, closestCents, currency),
      },
      sortValue: Number.POSITIVE_INFINITY,
    };
  }

  return {
    status: 'unsupported',
    display: '—',
    note,
    sortValue: Number.POSITIVE_INFINITY,
  };
}

function buildVideoLinks(entry: FalEngineEntry): PricingHubLink[] {
  const links: PricingHubLink[] = [];
  if (entry.surfaces.modelPage.indexable) {
    links.push({ label: 'Model', href: `/models/${entry.modelSlug}` });
  }
  if (entry.surfaces.examples.includeInFamilyResolver && entry.family) {
    links.push({ label: 'Examples', href: `/examples/${entry.family}` });
  }
  const compareSlug = entry.surfaces.compare.suggestOpponents?.[0] ?? entry.surfaces.compare.publishedPairs?.[0];
  if (entry.surfaces.compare.includeInHub && compareSlug) {
    links.push({ label: 'Compare', href: `/ai-video-engines/${entry.modelSlug}-vs-${compareSlug}` });
  }
  links.push({ label: 'Live price', href: `/app?engine=${encodeURIComponent(entry.modelSlug)}` });
  return links;
}

function buildVideoNotes(entry: FalEngineEntry) {
  const engine = entry.engine;
  const notes = new Set<string>();
  if (engine.audio) notes.add(supportsAudioOff(engine) ? 'Audio optional' : 'Audio included');
  else notes.add('Silent only');
  if (engine.maxDurationSec < 10) notes.add(`Max ${engine.maxDurationSec}s`);
  if (engine.resolutions.length === 1 && engine.resolutions[0] === '4k') notes.add('4K route');
  if (engine.modes.includes('i2v') || engine.modes.includes('ref2v')) notes.add('Image-to-video');
  if (engine.modes.includes('t2v') && (engine.modes.includes('i2v') || engine.modes.includes('ref2v'))) notes.add('Text + image');
  if (engine.latencyTier === 'fast') notes.add('Fast draft');
  return [...notes].slice(0, 4);
}

function markCheapestQuotes(rows: VideoPricingRow[]) {
  VIDEO_RATE_PRESETS.forEach((preset) => {
    const exactQuotes = rows
      .map((row) => ({ row, quote: row.quotes[preset.id] }))
      .filter((item) => item.quote.status === 'exact' && typeof item.quote.amountCents === 'number');
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
        VIDEO_RATE_PRESETS.map((preset) => [preset.id, getPresetRateQuote(entry, preset, locale)])
      ) as Record<VideoRatePresetId, PresetQuote>;
      const defaultQuote = quotes['1080p-sec'];
      const exactRank = defaultQuote.status === 'exact' ? 0 : defaultQuote.status === 'closest' ? 1 : 2;
      const pricedRank = typeof defaultQuote.amountCents === 'number' ? defaultQuote.amountCents : Number.MAX_SAFE_INTEGER;
      return {
        id: entry.id,
        anchorId: anchorFromSlug(entry.modelSlug),
        family: entry.family ?? entry.provider,
        engineName: entry.marketingName || entry.engine.label,
        variant: entry.versionLabel ?? entry.engine.variant ?? null,
        maxDurationLabel: formatDurationLabel(entry),
        notes: buildVideoNotes(entry),
        links: buildVideoLinks(entry),
        quotes,
        sortValue: exactRank * 10_000_000 + pricedRank,
      };
    })
    .sort((a, b) => a.sortValue - b.sortValue || a.engineName.localeCompare(b.engineName));

  return markCheapestQuotes(rows);
}

function cheapestExactRow(rows: VideoPricingRow[], presetId: VideoRatePresetId) {
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

function highestExactRow(rows: VideoPricingRow[], presetId: VideoRatePresetId) {
  return rows.reduce(
    (best, row) => {
      const quote = row.quotes[presetId];
      if (quote.status !== 'exact' || typeof quote.amountCents !== 'number') return best;
      if (!best || quote.amountCents > best.quote.amountCents!) return { row, quote };
      return best;
    },
    null as { row: VideoPricingRow; quote: PresetQuote } | null
  );
}

function buildVideoHighlights(rows: VideoPricingRow[]): VideoPricingHighlight[] {
  const cheapest1080 = cheapestExactRow(rows, '1080p-sec');
  const cheapestAudio = cheapestExactRow(rows, '1080p-audio-sec');
  const cheapestDraft = cheapestExactRow(rows, '720p-sec');
  const premium1080 = highestExactRow(rows, '1080p-sec');
  const available1080Count = rows.filter((row) => row.quotes['1080p-sec'].status === 'exact').length;
  return [
    {
      label: 'Cheapest 1080p/sec',
      value: cheapest1080 ? `${cheapest1080.row.engineName} · ${cheapest1080.quote.display}` : LIVE_QUOTE_LABEL,
      href: cheapest1080 ? `#${cheapest1080.row.anchorId}` : undefined,
    },
    {
      label: 'Cheapest 1080p/sec + audio',
      value: cheapestAudio ? `${cheapestAudio.row.engineName} · ${cheapestAudio.quote.display}` : LIVE_QUOTE_LABEL,
      href: cheapestAudio ? `#${cheapestAudio.row.anchorId}` : undefined,
    },
    {
      label: 'Cheapest 720p/sec draft',
      value: cheapestDraft ? `${cheapestDraft.row.engineName} · ${cheapestDraft.quote.display}` : LIVE_QUOTE_LABEL,
      href: cheapestDraft ? `#${cheapestDraft.row.anchorId}` : undefined,
    },
    {
      label: 'Premium 1080p/sec',
      value: premium1080 ? `${premium1080.row.engineName} · ${premium1080.quote.display}` : LIVE_QUOTE_LABEL,
      href: premium1080 ? `#${premium1080.row.anchorId}` : undefined,
    },
    {
      label: '1080p available',
      value: `${available1080Count} engines`,
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

function buildImageLinks(entry: FalEngineEntry): PricingHubLink[] {
  const links: PricingHubLink[] = [];
  if (entry.surfaces.modelPage.indexable) links.push({ label: 'Model', href: `/models/${entry.modelSlug}` });
  links.push({ label: 'Image app', href: '/app/image' });
  if (entry.modelSlug === 'gpt-image-2') links.push({ label: 'GPT Image 2', href: '/models/gpt-image-2' });
  return links;
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
        reference: engine.modes.includes('i2i') ? 'Supported' : '—',
        sizes: resolutions.slice(0, 5).join(', ') || 'App presets',
        links: buildImageLinks(entry),
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
  const appLink = [{ label: 'Audio app', href: '/app/audio' }];
  return [
    {
      id: 'audio-music-only',
      anchorId: 'audio-music-only-pricing',
      mode: 'Music Only · MiniMax Music 2.6 / Stable Audio 2.5',
      thirtySeconds: audioPrice(locale, 'music_only', 30),
      sixtySeconds: audioPrice(locale, 'music_only', 60),
      oneTwentySeconds: audioPrice(locale, 'music_only', 120),
      voiceClone: '—',
      links: appLink,
    },
    {
      id: 'audio-voice-only',
      anchorId: 'audio-voice-over-pricing',
      mode: 'Voice Over Only · Gemini 3.1 Flash TTS',
      thirtySeconds: audioPrice(locale, 'voice_only', 30),
      sixtySeconds: audioPrice(locale, 'voice_only', 60),
      oneTwentySeconds: audioPrice(locale, 'voice_only', 120),
      voiceClone: 'Optional',
      links: appLink,
    },
    {
      id: 'audio-cinematic',
      anchorId: 'audio-cinematic-pricing',
      mode: 'Cinematic · Mirelo SFX + music',
      thirtySeconds: audioPrice(locale, 'cinematic', 30),
      sixtySeconds: audioPrice(locale, 'cinematic', 60),
      oneTwentySeconds: audioPrice(locale, 'cinematic', 120),
      voiceClone: '—',
      links: appLink,
    },
    {
      id: 'audio-cinematic-voice',
      anchorId: 'audio-cinematic-voice-pricing',
      mode: 'Cinematic + Voice · Mirelo SFX + Gemini 3.1 Flash TTS',
      thirtySeconds: audioPrice(locale, 'cinematic_voice', 30),
      sixtySeconds: audioPrice(locale, 'cinematic_voice', 60),
      oneTwentySeconds: audioPrice(locale, 'cinematic_voice', 120),
      voiceClone: 'Optional',
      links: appLink,
    },
    {
      id: 'audio-voice-clone',
      anchorId: 'minimax-voice-clone-pricing',
      mode: 'MiniMax Voice Clone',
      thirtySeconds: audioPrice(locale, 'voice_only', 30, 'clone'),
      sixtySeconds: audioPrice(locale, 'voice_only', 60, 'clone'),
      oneTwentySeconds: audioPrice(locale, 'voice_only', 120, 'clone'),
      voiceClone: 'Sample required',
      links: appLink,
    },
  ];
}

function buildToolPricingRows(locale: AppLocale): ToolPricingRow[] {
  const draftQuality = CHARACTER_QUALITY_OPTIONS.find((option) => option.id === 'draft');
  const finalQuality = CHARACTER_QUALITY_OPTIONS.find((option) => option.id === 'final');
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
      tool: `Character Builder ${draftQuality?.label ?? 'Draft'}`,
      standardOutput: formatPrice(locale, 8),
      proOutput: `${fourKFormat?.label ?? '4K'}: ${formatPrice(locale, 24)}`,
      bestUsedBefore: 'Image-to-video references',
      links: [
        { label: 'Tool', href: '/tools/character-builder' },
        { label: 'Live price', href: '/app/tools/character-builder' },
      ],
    },
    {
      id: 'character-builder-final',
      anchorId: 'character-builder-final-pricing',
      tool: `Character Builder ${finalQuality?.label ?? 'Final'}`,
      standardOutput: formatPrice(locale, 15),
      proOutput: `${fourKFormat?.label ?? '4K'}: ${formatPrice(locale, 30)}`,
      bestUsedBefore: 'Final character references',
      links: [
        { label: 'Tool', href: '/tools/character-builder' },
        { label: 'Live price', href: '/app/tools/character-builder' },
      ],
    },
    {
      id: 'change-camera-angle',
      anchorId: 'change-camera-angle-pricing',
      tool: 'Change Camera Angle',
      standardOutput: `${fluxAngle?.label ?? 'FLUX'}: ${formatPrice(locale, 4)}`,
      proOutput: `${qwenAngle?.label ?? 'Qwen'}: ${formatPrice(locale, 7)}`,
      bestUsedBefore: 'Image-to-video setup',
      links: [
        { label: 'Tool', href: '/tools/angle' },
        { label: 'Live price', href: '/app/tools' },
      ],
    },
    {
      id: 'generate-best-angles',
      anchorId: 'generate-best-angles-pricing',
      tool: 'Generate 4 best angles',
      standardOutput: `${fluxAngle?.label ?? 'FLUX'}: ${formatPrice(locale, 24)}`,
      proOutput: `${qwenAngle?.label ?? 'Qwen'}: ${formatPrice(locale, 40)}`,
      bestUsedBefore: 'Storyboard coverage',
      links: [
        { label: 'Tool', href: '/tools/angle' },
        { label: 'Live price', href: '/app/tools' },
      ],
    },
    {
      id: 'image-upscale',
      anchorId: 'upscale-pricing',
      tool: 'Image Upscale',
      standardOutput: `${seedvrImage?.label ?? '2x'}: ${formatPrice(locale, 4)}`,
      proOutput: `${topazImage?.label ?? '4x'}: ${formatPrice(locale, 12)}`,
      bestUsedBefore: 'Image-to-video source cleanup',
      links: [
        { label: 'Tool', href: '/tools/upscale' },
        { label: 'Live price', href: '/app/tools' },
      ],
    },
    {
      id: 'video-upscale',
      anchorId: 'video-upscale-pricing',
      tool: 'Video Upscale',
      standardOutput: `${seedvrVideo?.label ?? '1080p'}: ${formatPrice(locale, 25)}`,
      proOutput: `${topazVideo?.label ?? '4K'}: ${formatPrice(locale, 80)}`,
      bestUsedBefore: 'Final export',
      links: [
        { label: 'Tool', href: '/tools/upscale' },
        { label: 'Live price', href: '/app/tools' },
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
  const rowFor = (presetId: VideoRatePresetId) => cheapestExactRow(videoRows, presetId);
  const draft720 = rowFor('720p-sec');
  const rate1080 = rowFor('1080p-sec');
  const audio1080 = rowFor('1080p-audio-sec');
  const imageRow = imageRows[0];
  const voiceRow = audioRows.find((row) => row.id === 'audio-voice-only');
  const upscaleRow = toolRows.find((row) => row.id === 'video-upscale');
  return [
    {
      id: '720p-video-second',
      priceCheck: '720p video second',
      engine: draft720?.row.engineName ?? LIVE_QUOTE_LABEL,
      price: draft720?.quote.display ?? LIVE_QUOTE_LABEL,
      link: { label: 'View row', href: draft720 ? `#${draft720.row.anchorId}` : '/app' },
    },
    {
      id: '1080p-video-second',
      priceCheck: '1080p video second',
      engine: rate1080?.row.engineName ?? LIVE_QUOTE_LABEL,
      price: rate1080?.quote.display ?? LIVE_QUOTE_LABEL,
      link: { label: 'View row', href: rate1080 ? `#${rate1080.row.anchorId}` : '/app' },
    },
    {
      id: '1080p-audio-video-second',
      priceCheck: '1080p with audio second',
      engine: audio1080?.row.engineName ?? LIVE_QUOTE_LABEL,
      price: audio1080?.quote.display ?? LIVE_QUOTE_LABEL,
      link: { label: 'View row', href: audio1080 ? `#${audio1080.row.anchorId}` : '/app' },
    },
    {
      id: 'one-image-generation',
      priceCheck: '1 image generation',
      engine: imageRow?.engine ?? LIVE_QUOTE_LABEL,
      price: imageRow?.standardImage ?? LIVE_QUOTE_LABEL,
      link: { label: 'Image pricing', href: imageRow ? `#${imageRow.anchorId}` : '/app/image' },
    },
    {
      id: '30s-voice-over',
      priceCheck: '30s voice-over',
      engine: voiceRow?.mode ?? 'Voice Over Only',
      price: voiceRow?.thirtySeconds ?? audioPrice(locale, 'voice_only', 30),
      link: { label: 'Audio pricing', href: '#audio-pricing' },
    },
    {
      id: '4k-upscale',
      priceCheck: '4K upscale',
      engine: upscaleRow?.tool ?? 'Video Upscale',
      price: upscaleRow?.proOutput ?? LIVE_QUOTE_LABEL,
      link: { label: 'Tool pricing', href: '#tool-pricing' },
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
      presets: VIDEO_RATE_PRESETS,
      rows: videoRows,
      highlights: buildVideoHighlights(videoRows),
    },
    popularChecks: buildPopularChecks(locale, videoRows, imageRows, audioRows, toolRows),
    otherSurfaces: {
      imageRows,
      audioRows,
      toolRows,
    },
  };
}
