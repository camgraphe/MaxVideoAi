import { isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import {
  MIN_CLIP_DURATION_SEC,
  clampTimelineValue,
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline-frames';
import { primaryTimelineItemFor, syncLinkedAudioWithVideo } from './timeline-linked-audio';
import {
  clampSourceStartForDuration,
  resolveResizeTarget,
  sourceRightRoomForTimelineItem,
  sourceStartForTimelineItem,
  type WorkspaceTimelineTrimEdge,
} from './timeline-trim';

export type WorkspaceTimelineTrimMode = 'trim' | 'ripple' | 'roll';

function updateGroupItems(
  items: WorkspaceTimelineItem[],
  groupItems: WorkspaceTimelineItem[],
  updater: (item: WorkspaceTimelineItem) => WorkspaceTimelineItem
): WorkspaceTimelineItem[] {
  const groupIds = new Set(groupItems.map((groupItem) => groupItem.id));
  return items.map((item) => (groupIds.has(item.id) ? updater(item) : item));
}

function primaryTrackItems(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack): WorkspaceTimelineItem[] {
  return items
    .filter((item) => item.track === track)
    .sort((left, right) => left.startSec - right.startSec);
}

function shiftTrackItemsAfter(
  items: WorkspaceTimelineItem[],
  track: WorkspaceTimelineTrack,
  afterSec: number,
  deltaSec: number,
  ignoredIds: Set<string>
): WorkspaceTimelineItem[] {
  if (deltaSec === 0) return items;
  return syncLinkedAudioWithVideo(items.map((item) => {
    if (item.track !== track || ignoredIds.has(item.id) || item.startSec < afterSec) return item;
    return {
      ...item,
      startSec: snapTimelineValue(Math.max(0, item.startSec + deltaSec)),
    };
  }));
}

function nearestTrackItemAfter(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem | null {
  return primaryTrackItems(items, item.track).find((candidate) => candidate.id !== item.id && candidate.startSec >= itemEndSec(item) - 0.25) ?? null;
}

function nearestTrackItemBefore(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem | null {
  return primaryTrackItems(items, item.track)
    .filter((candidate) => candidate.id !== item.id && itemEndSec(candidate) <= item.startSec + 0.25)
    .at(-1) ?? null;
}

export function resizeWorkspaceTimelineItem(params: {
  items: WorkspaceTimelineItem[];
  itemId: string;
  edge: WorkspaceTimelineTrimEdge;
  nextStartSec: number;
  nextDurationSec: number;
  mode?: WorkspaceTimelineTrimMode;
}): WorkspaceTimelineItem[] {
  const item = params.items.find((candidate) => candidate.id === params.itemId);
  if (!item) return params.items;
  const primaryItem = primaryTimelineItemFor(params.items, item);
  const groupId = primaryItem.linkedGroupId ?? null;
  const groupItems = groupId ? params.items.filter((candidate) => candidate.linkedGroupId === groupId) : [primaryItem];
  const { safeDurationSec, safeStartSec, sourceDeltaSec } = resolveResizeTarget({
    item: primaryItem,
    edge: params.edge,
    nextDurationSec: params.nextDurationSec,
  });
  const trimMode = params.mode ?? 'trim';

  if (trimMode === 'ripple') {
    const nextDurationSec = safeDurationSec;
    const durationDeltaSec = snapTimelineValue(nextDurationSec - primaryItem.durationSec);
    const resizedItems = updateGroupItems(params.items, groupItems, (candidate) => ({
      ...candidate,
      startSec: primaryItem.startSec,
      durationSec: nextDurationSec,
      sourceStartSec:
        params.edge === 'start'
          ? clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + sourceDeltaSec, nextDurationSec)
          : candidate.sourceStartSec,
    }));
    const ignoredIds = new Set(groupItems.map((groupItem) => groupItem.id));
    return shiftTrackItemsAfter(resizedItems, primaryItem.track, itemEndSec(primaryItem), durationDeltaSec, ignoredIds);
  }

  if (trimMode === 'roll') {
    const trackItems = primaryTrackItems(params.items, primaryItem.track);
    const neighborItem = params.edge === 'end'
      ? nearestTrackItemAfter(trackItems, primaryItem)
      : nearestTrackItemBefore(trackItems, primaryItem);
    if (!neighborItem) return params.items;

    const neighborGroupItems = neighborItem.linkedGroupId
      ? params.items.filter((candidate) => candidate.linkedGroupId === neighborItem.linkedGroupId)
      : [neighborItem];
    const rawDeltaSec = params.edge === 'end'
      ? safeDurationSec - primaryItem.durationSec
      : safeStartSec - primaryItem.startSec;
    const deltaMinSec = params.edge === 'end'
      ? Math.max(MIN_CLIP_DURATION_SEC - primaryItem.durationSec, -sourceStartForTimelineItem(neighborItem))
      : Math.max(MIN_CLIP_DURATION_SEC - neighborItem.durationSec, -sourceStartForTimelineItem(primaryItem));
    const deltaMaxSec = params.edge === 'end'
      ? Math.min(neighborItem.durationSec - MIN_CLIP_DURATION_SEC, sourceRightRoomForTimelineItem(primaryItem))
      : Math.min(primaryItem.durationSec - MIN_CLIP_DURATION_SEC, sourceRightRoomForTimelineItem(neighborItem));
    const deltaSec = snapTimelineValue(clampTimelineValue(rawDeltaSec, deltaMinSec, deltaMaxSec));
    if (deltaSec === 0) return params.items;

    const primaryGroupIds = new Set(groupItems.map((groupItem) => groupItem.id));
    const neighborGroupIds = new Set(neighborGroupItems.map((groupItem) => groupItem.id));
    return syncLinkedAudioWithVideo(params.items.map((candidate) => {
      if (primaryGroupIds.has(candidate.id)) {
        if (params.edge === 'end') {
          return {
            ...candidate,
            durationSec: snapTimelineValue(candidate.durationSec + deltaSec),
          };
        }
        return {
          ...candidate,
          startSec: snapTimelineValue(candidate.startSec + deltaSec),
          durationSec: snapTimelineValue(candidate.durationSec - deltaSec),
          sourceStartSec: clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + deltaSec, snapTimelineValue(candidate.durationSec - deltaSec)),
        };
      }

      if (neighborGroupIds.has(candidate.id)) {
        if (params.edge === 'end') {
          return {
            ...candidate,
            startSec: snapTimelineValue(candidate.startSec + deltaSec),
            durationSec: snapTimelineValue(candidate.durationSec - deltaSec),
            sourceStartSec: clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + deltaSec, snapTimelineValue(candidate.durationSec - deltaSec)),
          };
        }
        return {
          ...candidate,
          durationSec: snapTimelineValue(candidate.durationSec + deltaSec),
        };
      }

      return candidate;
    }));
  }

  return params.items.map((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return candidate;
    return {
      ...candidate,
      startSec: params.edge === 'start' ? safeStartSec : candidate.startSec,
      durationSec: safeDurationSec,
      sourceStartSec:
        params.edge === 'start'
          ? clampSourceStartForDuration(candidate, sourceStartForTimelineItem(candidate) + sourceDeltaSec, safeDurationSec)
          : candidate.sourceStartSec,
    };
  });
}

export function toggleWorkspaceTimelineCrossfade(
  items: WorkspaceTimelineItem[],
  itemId: string,
  durationSec = 1
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  if (!isWorkspaceTimelineVideoTrack(primaryItem.track)) return items;
  const nextItem = nearestTrackItemAfter(items, primaryItem);
  if (!nextItem) return items;
  const safeDurationSec = snapTimelineValue(Math.max(0.25, Math.min(durationSec, primaryItem.durationSec / 2, nextItem.durationSec / 2)));
  const hasSameTransition = primaryItem.transitionOut?.type === 'crossfade' && primaryItem.transitionOut.durationSec === safeDurationSec;
  return items.map((candidate) => {
    if (candidate.id !== primaryItem.id) return candidate;
    return {
      ...candidate,
      transitionOut: hasSameTransition ? null : { type: 'crossfade', durationSec: safeDurationSec },
    };
  });
}
