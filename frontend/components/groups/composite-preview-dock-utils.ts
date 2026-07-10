import type { VideoGroup, VideoItem } from '@/types/video-groups';

export const DEFAULT_PREVIEW_COPY = {
  title: 'Composite Preview',
  empty: 'Select a take to preview',
  variants: {
    singular: '{count} variant',
    plural: '{count} variants',
  },
  controls: {
    play: { on: 'Pause', off: 'Play', ariaOn: 'Pause all previews', ariaOff: 'Play all previews' },
    mute: { on: 'Unmute', off: 'Mute', ariaOn: 'Unmute all previews', ariaOff: 'Mute all previews' },
    loop: { on: 'Loop on', off: 'Loop off', ariaOn: 'Disable looping', ariaOff: 'Enable looping' },
    download: { label: 'Download', aria: 'Download preview' },
    modal: { label: 'Open modal', aria: 'Open preview in modal' },
    openTake: { label: 'Open', aria: 'Open this take' },
    copyPrompt: 'Copy prompt',
  },
  guided: {
    previous: 'Previous sample',
    next: 'Next sample',
    badge: 'Starter sample {current}/{total}',
  },
  errorTitle: 'Preview unavailable',
  errorBody: 'Generation failed. Please retry.',
  placeholder: '—',
} as const;

export type PreviewCopy = typeof DEFAULT_PREVIEW_COPY;

export const LAYOUT_SLOT_COUNT: Record<VideoGroup['layout'], number> = {
  x1: 1,
  x2: 2,
  x3: 4,
  x4: 4,
};

export const GRID_CLASS: Record<VideoGroup['layout'], string> = {
  x1: 'grid-cols-1',
  x2: 'grid-cols-2',
  x3: 'md:grid-cols-2',
  x4: 'grid-cols-2',
};

export const ICON_BUTTON_BASE =
  'flex h-9 w-9 items-center justify-center rounded-lg border border-surface-on-media-25 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px';

export function isVideo(item: VideoItem): boolean {
  const hint = typeof item.meta?.mediaType === 'string' ? String(item.meta.mediaType).toLowerCase() : null;
  if (hint === 'video') return true;
  if (hint === 'image') return false;
  const url = item.url.toLowerCase();
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.mov');
}

export function getInlinePreviewUrl(item: VideoItem): string {
  return item.url;
}

export function resolveAspectHint(item: VideoItem): string | null {
  const original =
    item.meta && typeof item.meta === 'object' && 'originalAspectRatio' in item.meta
      ? (item.meta as Record<string, unknown>).originalAspectRatio
      : null;
  if (typeof original === 'string' && original.trim()) {
    return original.trim().replace(/x/gi, ':');
  }
  return item.aspect ?? null;
}

export function resolveCompositePreviewSlots(group: VideoGroup | null): Array<VideoItem | null> {
  if (!group) return [];
  const desired = LAYOUT_SLOT_COUNT[group.layout] ?? Math.min(group.items.length, 4);
  const list = group.items.slice(0, desired);
  const padded: Array<VideoItem | null> = Array.from({ length: desired }, (_, index) => list[index] ?? null);
  if (group.layout === 'x3' && padded.length === 4 && !padded[2]) {
    padded[2] = padded[3];
    padded[3] = null;
  }
  return padded;
}

export function resolvePrimaryMediaUrl(group: VideoGroup | null): string | null {
  if (!group) return null;
  const videoItem = group.items.find((item) => Boolean(item?.url) && isVideo(item));
  if (videoItem?.url) return videoItem.url;
  const fallback = group.items.find((item) => Boolean(item?.url));
  return fallback?.url ?? null;
}

export function resolvePreviewItemStatus(item: VideoItem): 'completed' | 'pending' | 'error' {
  const status = typeof item.meta?.status === 'string' ? String(item.meta.status).toLowerCase() : null;
  if (status === 'completed' || status === 'ready') return 'completed';
  if (status === 'failed' || status === 'error') return 'error';
  if (status === 'pending' || status === 'loading' || !item.url) return 'pending';
  return 'completed';
}

export function resolvePreviewItemHasAudio(item: VideoItem): boolean {
  if (typeof item.hasAudio === 'boolean') {
    return item.hasAudio;
  }
  return Boolean(
    item.meta &&
      typeof item.meta === 'object' &&
      'hasAudio' in item.meta &&
      (item.meta as Record<string, unknown>).hasAudio
  );
}
