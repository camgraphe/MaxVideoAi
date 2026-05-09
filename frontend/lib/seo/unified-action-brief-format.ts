import type { UnifiedActionSourceModule, UnifiedPageActionBrief } from './internal-seo-types';

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

export function titleForBrief(brief: Pick<UnifiedPageActionBrief, 'queryCluster' | 'targetUrl' | 'intent'>) {
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

export function labelizeIssue(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
