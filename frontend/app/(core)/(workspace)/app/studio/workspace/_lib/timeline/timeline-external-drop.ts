import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import {
  MIN_CLIP_DURATION_SEC,
  snapTimelineSeconds,
} from './timeline-interaction';
import {
  shouldEditTrackItem,
} from './timeline-insert';

export const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';

const EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC = 5;
let activeTimelineNodeDragPayload: TimelineNodeDragPayload | null = null;

type TimelineDataTransfer = {
  getData: (format: string) => string;
  types: ArrayLike<string> | Iterable<string>;
};

export type TimelineExternalDropPreview = {
  displacedItems: TimelineExternalDropDisplacement[];
  durationSec: number;
  isValid: boolean;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  startSec: number;
  title: string;
  trackId: WorkspaceTimelineTrack;
};

export type TimelineExternalDropDisplacement = {
  durationSec: number;
  fromStartSec: number;
  itemId: string;
  mediaKind?: WorkspaceTimelineItem['mediaKind'];
  title: string;
  toStartSec: number;
  trackId: WorkspaceTimelineTrack;
};

export type TimelineNodeDragPayload = {
  assetId?: string;
  durationSec?: number | null;
  mediaKind?: 'audio' | 'image' | 'video';
  nodeId?: string;
  previewUrl?: string | null;
  title?: string | null;
};

function isValidTimelineNodeDragPayload(payload: TimelineNodeDragPayload | null | undefined): payload is TimelineNodeDragPayload {
  return Boolean(payload?.mediaKind && (payload.nodeId || payload.assetId));
}

export function rememberTimelineNodeDragPayload(payload: TimelineNodeDragPayload): void {
  activeTimelineNodeDragPayload = isValidTimelineNodeDragPayload(payload) ? payload : null;
}

export function clearTimelineNodeDragPayload(): void {
  activeTimelineNodeDragPayload = null;
}

export function currentTimelineNodeDragPayload(): TimelineNodeDragPayload | null {
  return activeTimelineNodeDragPayload;
}

export function parseTimelineNodeDragPayload(dataTransfer: TimelineDataTransfer): TimelineNodeDragPayload | null {
  const types = Array.from(dataTransfer.types);
  const fallbackPayload = currentTimelineNodeDragPayload();
  if (!types.includes(TIMELINE_NODE_DRAG_TYPE)) return fallbackPayload;
  try {
    const payload = JSON.parse(dataTransfer.getData(TIMELINE_NODE_DRAG_TYPE)) as TimelineNodeDragPayload;
    return isValidTimelineNodeDragPayload(payload) ? payload : fallbackPayload;
  } catch {
    return fallbackPayload;
  }
}

export function durationForTimelineDropPayload(payload: TimelineNodeDragPayload): number {
  const durationSec = Number(payload.durationSec);
  if (Number.isFinite(durationSec) && durationSec > 0) return Math.max(MIN_CLIP_DURATION_SEC, durationSec);
  return EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC;
}

export function titleForTimelineDropPayload(payload: TimelineNodeDragPayload): string {
  if (payload.title && payload.title.trim()) return payload.title.trim();
  if (payload.mediaKind === 'audio') return 'Audio clip';
  if (payload.mediaKind === 'image') return 'Image clip';
  return 'Video clip';
}

export function isExternalTimelineDropCompatible(
  mediaKind: TimelineExternalDropPreview['mediaKind'],
  track: WorkspaceTimelineTrack
): boolean {
  if (mediaKind === 'audio') return !isWorkspaceTimelineVideoTrack(track);
  return isWorkspaceTimelineVideoTrack(track);
}

export function insertionBoundaryForTimelineTrack(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack,
  requestedStartSec: number
): number {
  const targetItem = items
    .filter((item) => item.track === track)
    .filter((item) => requestedStartSec > item.startSec && requestedStartSec < item.startSec + item.durationSec)
    .sort((left, right) => left.startSec - right.startSec)[0] ?? null;
  if (!targetItem) return requestedStartSec;

  const midpointSec = targetItem.startSec + targetItem.durationSec / 2;
  return snapTimelineSeconds(requestedStartSec < midpointSec ? targetItem.startSec : targetItem.startSec + targetItem.durationSec);
}

export function resolveTimelineExternalDropDisplacements({
  insertDurationSec,
  insertStartSec,
  items,
  track,
}: {
  insertDurationSec: number;
  insertStartSec: number;
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
}): TimelineExternalDropDisplacement[] {
  if (!Number.isFinite(insertDurationSec) || insertDurationSec <= 0) return [];

  return items.flatMap((item) => {
    if (!shouldEditTrackItem({ items, item, track })) return [];

    const itemStartSec = item.startSec;
    const itemEndSec = item.startSec + item.durationSec;
    if (itemEndSec <= insertStartSec) return [];

    if (itemStartSec >= insertStartSec) {
      return [{
        durationSec: item.durationSec,
        fromStartSec: itemStartSec,
        itemId: item.id,
        mediaKind: item.mediaKind,
        title: item.title,
        toStartSec: snapTimelineSeconds(itemStartSec + insertDurationSec),
        trackId: item.track,
      }];
    }

    const tailDurationSec = itemEndSec - insertStartSec;
    if (tailDurationSec < MIN_CLIP_DURATION_SEC) return [];

    return [{
      durationSec: snapTimelineSeconds(tailDurationSec),
      fromStartSec: snapTimelineSeconds(insertStartSec),
      itemId: `${item.id}:tail-preview`,
      mediaKind: item.mediaKind,
      title: `${item.title} tail`,
      toStartSec: snapTimelineSeconds(insertStartSec + insertDurationSec),
      trackId: item.track,
    }];
  });
}

export function resolveTimelineExternalDropPreview({
  isInsertIntoClipEnabled,
  items,
  lockedTracks,
  payload,
  rawStartSec,
  track,
}: {
  isInsertIntoClipEnabled: boolean;
  items: WorkspaceTimelineItem[];
  lockedTracks: ReadonlySet<WorkspaceTimelineTrack>;
  payload: TimelineNodeDragPayload;
  rawStartSec: number;
  track: WorkspaceTimelineTrack;
}): TimelineExternalDropPreview | null {
  if ((!payload.nodeId && !payload.assetId) || !payload.mediaKind) return null;
  const startSec = !isInsertIntoClipEnabled
    ? insertionBoundaryForTimelineTrack(items, track, rawStartSec)
    : rawStartSec;
  const durationSec = durationForTimelineDropPayload(payload);
  const isValid = isExternalTimelineDropCompatible(payload.mediaKind, track) && !lockedTracks.has(track);
  return {
    displacedItems: isValid
      ? resolveTimelineExternalDropDisplacements({
          insertDurationSec: durationSec,
          insertStartSec: startSec,
          items,
          track,
        })
      : [],
    durationSec,
    isValid,
    mediaKind: payload.mediaKind,
    previewUrl: payload.previewUrl,
    startSec,
    title: titleForTimelineDropPayload(payload),
    trackId: track,
  };
}
