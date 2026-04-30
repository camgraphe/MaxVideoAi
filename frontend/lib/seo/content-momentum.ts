import type { GscPerformanceRow } from './gsc-analysis';
import type {
  ContentMomentumItem,
  ContentMomentumType,
  SeoActionPriority,
  SeoSourceMetrics,
  StrategicSeoFamily,
} from './internal-seo-types';
import { classifyMissingContentIntent } from './missing-content';
import {
  detectStrategicModelFamily,
  getBusinessPriorityWeight,
  getSeoFamilyStatus,
  normalizeSeoQuery,
} from './seo-intents';
import { clusterGscQueries, stripOrigin, summarizeRows } from './seo-opportunity-engine';

const MAX_MOMENTUM_ITEMS = 80;
const STRATEGIC_FAMILIES = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);

type BuildContentMomentumOptions = {
  currentRows: GscPerformanceRow[];
  previousRows: GscPerformanceRow[];
};

type MomentumDraft = {
  type: ContentMomentumType;
  pageUrl: string | null;
  queryCluster: string | null;
  family: StrategicSeoFamily;
  representativeQueries: string[];
  current: SeoSourceMetrics;
  previous: SeoSourceMetrics;
  scoreBoost: number;
};

export function buildContentMomentumItems(options: BuildContentMomentumOptions): ContentMomentumItem[] {
  if (!options.previousRows.length) return [];

  const drafts = [
    ...buildPageMomentumDrafts(options.currentRows, options.previousRows),
    ...buildClusterMomentumDrafts(options.currentRows, options.previousRows),
    ...buildFamilyMomentumDrafts(options.currentRows, options.previousRows),
    ...buildOutdatedModelDrafts(options.currentRows, options.previousRows),
  ];

  return dedupeMomentumItems(
    drafts
      .filter((draft) => !isJunkMomentumDraft(draft))
      .filter(isWorthMomentumItem)
      .map(finalizeMomentumItem)
  )
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score)
    .slice(0, MAX_MOMENTUM_ITEMS);
}

export function formatContentMomentumMarkdown(item: ContentMomentumItem): string {
  return [
    'Title:',
    buildMomentumTitle(item),
    '',
    'Target:',
    item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster ?? item.family,
    '',
    'Source:',
    item.queryCluster ? `GSC query cluster: "${item.queryCluster}"` : `GSC family/page momentum: ${item.family}`,
    `Current: ${formatMetrics(item.current)}`,
    `Previous: ${formatMetrics(item.previous)}`,
    `Delta: ${formatDelta(item.clickDelta, 'clicks')}, ${formatDelta(item.impressionDelta, 'impressions')}, ${formatSignedPercent(item.ctrDelta)} CTR, ${formatSignedNumber(item.positionDelta)} position`,
    '',
    'Observed trend:',
    item.observedTrend,
    '',
    'Recommended action:',
    item.recommendedAction,
    '',
    'Why it matters:',
    item.whyItMatters,
    '',
    'Acceptance criteria:',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatContentMomentumSectionMarkdown(items: ContentMomentumItem[]): string {
  if (!items.length) {
    return ['# Content Momentum', '', 'No Content Momentum items generated for this snapshot.'].join('\n');
  }

  return [
    '# Content Momentum',
    '',
    `Generated items: ${items.length}`,
    '',
    ...items.map((item, index) => [`## ${index + 1}. ${buildMomentumTitle(item)}`, '', formatContentMomentumMarkdown(item)].join('\n')),
  ].join('\n\n');
}

export function labelizeMomentumType(value: ContentMomentumType) {
  if (value === 'gaining_page') return 'Gaining page';
  if (value === 'declining_page') return 'Declining page';
  if (value === 'gaining_cluster') return 'Gaining cluster';
  if (value === 'declining_cluster') return 'Declining cluster';
  if (value === 'rising_family') return 'Rising family';
  if (value === 'declining_family') return 'Declining family';
  if (value === 'mixed_family_momentum') return 'Mixed family momentum';
  if (value === 'refresh_candidate') return 'Refresh candidate';
  if (value === 'protect_winner') return 'Protect winner';
  if (value === 'outdated_model_attention') return 'Older model attention';
  return 'Watchlist';
}

function buildPageMomentumDrafts(currentRows: GscPerformanceRow[], previousRows: GscPerformanceRow[]): MomentumDraft[] {
  const currentPages = groupRowsByPage(currentRows);
  const previousPages = groupRowsByPage(previousRows);
  const drafts: MomentumDraft[] = [];

  for (const [pageUrl, currentGroup] of currentPages) {
    const previousGroup = previousPages.get(pageUrl);
    if (!previousGroup) continue;
    const current = summarizeRows(currentGroup);
    const previous = summarizeRows(previousGroup);
    const family = detectFamilyForRows(currentGroup, pageUrl);
    const trend = classifyTrend(current, previous);
    if (!trend) {
      if (
        getSeoFamilyStatus(family) === 'emerging' &&
        current.impressions >= 35 &&
        current.impressions - previous.impressions >= 15
      ) {
        drafts.push({
          type: 'watchlist',
          pageUrl,
          queryCluster: null,
          family,
          representativeQueries: pickRepresentativeQueries(currentGroup),
          current,
          previous,
          scoreBoost: -12,
        });
      }
      continue;
    }

    const type =
      trend === 'gaining'
        ? current.clicks >= 10 && current.impressions >= 100
          ? 'protect_winner'
          : 'gaining_page'
        : previous.impressions >= 80 && (previous.clicks - current.clicks >= 5 || previous.impressions - current.impressions >= 50)
          ? 'refresh_candidate'
          : 'declining_page';

    drafts.push({
      type,
      pageUrl,
      queryCluster: null,
      family,
      representativeQueries: pickRepresentativeQueries(currentGroup),
      current,
      previous,
      scoreBoost: type === 'protect_winner' || type === 'refresh_candidate' ? 16 : 8,
    });
  }

  return drafts;
}

function buildClusterMomentumDrafts(currentRows: GscPerformanceRow[], previousRows: GscPerformanceRow[]): MomentumDraft[] {
  const currentClusters = new Map(clusterGscQueries(currentRows).map((cluster) => [cluster.key, cluster]));
  const previousClusters = new Map(clusterGscQueries(previousRows).map((cluster) => [cluster.key, cluster]));
  const drafts: MomentumDraft[] = [];

  for (const [key, currentCluster] of currentClusters) {
    const previousCluster = previousClusters.get(key);
    if (!previousCluster) continue;
    const trend = classifyTrend(currentCluster.metrics, previousCluster.metrics);
    if (!trend) continue;
    drafts.push({
      type: trend === 'gaining' ? 'gaining_cluster' : 'declining_cluster',
      pageUrl: currentCluster.targetUrl,
      queryCluster: currentCluster.label,
      family: currentCluster.modelFamily,
      representativeQueries: currentCluster.representativeQueries,
      current: currentCluster.metrics,
      previous: previousCluster.metrics,
      scoreBoost: currentCluster.intent === 'comparison' || currentCluster.intent === 'prompt_examples' ? 14 : 8,
    });
  }

  return drafts;
}

function buildFamilyMomentumDrafts(currentRows: GscPerformanceRow[], previousRows: GscPerformanceRow[]): MomentumDraft[] {
  const currentFamilies = groupRowsByFamily(currentRows);
  const previousFamilies = groupRowsByFamily(previousRows);
  const drafts: MomentumDraft[] = [];

  for (const [family, currentGroup] of currentFamilies) {
    if (family === 'Other' || family === 'Brand') continue;
    const previousGroup = previousFamilies.get(family);
    if (!previousGroup) continue;
    const current = summarizeRows(currentGroup);
    const previous = summarizeRows(previousGroup);
    const mixed = classifyMixedFamilyMomentum(current, previous);
    if (mixed) {
      drafts.push({
        type: 'mixed_family_momentum',
        pageUrl: null,
        queryCluster: null,
        family,
        representativeQueries: pickRepresentativeQueries(currentGroup),
        current,
        previous,
        scoreBoost: -8,
      });
      continue;
    }
    const trend = classifyTrend(current, previous);
    if (!trend) continue;
    drafts.push({
      type: trend === 'gaining' ? 'rising_family' : 'declining_family',
      pageUrl: null,
      queryCluster: null,
      family,
      representativeQueries: pickRepresentativeQueries(currentGroup),
      current,
      previous,
      scoreBoost: STRATEGIC_FAMILIES.has(family) ? 12 : 4,
    });
  }

  return drafts;
}

function buildOutdatedModelDrafts(currentRows: GscPerformanceRow[], previousRows: GscPerformanceRow[]): MomentumDraft[] {
  const currentPages = groupRowsByPage(currentRows);
  const previousPages = groupRowsByPage(previousRows);
  const drafts: MomentumDraft[] = [];

  for (const [pageUrl, currentGroup] of currentPages) {
    const family = detectFamilyForRows(currentGroup, pageUrl);
    const status = getSeoFamilyStatus(family);
    if (status !== 'deprioritized' && !/\/models\/sora\b/i.test(pageUrl)) continue;
    const current = summarizeRows(currentGroup);
    if (current.impressions < 50) continue;
    drafts.push({
      type: 'outdated_model_attention',
      pageUrl,
      queryCluster: null,
      family,
      representativeQueries: pickRepresentativeQueries(currentGroup),
      current,
      previous: summarizeRows(previousPages.get(pageUrl) ?? []),
      scoreBoost: -16,
    });
  }

  return drafts;
}

function finalizeMomentumItem(draft: MomentumDraft): ContentMomentumItem {
  const clickDelta = draft.current.clicks - draft.previous.clicks;
  const impressionDelta = draft.current.impressions - draft.previous.impressions;
  const ctrDelta = draft.current.ctr - draft.previous.ctr;
  const positionDelta = draft.current.averagePosition - draft.previous.averagePosition;
  const score = calibrateScore(draft, scoreMomentumDraft(draft, clickDelta, impressionDelta, ctrDelta, positionDelta));
  const itemWithoutDraft: Omit<ContentMomentumItem, 'codexTaskDraft'> = {
    id: `${draft.type}_${stableId(`${draft.pageUrl ?? ''}|${draft.queryCluster ?? ''}|${draft.family}`)}`,
    type: draft.type,
    priority: scoreToPriority(score),
    score,
    pageUrl: draft.pageUrl,
    queryCluster: draft.queryCluster,
    family: draft.family,
    current: draft.current,
    previous: draft.previous,
    clickDelta,
    impressionDelta,
    ctrDelta,
    positionDelta,
    observedTrend: buildObservedTrend(draft, clickDelta, impressionDelta, ctrDelta, positionDelta),
    recommendedAction: buildRecommendedAction(draft),
    whyItMatters: buildWhyItMatters(draft),
    acceptanceCriteria: buildAcceptanceCriteria(draft),
  };

  return {
    ...itemWithoutDraft,
    codexTaskDraft: formatContentMomentumMarkdown(itemWithoutDraft as ContentMomentumItem),
  };
}

function scoreMomentumDraft(
  draft: MomentumDraft,
  clickDelta: number,
  impressionDelta: number,
  ctrDelta: number,
  positionDelta: number
) {
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const deltaMagnitude = Math.abs(impressionDelta) + Math.abs(clickDelta) * 8;
  const volumeScore = Math.min(34, Math.log10(Math.max(maxImpressions, 1)) * 14);
  const deltaScore = Math.min(34, Math.log10(Math.max(deltaMagnitude, 1)) * 16);
  const positionScore = draft.current.averagePosition <= 6 ? 14 : draft.current.averagePosition <= 12 ? 10 : draft.current.averagePosition <= 30 ? 3 : -10;
  const ctrScore = draft.type.includes('declining') || draft.type === 'refresh_candidate' ? Math.min(10, Math.max(0, -ctrDelta * 220)) : Math.min(8, Math.max(0, ctrDelta * 180));
  return Math.round((volumeScore + deltaScore + positionScore + ctrScore + draft.scoreBoost) * getBusinessPriorityWeight(draft.family));
}

function calibrateScore(draft: MomentumDraft, rawScore: number) {
  const status = getSeoFamilyStatus(draft.family);
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const impressionDelta = Math.abs(draft.current.impressions - draft.previous.impressions);
  const currentImpressions = draft.current.impressions;
  const clickDelta = Math.abs(draft.current.clicks - draft.previous.clicks);
  if (draft.family === 'Brand') {
    return Math.min(rawScore, isBrandTypoMomentum(draft) ? 75 : 103);
  }
  if (maxImpressions < 35 || impressionDelta < 20) return Math.min(rawScore, 48);
  if (draft.type === 'mixed_family_momentum') return Math.min(rawScore, 48);
  if ((draft.type === 'declining_cluster' || draft.type === 'declining_page') && currentImpressions < 20 && maxImpressions < 80) {
    return Math.min(rawScore, 48);
  }
  if (currentImpressions < 50 && maxImpressions < 90) return Math.min(rawScore, 75);
  if (draft.current.averagePosition >= 30 && maxImpressions < 250) return Math.min(rawScore, 48);
  if (draft.type === 'watchlist') return Math.min(rawScore, 48);
  if (draft.type === 'outdated_model_attention') return Math.min(rawScore, 48);
  if (draft.family === 'Sora') return Math.min(rawScore, 48);
  if (status === 'emerging' && maxImpressions < 120) return Math.min(rawScore, 48);
  if (status === 'emerging') return Math.min(rawScore, 62);
  if ((draft.type === 'rising_family' || draft.type === 'declining_family') && maxImpressions < 100) return Math.min(rawScore, 58);
  if (rawScore >= 104 && !isCriticalEligible(draft, impressionDelta, clickDelta)) return Math.min(rawScore, 103);
  return rawScore;
}

function scoreToPriority(score: number): SeoActionPriority {
  if (score >= 104) return 'critical';
  if (score >= 76) return 'high';
  if (score >= 52) return 'medium';
  return 'low';
}

function classifyTrend(current: SeoSourceMetrics, previous: SeoSourceMetrics): 'gaining' | 'declining' | null {
  const maxImpressions = Math.max(current.impressions, previous.impressions);
  const impressionDelta = current.impressions - previous.impressions;
  const clickDelta = current.clicks - previous.clicks;
  const relativeImpressionDelta = previous.impressions ? impressionDelta / previous.impressions : current.impressions ? 1 : 0;
  const relativeClickDelta = previous.clicks ? clickDelta / previous.clicks : current.clicks ? 1 : 0;

  if (maxImpressions < 20) return null;
  if (Math.abs(impressionDelta) < 20 && Math.abs(clickDelta) < 4) return null;

  if (
    (impressionDelta >= 40 && relativeImpressionDelta >= 0.25) ||
    (clickDelta >= 5 && relativeClickDelta >= 0.25)
  ) {
    return 'gaining';
  }
  if (
    (impressionDelta <= -40 && relativeImpressionDelta <= -0.25) ||
    (clickDelta <= -5 && relativeClickDelta <= -0.25)
  ) {
    return 'declining';
  }
  return null;
}

function classifyMixedFamilyMomentum(current: SeoSourceMetrics, previous: SeoSourceMetrics): boolean {
  const impressionDelta = current.impressions - previous.impressions;
  const clickDelta = current.clicks - previous.clicks;
  const positionDelta = current.averagePosition - previous.averagePosition;
  const clicksRising = clickDelta >= 5;
  const impressionsFalling = impressionDelta <= -40;
  const positionWorse = positionDelta >= 3 && current.averagePosition > 12;
  const clicksFalling = clickDelta <= -5;
  const impressionsRising = impressionDelta >= 40;
  return (clicksRising && (impressionsFalling || positionWorse)) || (clicksFalling && impressionsRising);
}

function isWorthMomentumItem(draft: MomentumDraft) {
  const maxImpressions = Math.max(draft.current.impressions, draft.previous.impressions);
  const impressionDelta = Math.abs(draft.current.impressions - draft.previous.impressions);
  const clickDelta = Math.abs(draft.current.clicks - draft.previous.clicks);
  const status = getSeoFamilyStatus(draft.family);

  if (draft.type === 'outdated_model_attention') return draft.current.impressions >= 50;
  if (maxImpressions < 20) return false;
  if (impressionDelta < 20 && clickDelta < 4) return false;
  if (status === 'emerging') return maxImpressions >= 35 && impressionDelta >= 15;
  if (draft.type === 'mixed_family_momentum') return maxImpressions >= 80 && (impressionDelta >= 40 || clickDelta >= 5);
  if (draft.type === 'rising_family' || draft.type === 'declining_family') return maxImpressions >= 80 && impressionDelta >= 50;
  return true;
}

function isJunkMomentumDraft(draft: MomentumDraft) {
  const text = normalizeSeoQuery([
    draft.pageUrl,
    draft.queryCluster,
    draft.family,
    ...draft.representativeQueries,
  ].filter(Boolean).join(' '));
  if (isAdultOrJunkText(text)) return true;
  return draft.representativeQueries.some((query) => classifyMissingContentIntent(query) === 'irrelevant_junk');
}

function buildObservedTrend(
  draft: MomentumDraft,
  clickDelta: number,
  impressionDelta: number,
  ctrDelta: number,
  positionDelta: number
) {
  const direction = impressionDelta >= 0 || clickDelta >= 0 ? 'gaining' : 'losing';
  if (draft.type === 'protect_winner') {
    return `${targetLabel(draft)} is gaining momentum: ${formatDelta(clickDelta, 'clicks')} and ${formatDelta(impressionDelta, 'impressions')} vs the previous period. CTR moved ${formatSignedPercent(ctrDelta)} and position moved ${formatSignedNumber(positionDelta)}.`;
  }
  if (draft.type === 'refresh_candidate') {
    return `${targetLabel(draft)} is losing momentum: ${formatDelta(clickDelta, 'clicks')} and ${formatDelta(impressionDelta, 'impressions')} vs the previous period. Position moved ${formatSignedNumber(positionDelta)}.`;
  }
  if (draft.type === 'outdated_model_attention') {
    return `${draft.family} is de-prioritized but still receives ${draft.current.impressions} impressions in this period.`;
  }
  if (draft.type === 'mixed_family_momentum') {
    return `${draft.family} has mixed momentum: ${formatDelta(clickDelta, 'clicks')} and ${formatDelta(impressionDelta, 'impressions')} vs the previous period. Position moved ${formatSignedNumber(positionDelta)}.`;
  }
  return `${targetLabel(draft)} is ${direction}: ${formatDelta(clickDelta, 'clicks')} and ${formatDelta(impressionDelta, 'impressions')} vs the previous period.`;
}

function buildRecommendedAction(draft: MomentumDraft) {
  if (draft.type === 'protect_winner') {
    if (draft.family === 'Brand') {
      return 'Protect and defend brand momentum. Keep the homepage clear, fast, and consistent; avoid turning brand or typo demand into repetitive SEO copy.';
    }
    return `Protect and expand the page. Refresh the most visible section, keep the winning intent prominent, and verify current model/example links before making larger edits.`;
  }
  if (draft.type === 'refresh_candidate' || draft.type === 'declining_page' || draft.type === 'declining_cluster') {
    if (draft.queryCluster?.toLowerCase().includes('vs') || draft.pageUrl?.includes('/ai-video-engines/')) {
      return 'Refresh the comparison summary, current model references, specs/pricing clarity, and compact FAQ. Keep the page focused on the comparison intent.';
    }
    return 'Review the page for stale copy, missing current model references, weak examples/specs clarity, and internal links that may need a light refresh.';
  }
  if (draft.type === 'outdated_model_attention') {
    return 'Keep useful older-model demand indexable, but frame it as older or de-prioritized, link toward current stronger model pages, and avoid over-promoting it.';
  }
  if (draft.type === 'rising_family') {
    return `Prioritize ${draft.family} refresh and expansion work where it overlaps with existing opportunities, CTR Doctor, Missing Content, or internal-link recommendations.`;
  }
  if (draft.type === 'declining_family') {
    return `Audit ${draft.family} pages for stale positioning, current model references, examples freshness, and comparison clarity before adding new content.`;
  }
  if (draft.type === 'mixed_family_momentum') {
    return `Treat ${draft.family} as watchlist momentum. Review the underlying clusters before prioritizing work, because clicks and visibility are moving in different directions.`;
  }
  return 'Monitor the trend and fold the momentum context into an existing SEO task if the same page or cluster already has a stronger recommendation.';
}

function buildWhyItMatters(draft: MomentumDraft) {
  if (draft.type === 'protect_winner') return 'Growing pages are usually the best place to compound gains without creating new low-signal content.';
  if (draft.type === 'refresh_candidate') return 'Declining pages with existing demand are often faster to recover than brand-new pages are to rank.';
  if (draft.type === 'outdated_model_attention') return 'Older model demand can still be useful, but it should point users toward the current MaxVideoAI model ecosystem.';
  if (draft.type === 'rising_family') return `${draft.family} is gaining demand and can guide where SEO/dev time should go next.`;
  if (draft.type === 'declining_family') return `${draft.family} is losing demand, so refresh work should be defensive and evidence-led.`;
  if (draft.type === 'mixed_family_momentum') return 'Mixed signals are useful for monitoring, but they should not outrank cleaner growth or decay signals.';
  return 'Momentum context helps avoid reacting to static rankings without understanding whether demand is rising or fading.';
}

function buildAcceptanceCriteria(draft: MomentumDraft) {
  const criteria = [
    'Use cached GSC comparison data as context; do not call external SEO APIs',
    'Do not create a new page unless another detector separately justifies it',
    'Copy stays compact, premium, and aligned with existing MaxVideoAI page structure',
  ];

  if (draft.type === 'protect_winner' || draft.type === 'gaining_page' || draft.type === 'gaining_cluster') {
    criteria.push('Winning intent remains visible above the fold or in the most relevant section');
    criteria.push('Current model/example links are verified before adding new links');
  }
  if (draft.type === 'refresh_candidate' || draft.type === 'declining_page' || draft.type === 'declining_cluster') {
    criteria.push('Refresh addresses stale model names, specs, pricing, examples, or comparison copy where relevant');
    criteria.push('No generic rewrite or keyword stuffing is introduced');
  }
  if (draft.type === 'outdated_model_attention') {
    criteria.push('Older/de-prioritized model framing is honest and links users toward current alternatives where appropriate');
  }
  if (draft.type === 'mixed_family_momentum') {
    criteria.push('Underlying query/page clusters are reviewed before assigning implementation work');
  }
  return criteria;
}

function buildMomentumTitle(item: ContentMomentumItem) {
  if (item.type === 'protect_winner') return `Protect growing SEO winner: ${item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster}`;
  if (item.type === 'refresh_candidate') return `Refresh declining SEO page: ${item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster}`;
  if (item.type === 'outdated_model_attention') return `Reposition older ${item.family} demand`;
  if (item.type === 'rising_family') return `${item.family} family is gaining momentum`;
  if (item.type === 'declining_family') return `${item.family} family is losing momentum`;
  if (item.type === 'mixed_family_momentum') return `${item.family} family has mixed momentum`;
  return `${labelizeMomentumType(item.type)}: ${item.queryCluster ?? item.pageUrl ?? item.family}`;
}

function groupRowsByPage(rows: GscPerformanceRow[]) {
  const grouped = new Map<string, GscPerformanceRow[]>();
  for (const row of rows) {
    const path = stripOrigin(row.page);
    if (!path || path === 'No target URL') continue;
    grouped.set(path, [...(grouped.get(path) ?? []), row]);
  }
  return grouped;
}

function groupRowsByFamily(rows: GscPerformanceRow[]) {
  const grouped = new Map<StrategicSeoFamily, GscPerformanceRow[]>();
  for (const row of rows) {
    const family = detectStrategicModelFamily(row.query, row.page);
    grouped.set(family, [...(grouped.get(family) ?? []), row]);
  }
  return grouped;
}

function detectFamilyForRows(rows: GscPerformanceRow[], pageUrl: string | null): StrategicSeoFamily {
  const familyCounts = new Map<StrategicSeoFamily, number>();
  for (const row of rows) {
    const family = detectStrategicModelFamily(row.query, row.page ?? pageUrl);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + row.impressions);
  }
  return Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Other';
}

function pickRepresentativeQueries(rows: GscPerformanceRow[]) {
  return rows
    .filter((row) => row.query)
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 4)
    .map((row) => row.query as string);
}

function dedupeMomentumItems(items: ContentMomentumItem[]) {
  const best = new Map<string, ContentMomentumItem>();
  for (const item of items) {
    const key = dedupeKey(item);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      continue;
    }
    const winner = compareMomentumQuality(item, existing) < 0 ? item : existing;
    const loser = winner === item ? existing : item;
    best.set(key, mergeMomentumContext(winner, loser));
  }
  return Array.from(best.values());
}

function dedupeKey(item: ContentMomentumItem) {
  if (item.pageUrl && item.type !== 'outdated_model_attention') {
    return `page|${stripOrigin(item.pageUrl)}|${item.family}`;
  }
  if (item.type === 'outdated_model_attention') {
    return `page|${stripOrigin(item.pageUrl)}|${item.family}|older`;
  }
  if (item.type === 'rising_family' || item.type === 'declining_family' || item.type === 'mixed_family_momentum') return `family|${item.family}`;
  return `cluster|${item.queryCluster}|${item.family}`;
}

function compareMomentumQuality(a: ContentMomentumItem, b: ContentMomentumItem) {
  const typeDelta = momentumTypeRank(a.type) - momentumTypeRank(b.type);
  if (typeDelta !== 0) return typeDelta;
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  if (a.score !== b.score) return b.score - a.score;
  return Math.abs(b.impressionDelta) - Math.abs(a.impressionDelta);
}

function mergeMomentumContext(winner: ContentMomentumItem, loser: ContentMomentumItem): ContentMomentumItem {
  const merged = {
    ...winner,
    queryCluster: winner.queryCluster ?? loser.queryCluster,
    observedTrend: winner.queryCluster ?? !loser.queryCluster
      ? winner.observedTrend
      : `${winner.observedTrend} Related cluster context: ${loser.queryCluster}.`,
  };
  return {
    ...merged,
    codexTaskDraft: formatContentMomentumMarkdown(merged),
  };
}

function momentumTypeRank(type: ContentMomentumType) {
  if (type === 'protect_winner' || type === 'refresh_candidate') return 1;
  if (type === 'gaining_page' || type === 'declining_page') return 2;
  if (type === 'gaining_cluster' || type === 'declining_cluster') return 3;
  if (type === 'rising_family' || type === 'declining_family') return 4;
  if (type === 'mixed_family_momentum') return 5;
  return 6;
}

function priorityRank(priority: SeoActionPriority) {
  if (priority === 'critical') return 1;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 3;
  return 4;
}

function isCriticalEligible(draft: MomentumDraft, impressionDelta: number, clickDelta: number) {
  const hasAbsoluteSignal = draft.current.impressions >= 250 || impressionDelta >= 150;
  const hasClickSignal = draft.current.clicks >= 20 || clickDelta >= 15;
  const nearPageOne = draft.current.averagePosition > 0 && draft.current.averagePosition <= 12;
  const strategic = STRATEGIC_FAMILIES.has(draft.family);
  if (hasAbsoluteSignal && hasClickSignal && nearPageOne) return true;
  return strategic && nearPageOne && draft.current.impressions >= 120 && impressionDelta >= 80 && hasClickSignal;
}

function isBrandTypoMomentum(draft: MomentumDraft) {
  const text = normalizeSeoQuery([draft.queryCluster, ...draft.representativeQueries].filter(Boolean).join(' '));
  return /\bmaxvedio\b|\bmaxvideos\b|\bmax videoa\b|\bmaxvideai\b|\bmax vidio\b/.test(text);
}

function targetLabel(draft: MomentumDraft) {
  return draft.queryCluster ?? draft.pageUrl ?? draft.family;
}

function formatMetrics(metrics: SeoSourceMetrics) {
  return [
    `${metrics.clicks} clicks`,
    `${metrics.impressions} impressions`,
    `${(metrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${metrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

function formatDelta(value: number, label: string) {
  return `${formatSignedNumber(value)} ${label}`;
}

function formatSignedNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function isAdultOrJunkText(value: string) {
  return /\b(?:porn|porno|nsfw|nude|naked|sex|sexy|xxx|onlyfans|casino|gambling|torrent|crack|hack)\b/.test(value);
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
