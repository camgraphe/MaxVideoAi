import type { AiStrategistReviewStatus } from '@/server/ai-strategist-conversations';

const reviewStatusLabels: Record<AiStrategistReviewStatus, string> = {
  unreviewed: 'Unreviewed',
  reviewed: 'Reviewed',
  flagged: 'Flagged',
  training_candidate: 'Training candidate',
  ignored: 'Ignored',
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatConversationDate(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : dateFormatter.format(date);
}

export function formatReviewStatusLabel(value: AiStrategistReviewStatus | string | null | undefined): string {
  return reviewStatusLabels[(value ?? 'unreviewed') as AiStrategistReviewStatus] ?? 'Unreviewed';
}

export function formatUsd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '$0.00';
  return `$${value.toFixed(4)}`;
}

export function previewText(value: string | null | undefined, fallback = 'No text captured'): string {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > 150 ? `${normalized.slice(0, 147)}...` : normalized;
}

export function formatTagList(tags: string[]): string {
  return tags.length ? tags.join(', ') : 'No tags';
}

export function parseReviewTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}
