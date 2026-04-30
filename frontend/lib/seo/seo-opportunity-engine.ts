import type { GscPerformanceRow } from './gsc-analysis';
import type {
  SeoIntentType,
  SeoQueryCluster,
  StrategicSeoFamily,
  StrategicSeoIssueType,
  StrategicSeoOpportunity,
} from './internal-seo-types';
import {
  classifySeoIntent,
  compactIntentLabel,
  detectStrategicModelFamily,
  getBusinessPriorityWeight,
  isStrategicIntent,
  normalizeSeoQuery,
} from './seo-intents';

const MIN_CLUSTER_IMPRESSIONS = 50;
const MIN_STRATEGIC_IMPRESSIONS = 20;
const TOP_QUERY_LIMIT = 4;

export function clusterGscQueries(rows: GscPerformanceRow[]): SeoQueryCluster[] {
  const grouped = new Map<string, GscPerformanceRow[]>();

  for (const row of rows) {
    if (!row.query) continue;
    const family = detectStrategicModelFamily(row.query, row.page);
    const intent = normalizeCompositeIntent(classifySeoIntent(row.query, row.page));
    const terms = extractImportantTerms(row.query, family, intent);
    const key = [family, intent, terms.join(' ') || normalizeSeoQuery(row.query)].join('|');
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return Array.from(grouped.entries())
    .map(([key, groupRows]) => {
      const first = groupRows[0];
      const family = detectStrategicModelFamily(first?.query, first?.page);
      const intent = normalizeCompositeIntent(classifySeoIntent(first?.query, first?.page));
      const importantTerms = extractImportantTerms(first?.query, family, intent);
      const targetUrl = pickTargetUrl(groupRows);
      const representativeQueries = pickRepresentativeQueries(groupRows);
      return {
        id: stableId(key),
        key,
        label: buildClusterLabel(representativeQueries, family, intent, importantTerms),
        targetUrl,
        modelFamily: family,
        intent,
        representativeQueries,
        importantTerms,
        rows: groupRows,
        metrics: summarizeRows(groupRows),
      };
    })
    .sort((a, b) => b.metrics.impressions - a.metrics.impressions || b.metrics.clicks - a.metrics.clicks);
}

export function buildStrategicSeoOpportunities(rows: GscPerformanceRow[]): StrategicSeoOpportunity[] {
  const opportunities: StrategicSeoOpportunity[] = [];

  for (const cluster of clusterGscQueries(rows)) {
    if (!clusterIsWorthAction(cluster)) continue;
    const issueTypes = detectIssueTypes(cluster);
    for (const issueType of issueTypes) {
      opportunities.push(buildOpportunity(cluster, issueType));
    }
  }

  return dedupeOpportunities(opportunities)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score)
    .slice(0, 120);
}

export function summarizeRows(rows: GscPerformanceRow[]) {
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const averagePosition = impressions
    ? rows.reduce((total, row) => total + row.position * row.impressions, 0) / impressions
    : 0;
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    averagePosition,
  };
}

export function stripOrigin(url: string | null): string {
  if (!url) return 'No target URL';
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function detectIssueTypes(cluster: SeoQueryCluster): StrategicSeoIssueType[];
function detectIssueTypes(cluster: SeoQueryCluster): StrategicSeoIssueType[] {
  const { clicks, impressions, ctr, averagePosition } = cluster.metrics;
  const issues: StrategicSeoIssueType[] = [];

  if (cluster.intent === 'brand_typo') return ['brand_typo'];

  if (impressions >= 250 && ctr <= 0.012) issues.push('high_impressions_low_ctr');
  if (averagePosition <= 3.5 && clicks === 0 && impressions >= 50) issues.push('good_position_zero_clicks');
  if (averagePosition >= 4 && averagePosition <= 12 && impressions >= 80) issues.push('position_4_to_12');
  if (cluster.modelFamily !== 'Other' && cluster.modelFamily !== 'Brand' && impressions >= 60) {
    issues.push('model_family_opportunity');
  }
  if (cluster.intent === 'comparison' && impressions >= 35) issues.push('comparison_intent');
  if ((cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') && impressions >= 25) {
    issues.push('prompt_examples_intent');
  }
  if ((cluster.intent === 'pricing_specs' || cluster.intent === 'pricing' || cluster.intent === 'specs' || cluster.intent === 'max_length') && impressions >= 35) {
    issues.push('pricing_specs_intent');
  }
  if (cluster.modelFamily === 'Sora' && impressions >= 80) issues.push('outdated_deprioritized_model');

  return Array.from(new Set(issues));
}

function buildOpportunity(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType): StrategicSeoOpportunity {
  const businessPriorityWeight = getBusinessPriorityWeight(cluster.modelFamily);
  const baseScore = scoreIssue(cluster, issueType);
  const rawScore = Math.round(baseScore * businessPriorityWeight);
  const score = calibrateScore(cluster, issueType, rawScore);
  const priority = scoreToPriority(score);
  const targetPath = stripOrigin(cluster.targetUrl);
  const title = buildOpportunityTitle(cluster, issueType, targetPath);
  const observedIssue = buildObservedIssue(cluster, issueType);
  const suggestedAction = buildSuggestedAction(cluster, issueType);
  const expectedImpact = buildExpectedImpact(cluster, issueType);

  const opportunity: StrategicSeoOpportunity = {
    id: `${issueType}_${cluster.intent}_${stableId([issueType, cluster.key, targetPath].join('|'))}`,
    title,
    priority,
    score,
    targetUrl: cluster.targetUrl,
    queryCluster: cluster.label,
    representativeQueries: cluster.representativeQueries,
    modelFamily: cluster.modelFamily,
    intent: cluster.intent,
    issueType,
    observedIssue,
    suggestedAction,
    expectedImpact,
    sourceMetrics: cluster.metrics,
    businessPriorityWeight,
    codexTaskDraft: '',
  };

  opportunity.codexTaskDraft = buildCodexTaskDraft(opportunity);
  return opportunity;
}

function scoreIssue(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType): number {
  const impressionsScore = Math.min(42, Math.log10(Math.max(cluster.metrics.impressions, 1)) * 18);
  const positionScore = cluster.metrics.averagePosition <= 3
    ? 26
    : cluster.metrics.averagePosition <= 8
      ? 20
      : cluster.metrics.averagePosition <= 12
        ? 13
        : 4;
  const lowCtrScore = Math.max(0, Math.min(24, (0.025 - cluster.metrics.ctr) * 900));
  const strategicIntentScore = isStrategicIntent(cluster.intent) ? 14 : 0;
  const repeatScore = Math.min(10, cluster.representativeQueries.length * 3);
  const issueBoost: Record<StrategicSeoIssueType, number> = {
    high_impressions_low_ctr: 22,
    good_position_zero_clicks: 24,
    position_4_to_12: 16,
    model_family_opportunity: 8,
    comparison_intent: 15,
    prompt_examples_intent: 15,
    pricing_specs_intent: 14,
    brand_typo: 12,
    outdated_deprioritized_model: -8,
  };

  return impressionsScore + positionScore + lowCtrScore + strategicIntentScore + repeatScore + issueBoost[issueType];
}

function calibrateScore(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType, rawScore: number): number {
  if (issueType === 'brand_typo') return Math.min(rawScore, 92);

  const { impressions, ctr, averagePosition } = cluster.metrics;
  const hasStrongCtr = ctr >= 0.12;
  const hasGoodPosition = averagePosition > 0 && averagePosition <= 6;

  if (cluster.intent === 'comparison' && hasStrongCtr && hasGoodPosition && impressions < 250) {
    return Math.min(rawScore, 105);
  }

  if (
    issueType === 'pricing_specs_intent' &&
    averagePosition >= 30 &&
    impressions < 250
  ) {
    return Math.min(rawScore, 54);
  }

  return rawScore;
}

function scoreToPriority(score: number) {
  if (score >= 112) return 'critical';
  if (score >= 86) return 'high';
  if (score >= 58) return 'medium';
  return 'low';
}

function clusterIsWorthAction(cluster: SeoQueryCluster): boolean {
  if (cluster.metrics.impressions >= MIN_CLUSTER_IMPRESSIONS) return true;
  if (cluster.metrics.impressions < MIN_STRATEGIC_IMPRESSIONS) return false;
  if (cluster.representativeQueries.length >= 2 && isStrategicIntent(cluster.intent)) return true;
  if (cluster.modelFamily !== 'Other' && cluster.modelFamily !== 'Sora' && isStrategicIntent(cluster.intent)) return true;
  return cluster.intent === 'brand_typo';
}

function normalizeCompositeIntent(intent: SeoIntentType): SeoIntentType {
  if (intent === 'pricing' || intent === 'specs' || intent === 'max_length' || intent === 'model_parameters') {
    return 'pricing_specs';
  }
  if (intent === 'prompt_guide') return 'prompt_examples';
  return intent;
}

function extractImportantTerms(query: string | null | undefined, family: StrategicSeoFamily, intent: SeoIntentType): string[] {
  const normalized = normalizeSeoQuery(query);
  if (!normalized) return [];
  const tokens = normalized.split(' ').filter(Boolean);
  const stop = new Set([
    'ai',
    'video',
    'generator',
    'generate',
    'model',
    'models',
    'the',
    'a',
    'an',
    'for',
    'with',
    'and',
    'to',
    'of',
    'how',
    'what',
    'is',
  ]);
  const familyToken = family === 'Hailuo / Minimax' ? 'hailuo' : family.toLowerCase().split(' ')[0];
  const terms = tokens.filter((token) => !stop.has(token));

  if (intent === 'comparison') return keepComparisonTerms(terms, familyToken);
  if (intent === 'prompt_examples' || intent === 'prompt_guide') return keepTerms(terms, familyToken, ['prompt', 'prompts', 'examples', 'guide']);
  if (intent === 'examples') return keepTerms(terms, familyToken, ['examples', 'example', 'samples', 'gallery']);
  if (intent === 'pay_as_you_go') return ['pay-as-you-go'];
  if (intent === 'pricing_specs') return keepTerms(terms, familyToken, ['pricing', 'price', 'cost', 'specs', 'max', 'length', 'duration', 'parameters']);
  if (intent === 'brand_typo') return ['brand-typo'];
  if (intent === 'brand') return ['brand'];

  return terms.slice(0, 5);
}

function keepComparisonTerms(terms: string[], familyToken: string) {
  return terms
    .filter((term) => term === familyToken || ['vs', 'versus', 'fast', 'lite', 'pro', 'difference', 'compare'].includes(term))
    .filter((term, index, values) => values.indexOf(term) === index)
    .sort((a, b) => comparisonTermSortRank(a, familyToken) - comparisonTermSortRank(b, familyToken) || a.localeCompare(b))
    .slice(0, 8);
}

function comparisonTermSortRank(term: string, familyToken: string) {
  if (term === familyToken) return 1;
  if (term === 'vs' || term === 'versus') return 2;
  return 3;
}

function keepTerms(terms: string[], familyToken: string, anchors: string[]) {
  return terms
    .map((term) => {
      if (term === 'prompt' || term === 'prompts' || term === 'example' || term === 'examples' || term === 'guide') {
        return anchors.includes(term) ? 'prompts' : term;
      }
      return term;
    })
    .filter((term, index, values) => values.indexOf(term) === index)
    .filter((term) => term === familyToken || /\d/.test(term) || anchors.includes(term) || term === 'prompts')
    .sort((a, b) => termSortRank(a, familyToken, anchors) - termSortRank(b, familyToken, anchors) || a.localeCompare(b))
    .slice(0, 8);
}

function termSortRank(term: string, familyToken: string, anchors: string[]) {
  if (term === familyToken) return 1;
  if (/\d/.test(term)) return 2;
  if (term === 'prompts') return 3;
  if (anchors.includes(term)) return 4;
  return 9;
}

function buildClusterLabel(
  queries: string[],
  family: StrategicSeoFamily,
  intent: SeoIntentType,
  importantTerms: string[]
): string {
  const best = queries[0] ? normalizeSeoQuery(queries[0]) : '';
  if (best) return best;
  const terms = importantTerms.join(' ');
  if (terms) return terms;
  return `${family.toLowerCase()} ${compactIntentLabel(intent).toLowerCase()}`;
}

function pickTargetUrl(rows: GscPerformanceRow[]) {
  const counts = new Map<string, { url: string; impressions: number }>();
  for (const row of rows) {
    if (!row.page) continue;
    const existing = counts.get(row.page) ?? { url: row.page, impressions: 0 };
    existing.impressions += row.impressions;
    counts.set(row.page, existing);
  }
  return Array.from(counts.values()).sort((a, b) => b.impressions - a.impressions)[0]?.url ?? null;
}

function pickRepresentativeQueries(rows: GscPerformanceRow[]) {
  const counts = new Map<string, { query: string; impressions: number; clicks: number }>();
  for (const row of rows) {
    if (!row.query) continue;
    const key = normalizeSeoQuery(row.query);
    const existing = counts.get(key) ?? { query: row.query, impressions: 0, clicks: 0 };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    counts.set(key, existing);
  }
  return Array.from(counts.values())
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, TOP_QUERY_LIMIT)
    .map((entry) => entry.query);
}

function buildOpportunityTitle(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType, targetPath: string) {
  const intentLabel = compactIntentLabel(cluster.intent).toLowerCase();
  if (issueType === 'brand_typo') return `Defend brand typo demand on ${targetPath}`;
  if (issueType === 'outdated_deprioritized_model') return `Reposition Sora demand on ${targetPath}`;
  if (issueType === 'comparison_intent' && isHealthyGrowthCluster(cluster)) {
    return `Expand ${cluster.modelFamily} ${intentLabel} demand on ${targetPath}`;
  }
  return `Improve ${cluster.modelFamily} ${intentLabel} performance on ${targetPath}`;
}

function buildObservedIssue(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType) {
  const metrics = cluster.metrics;
  const metricLine = `${metrics.impressions} impressions, ${metrics.clicks} clicks, ${(metrics.ctr * 100).toFixed(2)}% CTR, avg position ${metrics.averagePosition.toFixed(1)}`;
  const intentContext =
    cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide'
      ? ' Prompt intent is present in the query cluster.'
      : '';
  if (issueType === 'high_impressions_low_ctr') {
    return `The cluster has meaningful visibility but weak click-through: ${metricLine}.${intentContext}`;
  }
  if (issueType === 'good_position_zero_clicks') {
    return `The cluster ranks strongly but has no clicks: ${metricLine}.${intentContext}`;
  }
  if (issueType === 'position_4_to_12') {
    return `The cluster sits in the push range, close enough to improve with stronger content and internal support: ${metricLine}.${intentContext}`;
  }
  if (issueType === 'comparison_intent') {
    if (isHealthyGrowthCluster(cluster)) {
      return `This comparison cluster is already earning clicks, so treat it as expand/defend work rather than an urgent CTR fix: ${metricLine}.`;
    }
    return `Searchers are comparing options, but the ranking page may not make the comparison intent explicit enough: ${metricLine}.`;
  }
  if (issueType === 'prompt_examples_intent') {
    return `Prompt/example intent is visible in GSC, but the page may not surface prompt help strongly enough: ${metricLine}.`;
  }
  if (issueType === 'pricing_specs_intent') {
    return `Pricing, specs, limits, or duration intent is present and should be answered quickly: ${metricLine}.`;
  }
  if (issueType === 'brand_typo') {
    return `Brand typo demand is appearing in GSC and should route clearly back to MaxVideoAI: ${metricLine}.`;
  }
  if (issueType === 'outdated_deprioritized_model') {
    return `Sora demand is present, but Sora is de-prioritized against MaxVideoAI's current model strategy: ${metricLine}.`;
  }
  return `The model family has enough strategic demand to deserve focused improvement: ${metricLine}.`;
}

function buildSuggestedAction(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType) {
  if (cluster.intent === 'prompt_examples' || cluster.intent === 'prompt_guide') {
    return 'Add a compact prompt examples section, improve prompt-oriented FAQ entries, and link to the matching examples page where appropriate.';
  }
  if (issueType === 'comparison_intent') {
    if (isHealthyGrowthCluster(cluster)) {
      return 'Expand and defend the comparison page with compact copy that clarifies variants, reinforces the current ranking, and routes users to the best matching model pages.';
    }
    return 'Add or strengthen a compact comparison block that names the compared variants, clarifies differences, and links to the best matching model pages.';
  }
  if (issueType === 'pricing_specs_intent') {
    return 'Make price, credit, duration, resolution, or limit details easier to scan near the top of the target page.';
  }
  if (issueType === 'brand_typo') {
    return 'Create copy and metadata coverage that reinforces the correct MaxVideoAI spelling while capturing common typo demand.';
  }
  if (issueType === 'outdated_deprioritized_model') {
    return 'Keep the page useful but route attention toward stronger current model families with comparison links and updated positioning.';
  }
  if (issueType === 'good_position_zero_clicks' || issueType === 'high_impressions_low_ctr') {
    return 'Tighten the title/meta direction and above-the-fold promise so the visible snippet mirrors the query intent more directly.';
  }
  return 'Strengthen the target page with a focused content block and clearer internal links from related MaxVideoAI hubs.';
}

function buildExpectedImpact(cluster: SeoQueryCluster, issueType: StrategicSeoIssueType) {
  if (issueType === 'comparison_intent' && isHealthyGrowthCluster(cluster)) {
    return 'The page should protect existing comparison demand while nudging a good page-one ranking toward stronger qualified traffic.';
  }
  if (issueType === 'position_4_to_12') return 'Better topical coverage and internal support should improve rankings from page-one lower positions into higher-click positions.';
  if (issueType === 'good_position_zero_clicks' || issueType === 'high_impressions_low_ctr') {
    return 'A clearer snippet promise should improve CTR without needing new demand.';
  }
  if (issueType === 'outdated_deprioritized_model') return 'The page can preserve Sora traffic while steering users toward higher-priority MaxVideoAI model families.';
  return 'The page should capture more qualified clicks by matching the observed search intent more explicitly.';
}

function buildCodexTaskDraft(opportunity: StrategicSeoOpportunity) {
  const target = stripOrigin(opportunity.targetUrl);
  return [
    'Title:',
    opportunity.title,
    '',
    'Source:',
    `GSC query cluster: ${opportunity.representativeQueries.map((query) => `"${query}"`).join(', ')}`,
    '',
    'Problem:',
    opportunity.observedIssue,
    '',
    'Recommended implementation:',
    opportunity.suggestedAction,
    '',
    'Acceptance criteria:',
    `- Target page remains ${target}`,
    '- Query intent is visible without generic or robotic copy',
    '- Page remains compact, premium, and aligned with the existing MaxVideoAI page structure',
  ].join('\n');
}

function dedupeOpportunities(opportunities: StrategicSeoOpportunity[]) {
  const bestByCluster = new Map<string, StrategicSeoOpportunity>();
  for (const opportunity of opportunities) {
    const key = `${opportunity.targetUrl ?? ''}|${opportunity.queryCluster}`;
    const existing = bestByCluster.get(key);
    if (!existing || compareOpportunityQuality(opportunity, existing) < 0) {
      bestByCluster.set(key, opportunity);
    }
  }
  return Array.from(bestByCluster.values());
}

function compareOpportunityQuality(a: StrategicSeoOpportunity, b: StrategicSeoOpportunity) {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  const scoreDelta = b.score - a.score;
  if (scoreDelta !== 0) return scoreDelta;
  return issueSelectionRank(a.issueType) - issueSelectionRank(b.issueType);
}

function issueSelectionRank(issueType: StrategicSeoIssueType) {
  const ranks: Record<StrategicSeoIssueType, number> = {
    high_impressions_low_ctr: 1,
    good_position_zero_clicks: 2,
    position_4_to_12: 3,
    comparison_intent: 4,
    prompt_examples_intent: 4,
    pricing_specs_intent: 4,
    model_family_opportunity: 5,
    brand_typo: 2,
    outdated_deprioritized_model: 4,
  };
  return ranks[issueType];
}

function isHealthyGrowthCluster(cluster: SeoQueryCluster) {
  return cluster.metrics.ctr >= 0.12 && cluster.metrics.averagePosition > 0 && cluster.metrics.averagePosition <= 6;
}

function priorityRank(priority: StrategicSeoOpportunity['priority']) {
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
  return `seo_${Math.abs(hash).toString(36)}`;
}
