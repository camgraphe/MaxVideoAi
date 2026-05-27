import type { PromptReviewIntent, PromptReviewStatusFilter, PromptReviewVerdict } from '@/server/prompt-intelligence';

export const reviewStatuses: PromptReviewStatusFilter[] = [
  'unreviewed',
  'reviewed',
  'all',
  'strong_example',
  'good_needs_prompt_tweak',
  'wrong_model',
  'wrong_workflow',
  'bad_result',
  'avoid_pattern',
  'seo_candidate',
];

export const reviewIntents: PromptReviewIntent[] = [
  'product_ad',
  'social_ad',
  'cinematic_scene',
  'talking_avatar',
  'spokesperson',
  'character_animation',
  'product_reference_i2v',
  'person_reference_i2v',
  'video_to_video',
  'draft_storyboard',
  'seo_watch_page',
  'unknown',
];

export const reviewVerdicts: PromptReviewVerdict[] = [
  'strong_example',
  'good_needs_prompt_tweak',
  'wrong_model',
  'wrong_workflow',
  'bad_result',
  'avoid_pattern',
  'seo_candidate',
];

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatPromptReviewLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  return value
    .split('_')
    .join(' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPromptReviewDate(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : dateFormatter.format(date);
}

export function formatPromptReviewScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}/5` : 'Not scored';
}

export function parsePromptReviewTags(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

export function parsePromptReviewLines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== 'string') return [];
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function parsePromptReviewScore(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : null;
}

export function parsePromptReviewBoolean(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true' || value === '1';
}
