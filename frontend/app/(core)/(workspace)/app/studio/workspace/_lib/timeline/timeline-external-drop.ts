import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import {
  MIN_CLIP_DURATION_SEC,
  snapTimelineSeconds,
} from './timeline-interaction';

export const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';

const EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC = 5;

type TimelineDataTransfer = {
  getData: (format: string) => string;
  types: ArrayLike<string> | Iterable<string>;
};

export type TimelineExternalDropPreview = {
  durationSec: number;
  isValid: boolean;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  startSec: number;
  title: string;
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

export function parseTimelineNodeDragPayload(dataTransfer: TimelineDataTransfer): TimelineNodeDragPayload | null {
  if (!Array.from(dataTransfer.types).includes(TIMELINE_NODE_DRAG_TYPE)) return null;
  try {
    const payload = JSON.parse(dataTransfer.getData(TIMELINE_NODE_DRAG_TYPE)) as TimelineNodeDragPayload;
    if ((!payload.nodeId && !payload.assetId) || !payload.mediaKind) return null;
    return payload;
  } catch {
    return null;
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
  return {
    durationSec: durationForTimelineDropPayload(payload),
    isValid: isExternalTimelineDropCompatible(payload.mediaKind, track) && !lockedTracks.has(track),
    mediaKind: payload.mediaKind,
    previewUrl: payload.previewUrl,
    startSec,
    title: titleForTimelineDropPayload(payload),
    trackId: track,
  };
}
