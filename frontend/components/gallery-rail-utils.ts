import type { Job } from '@/types/jobs';
import type { GroupSummary } from '@/types/groups';
import type { ResultProvider } from '@/types/video-groups';
import { countResolvedVisualSlots, mergeImageProgressGroup } from '@/lib/group-progress';

export type GalleryVariant = 'desktop' | 'mobile';
export type GalleryFeedType = 'video' | 'image';

export const DEFAULT_GALLERY_COPY = {
  title: 'Latest renders',
  viewAll: 'View all',
  curated: 'Starter samples curated by the MaxVideo team are shown until you generate your own videos.',
  error: 'Failed to load latest renders. Please retry.',
  retry: 'Retry',
  imageCta: 'Generate images',
  snackbar: {
    samples: 'Sample clips cannot be removed.',
    removed: 'Removed from gallery.',
    failed: 'Unable to remove from gallery.',
    saved: 'Saved to library.',
    saveFailed: 'Unable to save to library.',
    copied: 'Link copied.',
    copyFailed: 'Unable to copy link.',
    noMedia: 'No media available.',
  },
} as const;

export type GalleryCopy = typeof DEFAULT_GALLERY_COPY;

export const DEFAULT_GROUP_PROVIDER: ResultProvider = 'fal';
export const INITIAL_EAGER_PREVIEW_COUNT = 0;
const DESKTOP_BACKGROUND_WARM_PREVIEW_LIMIT = 2;

type NavigatorWithConnection = Navigator & {
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

export function resolveBackgroundWarmPreviewLimit(variant: GalleryVariant): number {
  if (variant !== 'desktop') return 0;
  if (typeof navigator === 'undefined') return DESKTOP_BACKGROUND_WARM_PREVIEW_LIMIT;
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return 0;
  const effectiveType = connection?.effectiveType;
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 1;
  if (effectiveType === '3g') return 1;
  return DESKTOP_BACKGROUND_WARM_PREVIEW_LIMIT;
}

export function resolveDisplayedActiveGroup(
  feedType: GalleryFeedType,
  activeGroup: GroupSummary,
  historicalGroup?: GroupSummary
): GroupSummary {
  if (!historicalGroup) return activeGroup;
  if (feedType !== 'image') return historicalGroup;

  const expectedCount = Math.max(1, Math.min(4, activeGroup.count || historicalGroup.count || 1));
  const resolvedCount = countResolvedVisualSlots(historicalGroup);
  if (resolvedCount >= expectedCount) {
    return historicalGroup;
  }

  if (resolvedCount > 0) {
    return mergeImageProgressGroup(activeGroup, historicalGroup);
  }

  return activeGroup;
}

export function resolveAspectRatioLabel(group: GroupSummary): string | null {
  const ratio = group.hero.aspectRatio ?? group.previews.find((preview) => preview.aspectRatio)?.aspectRatio ?? null;
  if (!ratio) return null;
  if (ratio.toLowerCase() === 'auto') return 'Auto';
  return ratio;
}

export function resolveImageOriginalUrl(group: GroupSummary): string | null {
  const resolveFromMember = (member = group.hero) => {
    const job = member.job;
    if (!job || !Array.isArray(job.renderIds) || !job.renderIds.length) {
      return null;
    }
    const renderIds = job.renderIds.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value));
    if (!renderIds.length) {
      return null;
    }
    if (typeof job.heroRenderId === 'string' && /^https?:\/\//i.test(job.heroRenderId)) {
      return job.heroRenderId;
    }
    const match = member.id.match(/-image-(\d+)$/);
    if (match) {
      const index = Number(match[1]) - 1;
      if (Number.isInteger(index) && index >= 0 && index < renderIds.length) {
        return renderIds[index];
      }
    }
    return renderIds[0] ?? null;
  };

  return (
    resolveFromMember(group.hero) ??
    group.members.map((member) => resolveFromMember(member)).find((value): value is string => typeof value === 'string' && value.length > 0) ??
    group.hero.thumbUrl ??
    group.previews.find((preview) => preview.thumbUrl)?.thumbUrl ??
    null
  );
}

export function resolveMediaUrl(group: GroupSummary, preferImage: boolean): string | null {
  if (preferImage) {
    return (
      resolveImageOriginalUrl(group) ??
      group.hero.videoUrl ??
      group.previews.find((preview) => preview.videoUrl)?.videoUrl ??
      null
    );
  }
  return (
    group.hero.videoUrl ??
    group.previews.find((preview) => preview.videoUrl)?.videoUrl ??
    group.hero.thumbUrl ??
    group.previews.find((preview) => preview.thumbUrl)?.thumbUrl ??
    null
  );
}

export function filterGalleryFeedJobs(feedType: GalleryFeedType, jobs: Job[]): Job[] {
  if (feedType !== 'video') return jobs;
  return jobs.filter((job) => job.surface !== 'audio');
}
