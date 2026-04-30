import type { GscPerformanceRow } from './gsc-analysis';
import type {
  CtrDoctorItem,
  InternalLinkRecommendationType,
  InternalLinkSuggestion,
  MissingContentItem,
  SeoActionPriority,
  SeoIntentType,
  SeoPageType,
  SeoQueryCluster,
  SeoSourceMetrics,
  StrategicSeoFamily,
  StrategicSeoOpportunity,
} from './internal-seo-types';
import { classifyMissingContentIntent } from './missing-content';
import {
  getBusinessPriorityWeight,
  getSeoFamilyDictionary,
  getSeoFamilyStatus,
  normalizeSeoQuery,
} from './seo-intents';
import { clusterGscQueries, stripOrigin } from './seo-opportunity-engine';

const MIN_LINK_IMPRESSIONS = 25;
const MAX_SUGGESTIONS = 80;
const STRATEGIC_FAMILIES = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);

type BuildInternalLinkOptions = {
  rows: GscPerformanceRow[];
  opportunities?: StrategicSeoOpportunity[];
  ctrDoctorItems?: CtrDoctorItem[];
  missingContentItems?: MissingContentItem[];
};

type LinkDraft = Omit<InternalLinkSuggestion, 'id' | 'priority' | 'score' | 'codexTaskDraft' | 'acceptanceCriteria'> & {
  typeBoost: number;
};

export function buildInternalLinkSuggestions(options: BuildInternalLinkOptions): InternalLinkSuggestion[] {
  const clusters = clusterGscQueries(options.rows);
  const context = buildSignalContext(options);
  const drafts: LinkDraft[] = [];

  for (const cluster of clusters) {
    if (!clusterIsWorthInternalLinks(cluster, context)) continue;
    if (classifyMissingContentIntent(cluster) === 'irrelevant_junk') continue;

    drafts.push(...buildClusterLinkDrafts(cluster));
  }

  return dedupeSuggestions(
    drafts
      .map((draft) => finalizeSuggestion(draft))
      .filter((suggestion) => suggestion.sourceUrl !== suggestion.targetUrl)
  )
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score)
    .slice(0, MAX_SUGGESTIONS);
}

export function formatInternalLinkMarkdown(item: InternalLinkSuggestion): string {
  return [
    'Title:',
    `Add or verify internal link from ${item.sourceUrl} to ${item.targetUrl}`,
    '',
    'Source:',
    `GSC query cluster: ${item.representativeQueries.map((query) => `"${query}"`).join(', ')}`,
    `Metrics: ${formatMetrics(item.currentMetrics)}`,
    '',
    'Recommended link:',
    `Source page: ${item.sourceUrl}`,
    `Target page: ${item.targetUrl}`,
    `Anchor text: ${item.suggestedAnchor}`,
    '',
    'Reason:',
    item.reason,
    '',
    'Implementation note:',
    item.verifyExistingLinkFirst
      ? 'Verify whether this internal link already exists first. If it exists with clear anchor text, refine only if needed instead of adding a duplicate link.'
      : 'Add the link where it naturally helps users move between related MaxVideoAI pages.',
    '',
    'Acceptance criteria:',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatInternalLinkSectionMarkdown(items: InternalLinkSuggestion[]): string {
  if (!items.length) {
    return ['# Internal Link Suggestions', '', 'No internal link suggestions generated for this snapshot.'].join('\n');
  }

  return [
    '# Internal Link Suggestions',
    '',
    `Generated suggestions: ${items.length}`,
    '',
    ...items.map((item, index) => [`## ${index + 1}. ${item.sourceUrl} -> ${item.targetUrl}`, '', formatInternalLinkMarkdown(item)].join('\n')),
  ].join('\n\n');
}

export function labelizeInternalLinkType(value: InternalLinkRecommendationType) {
  if (value === 'family_hub_to_model') return 'Family hub to model';
  if (value === 'model_to_examples') return 'Model to examples';
  if (value === 'compare_to_model') return 'Compare to model';
  if (value === 'examples_to_model') return 'Examples to model';
  if (value === 'pricing_to_model') return 'Pricing to model';
  return 'Hub to opportunity';
}

export function labelizePageType(value: SeoPageType) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildSignalContext(options: BuildInternalLinkOptions) {
  const keys = new Set<string>();
  for (const opportunity of options.opportunities ?? []) {
    keys.add(signalKey(opportunity.targetUrl, opportunity.queryCluster));
  }
  for (const item of options.ctrDoctorItems ?? []) {
    keys.add(signalKey(item.targetUrl, item.queryCluster));
  }
  for (const item of options.missingContentItems ?? []) {
    keys.add(signalKey(item.targetUrl, item.queryCluster));
  }
  return keys;
}

function clusterIsWorthInternalLinks(cluster: SeoQueryCluster, context: Set<string>) {
  if (context.has(signalKey(cluster.targetUrl, cluster.label))) return true;
  if (cluster.metrics.impressions >= MIN_LINK_IMPRESSIONS && isLinkableIntent(cluster.intent)) return true;
  if (cluster.modelFamily !== 'Other' && cluster.modelFamily !== 'Brand' && cluster.metrics.impressions >= 40) return true;
  return false;
}

function buildClusterLinkDrafts(cluster: SeoQueryCluster): LinkDraft[] {
  const familyEntry = getSeoFamilyDictionary().find((entry) => entry.label === cluster.modelFamily);
  const targetPath = normalizePath(stripOrigin(cluster.targetUrl));
  const modelSlug = inferModelSlug(cluster, familyEntry);
  const familyExamplesPath = familyEntry ? `/examples/${familyEntry.id}` : null;
  const modelPath = modelSlug ? `/models/${modelSlug}` : null;
  const drafts: LinkDraft[] = [];

  if (targetPath.startsWith('/ai-video-engines/')) {
    drafts.push(...buildCompareToModelDrafts(cluster, targetPath));
  }

  if (familyEntry && modelPath && familyExamplesPath && modelSlug) {
    if (targetPath === familyExamplesPath || targetPath.startsWith(`${familyExamplesPath}/`) || isPromptOrExamplesIntent(cluster.intent)) {
      drafts.push({
        recommendationType: 'examples_to_model',
        sourceUrl: familyExamplesPath,
        targetUrl: modelPath,
        sourceType: 'family_examples',
        targetType: 'model_page',
        suggestedAnchor: buildExamplesToModelAnchor(cluster, familyEntry.label, modelSlug),
        reason: `${cluster.label} has ${formatMetrics(cluster.metrics)}. Route users from examples demand to the matching model/spec page so they can evaluate capabilities before generating.`,
        relatedQueryCluster: cluster.label,
        representativeQueries: cluster.representativeQueries,
        family: cluster.modelFamily,
        intent: cluster.intent,
        currentMetrics: cluster.metrics,
        verifyExistingLinkFirst: true,
        typeBoost: 14,
      });
      drafts.push({
        recommendationType: 'model_to_examples',
        sourceUrl: modelPath,
        targetUrl: familyExamplesPath,
        sourceType: 'model_page',
        targetType: 'family_examples',
        suggestedAnchor: buildModelToExamplesAnchor(cluster, familyEntry.label, modelSlug),
        reason: `${cluster.label} shows practical examples or prompt intent. Give the model page a clear path to the matching examples page without turning the model copy into a gallery.`,
        relatedQueryCluster: cluster.label,
        representativeQueries: cluster.representativeQueries,
        family: cluster.modelFamily,
        intent: cluster.intent,
        currentMetrics: cluster.metrics,
        verifyExistingLinkFirst: true,
        typeBoost: 12,
      });
    }

    if (targetPath === modelPath && isModelPageIntent(cluster.intent)) {
      drafts.push({
        recommendationType: 'model_to_examples',
        sourceUrl: modelPath,
        targetUrl: familyExamplesPath,
        sourceType: 'model_page',
        targetType: 'family_examples',
        suggestedAnchor: buildModelToExamplesAnchor(cluster, familyEntry.label, modelSlug),
        reason: `${cluster.label} is already landing on the model page. A contextual examples link can help users continue to proof and prompt patterns for the same family.`,
        relatedQueryCluster: cluster.label,
        representativeQueries: cluster.representativeQueries,
        family: cluster.modelFamily,
        intent: cluster.intent,
        currentMetrics: cluster.metrics,
        verifyExistingLinkFirst: true,
        typeBoost: 8,
      });
    }

    if ((cluster.intent === 'pricing' || cluster.intent === 'pricing_specs' || cluster.intent === 'pay_as_you_go') && targetPath === '/pricing') {
      drafts.push({
        recommendationType: 'pricing_to_model',
        sourceUrl: '/pricing',
        targetUrl: modelPath,
        sourceType: 'pricing',
        targetType: 'model_page',
        suggestedAnchor: `${humanizeModelSlug(modelSlug)} pricing and specs`,
        reason: `${cluster.label} ties pricing/spec demand to ${cluster.modelFamily}. Keep pricing concise, but give users a path to the relevant model page when it helps clarify capability and value.`,
        relatedQueryCluster: cluster.label,
        representativeQueries: cluster.representativeQueries,
        family: cluster.modelFamily,
        intent: cluster.intent,
        currentMetrics: cluster.metrics,
        verifyExistingLinkFirst: true,
        typeBoost: 6,
      });
    }
  }

  if (modelPath && modelSlug && STRATEGIC_FAMILIES.has(cluster.modelFamily) && cluster.metrics.impressions >= 90 && isLinkableIntent(cluster.intent)) {
    const sourceUrl = isPromptOrExamplesIntent(cluster.intent) ? '/examples' : '/models';
    drafts.push({
      recommendationType: 'hub_to_opportunity',
      sourceUrl,
      targetUrl: modelPath,
      sourceType: sourceUrl === '/examples' ? 'examples_hub' : 'models_hub',
      targetType: 'model_page',
      suggestedAnchor: buildHubAnchor(cluster, modelSlug),
      reason: `${cluster.label} has enough strategic demand to consider a small hub-level path, after confirming the existing hub does not already surface it clearly.`,
      relatedQueryCluster: cluster.label,
      representativeQueries: cluster.representativeQueries,
      family: cluster.modelFamily,
      intent: cluster.intent,
      currentMetrics: cluster.metrics,
      verifyExistingLinkFirst: true,
      typeBoost: 4,
    });
  }

  return drafts;
}

function buildCompareToModelDrafts(cluster: SeoQueryCluster, comparePath: string): LinkDraft[] {
  const slug = comparePath.split('/').filter(Boolean)[1] ?? '';
  if (!slug.includes('-vs-')) return [];
  const [leftSlug, rightSlug] = slug.split('-vs-');
  if (!leftSlug || !rightSlug) return [];

  return [leftSlug, rightSlug].map((modelSlug) => ({
    recommendationType: 'compare_to_model',
    sourceUrl: comparePath,
    targetUrl: `/models/${modelSlug}`,
    sourceType: 'compare_page',
    targetType: 'model_page',
    suggestedAnchor: `${humanizeModelSlug(modelSlug)} specs`,
    reason: `${cluster.label} is comparison intent. The compare page should offer clear routes to each compared model page so users can inspect specs, examples, and generation options.`,
    relatedQueryCluster: cluster.label,
    representativeQueries: cluster.representativeQueries,
    family: cluster.modelFamily,
    intent: 'comparison',
    currentMetrics: cluster.metrics,
    verifyExistingLinkFirst: true,
    typeBoost: 16,
  }));
}

function finalizeSuggestion(draft: LinkDraft): InternalLinkSuggestion {
  const score = calibrateScore(draft, scoreSuggestion(draft));
  const suggestionWithoutDraft: Omit<InternalLinkSuggestion, 'codexTaskDraft'> = {
    id: `${draft.recommendationType}_${stableId(`${draft.sourceUrl}|${draft.targetUrl}|${draft.relatedQueryCluster}|${draft.suggestedAnchor}`)}`,
    priority: scoreToPriority(score),
    score,
    recommendationType: draft.recommendationType,
    sourceUrl: draft.sourceUrl,
    targetUrl: draft.targetUrl,
    sourceType: draft.sourceType,
    targetType: draft.targetType,
    suggestedAnchor: draft.suggestedAnchor,
    reason: draft.reason,
    relatedQueryCluster: draft.relatedQueryCluster,
    representativeQueries: draft.representativeQueries,
    family: draft.family,
    intent: draft.intent,
    currentMetrics: draft.currentMetrics,
    verifyExistingLinkFirst: draft.verifyExistingLinkFirst,
    acceptanceCriteria: buildAcceptanceCriteria(draft),
  };

  return {
    ...suggestionWithoutDraft,
    codexTaskDraft: formatInternalLinkMarkdown(suggestionWithoutDraft as InternalLinkSuggestion),
  };
}

function scoreSuggestion(draft: LinkDraft) {
  const { impressions, ctr, averagePosition } = draft.currentMetrics;
  const impressionsScore = Math.min(34, Math.log10(Math.max(impressions, 1)) * 14);
  const positionScore = averagePosition <= 6 ? 18 : averagePosition <= 12 ? 14 : averagePosition <= 30 ? 6 : -14;
  const intentScore = isLinkableIntent(draft.intent) ? 14 : 4;
  const lowCtrScore = Math.max(0, Math.min(10, (0.04 - ctr) * 260));
  const repeatScore = Math.min(8, draft.representativeQueries.length * 2);
  return Math.round(
    (impressionsScore + positionScore + intentScore + lowCtrScore + repeatScore + draft.typeBoost) *
      getBusinessPriorityWeight(draft.family)
  );
}

function calibrateScore(draft: LinkDraft, rawScore: number) {
  const status = getSeoFamilyStatus(draft.family);
  const { impressions, averagePosition } = draft.currentMetrics;
  if (impressions < 20) return Math.min(rawScore, 48);
  if (isExpectedExistingLinkPattern(draft)) return Math.min(rawScore, 48);
  if (averagePosition >= 30 && impressions < 250) return Math.min(rawScore, 46);
  if (draft.family === 'Sora') return Math.min(rawScore, impressions >= 250 ? 62 : 48);
  if (status === 'emerging' && impressions < 80) return Math.min(rawScore, 48);
  if (status === 'emerging') return Math.min(rawScore, 62);
  if (draft.recommendationType === 'hub_to_opportunity' && impressions < 140) return Math.min(rawScore, 58);
  return rawScore;
}

function scoreToPriority(score: number): SeoActionPriority {
  if (score >= 104) return 'critical';
  if (score >= 76) return 'high';
  if (score >= 52) return 'medium';
  return 'low';
}

function inferModelSlug(
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

function buildExamplesToModelAnchor(cluster: SeoQueryCluster, family: StrategicSeoFamily, modelSlug: string) {
  const modelName = chooseModelName(cluster, modelSlug);
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') return `${modelName} prompt examples and specs`;
  if (cluster.intent === 'examples') return `${modelName} examples and specs`;
  return `${family} model specs`;
}

function buildModelToExamplesAnchor(cluster: SeoQueryCluster, family: StrategicSeoFamily, modelSlug: string) {
  const modelName = chooseModelName(cluster, modelSlug);
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') return `${modelName} prompt examples`;
  if (cluster.intent === 'examples') return `${modelName} examples`;
  return `${family} examples`;
}

function buildHubAnchor(cluster: SeoQueryCluster, modelSlug: string) {
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

function humanizeModelSlug(slug: string) {
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

function isPromptOrExamplesIntent(intent: SeoIntentType) {
  return intent === 'prompt_examples' || intent === 'prompt_guide' || intent === 'examples';
}

function isModelPageIntent(intent: SeoIntentType) {
  return isPromptOrExamplesIntent(intent) || intent === 'model_page' || intent === 'pricing_specs' || intent === 'specs';
}

function isLinkableIntent(intent: SeoIntentType) {
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

function isExpectedExistingLinkPattern(draft: LinkDraft) {
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

function dedupeSuggestions(items: InternalLinkSuggestion[]) {
  const best = new Map<string, InternalLinkSuggestion>();
  for (const item of items) {
    const key = dedupeKey(item);
    const existing = best.get(key);
    if (!existing || compareSuggestionQuality(item, existing) < 0) best.set(key, item);
  }
  return Array.from(best.values());
}

function dedupeKey(item: InternalLinkSuggestion) {
  if (item.recommendationType === 'examples_to_model') {
    return `${item.recommendationType}|${item.sourceUrl}|${item.family}`;
  }
  if (item.recommendationType === 'model_to_examples') {
    return `${item.recommendationType}|${item.targetUrl}|${item.family}`;
  }
  if (item.recommendationType === 'hub_to_opportunity') {
    return `${item.recommendationType}|${item.sourceUrl}|${item.family}`;
  }
  return `${item.sourceUrl}|${item.targetUrl}|${item.recommendationType}`;
}

function compareSuggestionQuality(a: InternalLinkSuggestion, b: InternalLinkSuggestion) {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;
  return b.currentMetrics.impressions - a.currentMetrics.impressions;
}

function buildAcceptanceCriteria(item: LinkDraft) {
  const criteria = [
    'Review the source page first and avoid adding a duplicate internal link if a clear one already exists',
    `If added, the link points from ${item.sourceUrl} to ${item.targetUrl}`,
    `Anchor text is natural and close to "${item.suggestedAnchor}" without keyword stuffing`,
    'The link is placed where it helps users navigate related MaxVideoAI content',
  ];

  if (item.recommendationType === 'compare_to_model') {
    criteria.push('Comparison page has clear paths to both compared model pages when those pages exist');
  }
  if (item.recommendationType === 'model_to_examples' || item.recommendationType === 'examples_to_model') {
    criteria.push('Model and examples pages reinforce each other without turning either page into a link list');
  }
  return criteria;
}

function normalizePath(value: string | null) {
  if (!value || value === 'No target URL') return '';
  return value.split('?')[0].replace(/\/$/, '') || '/';
}

function aliasInHaystack(alias: string, haystack: string) {
  const normalized = normalizeSeoQuery(alias);
  if (!normalized) return false;
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\ /g, '[\\s./-]+');
  return new RegExp(`(^|[\\s/.-])${escaped}($|[\\s/.-])`, 'i').test(haystack);
}

function titleize(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bLtx\b/g, 'LTX');
}

function signalKey(targetUrl: string | null, cluster: string) {
  return `${normalizePath(stripOrigin(targetUrl))}|${normalizeSeoQuery(cluster)}`;
}

function formatMetrics(metrics: SeoSourceMetrics) {
  return [
    `${metrics.clicks} clicks`,
    `${metrics.impressions} impressions`,
    `${(metrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${metrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

function priorityRank(priority: SeoActionPriority) {
  if (priority === 'critical') return 1;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 3;
  return 4;
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
