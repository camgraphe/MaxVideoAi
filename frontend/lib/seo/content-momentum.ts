import type { GscPerformanceRow } from './gsc-analysis';
import type {
  ContentMomentumItem,
  ContentMomentumType,
  SeoActionPriority,
  SeoSourceMetrics,
  StrategicSeoFamily,
} from './internal-seo-types';
import {
  detectStrategicModelFamily,
  getSeoFamilyStatus,
} from './seo-intents';
import { clusterGscQueries, stripOrigin, summarizeRows } from './seo-opportunity-engine';
import {
  formatContentMomentumMarkdown,
  formatDelta,
  formatSignedNumber,
  formatSignedPercent,
} from './content-momentum-format';
import {
  calibrateScore,
  classifyMixedFamilyMomentum,
  classifyTrend,
  isJunkMomentumDraft,
  isWorthMomentumItem,
  scoreMomentumDraft,
  scoreToPriority,
} from './content-momentum-scoring';

export {
  formatContentMomentumMarkdown,
  formatContentMomentumSectionMarkdown,
  labelizeMomentumType,
} from './content-momentum-format';

const MAX_MOMENTUM_ITEMS = 80;
const STRATEGIC_FAMILIES = new Set(['Seedance', 'Kling', 'Veo', 'LTX']);

type BuildContentMomentumOptions = {
  currentRows: GscPerformanceRow[];
  previousRows: GscPerformanceRow[];
};

export type MomentumDraft = {
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
  const score = calibrateScore(draft, scoreMomentumDraft(draft, clickDelta, impressionDelta, ctrDelta));
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

function targetLabel(draft: MomentumDraft) {
  return draft.queryCluster ?? draft.pageUrl ?? draft.family;
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
