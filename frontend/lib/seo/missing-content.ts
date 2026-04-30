import type { GscPerformanceRow } from './gsc-analysis';
import type {
  MissingContentIntentType,
  MissingContentItem,
  MissingContentRecommendationType,
  SeoActionPriority,
  SeoQueryCluster,
  StrategicSeoFamily,
} from './internal-seo-types';
import {
  classifySeoIntent,
  compactIntentLabel,
  detectStrategicModelFamily,
  getBusinessPriorityWeight,
  getSeoFamilyDictionary,
  getSeoFamilyStatus,
  normalizeSeoQuery,
} from './seo-intents';
import { clusterGscQueries, stripOrigin } from './seo-opportunity-engine';

const MIN_MISSING_CONTENT_IMPRESSIONS = 20;
const MIN_CREATE_PAGE_IMPRESSIONS = 250;
const MAX_ITEMS = 50;

export function buildMissingContentItems(rows: GscPerformanceRow[]): MissingContentItem[] {
  return dedupeMissingContentItems(clusterGscQueries(rows)
    .map(buildMissingContentItem)
    .filter((item): item is MissingContentItem => Boolean(item && item.recommendationType !== 'ignore')))
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score)
    .slice(0, MAX_ITEMS);
}

export function formatMissingContentMarkdown(item: MissingContentItem): string {
  return [
    'Title:',
    itemTitle(item),
    '',
    'Target:',
    item.targetUrl ? stripOrigin(item.targetUrl) : 'Target uncertain',
    '',
    'Likely page candidates:',
    ...(item.likelyPageCandidates.length ? item.likelyPageCandidates.map((candidate) => `- ${candidate}`) : ['- Review existing route/page fit first']),
    '',
    'Source:',
    `GSC query cluster: ${item.representativeQueries.map((query) => `"${query}"`).join(', ')}`,
    `Metrics: ${formatMetrics(item)}`,
    '',
    'Observed gap:',
    item.observedGap,
    '',
    'Recommended action:',
    item.recommendedAction,
    '',
    'Why this action:',
    item.whyThisAction,
    '',
    ...(item.whyNotCreatePage ? ['Why not create a page yet:', item.whyNotCreatePage, ''] : []),
    'Acceptance criteria:',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatMissingContentSectionMarkdown(items: MissingContentItem[]): string {
  if (!items.length) {
    return ['# Missing Content', '', 'No Missing Content items generated for this snapshot.'].join('\n');
  }

  return [
    '# Missing Content',
    '',
    `Generated items: ${items.length}`,
    '',
    ...items.map((item, index) => [`## ${index + 1}. ${itemTitle(item)}`, '', formatMissingContentMarkdown(item)].join('\n')),
  ].join('\n\n');
}

function buildMissingContentItem(cluster: SeoQueryCluster): MissingContentItem | null {
  const intent = classifyMissingContentIntent(cluster);
  const family = detectStrategicModelFamily(cluster.representativeQueries.join(' '), cluster.targetUrl);
  const recommendationType = chooseRecommendationType(cluster, intent, family);
  if (recommendationType === 'ignore') return null;
  if (!clusterIsWorthMissingContent(cluster, intent, recommendationType)) return null;

  const likelyPageCandidates = inferLikelyPageCandidates(cluster, intent, family);
  const score = calibrateScore(cluster, intent, recommendationType, scoreMissingContent(cluster, intent, recommendationType, family));
  const itemWithoutDraft: Omit<MissingContentItem, 'codexTaskDraft'> = {
    id: `${recommendationType}_${stableId(`${cluster.targetUrl ?? ''}|${cluster.key}|${intent}`)}`,
    priority: scoreToPriority(score),
    score,
    recommendationType,
    targetUrl: cluster.targetUrl,
    likelyPageCandidates,
    queryCluster: cluster.label,
    representativeQueries: cluster.representativeQueries,
    family,
    intent,
    currentMetrics: cluster.metrics,
    observedGap: buildObservedGap(cluster, intent, recommendationType),
    recommendedAction: buildRecommendedAction(cluster, intent, recommendationType, likelyPageCandidates),
    whyThisAction: buildWhyThisAction(cluster, intent, recommendationType),
    whyNotCreatePage: buildWhyNotCreatePage(cluster, intent, recommendationType),
    acceptanceCriteria: buildAcceptanceCriteria(cluster, intent, recommendationType),
  };

  return {
    ...itemWithoutDraft,
    codexTaskDraft: formatMissingContentMarkdown(itemWithoutDraft as MissingContentItem),
  };
}

export function classifyMissingContentIntent(clusterOrQuery: SeoQueryCluster | string): MissingContentIntentType {
  const queryText =
    typeof clusterOrQuery === 'string'
      ? clusterOrQuery
      : `${clusterOrQuery.representativeQueries.join(' ')} ${stripOrigin(clusterOrQuery.targetUrl)}`;
  const normalized = normalizeSeoQuery(queryText);

  if (isJunkOrAdultQuery(normalized)) return 'irrelevant_junk';
  if (/\bfaq\b|\bhow do i\b|\bhow to\b|\bwhat is\b|\bcan i\b|\bdoes\b|\bwhy\b/.test(normalized)) {
    const base = classifySeoIntent(queryText);
    if (base !== 'generic' && base !== 'model_page') return base;
    return 'faq_info';
  }
  return classifySeoIntent(queryText);
}

function chooseRecommendationType(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  family: StrategicSeoFamily
): MissingContentRecommendationType {
  const targetPath = stripOrigin(cluster.targetUrl).split('?')[0];
  const { impressions, averagePosition } = cluster.metrics;

  if (intent === 'irrelevant_junk') return 'ignore';
  if (intent === 'brand') return 'ignore';
  if (intent === 'brand_typo') return impressions >= 80 ? 'strengthen_existing_page' : 'ignore';
  if (averagePosition >= 30 && impressions < MIN_CREATE_PAGE_IMPRESSIONS) return 'watchlist';

  if (intent === 'comparison') {
    if (targetPath.startsWith('/ai-video-engines/')) return 'add_comparison_block';
    return shouldCreateDedicatedPage(cluster, intent, family) ? 'create_page' : 'add_comparison_block';
  }

  if (intent === 'prompt_examples' || intent === 'prompt_guide') return 'add_examples_block';
  if (intent === 'pricing') return targetPath === '/pricing' ? 'strengthen_existing_page' : 'add_pricing_block';
  if (intent === 'pricing_specs' || intent === 'specs' || intent === 'max_length' || intent === 'model_parameters') {
    return 'add_specs_block';
  }
  if (intent === 'examples') return targetPath.startsWith('/examples') ? 'strengthen_existing_page' : 'add_examples_block';
  if (intent === 'pay_as_you_go') return targetPath === '/pricing' ? 'strengthen_existing_page' : 'add_pricing_block';
  if (intent === 'image_to_video' || intent === 'text_to_video' || intent === 'camera_movement' || intent === 'first_last_frame') {
    return 'add_section';
  }
  if (intent === 'product_advertisement' || intent === 'realistic_humans' || intent === 'best_ai_video_generator') {
    return shouldCreateDedicatedPage(cluster, intent, family) ? 'create_page' : 'add_faq';
  }
  if (intent === 'faq_info') return 'add_faq';

  if (family !== 'Other' && family !== 'Brand') return 'strengthen_existing_page';
  return shouldCreateDedicatedPage(cluster, intent, family) ? 'create_page' : 'watchlist';
}

function clusterIsWorthMissingContent(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType
): boolean {
  const { impressions } = cluster.metrics;
  if (recommendationType === 'ignore') return false;
  if (recommendationType === 'watchlist') return impressions >= 35;
  if (recommendationType === 'create_page') return shouldCreateDedicatedPage(cluster, intent, cluster.modelFamily);
  if (impressions >= MIN_MISSING_CONTENT_IMPRESSIONS) return true;
  if (cluster.representativeQueries.length >= 2 && isHighIntentMissingContent(intent)) return true;
  return false;
}

function shouldCreateDedicatedPage(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  family: StrategicSeoFamily
): boolean {
  if (cluster.targetUrl) return false;
  if (!isHighIntentMissingContent(intent)) return false;
  if (cluster.metrics.impressions < MIN_CREATE_PAGE_IMPRESSIONS) return false;
  if (cluster.representativeQueries.length < 3 && family !== 'Seedance' && family !== 'Kling' && family !== 'Veo' && family !== 'LTX') {
    return false;
  }
  return true;
}

function scoreMissingContent(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType,
  family: StrategicSeoFamily
): number {
  const { impressions, ctr, averagePosition } = cluster.metrics;
  const impressionsScore = Math.min(36, Math.log10(Math.max(impressions, 1)) * 15);
  const positionScore =
    averagePosition <= 3.5
      ? 16
      : averagePosition <= 8
        ? 20
        : averagePosition <= 12
          ? 14
          : averagePosition <= 30
            ? 6
            : -16;
  const intentScore = isHighIntentMissingContent(intent) ? 18 : intent === 'faq_info' ? 8 : 0;
  const lowCtrScore = Math.max(0, Math.min(12, (0.035 - ctr) * 420));
  const repeatScore = Math.min(10, cluster.representativeQueries.length * 2);
  const typeBoost: Record<MissingContentRecommendationType, number> = {
    add_section: 8,
    add_faq: 6,
    add_comparison_block: 14,
    add_specs_block: 12,
    add_pricing_block: 12,
    add_examples_block: 14,
    strengthen_existing_page: 10,
    create_page: 20,
    watchlist: -12,
    ignore: -100,
  };

  return Math.round(
    (impressionsScore + positionScore + intentScore + lowCtrScore + repeatScore + typeBoost[recommendationType]) *
      getBusinessPriorityWeight(family)
  );
}

function calibrateScore(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType,
  rawScore: number
) {
  if (recommendationType === 'watchlist') return Math.min(rawScore, 48);
  if (recommendationType === 'create_page') return Math.max(rawScore, 86);
  if (intent === 'brand_typo') return Math.min(rawScore, 72);
  if (cluster.metrics.impressions < 20) return Math.min(rawScore, 48);
  if (cluster.metrics.impressions < 35) return Math.min(rawScore, 58);
  if (cluster.metrics.averagePosition >= 30) return Math.min(rawScore, 48);
  if (cluster.metrics.ctr >= 0.12 && cluster.metrics.averagePosition <= 6 && cluster.metrics.impressions < 80) {
    return Math.min(rawScore, 76);
  }
  if (cluster.metrics.ctr >= 0.12 && cluster.metrics.averagePosition <= 6) return Math.min(rawScore, 86);
  if (cluster.modelFamily === 'Sora') return Math.min(rawScore, 62);
  return rawScore;
}

function scoreToPriority(score: number): SeoActionPriority {
  if (score >= 108) return 'critical';
  if (score >= 78) return 'high';
  if (score >= 52) return 'medium';
  return 'low';
}

function inferLikelyPageCandidates(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  family: StrategicSeoFamily
): string[] {
  const candidates = new Set<string>();
  if (cluster.targetUrl) candidates.add(stripOrigin(cluster.targetUrl).split('?')[0]);

  const familyEntry = getSeoFamilyDictionary().find((entry) => entry.label === family);
  if (familyEntry) {
    if (familyEntry.defaultModelSlug) candidates.add(`/models/${familyEntry.defaultModelSlug}`);
    candidates.add(`/examples/${familyEntry.id}`);
  }

  if (intent === 'pricing' || intent === 'pricing_specs' || intent === 'pay_as_you_go') candidates.add('/pricing');
  if (intent === 'comparison') candidates.add('/ai-video-engines');
  if (intent === 'best_ai_video_generator') candidates.add('/models');
  if (intent === 'examples' || intent === 'prompt_examples' || intent === 'prompt_guide') candidates.add('/examples');

  return Array.from(candidates).slice(0, 5);
}

function buildObservedGap(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType
) {
  const metricLine = formatMetricsFromCluster(cluster);
  if (recommendationType === 'watchlist') {
    return `The query intent is visible, but the cluster is still too far from page one for major content work: ${metricLine}.`;
  }
  if (recommendationType === 'create_page') {
    return `The cluster has repeated high-intent demand and no clear target URL in the cached GSC rows: ${metricLine}.`;
  }
  if (intent === 'comparison') return `Comparison intent is present and should be answered directly on the ranking page: ${metricLine}.`;
  if (intent === 'prompt_examples' || intent === 'prompt_guide') {
    return `Prompt/example demand is present, suggesting the target page should make practical prompt examples easier to find: ${metricLine}.`;
  }
  if (intent === 'pricing' || intent === 'pricing_specs' || intent === 'specs' || intent === 'max_length') {
    return `Pricing, specs, duration, or limit intent is present and should be answered with compact scannable copy: ${metricLine}.`;
  }
  if (intent === 'brand_typo') return `Brand typo demand exists, but it should be handled without typo-stuffed visible copy: ${metricLine}.`;
  return `GSC demand suggests the current page may need a clearer section or FAQ answer for this intent: ${metricLine}.`;
}

function buildRecommendedAction(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType,
  candidates: string[]
) {
  const target = cluster.targetUrl ? stripOrigin(cluster.targetUrl) : candidates[0] ?? 'the best matching existing page';
  if (recommendationType === 'watchlist') {
    return `Keep "${cluster.label}" on the watchlist. Review existing page content first, but avoid a major rewrite until ranking or impressions improve.`;
  }
  if (recommendationType === 'create_page') {
    return `Plan a dedicated page for "${cluster.label}" only after confirming no existing route already answers this intent.`;
  }
  if (recommendationType === 'add_comparison_block') {
    return `Strengthen ${target} with a compact comparison/differences block that answers the compared variants directly.`;
  }
  if (recommendationType === 'add_examples_block') {
    return `Strengthen ${target} with a concise examples or prompt examples block tied to the observed query cluster.`;
  }
  if (recommendationType === 'add_specs_block') {
    return `Add or clarify a compact specs, duration, limits, or model-parameters block on ${target}.`;
  }
  if (recommendationType === 'add_pricing_block') {
    return `Add or clarify pricing/credit/pay-as-you-go copy on ${target}, keeping it concise and accurate.`;
  }
  if (recommendationType === 'add_faq') {
    return `Add a focused FAQ entry on ${target} after reviewing whether existing copy already answers the query.`;
  }
  if (recommendationType === 'add_section') {
    return `Add a focused section on ${target} that answers ${labelizeMissingContentIntent(intent).toLowerCase()} intent without turning the page into a keyword list.`;
  }
  return `Strengthen ${target} after reviewing existing page content first.`;
}

function buildWhyThisAction(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType
) {
  if (recommendationType === 'watchlist') return 'The intent is real, but current ranking distance makes a lightweight monitoring action more appropriate than new content.';
  if (recommendationType === 'create_page') return 'The cluster is repeated, high-intent, and lacks a clear page candidate in cached GSC rows.';
  if (cluster.targetUrl) return 'GSC already maps the demand to an existing MaxVideoAI page, so strengthening that page is safer than creating another URL.';
  if (intent === 'pricing' || intent === 'pricing_specs' || intent === 'pay_as_you_go') return 'Pricing intent usually belongs on pricing or model pages before it deserves a standalone page.';
  return 'The recommendation keeps the work scoped to an existing route or likely candidate instead of creating low-signal pages.';
}

function buildWhyNotCreatePage(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType
) {
  if (recommendationType === 'create_page') return null;
  if (recommendationType === 'watchlist') return 'The cluster is not close enough to page one or not large enough yet to justify a new URL.';
  if (cluster.targetUrl) return 'A ranking target already exists in GSC, so a duplicate page would split intent before proving incremental value.';
  if (!isHighIntentMissingContent(intent)) return 'The detected intent is not specific enough to justify a dedicated page.';
  return 'The signal should be strengthened on an existing model, examples, pricing, or comparison page before creating a new URL.';
}

function buildAcceptanceCriteria(
  cluster: SeoQueryCluster,
  intent: MissingContentIntentType,
  recommendationType: MissingContentRecommendationType
) {
  const criteria = [
    'Review existing page content first; do not assume a section is missing without checking the target files',
    `${labelizeMissingContentIntent(intent).replace('Irrelevant Junk', 'Relevant')} intent is addressed without keyword stuffing`,
    'Copy stays compact, premium, and aligned with existing MaxVideoAI page structure',
  ];

  if (recommendationType === 'add_comparison_block') criteria.push('Comparison block names the variants and practical differences clearly');
  if (recommendationType === 'add_examples_block') criteria.push('Examples or prompt examples are visible where they naturally fit');
  if (recommendationType === 'add_specs_block') criteria.push('Specs, max length, duration, limits, or parameters are easy to scan');
  if (recommendationType === 'add_pricing_block') criteria.push('Pricing or credit claims are accurate and match current product behavior');
  if (recommendationType === 'create_page') criteria.push('New page is created only after confirming no existing route can satisfy the intent');
  if (recommendationType === 'watchlist') criteria.push('No major page rewrite is made unless future GSC signal improves');

  return criteria;
}

function isHighIntentMissingContent(intent: MissingContentIntentType) {
  return (
    intent === 'comparison' ||
    intent === 'prompt_examples' ||
    intent === 'prompt_guide' ||
    intent === 'pricing' ||
    intent === 'pricing_specs' ||
    intent === 'specs' ||
    intent === 'max_length' ||
    intent === 'pay_as_you_go' ||
    intent === 'examples' ||
    intent === 'image_to_video' ||
    intent === 'text_to_video'
  );
}

function isJunkOrAdultQuery(normalizedQuery: string) {
  return /\b(porn|porno|nsfw|nude|naked|sex|sexy|xxx|onlyfans|casino|gambling|torrent|crack|hack)\b/.test(normalizedQuery);
}

function dedupeMissingContentItems(items: MissingContentItem[]) {
  const bestByDecision = new Map<string, MissingContentItem>();
  for (const item of items) {
    const key = [
      item.targetUrl ?? item.likelyPageCandidates[0] ?? '',
      item.family,
      item.intent,
      item.recommendationType,
    ].join('|');
    const existing = bestByDecision.get(key);
    if (!existing || compareMissingContentQuality(item, existing) < 0) {
      bestByDecision.set(key, item);
    }
  }
  return Array.from(bestByDecision.values());
}

function compareMissingContentQuality(a: MissingContentItem, b: MissingContentItem) {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;
  return b.currentMetrics.impressions - a.currentMetrics.impressions;
}

function formatMetrics(item: MissingContentItem) {
  return [
    `${item.currentMetrics.clicks} clicks`,
    `${item.currentMetrics.impressions} impressions`,
    `${(item.currentMetrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${item.currentMetrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

function formatMetricsFromCluster(cluster: SeoQueryCluster) {
  return [
    `${cluster.metrics.clicks} clicks`,
    `${cluster.metrics.impressions} impressions`,
    `${(cluster.metrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${cluster.metrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

function itemTitle(item: MissingContentItem) {
  const action = labelizeRecommendation(item.recommendationType);
  const target = item.targetUrl ? stripOrigin(item.targetUrl) : item.likelyPageCandidates[0] ?? 'target page';
  const status = getSeoFamilyStatus(item.family);
  const familyPrefix = item.family !== 'Other' && item.family !== 'Brand' ? `${item.family} ` : '';
  const statusSuffix = status === 'deprioritized' ? ' (de-prioritized)' : '';
  return `${action}: ${familyPrefix}${item.queryCluster} on ${target}${statusSuffix}`;
}

export function labelizeRecommendation(value: MissingContentRecommendationType) {
  if (value === 'add_faq') return 'Add FAQ';
  if (value === 'add_comparison_block') return 'Add comparison block';
  if (value === 'add_specs_block') return 'Add specs block';
  if (value === 'add_pricing_block') return 'Add pricing block';
  if (value === 'add_examples_block') return 'Add examples block';
  if (value === 'strengthen_existing_page') return 'Strengthen existing page';
  if (value === 'create_page') return 'Create dedicated page';
  if (value === 'watchlist') return 'Watchlist';
  if (value === 'ignore') return 'Ignore';
  return 'Add section';
}

export function labelizeMissingContentIntent(value: MissingContentIntentType) {
  if (value === 'faq_info') return 'FAQ Info';
  if (value === 'irrelevant_junk') return 'Irrelevant Junk';
  return compactIntentLabel(value);
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
  return `missing_${Math.abs(hash).toString(36)}`;
}
