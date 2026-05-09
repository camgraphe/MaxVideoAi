import { CLUSTER_LABEL_OVERRIDES, MODE_LABELS } from './constants';

export function formatClusterLabel(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return CLUSTER_LABEL_OVERRIDES[normalized] ?? normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatModeLabel(mode?: string | null): string {
  if (!mode) return 'Video generation';
  return MODE_LABELS[mode] ?? 'Video generation';
}

export function formatPromptPreview(prompt: string, maxLength = 220): string {
  const clean = prompt.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Prompt unavailable.';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1)).trim()}…`;
}

export function truncateText(value: string, maxLength: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace > 60 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

export function likelyExpiringMediaUrl(value?: string | null): boolean {
  if (!value) return false;
  return /[?&](x-amz-|expires=|signature=|token=|googleaccessid=)/i.test(value);
}
