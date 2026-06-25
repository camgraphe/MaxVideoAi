import path from 'node:path';
import { promises as fs } from 'node:fs';

import engineCatalog from '@/config/engine-catalog.json';
import type { FalEngineEntry } from '@/config/falEngines';
import type { AppLocale } from '@/i18n/locales';
import { isImageOnlyModel, supportsVideoGeneration } from '@/lib/models/catalog';
import { applyDisplayedPriceMarginCents } from '@/lib/pricing-display';

export {
  DEFAULT_ENGINE_TYPE_LABELS,
  MODELS_HERO_IMAGE_URL,
  MODELS_SCOPE_NAV_LABELS,
  MODELS_SLUG_MAP,
  getModelsScopeEnglishPath,
  getModelsScopePath,
  getScopeDefaults,
} from './models-catalog-copy';
export type { ModelsPageScope, ScopePageDefaults } from './models-catalog-copy';

type EngineCatalogEntry = (typeof engineCatalog)[number];

export type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  visualQuality?: number | null;
  motion?: number;
  consistency?: number;
  anatomy?: number;
  textRendering?: number;
  lipsyncQuality?: number | null;
  sequencingQuality?: number | null;
  controllability?: number | null;
  speedStability?: number | null;
  pricing?: number | null;
};

type EngineScoresFile = {
  scores?: EngineScore[];
};

type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
};

type EngineKeySpecsFile = {
  specs?: EngineKeySpecsEntry[];
};

export async function loadEngineKeySpecs(): Promise<Map<string, Record<string, unknown>>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-key-specs.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-key-specs.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineKeySpecsFile;
      const map = new Map<string, Record<string, unknown>>();
      (data.specs ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key && entry.keySpecs) {
          map.set(key, entry.keySpecs);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export async function loadEngineScores(): Promise<Map<string, EngineScore>> {
  const candidates = [
    path.join(process.cwd(), 'data', 'benchmarks', 'engine-scores.v1.json'),
    path.join(process.cwd(), '..', 'data', 'benchmarks', 'engine-scores.v1.json'),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const data = JSON.parse(raw) as EngineScoresFile;
      const map = new Map<string, EngineScore>();
      (data.scores ?? []).forEach((entry) => {
        const key = entry.modelSlug ?? entry.engineId;
        if (key) {
          map.set(key, entry);
        }
      });
      return map;
    } catch {
      // keep trying
    }
  }
  return new Map();
}

export function getCatalogBySlug() {
  return new Map<string, EngineCatalogEntry>(engineCatalog.map((entry) => [entry.modelSlug, entry]));
}

export function resolveSupported(value: unknown) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized === 'supported' ||
    normalized.startsWith('supported ') ||
    normalized.startsWith('supported (') ||
    normalized === 'yes' ||
    normalized === 'true'
  ) {
    return true;
  }
  if (
    normalized === 'not supported' ||
    normalized.startsWith('not supported ') ||
    normalized.startsWith('not supported (') ||
    normalized === 'no' ||
    normalized === 'false'
  ) {
    return false;
  }
  return null;
}

export function extractMaxResolution(value?: string | null, fallback?: string[]) {
  const candidates = [value ?? '', ...(fallback ?? [])];
  let explicitMax = 0;
  let explicitLabel: string | null = null;
  let fallbackMax = 0;
  candidates.forEach((entry) => {
    const normalized = entry.toLowerCase();
    if (normalized.includes('4k')) {
      explicitMax = Math.max(explicitMax, 2160);
      if (!explicitLabel) explicitLabel = '4K';
      return;
    }
    const dimensionMatch = entry.trim().match(/^(\d{3,4})\s*[x×]\s*(\d{3,4})$/);
    if (dimensionMatch) {
      const width = Number(dimensionMatch[1]);
      const height = Number(dimensionMatch[2]);
      const max = Math.max(width, height);
      if (!Number.isNaN(max) && max > explicitMax) {
        explicitMax = max;
        explicitLabel = `${dimensionMatch[1]}×${dimensionMatch[2]}`;
      }
      return;
    }
    const pMatches = normalized.match(/(\d{3,4})p/g) ?? [];
    if (pMatches.length) {
      pMatches.forEach((match) => {
        const num = Number(match.replace('p', ''));
        if (!Number.isNaN(num)) explicitMax = Math.max(explicitMax, num);
      });
      return;
    }
    const matches = normalized.match(/(\d{3,4})/g) ?? [];
    matches.forEach((match) => {
      const num = Number(match);
      if (!Number.isNaN(num)) fallbackMax = Math.max(fallbackMax, num);
    });
  });
  const max = explicitMax || fallbackMax;
  if (!max) return { label: 'Data pending', value: null };
  if (explicitLabel) return { label: explicitLabel, value: max };
  return { label: `${max}p`, value: max };
}

export function extractMaxDuration(value?: string | null, fallback?: number | null) {
  if (typeof value === 'string') {
    const scopedValue = value
      .replace(/\([^)]*(?:source|intake)[^)]*\)/gi, ' ')
      .split(/[;,]/)
      .filter((segment) => !/\b(?:source|intake)\b/i.test(segment))
      .join(' ');
    const matches = Array.from(scopedValue.matchAll(/(\d+(?:\.\d+)?)\s*(?:s|sec(?:ond)?s?)\b/gi));
    const values = matches
      .map((match) => Number(match[1]))
      .filter((num) => !Number.isNaN(num));
    if (values.length) {
      const max = Math.max(...values);
      return { label: `${Number.isInteger(max) ? max : max.toFixed(1)}s`, value: max };
    }
  }
  if (typeof fallback === 'number') {
    return { label: `${fallback}s`, value: fallback };
  }
  return { label: 'Data pending', value: null };
}

export function getMinPricePerSecond(entry?: EngineCatalogEntry | null) {
  if (!entry?.engine) return null;
  const perSecond = entry.engine.pricingDetails?.perSecondCents;
  const candidates: number[] = [];
  if (typeof perSecond?.default === 'number') {
    candidates.push(applyDisplayedPriceMarginCents(perSecond.default));
    const audioOffDelta = entry.engine.pricingDetails?.addons?.audio_off?.perSecondCents;
    if (typeof audioOffDelta === 'number') {
      candidates.push(applyDisplayedPriceMarginCents(perSecond.default + audioOffDelta));
    }
  }
  if (perSecond?.byResolution) {
    Object.values(perSecond.byResolution).forEach((value) => {
      if (typeof value === 'number') candidates.push(applyDisplayedPriceMarginCents(value));
    });
  }
  if (typeof entry.engine.pricing?.base === 'number') {
    candidates.push(applyDisplayedPriceMarginCents(Math.round(entry.engine.pricing.base * 100)));
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

export function getPrelaunchPricingLabel(locale: AppLocale) {
  if (locale === 'fr') return 'Confirmé au lancement';
  if (locale === 'es') return 'Confirmado en lanzamiento';
  return 'TBD at launch';
}

export function getPrelaunchPricingNote(locale: AppLocale) {
  if (locale === 'fr') return 'Tarif final publié au lancement (date officielle à confirmer).';
  if (locale === 'es') return 'Precio final publicado en el lanzamiento (fecha oficial por confirmar).';
  return 'Final pricing will be published at launch (official date TBA).';
}

const SCORE_LABELS: Array<{ key: keyof EngineScore; label: string }> = [
  { key: 'fidelity', label: 'Prompt Adherence' },
  { key: 'visualQuality', label: 'Visual Quality' },
  { key: 'motion', label: 'Motion Realism' },
  { key: 'consistency', label: 'Temporal Consistency' },
  { key: 'anatomy', label: 'Human Fidelity' },
  { key: 'textRendering', label: 'Text & UI Legibility' },
  { key: 'lipsyncQuality', label: 'Audio & Lip Sync' },
  { key: 'sequencingQuality', label: 'Multi-Shot Sequencing' },
  { key: 'controllability', label: 'Controllability' },
  { key: 'speedStability', label: 'Speed & Stability' },
  { key: 'pricing', label: 'Pricing' },
];
export const SCORE_LABEL_KEYS = SCORE_LABELS.map((entry) => entry.key);
export const DEFAULT_SCORE_LABEL_MAP = SCORE_LABELS.reduce((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {} as Record<keyof EngineScore, string>);

export function computeOverall(score?: EngineScore | null) {
  if (!score) return null;
  const values = [score.fidelity, score.motion, score.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function deriveStrengths(score?: EngineScore | null, labels: Array<{ key: keyof EngineScore; label: string }> = SCORE_LABELS) {
  if (!score) return [];
  const entries = labels.map((entry) => {
    const value = score[entry.key];
    return typeof value === 'number' ? { label: entry.label, value } : null;
  }).filter((entry): entry is { label: string; value: number } => Boolean(entry));
  const nonPricing = entries.filter((entry) => entry.label !== 'Pricing');
  const pool = nonPricing.length ? nonPricing : entries;
  return pool
    .sort((a, b) => b.value - a.value)
    .slice(0, 2)
    .map((entry) => entry.label);
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const PROVIDER_LABEL_OVERRIDES: Record<string, string> = {
  'google-veo': 'Google',
  google: 'Google',
  openai: 'OpenAI',
  minimax: 'MiniMax',
  lightricks: 'Lightricks',
  bytedance: 'ByteDance',
  pika: 'Pika',
  kling: 'Kling',
  wan: 'Wan',
};

const PROVIDER_STRIP_IDS = new Set(['openai', 'google', 'google-veo', 'minimax']);

export function formatProviderLabel(entry: FalEngineEntry, catalogEntry?: EngineCatalogEntry | null) {
  const raw = entry.brandId ?? entry.engine.brandId ?? catalogEntry?.brandId ?? entry.provider;
  if (!raw) return '';
  const normalized = String(raw).toLowerCase();
  return PROVIDER_LABEL_OVERRIDES[normalized] ?? toTitleCase(raw);
}

export function stripProvider(name: string, provider: string, providerId?: string | null) {
  if (!provider || !providerId || !PROVIDER_STRIP_IDS.has(providerId)) return name;
  const normalizedName = name.toLowerCase();
  const normalizedProvider = provider.toLowerCase();
  if (normalizedName.startsWith(normalizedProvider)) {
    return name.slice(provider.length).trim();
  }
  return name;
}

export function clampDescription(value: string, maxLength = 110) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const sliced = trimmed.slice(0, maxLength - 1).trim();
  const lastSpace = sliced.lastIndexOf(' ');
  const safeSlice = lastSpace > Math.floor(maxLength * 0.65) ? sliced.slice(0, lastSpace).trim() : sliced;
  return `${safeSlice}…`;
}

export {
  DEFAULT_CAPABILITY_KEYWORDS,
  DEFAULT_VALUE_CAPABILITY_FALLBACK,
  DEFAULT_VALUE_CONJUNCTION,
  DEFAULT_VALUE_SENTENCE_BY_LOCALE,
  DEFAULT_VALUE_STRENGTHS_FALLBACK,
  MODEL_CARD_DESCRIPTION_OVERRIDES,
  USE_CASE_MAP,
} from './models-catalog-value-copy';

function formatTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

function joinWithConjunction(values: string[], conjunction: string) {
  if (!values.length) return '';
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} ${conjunction} ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} ${conjunction} ${values[values.length - 1]}`;
}

const SPEC_TOKEN_REGEX = /(\$\d+|\d+(?:\.\d+)?\s*s|\d+\s*seconds?|\d+\s*fps|\d+\s*p|\d+\s*×\s*\d+|4k|1080p|720p|2160p|\d+–\d+\s*s)/gi;
const PAREN_SPEC_REGEX = /\([^)]*?(\d|p|fps|\$)[^)]*\)/gi;

export function sanitizeDescription(text: string) {
  const withoutParens = text.replace(PAREN_SPEC_REGEX, '');
  const withoutTokens = withoutParens.replace(SPEC_TOKEN_REGEX, '');
  const withoutHints = withoutTokens.replace(/\b(up to|from)\b\s*/gi, '');
  const withoutFragments = withoutHints
    .replace(/\s*\/+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/([,.;:])\s*[-–]\s*/g, '$1 ')
    .replace(/\s{2,}/g, ' ');
  return withoutFragments.replace(/\s+$/, '').trim();
}

function capabilityKeywords(
  capabilities: string[],
  map: Record<string, string>,
  conjunction: string,
  fallback: string
) {
  const translated = capabilities.map((cap) => map[cap] ?? cap.toLowerCase());
  if (!translated.length) return fallback;
  return joinWithConjunction(translated, conjunction);
}

export function buildValueSentence({
  slug,
  strengths,
  capabilities,
  fallback,
  template,
  strengthsFallback,
  capabilityFallback,
  conjunction,
  useCaseMap,
  capabilityMap,
}: {
  slug: string;
  strengths: string[];
  capabilities: string[];
  fallback: string;
  template: string;
  strengthsFallback: string;
  capabilityFallback: string;
  conjunction: string;
  useCaseMap: Record<string, string>;
  capabilityMap: Record<string, string>;
}) {
  const useCase = useCaseMap[slug] ?? fallback;
  const cleanedUseCase = sanitizeDescription(useCase);
  const strengthsText = strengths.length ? joinWithConjunction(strengths, conjunction) : strengthsFallback;
  const capabilityText = capabilityKeywords(capabilities, capabilityMap, conjunction, capabilityFallback);
  return formatTemplate(template, {
    useCase: cleanedUseCase,
    strengths: strengthsText,
    capabilities: capabilityText,
  });
}

type EngineTypeKey = 'textImage' | 'text' | 'imageVideo' | 'image' | 'default';

const ENGINE_TYPE_KEYS: EngineTypeKey[] = ['textImage', 'text', 'imageVideo', 'image', 'default'];

export function getEngineTypeKey(entry: FalEngineEntry): EngineTypeKey {
  if (entry.type && ENGINE_TYPE_KEYS.includes(entry.type as EngineTypeKey)) return entry.type as EngineTypeKey;
  const modes = new Set(entry.engine.modes);
  const hasTextVideo = modes.has('t2v') || modes.has('a2v');
  const hasImageVideo =
    modes.has('i2v') || modes.has('v2v') || modes.has('reframe') || modes.has('r2v') || modes.has('retake') || entry.engine.keyframes;
  if (isImageOnlyModel(entry)) return 'image';
  if (hasTextVideo && hasImageVideo) return 'textImage';
  if (hasTextVideo) return 'text';
  if (hasImageVideo || supportsVideoGeneration(entry)) return 'imageVideo';
  return 'default';
}

export function getEngineDisplayName(entry: FalEngineEntry): string {
  const name = entry.marketingName ?? entry.engine.label;
  return name
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s+Text to Video$/i, '')
    .replace(/\s+Image to Video$/i, '')
    .trim();
}

function sentenceCaseHeroPart(value: string) {
  const trimmed = value.trim().replace(/[.。]+$/, '');
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

export function splitModelsHeroTitle(title: string) {
  const parenMatch = title.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (parenMatch) {
    return {
      lead: sentenceCaseHeroPart(parenMatch[1]),
      accent: sentenceCaseHeroPart(parenMatch[2]),
    };
  }
  const colonIndex = title.indexOf(':');
  if (colonIndex > 0) {
    return {
      lead: sentenceCaseHeroPart(title.slice(0, colonIndex)),
      accent: sentenceCaseHeroPart(title.slice(colonIndex + 1)),
    };
  }
  return {
    lead: sentenceCaseHeroPart(title),
    accent: '',
  };
}

export function splitHeroAccentTitle(accent: string) {
  const normalized = accent.trim();
  const prefixMatch = normalized.match(/^(All|Toutes les|Todos los|Todas las)\s+(.+)$/i);
  if (!prefixMatch) {
    return { prefix: '', emphasis: normalized };
  }
  return {
    prefix: `${prefixMatch[1]} `,
    emphasis: prefixMatch[2],
  };
}
