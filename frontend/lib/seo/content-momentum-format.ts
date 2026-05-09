import type { ContentMomentumItem, ContentMomentumType, SeoSourceMetrics } from './internal-seo-types';
import { stripOrigin } from './seo-opportunity-engine';

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

function buildMomentumTitle(item: ContentMomentumItem) {
  if (item.type === 'protect_winner') return `Protect growing SEO winner: ${item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster}`;
  if (item.type === 'refresh_candidate') return `Refresh declining SEO page: ${item.pageUrl ? stripOrigin(item.pageUrl) : item.queryCluster}`;
  if (item.type === 'outdated_model_attention') return `Reposition older ${item.family} demand`;
  if (item.type === 'rising_family') return `${item.family} family is gaining momentum`;
  if (item.type === 'declining_family') return `${item.family} family is losing momentum`;
  if (item.type === 'mixed_family_momentum') return `${item.family} family has mixed momentum`;
  return `${labelizeMomentumType(item.type)}: ${item.queryCluster ?? item.pageUrl ?? item.family}`;
}

function formatMetrics(metrics: SeoSourceMetrics) {
  return [
    `${metrics.clicks} clicks`,
    `${metrics.impressions} impressions`,
    `${(metrics.ctr * 100).toFixed(2)}% CTR`,
    `avg position ${metrics.averagePosition.toFixed(1)}`,
  ].join(', ');
}

export function formatDelta(value: number, label: string) {
  return `${formatSignedNumber(value)} ${label}`;
}

export function formatSignedNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  return `${value > 0 ? '+' : ''}${value.toFixed(Number.isInteger(value) ? 0 : 1)}`;
}

export function formatSignedPercent(value: number) {
  if (!Number.isFinite(value)) return '+0.00%';
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}
