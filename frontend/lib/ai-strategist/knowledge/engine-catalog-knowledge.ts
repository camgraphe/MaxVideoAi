import engineCatalog from '../../../config/engine-catalog.json';
import { getAiStrategistModel } from '../model-catalog';
import type { AiStrategistModelId } from '../types';
import { resolveModelId } from './model-knowledge';
import type { StrategistKnowledgeToolResult } from './types';

type EngineCatalogEntry = {
  engineId?: string;
  modelSlug?: string;
  marketingName?: string;
  availability?: string;
  engine?: {
    maxDurationSec?: number;
    pricing?: {
      unit?: string;
      base?: number;
      currency?: string;
      notes?: string;
    };
    pricingDetails?: {
      currency?: string;
      perSecondCents?: {
        default?: number;
        byResolution?: Record<string, number>;
      };
      tokenPricing?: {
        model?: string;
        unitPriceUsdPer1kTokens?: number;
        framesPerSecond?: number;
        defaultAspectRatio?: string;
        dimensions?: Record<string, Record<string, { width: number; height: number }>>;
      };
      addons?: Record<string, {
        perSecondCents?: number;
        perSecondCentsByResolution?: Record<string, number>;
      }>;
    };
  };
  modes?: Array<{
    mode?: string;
    ui?: {
      duration?: {
        options?: Array<string | number>;
        default?: string | number;
      };
      resolution?: string[];
      aspectRatio?: string[];
      audioToggle?: boolean;
      acceptsImageFormats?: string[];
      maxUploadMB?: number;
    };
  }>;
};

const catalogEntries = engineCatalog as EngineCatalogEntry[];

export function answerEnginePricingQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult | null {
  if (asksForCheapestEngine(input.rawUserMessage)) return answerCheapestEngineQuestion(input.rawUserMessage);

  const modelId = resolveModelId(input.rawUserMessage);
  const entry = resolveEngineEntry(input.rawUserMessage, modelId);
  if (!entry) return null;

  const requestedDurationSeconds = resolveDurationSeconds(input.rawUserMessage);
  const durationSeconds = clampEngineDuration(requestedDurationSeconds ?? 8, entry);
  const tokenPrice = buildTokenPricingQuote({
    rawUserMessage: input.rawUserMessage,
    entry,
    durationSeconds,
    requestedDurationSeconds,
    modelId,
  });
  if (tokenPrice) return tokenPrice;

  const defaultPerSecondCents = entry.engine?.pricingDetails?.perSecondCents?.default;
  const resolution = resolvePricingResolution(input.rawUserMessage, entry);
  const resolutionRate = resolution ? entry.engine?.pricingDetails?.perSecondCents?.byResolution?.[resolution] : undefined;
  if (typeof defaultPerSecondCents !== 'number' && typeof resolutionRate !== 'number') return null;

  const audioOff = /\baudio\s+off\b|\bwithout audio\b|\bno audio\b/i.test(input.rawUserMessage);
  const audioOffAddon = audioOff
    ? resolution
      ? entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCentsByResolution?.[resolution] ?? entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents ?? 0
      : entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents ?? 0
    : 0;
  const centsPerSecond = Math.max(0, (resolutionRate ?? defaultPerSecondCents ?? 0) + audioOffAddon);
  const estimatedCents = Math.max(1, Math.round(durationSeconds * centsPerSecond));
  const label = entry.marketingName ?? entry.engineId ?? modelId ?? 'Selected engine';
  const resolutionBasis = resolution ? ` at ${resolution}` : ' at the catalog default setting';

  return {
    toolName: 'engine_pricing',
    answer: [
      `${label}: engine catalog preview pricing is about ${formatUsd(estimatedCents)} for ${durationSeconds} seconds${resolutionBasis}${audioOff ? ', audio off' : ''}.`,
      `Catalog basis: ${formatUsd(centsPerSecond)} per second${resolutionBasis}${entry.engine?.pricing?.unit ? ` (${entry.engine.pricing.unit})` : ''}.`,
      'The final generator quote shown before rendering is authoritative, and I will not run generation or spend credits.',
    ].join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.86,
    limitations: [
      'The generator quote shown before rendering is authoritative.',
      'This tool reads the local engine catalog and does not start a render.',
    ],
    warnings: [
      ...durationAdjustmentWarnings(requestedDurationSeconds, durationSeconds, label, entry),
      ...(!hasExplicitResolution(input.rawUserMessage) && resolution ? [`No resolution was specified, so this estimate assumes ${resolution}.`] : []),
      ...(entry.engine?.pricing?.notes ? [entry.engine.pricing.notes] : []),
    ],
    uiActions: modelId ? [{ type: 'SET_MODEL', value: modelId }] : [],
  };
}

function buildTokenPricingQuote(input: {
  rawUserMessage: string;
  entry: EngineCatalogEntry;
  durationSeconds: number;
  requestedDurationSeconds?: number;
  modelId?: AiStrategistModelId;
}): StrategistKnowledgeToolResult | null {
  const tokenPricing = input.entry.engine?.pricingDetails?.tokenPricing;
  if (tokenPricing?.model !== 'fal_tokens') return null;
  if (
    typeof tokenPricing.unitPriceUsdPer1kTokens !== 'number' ||
    typeof tokenPricing.framesPerSecond !== 'number' ||
    !tokenPricing.dimensions
  ) {
    return null;
  }

  const resolution = resolveTokenPricingResolution(input.rawUserMessage, tokenPricing.dimensions);
  const dimensionMap = tokenPricing.dimensions[resolution];
  if (!dimensionMap) return null;
  const aspectRatio = resolveTokenPricingAspectRatio(input.rawUserMessage, dimensionMap, tokenPricing.defaultAspectRatio);
  const dimensions = dimensionMap[aspectRatio];
  if (!dimensions) return null;

  const tokenCount = (dimensions.width * dimensions.height * input.durationSeconds * tokenPricing.framesPerSecond) / 1024;
  const vendorUsd = (tokenCount * tokenPricing.unitPriceUsdPer1kTokens) / 1000;
  const estimatedCents = roundUsdUpToCents(vendorUsd * 1.3);
  const perSecondCents = estimatedCents / input.durationSeconds;
  const label = input.entry.marketingName ?? input.entry.engineId ?? input.modelId ?? 'Selected engine';

  return {
    toolName: 'engine_pricing',
    answer: [
      `${label}: engine catalog preview pricing is about ${formatUsd(estimatedCents)} for ${input.durationSeconds} seconds at ${resolution} ${aspectRatio} (${dimensions.width}x${dimensions.height}).`,
      `Catalog basis: token-priced output at ${tokenPricing.framesPerSecond} fps; this works out to about ${formatUsd(perSecondCents)} per second for ${resolution} ${aspectRatio}.`,
      'Seedance 2 pricing changes with resolution and aspect ratio, so 480p, 720p, 1080p, 16:9, 9:16, or 1:1 can produce different prices.',
      'The final generator quote shown before rendering is authoritative, and I will not run generation or spend credits.',
    ].join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.9,
    limitations: [
      'This preview uses the local engine catalog token-pricing formula and the default member margin.',
      'The generator quote shown before rendering is authoritative.',
    ],
    warnings: [
      ...durationAdjustmentWarnings(input.requestedDurationSeconds, input.durationSeconds, label, input.entry),
      ...(!hasExplicitResolution(input.rawUserMessage) ? [`No resolution was specified, so this estimate assumes ${resolution}.`] : []),
      ...(!hasExplicitAspectRatio(input.rawUserMessage) ? [`No aspect ratio was specified, so this estimate assumes ${aspectRatio}.`] : []),
      ...(input.entry.engine?.pricing?.notes ? [input.entry.engine.pricing.notes] : []),
    ],
    uiActions: input.modelId ? [{ type: 'SET_MODEL', value: input.modelId }] : [],
  };
}

function answerCheapestEngineQuestion(rawUserMessage: string): StrategistKnowledgeToolResult | null {
  const candidates = catalogEntries
    .filter(isAvailableVideoEngineWithPricing)
    .map((entry) => ({
      entry,
      centsPerSecond: entry.engine?.pricingDetails?.perSecondCents?.default ?? estimateTokenCentsPerSecond(entry) ?? Number.POSITIVE_INFINITY,
    }))
    .filter((candidate) => Number.isFinite(candidate.centsPerSecond))
    .sort((a, b) => a.centsPerSecond - b.centsPerSecond);

  const cheapest = candidates[0];
  if (!cheapest || !Number.isFinite(cheapest.centsPerSecond)) return null;

  const tiedCheapest = candidates.filter((candidate) => candidate.centsPerSecond === cheapest.centsPerSecond).slice(0, 3);
  const nextOptions = candidates
    .filter((candidate) => candidate.centsPerSecond > cheapest.centsPerSecond)
    .slice(0, 2);
  const isFrench = isFrenchText(rawUserMessage);
  const cheapestLabels = tiedCheapest.map(({ entry }) => entry.marketingName ?? entry.engineId ?? 'Unknown engine').join(', ');
  const nextLabels = nextOptions
    .map(({ entry, centsPerSecond }) => `${entry.marketingName ?? entry.engineId ?? 'Unknown engine'} (${formatUsd(centsPerSecond)}/s)`)
    .join(', ');

  return {
    toolName: 'engine_pricing',
    answer: isFrench
      ? [
          `Pour la vidéo, les moteurs les moins chers dans le catalogue local sont: ${cheapestLabels}.`,
          `Base catalogue: ${formatUsd(cheapest.centsPerSecond)} par seconde. Pour 8 secondes, ça donne environ ${formatUsd(Math.round(cheapest.centsPerSecond * 8))}.`,
          nextLabels ? `Options value juste au-dessus: ${nextLabels}.` : undefined,
          'Le devis affiché dans le générateur avant rendu reste la source de vérité. Je ne lance pas de génération et je ne dépense pas de crédits.',
        ].filter(Boolean).join('\n')
      : [
          `For video, the cheapest engines in the local catalog are: ${cheapestLabels}.`,
          `Catalog basis: ${formatUsd(cheapest.centsPerSecond)} per second. For 8 seconds, that is about ${formatUsd(Math.round(cheapest.centsPerSecond * 8))}.`,
          nextLabels ? `Next value options: ${nextLabels}.` : undefined,
          'The generator quote shown before rendering remains authoritative. I will not run generation or spend credits.',
        ].filter(Boolean).join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.88,
    limitations: [
      'This is a local catalog preview for available video engines only.',
      'The generator quote shown before rendering is authoritative.',
    ],
    warnings: ['Preview pricing is approximate. Final cost can change with duration, workflow, resolution, audio, and current generator settings.'],
    uiActions: [],
  };
}

export function answerEngineSettingsQuestion(input: { rawUserMessage: string }): StrategistKnowledgeToolResult {
  const modelId = resolveModelId(input.rawUserMessage);
  const entry = resolveEngineEntry(input.rawUserMessage, modelId);
  if (!entry) {
    return {
      toolName: 'engine_settings',
      answer: 'I could not find a precise engine catalog match. Ask with a model name such as “Kling 3 4K settings” or “Seedance 2 duration”.',
      sources: [engineCatalogSource()],
      confidence: 0.35,
      limitations: ['No exact engine catalog match was found.'],
      warnings: [],
      uiActions: [],
    };
  }

  const modes = entry.modes ?? [];
  const durations = uniqueStrings(modes.flatMap((mode) => (mode.ui?.duration?.options ?? []).map(String)));
  const resolutions = uniqueStrings(modes.flatMap((mode) => mode.ui?.resolution ?? []));
  const aspectRatios = uniqueStrings(modes.flatMap((mode) => mode.ui?.aspectRatio ?? []));
  const modeLabels = uniqueStrings(modes.map((mode) => mode.mode).filter((mode): mode is string => Boolean(mode)));
  const audioSupported = modes.some((mode) => mode.ui?.audioToggle === true);
  const label = entry.marketingName ?? entry.engineId ?? modelId ?? 'Selected engine';
  const intro = buildSettingsIntro({
    rawUserMessage: input.rawUserMessage,
    label,
    audioSupported,
  });

  return {
    toolName: 'engine_settings',
    answer: [
      intro,
      `In the generator, the practical ${label} controls are:`,
      `Modes: ${modeLabels.length ? modeLabels.join(', ') : 'not listed'}.`,
      `Duration options: ${durations.length ? durations.join(', ') : 'not listed'}.`,
      `Resolutions: ${resolutions.length ? resolutions.join(', ') : 'not listed'}.`,
      `Aspect ratios: ${aspectRatios.length ? aspectRatios.join(', ') : 'not listed'}.`,
      `Audio toggle: ${audioSupported ? 'available where exposed' : 'not listed'}.`,
      'Use this to choose the workflow and settings in the generator; the currently exposed generator controls remain authoritative.',
      'I will not run generation or spend credits.',
    ].join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.88,
    limitations: ['This reports local engine catalog settings. The generator UI remains authoritative for currently exposed controls.'],
    warnings: [],
    uiActions: modelId ? [{ type: 'SET_MODEL', value: modelId }] : [],
  };
}

function buildSettingsIntro(input: { rawUserMessage: string; label: string; audioSupported: boolean }): string {
  const text = normalizeSearchText(input.rawUserMessage);
  const asksAudio = /\baudio\b|\bsound\b|\bvoice(?:over)?\b|\blip\s*sync\b|\blipsync\b|\blip-sync\b|\bdialogue\b|\bspeak/i.test(text);
  if (!asksAudio) return `Here are the ${input.label} controls I found in the local engine catalog.`;

  if (input.audioSupported) {
    return `Yes, ${input.label} supports audio in MaxVideoAI where exposed. For short ads, keep any spoken line concise and use a compatible audio/lip-sync workflow when speech timing matters.`;
  }

  return `${input.label} does not list an audio toggle in the local engine settings. Use post audio or choose an audio-ready model if sound or lip-sync is central.`;
}

function resolveEngineEntry(rawUserMessage: string, modelId?: AiStrategistModelId): EngineCatalogEntry | undefined {
  const modelAliases = modelId ? getAiStrategistModel(modelId).appEngineAliases ?? [modelId] : [];
  const candidates = [modelId, ...modelAliases].filter((value): value is string => Boolean(value));
  const byAlias = catalogEntries.find((entry) =>
    candidates.some((candidate) => entry.engineId === candidate || entry.modelSlug === candidate || entry.engine?.pricing?.notes?.toLowerCase().includes(candidate))
  );
  if (byAlias) return byAlias;

  const text = normalizeSearchText(rawUserMessage);
  return catalogEntries.find((entry) => {
    const haystack = normalizeSearchText([entry.engineId, entry.modelSlug, entry.marketingName].filter(Boolean).join(' '));
    return haystack.length > 0 && text.includes(haystack);
  });
}

function asksForCheapestEngine(value: string): boolean {
  const text = normalizeSearchText(value);
  return [
    'cheapest',
    'least expensive',
    'lowest cost',
    'lowest price',
    'cheaper',
    'moins cher',
    'moin cher',
    'moins couteux',
    'pas cher',
    'barato',
    'mas barato',
    'menos caro',
  ].some((phrase) => text.includes(phrase));
}

function isAvailableVideoEngineWithPricing(entry: EngineCatalogEntry): boolean {
  if (entry.availability && entry.availability !== 'available') return false;
  const centsPerSecond = entry.engine?.pricingDetails?.perSecondCents?.default;
  const tokenPricing = entry.engine?.pricingDetails?.tokenPricing;
  if (
    (typeof centsPerSecond !== 'number' || !Number.isFinite(centsPerSecond)) &&
    tokenPricing?.model !== 'fal_tokens'
  ) {
    return false;
  }
  const modes = entry.modes ?? [];
  return modes.some((mode) => ['t2v', 'i2v', 'v2v', 'r2v'].includes(mode.mode ?? ''));
}

function isFrenchText(value: string): boolean {
  const text = normalizeSearchText(value);
  return [
    'quel',
    'quelle',
    'modele',
    'moins cher',
    'moin cher',
    'tarif',
    'prix',
    'combien',
    'cout',
    'couteux',
  ].some((needle) => text.includes(needle));
}

function resolveDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d{1,3})\s*(?:seconds?|secs?|s|secondes?)\b/i);
  if (!match) return undefined;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 60) : undefined;
}

function clampEngineDuration(durationSeconds: number, entry: EngineCatalogEntry): number {
  const maxDurationSec = entry.engine?.maxDurationSec;
  if (typeof maxDurationSec !== 'number' || !Number.isFinite(maxDurationSec) || maxDurationSec <= 0) {
    return durationSeconds;
  }
  return Math.min(durationSeconds, maxDurationSec);
}

function durationAdjustmentWarnings(
  requestedDurationSeconds: number | undefined,
  usedDurationSeconds: number,
  label: string,
  entry: EngineCatalogEntry
): string[] {
  const maxDurationSec = entry.engine?.maxDurationSec;
  if (
    typeof requestedDurationSeconds !== 'number' ||
    typeof maxDurationSec !== 'number' ||
    !Number.isFinite(maxDurationSec) ||
    requestedDurationSeconds <= usedDurationSeconds
  ) {
    return [];
  }
  return [`Requested ${requestedDurationSeconds} seconds, but ${label} is capped at ${maxDurationSec} seconds in the local engine catalog, so this estimate uses ${usedDurationSeconds} seconds.`];
}

function resolvePricingResolution(rawUserMessage: string, entry: EngineCatalogEntry): string | undefined {
  const explicit = extractResolution(rawUserMessage);
  const available = uniqueStrings((entry.modes ?? []).flatMap((mode) => mode.ui?.resolution ?? []));
  if (explicit && available.includes(explicit)) return explicit;
  if (available.length === 1) return available[0];
  if (available.includes('720p')) return '720p';
  return available[0];
}

function resolveTokenPricingResolution(
  rawUserMessage: string,
  dimensions: Record<string, Record<string, { width: number; height: number }>>
): string {
  const explicit = extractResolution(rawUserMessage);
  const available = Object.keys(dimensions);
  if (explicit && available.includes(explicit)) return explicit;
  if (available.includes('720p')) return '720p';
  return available[0] ?? '720p';
}

function resolveTokenPricingAspectRatio(
  rawUserMessage: string,
  dimensions: Record<string, { width: number; height: number }>,
  defaultAspectRatio?: string
): string {
  const explicit = extractAspectRatio(rawUserMessage);
  if (explicit && dimensions[explicit]) return explicit;
  if (/\b(?:vertical|tiktok|reels?|shorts?)\b/i.test(rawUserMessage) && dimensions['9:16']) return '9:16';
  if (/\b(?:square|carre|carré)\b/i.test(rawUserMessage) && dimensions['1:1']) return '1:1';
  if (defaultAspectRatio && dimensions[defaultAspectRatio]) return defaultAspectRatio;
  return Object.keys(dimensions)[0] ?? '16:9';
}

function extractResolution(rawUserMessage: string): string | undefined {
  const match = rawUserMessage.match(/\b(480p|720p|1080p|4k)\b/i);
  if (!match?.[1]) return undefined;
  return match[1].toLowerCase() === '4k' ? '4k' : match[1].toLowerCase();
}

function extractAspectRatio(rawUserMessage: string): string | undefined {
  return rawUserMessage.match(/\b(21:9|16:9|4:3|1:1|3:4|9:16)\b/)?.[1];
}

function hasExplicitResolution(rawUserMessage: string): boolean {
  return Boolean(extractResolution(rawUserMessage));
}

function hasExplicitAspectRatio(rawUserMessage: string): boolean {
  return Boolean(extractAspectRatio(rawUserMessage) || /\b(?:vertical|tiktok|reels?|shorts?|square|carre|carré)\b/i.test(rawUserMessage));
}

function roundUsdUpToCents(amountUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  return Math.max(1, Math.ceil(amountUsd * 100 - 1e-9));
}

function estimateTokenCentsPerSecond(entry: EngineCatalogEntry): number | undefined {
  const tokenPricing = entry.engine?.pricingDetails?.tokenPricing;
  if (
    tokenPricing?.model !== 'fal_tokens' ||
    typeof tokenPricing.unitPriceUsdPer1kTokens !== 'number' ||
    typeof tokenPricing.framesPerSecond !== 'number' ||
    !tokenPricing.dimensions
  ) {
    return undefined;
  }
  const resolution = tokenPricing.dimensions['720p'] ? '720p' : Object.keys(tokenPricing.dimensions)[0];
  if (!resolution) return undefined;
  const dimensionMap = tokenPricing.dimensions[resolution];
  if (!dimensionMap) return undefined;
  const aspectRatio = tokenPricing.defaultAspectRatio && dimensionMap[tokenPricing.defaultAspectRatio]
    ? tokenPricing.defaultAspectRatio
    : Object.keys(dimensionMap)[0];
  if (!aspectRatio) return undefined;
  const dimensions = dimensionMap[aspectRatio];
  if (!dimensions) return undefined;
  const tokenCountPerSecond = (dimensions.width * dimensions.height * tokenPricing.framesPerSecond) / 1024;
  const vendorUsdPerSecond = (tokenCountPerSecond * tokenPricing.unitPriceUsdPer1kTokens) / 1000;
  return roundUsdUpToCents(vendorUsdPerSecond * 1.3);
}

function engineCatalogSource() {
  return {
    id: 'engine_catalog' as const,
    label: 'Engine catalog',
    path: 'frontend/config/engine-catalog.json',
  };
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9:.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
