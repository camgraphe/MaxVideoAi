import type { InternalLinkRecommendationType, InternalLinkSuggestion, SeoPageType } from './internal-seo-types';
import { formatMetrics } from './internal-link-builder-helpers';

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
