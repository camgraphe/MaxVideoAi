import { isStaleGenerationUpdate, normalizeGenerationObservation } from '@/lib/generation-observation';
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

/** Selection owns identity/layout; current job state owns availability and progress. */
export function refreshCompositePreview(selected: VideoGroup, liveGroups: VideoGroup[]): VideoGroup {
  const liveItems = new Map(liveGroups.flatMap(group => group.items).map(item => [item.jobId ?? item.id, item]));
  let changed = false;
  const items = selected.items.map(item => {
    const live = liveItems.get(item.jobId ?? item.id);
    if (!live) return item;
    const currentStatus = typeof item.meta?.status === 'string' ? item.meta.status : undefined;
    const nextStatus = typeof live.meta?.status === 'string' ? live.meta.status : undefined;
    if (isStaleGenerationUpdate(
      { status: currentStatus, observation: normalizeGenerationObservation(item.meta?.observation) },
      { status: nextStatus, observation: normalizeGenerationObservation(live.meta?.observation) }
    )) return item;
    changed = true;
    return { ...item, ...live, id: item.id, meta: { ...item.meta, ...live.meta } };
  });
  if (!changed) return selected;
  const failed = items.some(item => item.meta?.status === 'failed');
  const ready = items.every(item => item.meta?.status === 'completed' && Boolean(item.url));
  return { ...selected, items, status: failed ? 'error' : ready ? 'ready' : 'loading' };
}
