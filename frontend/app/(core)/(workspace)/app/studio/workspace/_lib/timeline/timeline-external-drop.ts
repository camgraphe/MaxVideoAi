import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import {
  MIN_CLIP_DURATION_SEC,
  snapTimelineSeconds,
} from './timeline-interaction';
import {
  shouldEditTrackItem,
} from './timeline-insert';
import { localizeWorkspaceTimelineItemTitle } from '../workspace-generated-copy';
import type { StudioCopy } from '../../../_lib/studio-copy';

export const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';

const EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC = 5;
const LINKED_AUDIO_DROP_TRACK: WorkspaceTimelineTrack = 'audio';
let activeTimelineNodeDragPayload: TimelineNodeDragPayload | null = null;

type TimelineDataTransfer = {
  getData: (format: string) => string;
  types: ArrayLike<string> | Iterable<string>;
};

export type TimelineExternalDropPreview = {
  displacedItems: TimelineExternalDropDisplacement[];
  durationSec: number;
  ghostItems: TimelineExternalDropGhost[];
  isValid: boolean;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  startSec: number;
  title: string;
  trackId: WorkspaceTimelineTrack;
};

export type TimelineExternalDropGhost = {
  durationSec: number;
  isPrimary: boolean;
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
  hasTimelineAudio?: boolean;
  mediaKind?: 'audio' | 'image' | 'video';
  nodeId?: string;
  previewUrl?: string | null;
  title?: string | null;
};

function localizeTimelinePreviewTitle(
  item: WorkspaceTimelineItem,
  copy?: StudioCopy['canvas']['nodes']
): string {
  return copy ? localizeWorkspaceTimelineItemTitle(item, copy) : item.title;
}

function formatTimelinePreviewCopy(
  value: string,
  replacements: Record<string, string | number>
): string {
  return Object.entries(replacements).reduce(
    (current, [key, replacement]) => current.replaceAll(`{${key}}`, String(replacement)),
    value
  );
}

function localizeTimelineTailPreviewTitle(
  item: WorkspaceTimelineItem,
  copy?: StudioCopy['canvas']['nodes']
): string {
  if (!copy || !item.generatedCopy?.title) return `${item.title} tail`;
  const localizedTitle = localizeWorkspaceTimelineItemTitle(item, copy);
  return formatTimelinePreviewCopy(copy.templateTimelineTailPreviewName ?? '{name} tail', { name: localizedTitle });
}

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

function linkedAudioTitleForTimelineDropPayload(payload: TimelineNodeDragPayload): string {
  return `${titleForTimelineDropPayload(payload)} Audio`;
}

export function isExternalTimelineDropCompatible(
  mediaKind: TimelineExternalDropPreview['mediaKind'],
  track: WorkspaceTimelineTrack
): boolean {
  if (mediaKind === 'audio') return !isWorkspaceTimelineVideoTrack(track);
  return isWorkspaceTimelineVideoTrack(track);
}

function ghostItemsForTimelineDropPreview(params: {
  durationSec: number;
  isValid: boolean;
  payload: TimelineNodeDragPayload;
  startSec: number;
  track: WorkspaceTimelineTrack;
}): TimelineExternalDropGhost[] {
  const primaryGhost: TimelineExternalDropGhost = {
    durationSec: params.durationSec,
    isPrimary: true,
    mediaKind: params.payload.mediaKind ?? 'video',
    previewUrl: params.payload.previewUrl,
    startSec: params.startSec,
    title: titleForTimelineDropPayload(params.payload),
    trackId: params.track,
  };
  if (!params.isValid || params.payload.mediaKind !== 'video' || !params.payload.hasTimelineAudio) {
    return [primaryGhost];
  }
  return [
    primaryGhost,
    {
      durationSec: params.durationSec,
      isPrimary: false,
      mediaKind: 'audio',
      previewUrl: null,
      startSec: params.startSec,
      title: linkedAudioTitleForTimelineDropPayload(params.payload),
      trackId: LINKED_AUDIO_DROP_TRACK,
    },
  ];
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
  canvasNodeCopy,
  insertDurationSec,
  insertStartSec,
  items,
  track,
}: {
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
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
        title: localizeTimelinePreviewTitle(item, canvasNodeCopy),
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
      title: localizeTimelineTailPreviewTitle(item, canvasNodeCopy),
      toStartSec: snapTimelineSeconds(insertStartSec + insertDurationSec),
      trackId: item.track,
    }];
  });
}

export function resolveTimelineExternalDropPreview({
  canvasNodeCopy,
  isInsertIntoClipEnabled,
  items,
  lockedTracks,
  payload,
  rawStartSec,
  track,
}: {
  canvasNodeCopy?: StudioCopy['canvas']['nodes'];
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
  const title = titleForTimelineDropPayload(payload);
  return {
    displacedItems: isValid
      ? resolveTimelineExternalDropDisplacements({
          insertDurationSec: durationSec,
          insertStartSec: startSec,
          canvasNodeCopy,
          items,
          track,
        })
      : [],
    durationSec,
    ghostItems: ghostItemsForTimelineDropPreview({
      durationSec,
      isValid,
      payload,
      startSec,
      track,
    }),
    isValid,
    mediaKind: payload.mediaKind,
    previewUrl: payload.previewUrl,
    startSec,
    title,
    trackId: track,
  };
}
