import type { VideoGroup, VideoItem } from '@/types/video-groups';

const COMPOSITE_PREVIEW_SLOT_COUNT: Record<VideoGroup['layout'], number> = {
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 4,
};

function isCompositePreviewVideoItem(item: VideoItem): boolean {
  const hint = typeof item.meta?.mediaType === 'string' ? item.meta.mediaType.toLowerCase() : null;
  if (hint === 'video') return true;
  if (hint === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function getCompositePreviewPosterSrc(group: VideoGroup | null): string | null {
  if (!group) return null;
  const desired = COMPOSITE_PREVIEW_SLOT_COUNT[group.layout] ?? Math.min(group.items.length, 4);
  const visibleItems = group.items.slice(0, desired);
  const activeVideoItem = visibleItems.find((item) => item.thumb && isCompositePreviewVideoItem(item));
  const fallbackItem = visibleItems.find((item) => item.thumb);
  return activeVideoItem?.thumb ?? fallbackItem?.thumb ?? null;
}
