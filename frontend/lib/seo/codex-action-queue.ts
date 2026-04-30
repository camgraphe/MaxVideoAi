import type { CodexSeoAction, ContentMomentumItem, CtrDoctorItem, InternalLinkSuggestion, MissingContentItem, StrategicSeoOpportunity, UnifiedPageActionBrief, UrlInspectionItem } from './internal-seo-types';
import { formatContentMomentumSectionMarkdown } from './content-momentum';
import { formatCtrDoctorSectionMarkdown } from './ctr-doctor';
import { formatInternalLinkSectionMarkdown } from './internal-link-builder';
import { formatMissingContentSectionMarkdown } from './missing-content';
import { compactIntentLabel } from './seo-intents';
import { stripOrigin } from './seo-opportunity-engine';
import { formatUnifiedActionBriefsMarkdown } from './unified-action-briefs';
import { formatUrlInspectionSectionMarkdown } from './url-inspection';

export function buildCodexActionQueue(opportunities: StrategicSeoOpportunity[]): CodexSeoAction[] {
  const seen = new Set<string>();
  const actions: CodexSeoAction[] = [];

  for (const opportunity of opportunities) {
    const key = `${opportunity.targetUrl ?? ''}|${opportunity.queryCluster}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const action = buildCodexAction(opportunity);
    actions.push({ ...action, markdown: formatCodexActionMarkdown(action) });
  }

  return actions.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || b.score - a.score);
}

export function formatCodexActionMarkdown(action: Omit<CodexSeoAction, 'markdown'> | CodexSeoAction): string {
  return [
    'Title:',
    action.title,
    '',
    'Source:',
    `GSC query cluster: ${action.representativeQueries.map((query) => `"${query}"`).join(', ')}`,
    `Metrics: ${action.metricsSummary}`,
    '',
    'Problem:',
    action.observedIssue,
    '',
    'Recommended implementation:',
    action.recommendedImplementation,
    '',
    'Likely files to inspect:',
    ...action.likelyFilesToInspect.map((file) => `- ${file}`),
    '',
    'Acceptance criteria:',
    ...action.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ].join('\n');
}

export function formatCodexActionQueueMarkdown(
  actions: CodexSeoAction[],
  ctrDoctorItems: CtrDoctorItem[] = [],
  missingContentItems: MissingContentItem[] = [],
  internalLinkSuggestions: InternalLinkSuggestion[] = [],
  momentumItems: ContentMomentumItem[] = [],
  urlInspectionItems: UrlInspectionItem[] = [],
  unifiedActionBriefs: UnifiedPageActionBrief[] = []
): string {
  const sections = [
    '# Codex SEO Action Queue - MaxVideoAI',
    '',
    `Generated actions: ${actions.length}`,
    '',
    ...actions.map((action, index) => [`## ${index + 1}. ${action.title}`, '', formatCodexActionMarkdown(action)].join('\n')),
    '',
    formatCtrDoctorSectionMarkdown(ctrDoctorItems),
    '',
    formatMissingContentSectionMarkdown(missingContentItems),
    '',
    formatInternalLinkSectionMarkdown(internalLinkSuggestions),
    '',
    formatContentMomentumSectionMarkdown(momentumItems),
    '',
    formatUrlInspectionSectionMarkdown(urlInspectionItems),
  ];

  if (unifiedActionBriefs.length) {
    return [formatUnifiedActionBriefsMarkdown(unifiedActionBriefs), '', ...sections].join('\n\n');
  }

  return sections.join('\n\n');
}

function buildCodexAction(opportunity: StrategicSeoOpportunity): Omit<CodexSeoAction, 'markdown'> {
  const targetPath = stripOrigin(opportunity.targetUrl);
  return {
    id: opportunity.id,
    title: opportunity.title,
    priority: opportunity.priority,
    targetUrl: opportunity.targetUrl,
    family: opportunity.modelFamily,
    intent: opportunity.intent,
    issueType: opportunity.issueType,
    queryCluster: opportunity.queryCluster,
    representativeQueries: opportunity.representativeQueries,
    observedIssue: opportunity.observedIssue,
    metricsSummary: [
      `${opportunity.sourceMetrics.clicks} clicks`,
      `${opportunity.sourceMetrics.impressions} impressions`,
      `${(opportunity.sourceMetrics.ctr * 100).toFixed(2)}% CTR`,
      `avg position ${opportunity.sourceMetrics.averagePosition.toFixed(1)}`,
    ].join(', '),
    recommendedImplementation: buildRecommendedImplementation(opportunity, targetPath),
    likelyFilesToInspect: inferLikelyFiles(opportunity.targetUrl),
    acceptanceCriteria: buildAcceptanceCriteria(opportunity, targetPath),
    score: opportunity.score,
  };
}

function buildRecommendedImplementation(opportunity: StrategicSeoOpportunity, targetPath: string): string {
  const intro = opportunity.suggestedAction;
  if (opportunity.intent === 'prompt_examples' || opportunity.intent === 'prompt_guide') {
    return `${intro} For ${targetPath}, make prompt examples visible, add a practical FAQ entry if it fits the existing page, and link to the matching examples surface when available.`;
  }
  if (opportunity.intent === 'comparison') {
    return `${intro} Keep the comparison compact and route users to both relevant model pages instead of creating a generic SEO block.`;
  }
  if (opportunity.intent === 'pricing_specs') {
    return `${intro} Prefer concise copy, scannable specs, and pricing/credit clarity over a long table.`;
  }
  if (opportunity.intent === 'brand_typo') {
    return `${intro} Avoid awkward typo-stuffed copy; use natural brand reassurance and search-friendly metadata direction.`;
  }
  if (opportunity.issueType === 'outdated_deprioritized_model') {
    return `${intro} Do not erase useful Sora content; position it honestly and add pathways toward Seedance, Kling, Veo, or LTX where relevant.`;
  }
  return intro;
}

function inferLikelyFiles(targetUrl: string | null): string[] {
  const path = stripOrigin(targetUrl).split('?')[0];
  const files = new Set<string>();

  if (path.startsWith('/models/')) {
    const slug = path.split('/').filter(Boolean)[1];
    files.add(`content/models/en/${slug}.json`);
    files.add('frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx');
    files.add('frontend/config/model-families.ts');
  } else if (path.startsWith('/examples/')) {
    files.add('frontend/config/model-families.ts');
    files.add('frontend/app/(localized)/[locale]/(marketing)/examples/[family]/page.tsx');
  } else if (path.startsWith('/ai-video-engines/')) {
    files.add('frontend/lib/compare-hub/data.ts');
    files.add('frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx');
  } else if (path === '/pricing') {
    files.add('frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx');
    files.add('frontend/components/pricing');
  } else {
    files.add('frontend/app/(localized)/[locale]/(marketing)');
    files.add('frontend/lib/seo/metadata.ts');
  }

  return Array.from(files);
}

function buildAcceptanceCriteria(opportunity: StrategicSeoOpportunity, targetPath: string): string[] {
  const criteria = [
    `Target URL remains ${targetPath}`,
    `${compactIntentLabel(opportunity.intent)} intent is visible on the page without generic or robotic copy`,
    'Copy stays compact, premium, and aligned with existing MaxVideoAI page structure',
  ];

  if (opportunity.intent === 'prompt_examples' || opportunity.intent === 'prompt_guide') {
    criteria.push('Prompt examples or prompt guidance are visible where they naturally fit');
    criteria.push('Internal link to the matching examples page exists if appropriate');
  }
  if (opportunity.intent === 'comparison') {
    criteria.push('Comparison copy names the relevant models or variants clearly');
    criteria.push('Links point to both relevant model pages when those pages exist');
  }
  if (opportunity.intent === 'pricing_specs') {
    criteria.push('Pricing, duration, specs, or limits can be scanned quickly');
  }
  if (opportunity.issueType === 'outdated_deprioritized_model') {
    criteria.push('Older or de-prioritized model demand is handled without over-promoting it');
  }

  return criteria;
}

function priorityRank(priority: CodexSeoAction['priority']) {
  if (priority === 'critical') return 1;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 3;
  return 4;
}
