import type { GscPerformanceRow } from './gsc-analysis';
import type {
  SeoFamilyMomentum,
  SeoFamilyTrackerItem,
  StrategicSeoFamily,
  StrategicSeoOpportunity,
} from './internal-seo-types';
import {
  detectStrategicModelFamily,
  getFamilyPriorityLabel,
  getFamilyPriorityRank,
  getSeoFamilyDictionary,
  getSeoFamilyStatus,
} from './seo-intents';
import { clusterGscQueries, summarizeRows } from './seo-opportunity-engine';

export function buildModelFamilyTracker(
  currentRows: GscPerformanceRow[],
  opportunities: StrategicSeoOpportunity[],
  previousRows: GscPerformanceRow[] = []
): SeoFamilyTrackerItem[] {
  const currentByFamily = groupRowsByFamily(currentRows);
  const previousByFamily = groupRowsByFamily(previousRows);
  const opportunityByFamily = groupOpportunitiesByFamily(opportunities);
  const familySet = new Set<StrategicSeoFamily>([
    ...getSeoFamilyDictionary().map((family) => family.label),
    ...currentByFamily.keys(),
    ...opportunityByFamily.keys(),
  ]);

  return Array.from(familySet)
    .map((family) => {
      const familyRows = currentByFamily.get(family) ?? [];
      const previousFamilyRows = previousByFamily.get(family) ?? [];
      const familyOpportunities = opportunityByFamily.get(family) ?? [];
      const current = summarizeRows(familyRows);
      const previous = summarizeRows(previousFamilyRows);
      const topQueryClusters = Array.from(new Set(clusterGscQueries(familyRows).map((cluster) => cluster.label))).slice(0, 4);
      const highPriorityOpportunityCount = familyOpportunities.filter(
        (opportunity) => opportunity.priority === 'critical' || opportunity.priority === 'high'
      ).length;

      return {
        family,
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: current.ctr,
        position: current.averagePosition,
        familyStatus: getSeoFamilyStatus(family),
        businessPriorityRank: getFamilyPriorityRank(family),
        businessPriorityLabel: getFamilyPriorityLabel(family),
        opportunityCount: familyOpportunities.length,
        highPriorityOpportunityCount,
        topQueryClusters,
        recommendedNextAction: buildRecommendedAction(family, familyOpportunities, topQueryClusters),
        momentum: determineMomentum(current.impressions, previous.impressions),
        impressionsDelta: previousFamilyRows.length ? current.impressions - previous.impressions : null,
        clicksDelta: previousFamilyRows.length ? current.clicks - previous.clicks : null,
      };
    })
    .sort((a, b) => {
      const rankDelta = a.businessPriorityRank - b.businessPriorityRank;
      if (rankDelta !== 0) return rankDelta;
      return b.highPriorityOpportunityCount - a.highPriorityOpportunityCount || b.impressions - a.impressions;
    });
}

function groupRowsByFamily(rows: GscPerformanceRow[]) {
  const groups = new Map<StrategicSeoFamily, GscPerformanceRow[]>();
  for (const row of rows) {
    const family = detectStrategicModelFamily(row.query, row.page);
    groups.set(family, [...(groups.get(family) ?? []), row]);
  }
  return groups;
}

function groupOpportunitiesByFamily(opportunities: StrategicSeoOpportunity[]) {
  const groups = new Map<StrategicSeoFamily, StrategicSeoOpportunity[]>();
  for (const opportunity of opportunities) {
    groups.set(opportunity.modelFamily, [...(groups.get(opportunity.modelFamily) ?? []), opportunity]);
  }
  return groups;
}

function determineMomentum(currentImpressions: number, previousImpressions: number): SeoFamilyMomentum {
  if (!previousImpressions) return 'unknown';
  const deltaRatio = (currentImpressions - previousImpressions) / previousImpressions;
  if (deltaRatio >= 0.08) return 'gaining';
  if (deltaRatio <= -0.08) return 'declining';
  return 'flat';
}

function buildRecommendedAction(
  family: StrategicSeoFamily,
  opportunities: StrategicSeoOpportunity[],
  clusters: string[]
): string {
  const top = opportunities[0];
  if (top) return top.suggestedAction;
  if (family === 'Sora') {
    return 'Monitor Sora demand and route attention toward higher-priority model families when comparisons are useful.';
  }
  if (getSeoFamilyStatus(family) === 'emerging') {
    return 'Track emerging demand and only create action work when repeated clusters or strong commercial intent appear.';
  }
  if (clusters.length) {
    return `Review the leading cluster "${clusters[0]}" and decide whether the ranking page needs a tighter section or stronger snippet promise.`;
  }
  return 'No immediate action from current GSC rows; keep the family on the watchlist.';
}
