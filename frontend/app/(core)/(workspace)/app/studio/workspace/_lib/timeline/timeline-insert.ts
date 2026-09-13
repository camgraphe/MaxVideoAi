import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { generatedTextReference } from '../workspace-generated-copy';
import { hasLinkedVideoPeer } from './timeline-linked-audio';
import {
  MIN_CLIP_DURATION_SEC,
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline-frames';
import { timelineRangeOverlapsItem } from './timeline-collisions';

export function retimeNewItems(
  items: WorkspaceTimelineItem[],
  startSec: number,
  durationSec?: number
): WorkspaceTimelineItem[] {
  const primaryItem = items.find((item) => isWorkspaceTimelineVideoTrack(item.track)) ?? items[0] ?? null;
  const startDeltaSec = primaryItem ? startSec - primaryItem.startSec : 0;
  return items.map((item) => ({
    ...item,
    startSec: snapTimelineValue(item.startSec + startDeltaSec),
    durationSec: durationSec ? Math.max(MIN_CLIP_DURATION_SEC, Math.min(item.durationSec, durationSec)) : item.durationSec,
    sourceStartSec: item.sourceStartSec ?? 0,
  }));
}

export function editTracksForPreparedItems(items: WorkspaceTimelineItem[]): WorkspaceTimelineTrack[] {
  return Array.from(new Set(items.flatMap((item) => {
    if (isWorkspaceTimelineAudioTrack(item.track) && hasLinkedVideoPeer(items, item)) return [];
    return [item.track];
  })));
}

export function shouldEditTrackItem(params: {
  items: WorkspaceTimelineItem[];
  item: WorkspaceTimelineItem;
  track: WorkspaceTimelineTrack;
}): boolean {
  if (params.item.track === params.track) return true;
  if (!isWorkspaceTimelineVideoTrack(params.track) || !isWorkspaceTimelineAudioTrack(params.item.track) || !params.item.linkedGroupId) {
    return false;
  }
  return params.items.some((candidate) => (
    candidate.linkedGroupId === params.item.linkedGroupId &&
    candidate.track === params.track
  ));
}

function generatedTailCopyForItem(item: WorkspaceTimelineItem): WorkspaceTimelineItem['generatedCopy'] {
  return item.generatedCopy?.title
    ? { title: generatedTextReference(`${item.title} Tail`) }
    : undefined;
}

export function rewriteOverlappedTrackItems(params: {
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
  rangeStartSec: number;
  rangeEndSec: number;
  idSeed: string;
}): WorkspaceTimelineItem[] {
  return params.items.flatMap((item) => {
    if (!shouldEditTrackItem({ items: params.items, item, track: params.track })) return [item];
    const itemStartSec = item.startSec;
    const itemEnd = itemEndSec(item);
    if (!timelineRangeOverlapsItem(item, params.rangeStartSec, params.rangeEndSec)) return [item];

    const leftDurationSec = Math.max(0, params.rangeStartSec - itemStartSec);
    const rightDurationSec = Math.max(0, itemEnd - params.rangeEndSec);
    const nextItems: WorkspaceTimelineItem[] = [];

    if (leftDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        durationSec: snapTimelineValue(leftDurationSec),
      });
    }

    if (rightDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        id: `${item.id}-tail-${params.idSeed}`,
        title: `${item.title} Tail`,
        generatedCopy: generatedTailCopyForItem(item),
        startSec: snapTimelineValue(params.rangeEndSec),
        durationSec: snapTimelineValue(rightDurationSec),
        sourceStartSec: snapTimelineValue((item.sourceStartSec ?? 0) + (params.rangeEndSec - itemStartSec)),
        linkedGroupId: item.linkedGroupId ? `${item.linkedGroupId}-tail-${params.idSeed}` : item.linkedGroupId,
      });
    }

    return nextItems;
  });
}

export function insertIntoTrackItems(params: {
  items: WorkspaceTimelineItem[];
  track: WorkspaceTimelineTrack;
  insertStartSec: number;
  insertDurationSec: number;
  idSeed: string;
}): WorkspaceTimelineItem[] {
  return params.items.flatMap((item) => {
    if (!shouldEditTrackItem({ items: params.items, item, track: params.track })) return [item];
    const itemStartSec = item.startSec;
    const itemEnd = itemEndSec(item);
    if (itemEnd <= params.insertStartSec) return [item];
    if (itemStartSec >= params.insertStartSec) {
      return [{
        ...item,
        startSec: snapTimelineValue(item.startSec + params.insertDurationSec),
      }];
    }

    const leftDurationSec = params.insertStartSec - itemStartSec;
    const rightDurationSec = itemEnd - params.insertStartSec;
    const nextItems: WorkspaceTimelineItem[] = [];
    if (leftDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        durationSec: snapTimelineValue(leftDurationSec),
      });
    }
    if (rightDurationSec >= MIN_CLIP_DURATION_SEC) {
      nextItems.push({
        ...item,
        id: `${item.id}-tail-${params.idSeed}`,
        title: `${item.title} Tail`,
        generatedCopy: generatedTailCopyForItem(item),
        startSec: snapTimelineValue(params.insertStartSec + params.insertDurationSec),
        durationSec: snapTimelineValue(rightDurationSec),
        sourceStartSec: snapTimelineValue((item.sourceStartSec ?? 0) + leftDurationSec),
        linkedGroupId: item.linkedGroupId ? `${item.linkedGroupId}-tail-${params.idSeed}` : item.linkedGroupId,
      });
    }
    return nextItems;
  });
}

export function insertReferenceTrackForPreparedItems(items: WorkspaceTimelineItem[]): WorkspaceTimelineTrack | null {
  const tracks = editTracksForPreparedItems(items);
  return tracks.find((track) => isWorkspaceTimelineVideoTrack(track)) ?? tracks[0] ?? null;
}

export function insertionBoundaryForWholeClipInsert(params: {
  items: WorkspaceTimelineItem[];
  preparedItems: WorkspaceTimelineItem[];
  requestedStartSec: number;
}): number {
  const referenceTrack = insertReferenceTrackForPreparedItems(params.preparedItems);
  if (!referenceTrack) return params.requestedStartSec;

  const targetItem = params.items
    .filter((item) => shouldEditTrackItem({ items: params.items, item, track: referenceTrack }))
    .filter((item) => params.requestedStartSec > item.startSec && params.requestedStartSec < itemEndSec(item))
    .sort((left, right) => left.startSec - right.startSec)[0] ?? null;
  if (!targetItem) return params.requestedStartSec;

  const midpointSec = targetItem.startSec + targetItem.durationSec / 2;
  return snapTimelineValue(params.requestedStartSec < midpointSec ? targetItem.startSec : itemEndSec(targetItem));
}
