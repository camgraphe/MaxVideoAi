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
    pricing?: {
      unit?: string;
      base?: number;
      currency?: string;
      notes?: string;
    };
    pricingDetails?: {
      currency?: string;
      perSecondCents?: Record<string, number>;
      addons?: Record<string, { perSecondCents?: number }>;
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
  const modelId = resolveModelId(input.rawUserMessage);
  const entry = resolveEngineEntry(input.rawUserMessage, modelId);
  if (!entry) return null;

  const durationSeconds = resolveDurationSeconds(input.rawUserMessage) ?? 8;
  const defaultPerSecondCents = entry.engine?.pricingDetails?.perSecondCents?.default;
  if (typeof defaultPerSecondCents !== 'number') return null;

  const audioOff = /\baudio\s+off\b|\bwithout audio\b|\bno audio\b/i.test(input.rawUserMessage);
  const audioOffAddon = audioOff ? entry.engine?.pricingDetails?.addons?.audio_off?.perSecondCents ?? 0 : 0;
  const centsPerSecond = Math.max(0, defaultPerSecondCents + audioOffAddon);
  const estimatedCents = Math.max(1, Math.round(durationSeconds * centsPerSecond));
  const label = entry.marketingName ?? entry.engineId ?? modelId ?? 'Selected engine';

  return {
    toolName: 'engine_pricing',
    answer: [
      `${label}: engine catalog preview pricing is about ${formatUsd(estimatedCents)} for ${durationSeconds} seconds${audioOff ? ' with audio off' : ''}.`,
      `Catalog basis: ${formatUsd(centsPerSecond)} per second${entry.engine?.pricing?.unit ? ` (${entry.engine.pricing.unit})` : ''}.`,
      'The generator quote shown before rendering is authoritative, and I will not run generation or spend credits.',
    ].join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.86,
    limitations: [
      'The generator quote shown before rendering is authoritative.',
      'This tool reads the local engine catalog and does not start a render.',
    ],
    warnings: entry.engine?.pricing?.notes ? [entry.engine.pricing.notes] : [],
    uiActions: modelId ? [{ type: 'SET_MODEL', value: modelId }] : [],
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

  return {
    toolName: 'engine_settings',
    answer: [
      `${label} settings from the engine catalog:`,
      `Modes: ${modeLabels.length ? modeLabels.join(', ') : 'not listed'}.`,
      `Duration options: ${durations.length ? durations.join(', ') : 'not listed'}.`,
      `Resolutions: ${resolutions.length ? resolutions.join(', ') : 'not listed'}.`,
      `Aspect ratios: ${aspectRatios.length ? aspectRatios.join(', ') : 'not listed'}.`,
      `Audio toggle: ${audioSupported ? 'available where exposed' : 'not listed'}.`,
    ].join('\n'),
    sources: [engineCatalogSource()],
    confidence: 0.88,
    limitations: ['This reports local engine catalog settings. The generator UI remains authoritative for currently exposed controls.'],
    warnings: [],
    uiActions: modelId ? [{ type: 'SET_MODEL', value: modelId }] : [],
  };
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

function resolveDurationSeconds(text: string): number | undefined {
  const match = text.match(/\b(\d{1,3})\s*(?:seconds?|secs?|s|secondes?)\b/i);
  if (!match) return undefined;
  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), 60) : undefined;
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
