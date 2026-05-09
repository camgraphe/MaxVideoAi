import type {
  InternalLinkRecommendationType,
  SeoIntentType,
  SeoPageType,
  SeoQueryCluster,
  SeoSourceMetrics,
  StrategicSeoFamily,
} from './internal-seo-types';
import { getSeoFamilyDictionary, normalizeSeoQuery } from './seo-intents';
import { stripOrigin } from './seo-opportunity-engine';

type InternalLinkDraftLike = {
  recommendationType: InternalLinkRecommendationType;
  sourceUrl: string;
  targetUrl: string;
  sourceType: SeoPageType;
  family: StrategicSeoFamily;
};

const STRATEGIC_FAMILIES = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);

export function inferModelSlug(
  cluster: SeoQueryCluster,
  familyEntry: ReturnType<typeof getSeoFamilyDictionary>[number] | undefined
) {
  const targetPath = normalizePath(stripOrigin(cluster.targetUrl));
  if (targetPath.startsWith('/models/')) return targetPath.split('/').filter(Boolean)[1] ?? null;
  if (!familyEntry) return null;

  const haystack = normalizeSeoQuery(`${cluster.representativeQueries.join(' ')} ${targetPath}`);
  const modelSlug = familyEntry.modelSlugs
    .slice()
    .sort((a, b) => b.length - a.length)
    .find((slug) => aliasInHaystack(slug, haystack) || aliasInHaystack(humanizeModelSlug(slug), haystack));

  return preferCurrentModelSlug(modelSlug ?? null, familyEntry);
}

function preferCurrentModelSlug(
  candidateSlug: string | null,
  familyEntry: ReturnType<typeof getSeoFamilyDictionary>[number]
) {
  const currentSlugs = familyEntry.currentModelSlugs.length
    ? familyEntry.currentModelSlugs
    : familyEntry.defaultModelSlug
      ? [familyEntry.defaultModelSlug]
      : [];
  if (!candidateSlug) return currentSlugs[0] ?? familyEntry.defaultModelSlug;
  if (currentSlugs.includes(candidateSlug)) return candidateSlug;

  const defaultSlug = familyEntry.defaultModelSlug;
  if (defaultSlug && currentSlugs.includes(defaultSlug) && defaultSlug.startsWith(candidateSlug)) {
    return defaultSlug;
  }

  return currentSlugs.find((slug) => slug.startsWith(candidateSlug)) ?? candidateSlug;
}

export function buildExamplesToModelAnchor(cluster: SeoQueryCluster, family: StrategicSeoFamily, modelSlug: string) {
  const modelName = chooseModelName(cluster, modelSlug);
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') return `${modelName} prompt examples and specs`;
  if (cluster.intent === 'examples') return `${modelName} examples and specs`;
  return `${family} model specs`;
}

export function buildModelToExamplesAnchor(cluster: SeoQueryCluster, family: StrategicSeoFamily, modelSlug: string) {
  const modelName = chooseModelName(cluster, modelSlug);
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') return `${modelName} prompt examples`;
  if (cluster.intent === 'examples') return `${modelName} examples`;
  return `${family} examples`;
}

export function buildHubAnchor(cluster: SeoQueryCluster, modelSlug: string) {
  const modelName = chooseModelName(cluster, modelSlug);
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') return `${modelName} prompt examples`;
  if (cluster.intent === 'comparison') return `${modelName} comparison`;
  if (cluster.intent === 'pricing' || cluster.intent === 'pricing_specs') return `${modelName} pricing and specs`;
  return `${modelName} model details`;
}

function chooseModelName(cluster: SeoQueryCluster, modelSlug: string) {
  const queryText = cluster.representativeQueries.join(' ');
  const versionMatch = queryText.match(/\b(?:ltx|seedance|veo|kling|pika|wan|sora|happy horse|hailuo|minimax|luma|ray)\s+(?:v)?\d+(?:[.\s-]\d+){0,2}(?:\s+(?:fast|lite|pro|standard|flash))?\b/i);
  if (versionMatch) return titleize(versionMatch[0]);
  return humanizeModelSlug(modelSlug);
}

export function humanizeModelSlug(slug: string) {
  return slug
    .split('-')
    .map((part) => {
      if (/^\d+$/.test(part)) return part;
      if (part === 'ltx') return 'LTX';
      if (part === 'veo') return 'Veo';
      if (part === 'wan') return 'Wan';
      if (part === 'pika') return 'Pika';
      if (part === 'sora') return 'Sora';
      if (part === 'kling') return 'Kling';
      if (part === 'seedance') return 'Seedance';
      if (part === 'minimax') return 'MiniMax';
      if (part === 'hailuo') return 'Hailuo';
      if (part === 'luma') return 'Luma';
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ')
    .replace(/\b2 3\b/g, '2.3')
    .replace(/\b3 1\b/g, '3.1')
    .replace(/\b2 0\b/g, '2.0')
    .replace(/\b1 5\b/g, '1.5')
    .replace(/\b1 0\b/g, '1.0');
}

export function isPromptOrExamplesIntent(intent: SeoIntentType) {
  return intent === 'prompt_examples' || intent === 'prompt_guide' || intent === 'examples';
}

export function isModelPageIntent(intent: SeoIntentType) {
  return isPromptOrExamplesIntent(intent) || intent === 'model_page' || intent === 'pricing_specs' || intent === 'specs';
}

export function isLinkableIntent(intent: SeoIntentType) {
  return (
    isPromptOrExamplesIntent(intent) ||
    intent === 'comparison' ||
    intent === 'pricing' ||
    intent === 'pricing_specs' ||
    intent === 'pay_as_you_go' ||
    intent === 'specs' ||
    intent === 'max_length' ||
    intent === 'image_to_video' ||
    intent === 'text_to_video' ||
    intent === 'model_page'
  );
}

export function isExpectedExistingLinkPattern(draft: InternalLinkDraftLike) {
  if (draft.recommendationType === 'compare_to_model' && draft.sourceType === 'compare_page') return true;
  if (draft.recommendationType === 'model_to_examples' && draft.sourceType === 'model_page') return true;
  if (
    (draft.recommendationType === 'examples_to_model' || draft.recommendationType === 'hub_to_opportunity') &&
    (draft.sourceType === 'family_examples' || draft.sourceType === 'examples_hub' || draft.sourceType === 'models_hub') &&
    getSeoFamilyDictionary().some(
      (entry) =>
        entry.label === draft.family &&
        entry.currentModelSlugs.includes(draft.targetUrl.replace('/models/', ''))
    )
  ) {
    return true;
  }
  return false;
}

export function isStrategicInternalLinkFamily(family: StrategicSeoFamily) {
  return STRATEGIC_FAMILIES.has(family);
}

export function normalizePath(value: string | null) {
  if (!value || value === 'No target URL') return '';
  return value.split('?')[0].replace(/\/$/, '') || '/';
}

function aliasInHaystack(alias: string, haystack: string) {
  const normalized = normalizeSeoQuery(alias);
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\ /g, '[\\s./-]+');
  return new RegExp(`(^|[\\s/.-])${escaped}($|[\\s/.-])`, 'i').test(haystack);
}

function titleize(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bLtx\b/g, 'LTX');
}

export function signalKey(targetUrl: string | null, cluster: string) {
  return `${normalizePath(stripOrigin(targetUrl))}|${normalizeSeoQuery(cluster)}`;
}

export function formatMetrics(metrics: SeoSourceMetrics) {
  return [
    `${metrics.clicks} clicks`,
    `${metrics.impressions} impressions`,
    `${(metrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${metrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

export function priorityRank(priority: 'critical' | 'high' | 'medium' | 'low') {
  if (priority === 'critical') return 1;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 3;
  return 4;
}

export function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
