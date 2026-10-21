import { PRIMARY_MODERATION_FILTERS, TOOL_MODERATION_FILTERS } from '@/lib/admin/moderation-filters';
import type { ReactNode } from 'react';
import { normalizeMediaUrl } from '@/lib/media';
import type {
  ModerationBucket,
  ModerationVideo,
  PublicationState,
} from '@/components/admin/moderation/moderation-types';

const FAILURE_STATES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted']);

export const BUCKET_OPTIONS: Array<{ id: ModerationBucket; label: string; helper: string }> = [
  { id: 'not-published', label: 'Not published', helper: 'Anything not yet published on the site' },
  { id: 'published', label: 'Published', helper: 'Live on site and eligible for public surfaces' },
  { id: 'all', label: 'All', helper: 'Everything in the editorial publication queue' },
];

export const SURFACE_OPTIONS = PRIMARY_MODERATION_FILTERS;
export const TOOL_SURFACE_OPTIONS = TOOL_MODERATION_FILTERS;

export function getModerationPreviewUrls(video: Pick<ModerationVideo, 'videoUrl' | 'thumbUrl'>) {
  const originalUrl = video.videoUrl ? normalizeMediaUrl(video.videoUrl) ?? video.videoUrl : undefined;
  const thumbUrl = video.thumbUrl ? normalizeMediaUrl(video.thumbUrl) ?? video.thumbUrl : undefined;
  // Tool GIF exports are stored in video_url, but require an image element.
  const animatedImageUrl = originalUrl && /\.gif$/i.test(originalUrl.split(/[?#]/, 1)[0]) ? originalUrl : undefined;
  return { originalUrl, thumbUrl, animatedImageUrl, videoUrl: animatedImageUrl ? undefined : originalUrl };
}

export function compareChronologically(
  a: Pick<ModerationVideo, 'createdAt' | 'id'>,
  b: Pick<ModerationVideo, 'createdAt' | 'id'>
) {
  const aTime = Number.isNaN(Date.parse(a.createdAt)) ? 0 : Date.parse(a.createdAt);
  const bTime = Number.isNaN(Date.parse(b.createdAt)) ? 0 : Date.parse(b.createdAt);
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id.localeCompare(a.id);
}

export function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'Europe/Paris',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function isFailedVideo(video: Pick<ModerationVideo, 'status'>) {
  const normalized = video.status?.trim().toLowerCase() ?? '';
  return FAILURE_STATES.has(normalized);
}

export function resolvePublicationState(video: Pick<ModerationVideo, 'visibility' | 'indexable'>): PublicationState {
  if (video.visibility === 'public' && video.indexable) {
    return 'published';
  }
  if (video.visibility === 'private' && !video.indexable) {
    return 'private';
  }
  return 'legacy-mismatch';
}

export function getPublicationLabel(video: Pick<ModerationVideo, 'visibility' | 'isPublishedOnSite'>) {
  if (video.isPublishedOnSite) return 'Published';
  if (video.visibility === 'private') return 'Private';
  return 'Not published';
}

export function matchesBucket(
  video: Pick<ModerationVideo, 'status' | 'visibility' | 'isPublishedOnSite'>,
  bucket: ModerationBucket
) {
  if (isFailedVideo(video)) return false;
  if (bucket === 'all') return true;
  if (bucket === 'published') return video.isPublishedOnSite;
  return !video.isPublishedOnSite;
}

export function PublicationPill({ state }: { state: PublicationState }) {
  const className =
    state === 'published'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : 'border-warning-border/60 bg-warning-bg/20 text-warning';

  const label =
    state === 'published'
      ? 'Published'
      : state === 'private'
        ? 'Private'
        : 'Not published';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${className}`}>{label}</span>;
}

export function StatePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'ok' | 'warn' | 'neutral';
}) {
  const className =
    tone === 'ok'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
      : tone === 'warn'
        ? 'border-warning-border/60 bg-warning-bg/20 text-warning'
        : 'border-border bg-bg text-text-secondary';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}
