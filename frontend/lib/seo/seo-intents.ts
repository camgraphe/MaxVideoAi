import { MODEL_FAMILIES, type ModelFamilyDefinition } from '../../config/model-families';
import type {
  SeoFamilyDictionaryEntry,
  SeoFamilyStatus,
  SeoIntentType,
  StrategicSeoFamily,
} from './internal-seo-types';

export const STRATEGIC_FAMILY_ORDER: StrategicSeoFamily[] = [
  'Seedance',
  'Kling',
  'Veo',
  'LTX',
  'Pika',
  'Wan',
  'Hailuo / Minimax',
  'Sora',
];

const STRATEGIC_FAMILY_LABELS = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);
const SUPPORTED_FAMILY_LABELS = new Set(['Pika', 'Wan', 'Hailuo / Minimax', 'Luma Ray']);
const EMERGING_FAMILY_LABELS = new Set(['Happy Horse']);
const DEPRIORITIZED_FAMILY_LABELS = new Set(['Sora']);

export const BUSINESS_PRIORITY_WEIGHTS: Record<string, number> = {
  Seedance: 1.35,
  Kling: 1.25,
  Veo: 1.16,
  LTX: 1.1,
  Pika: 1,
  Wan: 0.96,
  'Hailuo / Minimax': 0.94,
  'Luma Ray': 0.9,
  'Happy Horse': 0.88,
  Sora: 0.62,
  Brand: 1.18,
  Other: 0.82,
};

export function normalizeSeoQuery(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s./-]+/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectStrategicModelFamily(query?: string | null, page?: string | null): StrategicSeoFamily {
  const queryText = normalizeSeoQuery(query);
  const pagePath = normalizeSeoQuery(extractUrlPath(page));
  const haystack = `${queryText} ${pagePath}`.trim();
  if (isBrandQuery(queryText) || isBrandTypoQuery(queryText)) return 'Brand';

  const matches = getSeoFamilyDictionary()
    .flatMap((entry) =>
      entry.aliases
        .map((alias) => ({ entry, alias, index: aliasMatchIndex(alias, haystack) }))
        .filter((match) => match.index >= 0)
    )
    .sort((a, b) => a.index - b.index || b.alias.length - a.alias.length || a.entry.businessPriorityRank - b.entry.businessPriorityRank);
  return matches[0]?.entry.label ?? 'Other';
}

export function classifySeoIntent(query?: string | null, page?: string | null): SeoIntentType {
  const queryText = normalizeSeoQuery(query);
  const haystack = normalizeSeoQuery(`${query ?? ''} ${page ?? ''}`);

  if (isBrandTypoQuery(queryText)) return 'brand_typo';
  if (isBrandQuery(queryText)) return 'brand';
  if (/\bvs\b|\bversus\b|\bcompare\b|\bcomparison\b|\bdifference\b|\balternative\b|\balternatives\b/.test(haystack)) {
    return 'comparison';
  }
  if (/\bpay as you go\b|\bno subscription\b|\bwithout subscription\b|\bno monthly\b|\bsubscription free\b/.test(haystack)) {
    return 'pay_as_you_go';
  }
  if (/\bprompt guide\b|\bhow to prompt\b|\bprompt structure\b|\bprompting\b/.test(haystack)) return 'prompt_guide';
  if (/\bprompts?\b|\bprompt examples?\b/.test(haystack)) return 'prompt_examples';
  if (/\bexamples?\b|\bsamples?\b|\bgallery\b|\/examples(?:\/|$)/.test(haystack)) return 'examples';
  if (/\bmax length\b|\bmaximum length\b|\bvideo length\b|\bduration\b|\bseconds\b/.test(haystack)) return 'max_length';
  if (/\bparameters?\b|\bmodel size\b|\bsize of model\b/.test(haystack)) return 'model_parameters';
  if (/\bspecs?\b|\bspecifications?\b|\bresolution\b|\baspect ratio\b|\bfps\b|\blimits?\b/.test(haystack)) return 'specs';
  if (/\bprice\b|\bpricing\b|\bcost\b|\bcredits?\b|\bfree\b|\bcheap\b/.test(haystack)) return 'pricing';
  if (/\bimage to video\b|\bimage-to-video\b|\bi2v\b/.test(haystack)) return 'image_to_video';
  if (/\btext to video\b|\btext-to-video\b|\bt2v\b/.test(haystack)) return 'text_to_video';
  if (/\bcamera movement\b|\bcamera motion\b|\bcamera controls?\b|\bpan\b|\bzoom\b|\bdolly\b/.test(haystack)) {
    return 'camera_movement';
  }
  if (/\bfirst frame\b|\blast frame\b|\bstart frame\b|\bend frame\b|\bkeyframe\b/.test(haystack)) return 'first_last_frame';
  if (/\bproduct ads?\b|\bproduct advertisement\b|\bcommercial\b|\bad creative\b/.test(haystack)) {
    return 'product_advertisement';
  }
  if (/\brealistic humans?\b|\brealistic people\b|\bhuman video\b|\bface\b/.test(haystack)) return 'realistic_humans';
  if (/\bbest ai video generator\b|\bbest video generator\b|\btop ai video\b/.test(haystack)) return 'best_ai_video_generator';
  if (/\/models(?:\/|$)|\bmodel\b/.test(haystack)) return 'model_page';
  return 'generic';
}

export function isStrategicIntent(intent: SeoIntentType): boolean {
  return (
    intent === 'comparison' ||
    intent === 'pricing' ||
    intent === 'specs' ||
    intent === 'pricing_specs' ||
    intent === 'prompt_examples' ||
    intent === 'prompt_guide' ||
    intent === 'pay_as_you_go' ||
    intent === 'examples' ||
    intent === 'max_length' ||
    intent === 'brand_typo'
  );
}

export function getBusinessPriorityWeight(family: StrategicSeoFamily): number {
  return BUSINESS_PRIORITY_WEIGHTS[family] ?? BUSINESS_PRIORITY_WEIGHTS.Other;
}

export function getFamilyPriorityRank(family: StrategicSeoFamily): number {
  const dynamicFamily = getSeoFamilyDictionary().find((entry) => entry.label === family);
  if (dynamicFamily) return dynamicFamily.businessPriorityRank;
  if (family === 'Brand') return 90;
  return 99;
}

export function getFamilyPriorityLabel(family: StrategicSeoFamily): string {
  const status = getSeoFamilyStatus(family);
  if (status === 'strategic') {
    const rank = getFamilyPriorityRank(family);
    return rank >= 1 && rank <= 4 ? `Strategic priority ${rank}` : 'Strategic priority';
  }
  if (status === 'supported') return 'Supported / active';
  if (status === 'emerging') return 'Emerging / niche';
  if (status === 'deprioritized') return 'De-prioritized';
  if (status === 'brand') return 'Brand defense';
  return 'Unknown / emerging models';
}

export function getSeoFamilyStatus(family: StrategicSeoFamily): SeoFamilyStatus {
  if (family === 'Brand') return 'brand';
  if (family === 'Other') return 'unknown';
  return getSeoFamilyDictionary().find((entry) => entry.label === family)?.status ?? 'unknown';
}

export function getSeoFamilyDictionary(): SeoFamilyDictionaryEntry[] {
  return (MODEL_FAMILIES as readonly ModelFamilyDefinition[]).map((family) => {
    const label = canonicalSeoFamilyLabel(family.id, family.label);
    const currentModelSlugs = Array.from(
      new Set([
        ...(family.examplesPage?.currentModelSlugs ?? []),
        family.defaultModelSlug,
      ].filter((value): value is string => Boolean(value)))
    );
    const publishedModelSlugs = Array.from(
      new Set([
        ...(family.examplesPage?.publishedModelSlugs ?? []),
        ...(family.routeAliases ?? []),
        family.defaultModelSlug,
      ].filter((value): value is string => Boolean(value)))
    );
    const modelSlugs = Array.from(
      new Set([
        family.defaultModelSlug,
        ...(family.routeAliases ?? []),
        ...publishedModelSlugs,
        ...currentModelSlugs,
      ].filter((value): value is string => Boolean(value)))
    );
    const aliases = Array.from(
      new Set(
        [
          family.id,
          family.label,
          family.navLabel,
          family.brandId,
          family.defaultModelSlug,
          ...(family.routeAliases ?? []),
          ...(family.aliases ?? []),
          ...(family.prefixes ?? []),
          ...(family.contains ?? []),
          ...modelSlugs,
          ...expandSeoAliases(family.id, family.label, family.navLabel),
        ]
          .filter((value): value is string => Boolean(value))
          .map(normalizeSeoQuery)
          .filter(Boolean)
      )
    ).sort((a, b) => b.length - a.length);

    return {
      id: family.id,
      label,
      status: resolveFamilyStatus(label),
      aliases,
      modelSlugs,
      currentModelSlugs,
      publishedModelSlugs,
      defaultModelSlug: family.defaultModelSlug ?? null,
      businessPriorityWeight: getBusinessPriorityWeight(label),
      businessPriorityRank: resolveFamilyRank(label),
    };
  }).sort((a, b) => a.businessPriorityRank - b.businessPriorityRank || a.label.localeCompare(b.label));
}

export function compactIntentLabel(intent: SeoIntentType): string {
  return intent
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function canonicalSeoFamilyLabel(id: string, label: string): StrategicSeoFamily {
  if (id === 'hailuo') return 'Hailuo / Minimax';
  if (id === 'luma') return 'Luma Ray';
  return label;
}

function resolveFamilyStatus(label: StrategicSeoFamily): SeoFamilyStatus {
  if (STRATEGIC_FAMILY_LABELS.has(label)) return 'strategic';
  if (SUPPORTED_FAMILY_LABELS.has(label)) return 'supported';
  if (EMERGING_FAMILY_LABELS.has(label)) return 'emerging';
  if (DEPRIORITIZED_FAMILY_LABELS.has(label)) return 'deprioritized';
  return 'supported';
}

function resolveFamilyRank(label: StrategicSeoFamily): number {
  const index = STRATEGIC_FAMILY_ORDER.indexOf(label);
  if (index >= 0) return index + 1;
  if (label === 'Happy Horse') return 9;
  if (label === 'Luma Ray') return 10;
  if (label === 'Brand') return 90;
  if (label === 'Other') return 99;
  return 20;
}

function expandSeoAliases(id: string, label: string, navLabel: string): string[] {
  const aliases = [label.replace(/\s+/g, ''), navLabel.replace(/\s+/g, '')];
  if (id === 'hailuo') aliases.push('minimax', 'mini max', 'minimax hailuo', 'hailuo 02');
  if (id === 'happy-horse') aliases.push('happy horse', 'happyhorse', 'happy horse 1.0', 'happy horse 1 0', 'alibaba happy horse');
  if (id === 'luma') aliases.push('luma ray', 'luma ray 2', 'ray 2');
  return aliases;
}

function aliasMatchIndex(alias: string, haystack: string): number {
  if (!alias) return -1;
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '[\\s./-]+');
  const match = new RegExp(`(^|[\\s/.-])${escaped}($|[\\s/.-])`, 'i').exec(haystack);
  return match?.index ?? -1;
}

function isBrandQuery(query: string): boolean {
  return /\bmax\s*video\s*ai\b|\bmaxvideoai\b|\bmaxvideo\b/.test(query);
}

function isBrandTypoQuery(query: string): boolean {
  return /\bmaxvedio\b|\bmaxvideos\b|\bmax videoa\b|\bmaxvideai\b|\bmax vidio\b/.test(query);
}

function extractUrlPath(value?: string | null): string {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return `${parsed.pathname} ${parsed.search}`;
  } catch {
    return value;
  }
}
