import type {
  ContentMomentumItem,
  CtrDoctorItem,
  InternalLinkSuggestion,
  MissingContentItem,
  SeoActionPriority,
  SeoIntentType,
  SeoSourceMetrics,
  StrategicSeoFamily,
  StrategicSeoOpportunity,
  UnifiedActionSignal,
  UnifiedActionSourceModule,
  UnifiedPageActionBrief,
  UrlInspectionItem,
  UrlInspectionStatus,
} from './internal-seo-types';
import { compactIntentLabel } from './seo-intents';
import { stripOrigin } from './seo-opportunity-engine';

type BuildUnifiedActionBriefsOptions = {
  opportunities?: StrategicSeoOpportunity[];
  ctrDoctorItems?: CtrDoctorItem[];
  missingContentItems?: MissingContentItem[];
  internalLinkSuggestions?: InternalLinkSuggestion[];
  momentumItems?: ContentMomentumItem[];
  urlInspectionItems?: UrlInspectionItem[];
};

type BriefDraft = {
  targetUrl: string;
  queryCluster: string;
  representativeQueries: Set<string>;
  family: StrategicSeoFamily;
  intent: SeoIntentType;
  priorities: SeoActionPriority[];
  scores: number[];
  metrics: SeoSourceMetrics[];
  combinedSignals: UnifiedActionSignal[];
  supportingActions: string[];
  risks: string[];
  acceptanceCriteria: string[];
  sourceModules: Set<UnifiedActionSourceModule>;
  pageStatus: UrlInspectionStatus | null;
  urlInspection: UrlInspectionItem | null;
};

const priorityWeight: Record<SeoActionPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const priorityOrder: SeoActionPriority[] = ['critical', 'high', 'medium', 'low'];

export function buildUnifiedActionBriefs(options: BuildUnifiedActionBriefsOptions): UnifiedPageActionBrief[] {
  const drafts = new Map<string, BriefDraft>();

  for (const opportunity of options.opportunities ?? []) {
    if (!opportunity.targetUrl) continue;
    const draft = getDraft(drafts, {
      targetUrl: opportunity.targetUrl,
      queryCluster: opportunity.queryCluster,
      family: opportunity.modelFamily,
      intent: opportunity.intent,
    });
    mergeCommon(draft, {
      module: 'opportunity_finder',
      priority: opportunity.priority,
      score: opportunity.score,
      metrics: opportunity.sourceMetrics,
      representativeQueries: opportunity.representativeQueries,
      summary: `${labelizeIssue(opportunity.issueType)}: ${opportunity.observedIssue}`,
      supportingAction: opportunity.suggestedAction,
      acceptanceCriteria: [],
    });
  }

  for (const item of options.ctrDoctorItems ?? []) {
    if (!item.targetUrl) continue;
    const draft = getDraft(drafts, {
      targetUrl: item.targetUrl,
      queryCluster: item.queryCluster,
      family: item.modelFamily,
      intent: item.detectedIntent,
    });
    mergeCommon(draft, {
      module: 'ctr_doctor',
      priority: item.priority,
      score: item.score,
      metrics: item.currentMetrics,
      representativeQueries: item.representativeQueries,
      summary: item.likelyProblem,
      supportingAction: [
        'Review title/meta/H1/intro for snippet and first-screen intent fit.',
        item.recommendedTitleDirection,
        item.aboveTheFoldRecommendation,
      ].filter(Boolean).join(' '),
      acceptanceCriteria: item.acceptanceCriteria,
    });
  }

  for (const item of options.missingContentItems ?? []) {
    const targetUrl = item.targetUrl ?? item.likelyPageCandidates[0];
    if (!targetUrl || item.recommendationType === 'ignore') continue;
    const draft = getDraft(drafts, {
      targetUrl,
      queryCluster: item.queryCluster,
      family: item.family,
      intent: normalizeIntent(item.intent),
    });
    mergeCommon(draft, {
      module: 'missing_content',
      priority: item.priority,
      score: item.score,
      metrics: item.currentMetrics,
      representativeQueries: item.representativeQueries,
      summary: `${labelizeIssue(item.recommendationType)}: ${item.observedGap}`,
      supportingAction: item.recommendedAction,
      acceptanceCriteria: item.acceptanceCriteria,
    });
    if (item.whyNotCreatePage) draft.risks.push(item.whyNotCreatePage);
  }

  for (const item of options.internalLinkSuggestions ?? []) {
    const draft = getDraft(drafts, {
      targetUrl: item.sourceUrl,
      queryCluster: item.relatedQueryCluster,
      family: item.family,
      intent: item.intent,
    });
    mergeCommon(draft, {
      module: 'internal_links',
      priority: 'low',
      score: Math.min(item.score, 45),
      metrics: item.currentMetrics,
      representativeQueries: item.representativeQueries,
      summary: `${labelizeIssue(item.recommendationType)}: ${item.reason}`,
      supportingAction: `Verify/support a link from ${item.sourceUrl} to ${item.targetUrl} with anchor "${item.suggestedAnchor}".`,
      acceptanceCriteria: item.acceptanceCriteria,
    });
    if (item.verifyExistingLinkFirst) draft.risks.push('Verify the suggested internal link does not already exist before editing.');
  }

  for (const item of options.momentumItems ?? []) {
    if (!item.pageUrl) continue;
    const draft = getDraft(drafts, {
      targetUrl: item.pageUrl,
      queryCluster: item.queryCluster ?? stripOrigin(item.pageUrl),
      family: item.family,
      intent: 'generic',
    });
    mergeCommon(draft, {
      module: 'momentum',
      priority: item.priority,
      score: item.score,
      metrics: item.current,
      representativeQueries: item.queryCluster ? [item.queryCluster] : [],
      summary: `${labelizeIssue(item.type)}: ${item.observedTrend}`,
      supportingAction: item.recommendedAction,
      acceptanceCriteria: item.acceptanceCriteria,
    });
  }

  const inspectionByPath = new Map((options.urlInspectionItems ?? []).map((item) => [item.path, item]));
  for (const draft of drafts.values()) {
    const inspection = inspectionByPath.get(normalizePath(draft.targetUrl));
    if (!inspection) continue;
    draft.pageStatus = inspection.status;
    draft.urlInspection = inspection;
    draft.sourceModules.add('url_inspection');
    draft.combinedSignals.push({
      module: 'url_inspection',
      priority: inspection.severity === 'critical' ? 'critical' : inspection.severity === 'warning' ? 'high' : 'low',
      summary:
        inspection.status === 'indexed_ok'
          ? `URL Inspection: indexed and canonical OK${inspection.lastCrawlTime ? `; last crawl ${inspection.lastCrawlTime}` : ''}.`
          : `URL Inspection: ${labelizeIssue(inspection.status)}. ${inspection.suggestedAction}`,
    });
    if (inspection.status === 'indexed_ok' && inspection.canonicalMatches) {
      draft.acceptanceCriteria.push('URL Inspection remains indexed/canonical OK after changes.');
    } else if (inspection.status !== 'unknown') {
      draft.supportingActions.push(inspection.suggestedAction);
      draft.risks.push('Resolve URL Inspection issues before treating content work as complete.');
    }
  }

  for (const item of options.urlInspectionItems ?? []) {
    if (item.status === 'indexed_ok' || item.status === 'unknown') continue;
    const key = briefKey(item.path, 'url inspection issue', 'Other', 'generic');
    if (drafts.has(key)) continue;
    const draft = getDraft(drafts, {
      targetUrl: item.path,
      queryCluster: 'url inspection issue',
      family: 'Other',
      intent: 'generic',
    });
    draft.pageStatus = item.status;
    draft.urlInspection = item;
    mergeCommon(draft, {
      module: 'url_inspection',
      priority: item.severity === 'critical' ? 'critical' : 'high',
      score: item.severity === 'critical' ? 90 : 70,
      metrics: null,
      representativeQueries: [],
      summary: `URL Inspection: ${labelizeIssue(item.status)}. ${item.suggestedAction}`,
      supportingAction: item.suggestedAction,
      acceptanceCriteria: ['URL Inspection issue is resolved or explicitly documented as intentional.'],
    });
  }

  return Array.from(drafts.values())
    .map(finalizeBrief)
    .filter((brief) => shouldKeepBrief(brief))
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority] || b.score - a.score || a.targetUrl.localeCompare(b.targetUrl));
}

export function formatUnifiedActionBriefMarkdown(brief: UnifiedPageActionBrief): string {
  return [
    'Title:',
    titleForBrief(brief),
    '',
    'Target:',
    brief.targetUrl,
    '',
    'Source signals:',
    ...brief.combinedSignals.map((signal) => `- ${labelizeModule(signal.module)}: ${signal.summary}`),
    '',
    'Problem:',
    brief.observedProblem,
    '',
    'Recommended implementation:',
    brief.recommendedImplementation,
    '',
    'Supporting actions:',
    ...brief.supportingActions.map((action) => `- ${action}`),
    '',
    'Risks / caveats:',
    ...brief.risks.map((risk) => `- ${risk}`),
    '',
    'Acceptance criteria:',
    ...brief.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatUnifiedActionBriefsMarkdown(briefs: UnifiedPageActionBrief[]): string {
  if (!briefs.length) return ['# Recommended Page Actions', '', 'No unified page action briefs generated for this snapshot.'].join('\n');
  return [
    '# Recommended Page Actions',
    '',
    `Generated briefs: ${briefs.length}`,
    '',
    ...briefs.map((brief, index) => [`## ${index + 1}. ${titleForBrief(brief)}`, '', formatUnifiedActionBriefMarkdown(brief)].join('\n')),
  ].join('\n\n');
}

function getDraft(
  drafts: Map<string, BriefDraft>,
  input: { targetUrl: string; queryCluster: string; family: StrategicSeoFamily; intent: SeoIntentType }
) {
  const normalizedTarget = normalizePath(input.targetUrl);
  const normalizedCluster = input.queryCluster.toLowerCase().trim();
  const compatibleDraft = Array.from(drafts.values()).find((draft) => {
    if (draft.targetUrl !== normalizedTarget) return false;
    if (draft.queryCluster.toLowerCase().trim() !== normalizedCluster) return false;
    return draft.intent === input.intent || draft.intent === 'generic' || input.intent === 'generic' || draft.family === input.family;
  });
  if (compatibleDraft) {
    if (compatibleDraft.intent === 'generic' && input.intent !== 'generic') compatibleDraft.intent = input.intent;
    if ((compatibleDraft.family === 'Other' || compatibleDraft.family === 'Unknown') && input.family !== 'Other') compatibleDraft.family = input.family;
    return compatibleDraft;
  }
  const key = briefKey(normalizedTarget, input.queryCluster, input.family, input.intent);
  let draft = drafts.get(key);
  if (!draft) {
    draft = {
      targetUrl: normalizedTarget,
      queryCluster: input.queryCluster,
      representativeQueries: new Set(),
      family: input.family,
      intent: input.intent,
      priorities: [],
      scores: [],
      metrics: [],
      combinedSignals: [],
      supportingActions: [],
      risks: [],
      acceptanceCriteria: [],
      sourceModules: new Set(),
      pageStatus: null,
      urlInspection: null,
    };
    drafts.set(key, draft);
  }
  return draft;
}

function mergeCommon(
  draft: BriefDraft,
  input: {
    module: UnifiedActionSourceModule;
    priority: SeoActionPriority;
    score: number;
    metrics: SeoSourceMetrics | null;
    representativeQueries: string[];
    summary: string;
    supportingAction: string;
    acceptanceCriteria: string[];
  }
) {
  draft.sourceModules.add(input.module);
  draft.priorities.push(input.priority);
  draft.scores.push(input.score);
  if (input.metrics) draft.metrics.push(input.metrics);
  for (const query of input.representativeQueries) draft.representativeQueries.add(query);
  pushUnique(draft.combinedSignals, { module: input.module, priority: input.priority, summary: input.summary }, (signal) => `${signal.module}:${signal.summary}`);
  pushUniqueString(draft.supportingActions, input.supportingAction);
  for (const criterion of input.acceptanceCriteria) pushUniqueString(draft.acceptanceCriteria, criterion);
}

function finalizeBrief(draft: BriefDraft): UnifiedPageActionBrief {
  const sourceModules = Array.from(draft.sourceModules);
  const priority = finalPriority(draft);
  const score = Math.max(0, ...draft.scores);
  const metrics = summarizeMetrics(draft.metrics);
  const supportingActions = normalizeSupportingActions(draft);
  const risks = normalizeRisks(draft);
  const acceptanceCriteria = normalizeAcceptanceCriteria(draft);
  const brief: Omit<UnifiedPageActionBrief, 'copyReadyCodexTask'> = {
    id: stableId([draft.targetUrl, draft.queryCluster, draft.family, draft.intent]),
    priority,
    score,
    targetUrl: draft.targetUrl,
    queryCluster: draft.queryCluster,
    representativeQueries: Array.from(draft.representativeQueries).slice(0, 6),
    family: draft.family,
    intent: draft.intent,
    pageStatus: draft.pageStatus,
    combinedSignals: dedupeSignals(draft.combinedSignals),
    metricsSummary: formatMetrics(metrics),
    observedProblem: buildObservedProblem(draft),
    recommendedImplementation: buildRecommendedImplementation(draft),
    supportingActions,
    risks,
    acceptanceCriteria,
    sourceModules,
  };
  return {
    ...brief,
    copyReadyCodexTask: formatUnifiedActionBriefMarkdown(brief as UnifiedPageActionBrief),
  };
}

function finalPriority(draft: BriefDraft): SeoActionPriority {
  const internalOnly = draft.sourceModules.size === 1 && draft.sourceModules.has('internal_links');
  if (internalOnly) return 'low';
  const max = priorityOrder.find((priority) => draft.priorities.includes(priority)) ?? 'low';
  if ((draft.family === 'Brand' || draft.intent === 'brand_typo' || draft.intent === 'brand') && max === 'critical') return 'high';
  return max;
}

function shouldKeepBrief(brief: UnifiedPageActionBrief) {
  if (brief.sourceModules.length === 1 && brief.sourceModules[0] === 'url_inspection' && brief.pageStatus === 'indexed_ok') return false;
  return true;
}

function buildObservedProblem(draft: BriefDraft) {
  const primary = draft.combinedSignals.find((signal) => signal.module !== 'url_inspection') ?? draft.combinedSignals[0];
  if (!primary) return `Review ${draft.targetUrl} for ${draft.queryCluster}.`;
  return primary.summary;
}

function buildRecommendedImplementation(draft: BriefDraft) {
  const parts: string[] = [];
  const target = draft.targetUrl;
  const cluster = draft.queryCluster;

  if (draft.sourceModules.has('ctr_doctor')) {
    parts.push(`Review title/meta/H1/intro so ${cluster} intent is clear without making the page robotic.`);
  }
  if (draft.sourceModules.has('missing_content')) {
    if (draft.intent === 'prompt_examples' || draft.intent === 'prompt_guide' || draft.intent === 'examples') {
      parts.push(`Add or improve a compact section for ${cluster} where it fits the current page structure.`);
    } else if (draft.intent === 'comparison') {
      parts.push('Strengthen the comparison framing with clearer differences, specs, or FAQ support where appropriate.');
    } else if (draft.intent === 'pricing' || draft.intent === 'pricing_specs' || draft.intent === 'specs') {
      parts.push('Clarify pricing, specs, duration, or limits in a scannable block if the existing page does not already cover them.');
    } else {
      parts.push('Strengthen the existing page section that best matches the query intent.');
    }
  }
  if (draft.sourceModules.has('internal_links')) {
    const linkTargets = draft.supportingActions
      .map((action) => action.match(/ to (\/[^\s]+) /)?.[1])
      .filter((value): value is string => Boolean(value));
    if (linkTargets.length) {
      parts.push(`Verify/support internal links from ${target} to ${Array.from(new Set(linkTargets)).join(' and ')}.`);
    }
  }
  if (draft.sourceModules.has('momentum')) {
    parts.push('Treat this as protect/expand work: preserve the current page intent while improving the visible user value.');
  }
  if (draft.sourceModules.has('opportunity_finder') && !parts.length) {
    parts.push(`Strengthen ${target} for ${cluster} using the existing page pattern and current MaxVideoAI tone.`);
  }
  if (draft.urlInspection && draft.urlInspection.status !== 'indexed_ok' && draft.urlInspection.status !== 'unknown') {
    parts.unshift(`Resolve the URL Inspection issue first: ${draft.urlInspection.suggestedAction}`);
  }
  if (!parts.length) parts.push(`Review ${target} for ${cluster} and make the smallest useful improvement.`);

  return parts.join(' ');
}

function normalizeSupportingActions(draft: BriefDraft) {
  const actions = [...draft.supportingActions];
  if (draft.intent === 'prompt_examples' || draft.intent === 'prompt_guide' || draft.intent === 'examples') {
    pushUniqueString(actions, 'Keep the page examples-first and avoid turning it into a generic SEO article.');
  }
  return actions.slice(0, 8);
}

function normalizeRisks(draft: BriefDraft) {
  const risks: string[] = [];
  for (const risk of draft.risks) pushUniqueString(risks, risk);
  pushUniqueString(risks, 'No keyword stuffing; keep copy compact, premium, and useful.');
  if (draft.pageStatus === 'indexed_ok') {
    pushUniqueString(risks, 'URL Inspection is clean, so avoid unnecessary technical indexation changes.');
  }
  if (draft.intent === 'brand_typo') {
    pushUniqueString(risks, 'Brand typo support should stay natural and should not dominate the action queue.');
  }
  return risks.slice(0, 6);
}

function normalizeAcceptanceCriteria(draft: BriefDraft) {
  const criteria: string[] = [];
  pushUniqueString(criteria, `Target URL remains ${draft.targetUrl}.`);
  pushUniqueString(criteria, `${compactIntentLabel(draft.intent)} intent is clearer without keyword stuffing.`);
  if (draft.intent === 'prompt_examples' || draft.intent === 'prompt_guide' || draft.intent === 'examples') {
    pushUniqueString(criteria, 'Page remains examples-first.');
  }
  if (draft.sourceModules.has('internal_links')) {
    pushUniqueString(criteria, 'Relevant internal links are verified before adding or changing links.');
  }
  if (draft.pageStatus === 'indexed_ok') {
    pushUniqueString(criteria, 'URL Inspection remains indexed/canonical OK after changes.');
  }
  for (const criterion of draft.acceptanceCriteria) pushUniqueString(criteria, criterion);
  return criteria.slice(0, 8);
}

function summarizeMetrics(metrics: SeoSourceMetrics[]): SeoSourceMetrics | null {
  if (!metrics.length) return null;
  return metrics.reduce((best, current) => (current.impressions > best.impressions ? current : best), metrics[0]);
}

function formatMetrics(metrics: SeoSourceMetrics | null) {
  if (!metrics) return 'No GSC metrics attached';
  return `${metrics.clicks} clicks, ${metrics.impressions} impressions, ${(metrics.ctr * 100).toFixed(2)}% CTR, avg position ${metrics.averagePosition.toFixed(1)}`;
}

function dedupeSignals(signals: UnifiedActionSignal[]) {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.module}:${signal.summary}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pushUnique<T>(items: T[], item: T, keyer: (item: T) => string) {
  const key = keyer(item);
  if (items.some((existing) => keyer(existing) === key)) return;
  items.push(item);
}

function pushUniqueString(items: string[], value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized || items.includes(normalized)) return;
  items.push(normalized);
}

function normalizeIntent(intent: string): SeoIntentType {
  if (intent === 'faq_info' || intent === 'irrelevant_junk') return 'generic';
  return intent as SeoIntentType;
}

function normalizePath(value: string) {
  return stripOrigin(value).split('?')[0].replace(/\/$/, '') || '/';
}

function briefKey(targetUrl: string, queryCluster: string, family: string, intent: string) {
  return [normalizePath(targetUrl), queryCluster.toLowerCase().trim(), family, intent].join('|');
}

function stableId(parts: string[]) {
  return `brief-${parts.join('|').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96)}`;
}

function titleForBrief(brief: Pick<UnifiedPageActionBrief, 'queryCluster' | 'targetUrl' | 'intent'>) {
  if (brief.intent === 'prompt_examples' || brief.intent === 'prompt_guide' || brief.intent === 'examples') {
    return `Strengthen ${brief.targetUrl} for ${brief.queryCluster}`;
  }
  if (brief.intent === 'comparison') return `Expand/defend ${brief.queryCluster} on ${brief.targetUrl}`;
  if (brief.intent === 'brand_typo') return `Defend brand typo demand on ${brief.targetUrl}`;
  return `Improve ${brief.targetUrl} for ${brief.queryCluster}`;
}

function labelizeModule(module: UnifiedActionSourceModule) {
  if (module === 'opportunity_finder') return 'Opportunity Finder';
  if (module === 'ctr_doctor') return 'CTR Doctor';
  if (module === 'missing_content') return 'Missing Content';
  if (module === 'internal_links') return 'Internal Links';
  if (module === 'url_inspection') return 'URL Inspection';
  return 'Momentum';
}

function labelizeIssue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
