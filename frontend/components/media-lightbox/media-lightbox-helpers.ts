import type { MediaLightboxEntry } from './media-lightbox-types';

export function isVerticalAspect(aspectRatio?: string | null): boolean {
  if (!aspectRatio) return false;
  const value = aspectRatio.toLowerCase();
  if (!value.includes(':')) return false;
  const [w, h] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return false;
  return h > w;
}

export function formatPromptPreview(prompt: string, maxLength = 220): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trim()}…`;
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function formatEntryDate(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function resolveStatusLabel(status?: MediaLightboxEntry['status']): string | null {
  if (status === 'pending') return 'Processing';
  if (status === 'failed') return 'Failed';
  if (status === 'completed') return 'Ready';
  return null;
}

export function statusBadgeClass(status?: MediaLightboxEntry['status']): string {
  if (status === 'failed') return 'border-warning-border bg-warning-bg text-warning';
  if (status === 'pending') return 'border-brand/30 bg-[var(--brand-soft)] text-brand';
  return 'border-[var(--brand-border)] bg-[var(--brand-soft)] text-brand';
}

export function resolveOpenLabel(entry: MediaLightboxEntry): string {
  if (entry.audioUrl && !entry.videoUrl) return 'Open audio';
  if (entry.imageUrl && !entry.videoUrl) return 'Open image';
  return 'Open in player';
}
