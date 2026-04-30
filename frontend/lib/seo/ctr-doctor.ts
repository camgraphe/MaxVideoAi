import type { GscPerformanceRow } from './gsc-analysis';
import type {
  CtrDoctorIssueType,
  CtrDoctorItem,
  SeoActionPriority,
  SeoIntentType,
  SeoPageMetadataSnapshot,
  SeoQueryCluster,
  StrategicSeoFamily,
} from './internal-seo-types';
import {
  compactIntentLabel,
  getBusinessPriorityWeight,
  isStrategicIntent,
} from './seo-intents';
import {
  clusterGscQueries,
  stripOrigin,
} from './seo-opportunity-engine';

type CtrDoctorOptions = {
  metadataByUrl?: Record<string, SeoPageMetadataSnapshot | null>;
};

const MIN_CTR_DOCTOR_IMPRESSIONS = 35;
const MAX_ITEMS = 40;

export function buildCtrDoctorItems(rows: GscPerformanceRow[], options: CtrDoctorOptions = {}): CtrDoctorItem[] {
  const items: CtrDoctorItem[] = [];

  for (const cluster of clusterGscQueries(rows)) {
    const issueType = detectCtrIssueType(cluster);
    if (!issueType) continue;
    items.push(buildCtrDoctorItem(cluster, issueType, options.metadataByUrl));
  }

  return dedupeCtrDoctorItems(items)
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score)
    .slice(0, MAX_ITEMS);
}

export function formatCtrDoctorMarkdown(item: CtrDoctorItem): string {
  return [
    'Title:',
    item.title,
    '',
    'Target:',
    stripOrigin(item.targetUrl),
    '',
    'Source:',
    `GSC query cluster: ${item.representativeQueries.map((query) => `"${query}"`).join(', ')}`,
    `Metrics: ${formatMetrics(item)}`,
    '',
    'Observed:',
    item.likelyProblem,
    '',
    'Recommended title direction:',
    item.recommendedTitleDirection,
    '',
    'Recommended meta description direction:',
    item.recommendedMetaDescriptionDirection,
    '',
    'Recommended H1 / section direction:',
    item.recommendedH1SectionDirection,
    '',
    'Above-the-fold recommendation:',
    item.aboveTheFoldRecommendation,
    '',
    'Recommended implementation:',
    buildRecommendedImplementation(item),
    '',
    'Acceptance criteria:',
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatCtrDoctorSectionMarkdown(items: CtrDoctorItem[]): string {
  if (!items.length) {
    return ['# CTR Doctor', '', 'No CTR Doctor items generated for this snapshot.'].join('\n');
  }

  return [
    '# CTR Doctor',
    '',
    `Generated items: ${items.length}`,
    '',
    ...items.map((item, index) => [`## ${index + 1}. ${item.title}`, '', formatCtrDoctorMarkdown(item)].join('\n')),
  ].join('\n\n');
}

function detectCtrIssueType(cluster: SeoQueryCluster): CtrDoctorIssueType | null {
  const { clicks, impressions, ctr, averagePosition } = cluster.metrics;
  if (impressions < MIN_CTR_DOCTOR_IMPRESSIONS) return null;

  if (cluster.intent === 'brand_typo') {
    return impressions >= 80 && ctr < 0.08 ? 'brand_typo_ctr' : null;
  }

  if (averagePosition >= 30) {
    if (isPricingSpecsIntent(cluster.intent) && impressions >= 50) return 'far_position_watchlist';
    return null;
  }

  if (impressions >= 250 && ctr <= 0.018) return 'high_impressions_low_ctr';
  if (clicks === 0 && impressions >= 50 && averagePosition > 0 && averagePosition <= 8) {
    return 'good_position_zero_clicks';
  }
  if (isCtrSensitiveIntent(cluster.intent) && impressions >= 50 && averagePosition > 0 && averagePosition <= 12 && ctr <= 0.04) {
    return 'intent_snippet_mismatch';
  }
  if (isHealthyGoodPerformer(cluster)) return 'expand_defend_good_performer';

  return null;
}

function buildCtrDoctorItem(
  cluster: SeoQueryCluster,
  issueType: CtrDoctorIssueType,
  metadataByUrl?: Record<string, SeoPageMetadataSnapshot | null>
): CtrDoctorItem {
  const targetPath = stripOrigin(cluster.targetUrl);
  const currentMetadata = cluster.targetUrl ? metadataByUrl?.[cluster.targetUrl] ?? null : null;
  const score = calibrateScore(cluster, issueType, scoreCtrIssue(cluster, issueType));
  const itemWithoutDraft: Omit<CtrDoctorItem, 'codexTaskDraft'> = {
    id: `${issueType}_${cluster.intent}_${stableId(`${cluster.targetUrl ?? ''}|${cluster.key}|${issueType}`)}`,
    title: buildTitle(cluster, issueType, targetPath),
    priority: scoreToPriority(score),
    score,
    targetUrl: cluster.targetUrl,
    queryCluster: cluster.label,
    representativeQueries: cluster.representativeQueries,
    currentMetrics: cluster.metrics,
    modelFamily: cluster.modelFamily,
    detectedIntent: cluster.intent,
    issueType,
    likelyProblem: buildLikelyProblem(cluster, issueType),
    recommendedTitleDirection: buildTitleDirection(cluster, issueType),
    recommendedMetaDescriptionDirection: buildMetaDirection(cluster, issueType),
    recommendedH1SectionDirection: buildH1Direction(cluster, issueType),
    aboveTheFoldRecommendation: buildAboveFoldRecommendation(cluster, issueType),
    currentMetadata,
    acceptanceCriteria: buildAcceptanceCriteria(cluster, issueType),
  };

  return {
    ...itemWithoutDraft,
    codexTaskDraft: formatCtrDoctorMarkdown(itemWithoutDraft as CtrDoctorItem),
  };
}

function scoreCtrIssue(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType): number {
  const { impressions, ctr, averagePosition, clicks } = cluster.metrics;
  const impressionsScore = Math.min(38, Math.log10(Math.max(impressions, 1)) * 16);
  const positionScore =
    averagePosition <= 3.5
      ? 24
      : averagePosition <= 8
        ? 18
        : averagePosition <= 12
          ? 10
          : averagePosition <= 30
            ? 4
            : -16;
  const ctrGapScore = Math.max(0, Math.min(24, (0.035 - ctr) * 850));
  const zeroClickScore = clicks === 0 ? 16 : 0;
  const intentScore = isStrategicIntent(cluster.intent) ? 12 : 0;
  const repeatScore = Math.min(8, cluster.representativeQueries.length * 2);
  const issueBoost: Record<CtrDoctorIssueType, number> = {
    high_impressions_low_ctr: 22,
    good_position_zero_clicks: 24,
    intent_snippet_mismatch: 16,
    expand_defend_good_performer: 8,
    far_position_watchlist: -10,
    brand_typo_ctr: 6,
  };
  return Math.round(
    (impressionsScore + positionScore + ctrGapScore + zeroClickScore + intentScore + repeatScore + issueBoost[issueType]) *
      getBusinessPriorityWeight(cluster.modelFamily)
  );
}

function calibrateScore(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType, rawScore: number): number {
  if (issueType === 'far_position_watchlist') return Math.min(rawScore, 48);
  if (issueType === 'brand_typo_ctr') return Math.min(rawScore, 74);
  if (issueType === 'expand_defend_good_performer') return Math.min(rawScore, 84);
  if (cluster.metrics.averagePosition >= 20 && cluster.metrics.impressions < 250) return Math.min(rawScore, 54);
  return rawScore;
}

function scoreToPriority(score: number): SeoActionPriority {
  if (score >= 108) return 'critical';
  if (score >= 78) return 'high';
  if (score >= 52) return 'medium';
  return 'low';
}

function buildTitle(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType, targetPath: string) {
  const intent = compactIntentLabel(cluster.intent).toLowerCase();
  if (issueType === 'expand_defend_good_performer') {
    return `Expand snippet match for ${cluster.label} on ${targetPath}`;
  }
  if (cluster.modelFamily !== 'Other' && cluster.modelFamily !== 'Brand') {
    return `Improve ${cluster.modelFamily} ${intent} snippet on ${targetPath}`;
  }
  if (cluster.intent === 'brand_typo') return `Tune MaxVideoAI brand typo snippet on ${targetPath}`;
  return `Improve ${intent} snippet on ${targetPath}`;
}

function buildLikelyProblem(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  const metrics = `${cluster.metrics.impressions} impressions, ${cluster.metrics.clicks} clicks, ${(cluster.metrics.ctr * 100).toFixed(2)}% CTR, avg position ${cluster.metrics.averagePosition.toFixed(1)}`;
  if (issueType === 'high_impressions_low_ctr') {
    return `The page is visible but CTR is weak for the query intent: ${metrics}. The title/meta or above-the-fold promise may not match what searchers expect.`;
  }
  if (issueType === 'good_position_zero_clicks') {
    return `The page has good average position but no clicks for this cluster: ${metrics}. The snippet may not make the value proposition specific enough.`;
  }
  if (issueType === 'intent_snippet_mismatch') {
    return `The page ranks for a clear ${compactIntentLabel(cluster.intent).toLowerCase()} intent, but the snippet likely needs a sharper promise: ${metrics}.`;
  }
  if (issueType === 'expand_defend_good_performer') {
    return `This is already a good performer, so treat it as expand/defend rather than an urgent fix. CTR is strong, but average position leaves room to grow: ${metrics}.`;
  }
  if (issueType === 'far_position_watchlist') {
    return `This is a watchlist item: the intent is useful, but the average position is still far from page one, so snippet work should not compete with closer opportunities: ${metrics}.`;
  }
  return `Brand typo demand is present, but it should be handled without typo-stuffed copy: ${metrics}.`;
}

function buildTitleDirection(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  if (issueType === 'far_position_watchlist') {
    return `Keep "${cluster.label}" as a watchlist title direction for now; revisit when the page ranks closer or impressions grow materially.`;
  }
  if (cluster.intent === 'comparison') {
    return `Make the comparison explicit near the start of the title, using the natural cluster language: ${cluster.label}.`;
  }
  if (cluster.intent === 'prompt_examples') {
    return `Make "${cluster.label}" visible in the title direction if it fits the page intent.`;
  }
  if (isPricingSpecsIntent(cluster.intent)) {
    return `Lead with pricing, specs, duration, or limits only when that is the real page promise; avoid overclaiming if the page is a broader pricing page.`;
  }
  if (cluster.intent === 'brand_typo') {
    return 'Use the correct MaxVideoAI spelling and natural brand reassurance; do not add awkward typo strings to the visible title.';
  }
  if (cluster.intent === 'examples' && cluster.modelFamily !== 'Other' && cluster.modelFamily !== 'Brand') {
    return `Make ${cluster.modelFamily} examples explicit in the title if that matches the page, especially for "${cluster.label}".`;
  }
  if (issueType === 'expand_defend_good_performer') {
    return `Protect the current title intent while making the strongest search angle more explicit: ${cluster.label}.`;
  }
  return `Make the title direction match the searcher's ${compactIntentLabel(cluster.intent).toLowerCase()} intent more directly.`;
}

function buildMetaDirection(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  if (issueType === 'far_position_watchlist') {
    return 'Keep this as a future snippet review unless the page starts ranking closer; do not spend major copy work on it yet.';
  }
  if (cluster.intent === 'comparison') {
    return 'Use the meta description to state what is compared, who each option fits, and that users can generate through MaxVideoAI.';
  }
  if (cluster.intent === 'prompt_examples') {
    return 'Mention examples, prompt patterns, and practical outputs without turning the snippet into a keyword list.';
  }
  if (isPricingSpecsIntent(cluster.intent)) {
    return 'Answer price/spec/limit intent quickly in plain language, including pay-as-you-go context only if the target page supports it.';
  }
  if (cluster.intent === 'brand_typo') {
    return 'Confirm the correct MaxVideoAI brand and product category naturally, with no typo stuffing.';
  }
  return 'Clarify the user outcome and why this MaxVideoAI page is the right result for the cluster.';
}

function buildH1Direction(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  if (issueType === 'far_position_watchlist') {
    return `Do not rewrite the H1 urgently for "${cluster.label}"; note the intent and revisit if ranking improves.`;
  }
  if (cluster.intent === 'prompt_examples') {
    return `If the current H1 is broad, consider a nearby H2/section heading that clearly names "${cluster.label}".`;
  }
  if (cluster.intent === 'comparison') {
    return 'Make sure the H1 or first comparison heading names both compared models or variants clearly.';
  }
  if (isPricingSpecsIntent(cluster.intent)) {
    return 'Use a compact section heading for pricing, duration, limits, or specs rather than a generic feature heading.';
  }
  if (issueType === 'expand_defend_good_performer') {
    return 'Prefer a supporting H2 or intro phrase over a disruptive H1 rewrite if the page is already performing well.';
  }
  return 'Review the H1 and first supporting section for clear intent match; update only if the page framing is too generic.';
}

function buildAboveFoldRecommendation(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  if (issueType === 'far_position_watchlist') {
    return 'No urgent above-the-fold rewrite; revisit if position improves or impressions grow materially.';
  }
  if (cluster.intent === 'comparison') {
    return 'Make the compared options visible above the fold with a compact distinction, not a long SEO table.';
  }
  if (cluster.intent === 'prompt_examples') {
    return 'Confirm above the fold that users can inspect examples and prompt patterns, then route to examples or model details naturally.';
  }
  if (isPricingSpecsIntent(cluster.intent)) {
    return 'Surface the relevant pricing/specs/limits promise early enough that the snippet promise is reflected on the page.';
  }
  return 'Make the first screen reinforce the same intent promised by the title/meta without adding generic SEO copy.';
}

function buildAcceptanceCriteria(cluster: SeoQueryCluster, issueType: CtrDoctorIssueType) {
  const criteria = [
    'Review current title/meta/H1 before editing; do not assume current metadata if it is not available in code',
    `${compactIntentLabel(cluster.intent)} intent is clearer in the snippet direction or first screen`,
    'No keyword stuffing or robotic copy',
    'Page remains compact, premium, and aligned with the existing MaxVideoAI design',
  ];
  if (cluster.intent === 'prompt_examples') criteria.push('Prompt examples or prompt patterns are visible if appropriate for the page');
  if (cluster.intent === 'comparison') criteria.push('Compared models or variants are named clearly');
  if (isPricingSpecsIntent(cluster.intent)) criteria.push('Pricing, specs, duration, or limits are answered only where the page can support the promise');
  if (issueType === 'far_position_watchlist') criteria.push('Keep changes lightweight unless ranking improves beyond the watchlist range');
  return criteria;
}

function buildRecommendedImplementation(item: CtrDoctorItem) {
  const metadataInstruction = item.currentMetadata
    ? 'Compare the recommendation against the known metadata snapshot before editing.'
    : 'Review current title/meta/H1 in the target files before editing; no current metadata snapshot was loaded for this CTR Doctor item.';
  return [
    metadataInstruction,
    item.recommendedTitleDirection,
    item.recommendedMetaDescriptionDirection,
    item.recommendedH1SectionDirection,
    item.aboveTheFoldRecommendation,
  ].join(' ');
}

function formatMetrics(item: CtrDoctorItem) {
  return [
    `${item.currentMetrics.clicks} clicks`,
    `${item.currentMetrics.impressions} impressions`,
    `${(item.currentMetrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${item.currentMetrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

function dedupeCtrDoctorItems(items: CtrDoctorItem[]) {
  const best = new Map<string, CtrDoctorItem>();
  for (const item of items) {
    const key = `${item.targetUrl ?? ''}|${item.queryCluster}`;
    const existing = best.get(key);
    if (!existing || compareCtrItems(item, existing) < 0) best.set(key, item);
  }
  return Array.from(best.values());
}

function compareCtrItems(a: CtrDoctorItem, b: CtrDoctorItem) {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  if (a.score !== b.score) return b.score - a.score;
  return issueRank(a.issueType) - issueRank(b.issueType);
}

function issueRank(issueType: CtrDoctorIssueType) {
  const ranks: Record<CtrDoctorIssueType, number> = {
    high_impressions_low_ctr: 1,
    good_position_zero_clicks: 2,
    intent_snippet_mismatch: 3,
    expand_defend_good_performer: 4,
    brand_typo_ctr: 5,
    far_position_watchlist: 6,
  };
  return ranks[issueType];
}

function priorityRank(priority: SeoActionPriority) {
  if (priority === 'critical') return 1;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 3;
  return 4;
}

function isCtrSensitiveIntent(intent: SeoIntentType) {
  return intent === 'comparison' || intent === 'prompt_examples' || intent === 'examples' || isPricingSpecsIntent(intent) || intent === 'pay_as_you_go';
}

function isPricingSpecsIntent(intent: SeoIntentType) {
  return intent === 'pricing' || intent === 'specs' || intent === 'pricing_specs' || intent === 'max_length' || intent === 'model_parameters';
}

function isHealthyGoodPerformer(cluster: SeoQueryCluster) {
  return (
    isCtrSensitiveIntent(cluster.intent) &&
    cluster.metrics.impressions >= 150 &&
    cluster.metrics.ctr >= 0.12 &&
    cluster.metrics.averagePosition >= 4 &&
    cluster.metrics.averagePosition <= 12
  );
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `ctr_${Math.abs(hash).toString(36)}`;
}
