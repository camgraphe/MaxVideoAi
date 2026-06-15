import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { timelineRangeOverlapsItem } from './timeline-collisions';
import {
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline-frames';
import {
  hasLinkedVideoPeer,
  primaryTimelineItemFor,
} from './timeline-linked-audio';
import { normalizeWorkspaceTimelineStarts } from './timeline-normalize';
import {
  timelineSelectionKeyForItem,
  timelineSelectionKeysForItemIds,
} from './timeline-selection-groups';

export function positionWorkspaceTimelineItem(
  items: WorkspaceTimelineItem[],
  itemId: string,
  nextStartSec: number,
  nextTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) return items;
  const primaryItem = primaryTimelineItemFor(items, item);
  const shouldRetargetDraggedItem = Boolean(
    nextTrack &&
    (
      (isWorkspaceTimelineVideoTrack(item.track) && isWorkspaceTimelineVideoTrack(nextTrack)) ||
      (isWorkspaceTimelineAudioTrack(item.track) && isWorkspaceTimelineAudioTrack(nextTrack))
    )
  );
  const trackAnchorItem = shouldRetargetDraggedItem ? item : primaryItem;
  const targetTrack = nextTrack && isWorkspaceTimelineVideoTrack(trackAnchorItem.track) && isWorkspaceTimelineVideoTrack(nextTrack)
    ? nextTrack
    : nextTrack && isWorkspaceTimelineAudioTrack(trackAnchorItem.track) && isWorkspaceTimelineAudioTrack(nextTrack)
      ? nextTrack
      : trackAnchorItem.track;
  const groupId = primaryItem.linkedGroupId ?? null;
  const groupItems = groupId ? items.filter((candidate) => candidate.linkedGroupId === groupId) : [primaryItem];
  const safeStartSec = snapTimelineValue(Math.max(0, nextStartSec));
  const startDeltaSec = safeStartSec - trackAnchorItem.startSec;
  const anchorCenterSec = safeStartSec + trackAnchorItem.durationSec / 2;
  const trackItems = items
    .filter((candidate) => candidate.track === targetTrack)
    .sort((left, right) => left.startSec - right.startSec);
  const crossedTrackNeighbor = trackItems.some((candidate) => {
    if (candidate.id === trackAnchorItem.id) return false;
    if (!timelineRangeOverlapsItem(candidate, safeStartSec, safeStartSec + trackAnchorItem.durationSec)) return false;
    const candidateMidSec = candidate.startSec + candidate.durationSec / 2;
    if (trackAnchorItem.startSec < candidate.startSec) return anchorCenterSec >= candidateMidSec;
    if (trackAnchorItem.startSec > candidate.startSec) return anchorCenterSec <= candidateMidSec;
    return false;
  });

  if (crossedTrackNeighbor) {
    const reorderedItems = trackItems.filter((candidate) => candidate.id !== trackAnchorItem.id);
    const insertionIndex = reorderedItems.findIndex((candidate) => anchorCenterSec < candidate.startSec + candidate.durationSec / 2);
    reorderedItems.splice(insertionIndex < 0 ? reorderedItems.length : insertionIndex, 0, {
      ...trackAnchorItem,
      track: targetTrack,
    });
    const remainingItems = items.filter((candidate) => candidate.id !== trackAnchorItem.id && candidate.track !== targetTrack);
    return normalizeWorkspaceTimelineStarts([...remainingItems, ...reorderedItems]);
  }

  return items.map((candidate) => {
    if (!groupItems.some((groupItem) => groupItem.id === candidate.id)) return candidate;
    return {
      ...candidate,
      track: candidate.id === trackAnchorItem.id ? targetTrack : candidate.track,
      startSec: snapTimelineValue(Math.max(0, candidate.startSec + startDeltaSec)),
    };
  });
}

function constrainTimelineSelectionDelta(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  selectedItems: WorkspaceTimelineItem[],
  requestedDeltaSec: number
): number {
  let minDeltaSec = Number.NEGATIVE_INFINITY;
  let maxDeltaSec = Number.POSITIVE_INFINITY;

  selectedItems.forEach((selectedItem) => {
    const selectedStartSec = selectedItem.startSec;
    const selectedEndSec = itemEndSec(selectedItem);
    minDeltaSec = Math.max(minDeltaSec, -selectedStartSec);

    items
      .filter((blocker) => blocker.track === selectedItem.track && !selectedKeys.has(timelineSelectionKeyForItem(blocker)))
      .forEach((blocker) => {
        const blockerStartSec = blocker.startSec;
        const blockerEndSec = itemEndSec(blocker);
        if (blockerEndSec <= selectedStartSec) {
          minDeltaSec = Math.max(minDeltaSec, blockerEndSec - selectedStartSec);
          return;
        }
        if (blockerStartSec >= selectedEndSec) {
          maxDeltaSec = Math.min(maxDeltaSec, blockerStartSec - selectedEndSec);
        }
      });
  });

  if (Number.isFinite(minDeltaSec) && Number.isFinite(maxDeltaSec) && minDeltaSec > maxDeltaSec) {
    return snapTimelineValue(requestedDeltaSec >= 0 ? maxDeltaSec : minDeltaSec);
  }

  let safeDeltaSec = requestedDeltaSec;
  if (Number.isFinite(minDeltaSec)) safeDeltaSec = Math.max(safeDeltaSec, minDeltaSec);
  if (Number.isFinite(maxDeltaSec)) safeDeltaSec = Math.min(safeDeltaSec, maxDeltaSec);
  return snapTimelineValue(safeDeltaSec);
}

export function positionWorkspaceTimelineItems(
  items: WorkspaceTimelineItem[],
  itemIds: string[],
  anchorItemId: string,
  nextStartSec: number,
  nextTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  const selectedKeys = timelineSelectionKeysForItemIds(items, itemIds);
  const anchorItem = items.find((candidate) => candidate.id === anchorItemId);
  if (!anchorItem) return items;

  const anchorKey = timelineSelectionKeyForItem(anchorItem);
  if (!selectedKeys.has(anchorKey)) {
    return positionWorkspaceTimelineItem(items, anchorItemId, nextStartSec, nextTrack);
  }
  if (selectedKeys.size <= 1) {
    return positionWorkspaceTimelineItem(items, anchorItemId, nextStartSec, nextTrack);
  }

  const anchorPrimaryItem = primaryTimelineItemFor(items, anchorItem);
  const selectedItems = items.filter((candidate) => selectedKeys.has(timelineSelectionKeyForItem(candidate)));
  const requestedDeltaSec = snapTimelineValue(Math.max(0, nextStartSec) - anchorPrimaryItem.startSec);
  const safeDeltaSec = constrainTimelineSelectionDelta(items, selectedKeys, selectedItems, requestedDeltaSec);
  if (safeDeltaSec === 0) return items;

  return items.map((candidate) => {
    if (!selectedKeys.has(timelineSelectionKeyForItem(candidate))) return candidate;
    return {
      ...candidate,
      startSec: snapTimelineValue(candidate.startSec + safeDeltaSec),
    };
  });
}

export function retargetTimelineSelectionItems(
  items: WorkspaceTimelineItem[],
  selectedKeys: Set<string>,
  anchorItem: WorkspaceTimelineItem,
  targetTrack?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  if (!targetTrack || selectedKeys.size > 1) return items;
  return items.map((item) => {
    if (isWorkspaceTimelineVideoTrack(item.track) && isWorkspaceTimelineVideoTrack(targetTrack)) {
      return { ...item, track: targetTrack };
    }
    if (
      isWorkspaceTimelineAudioTrack(item.track) &&
      isWorkspaceTimelineAudioTrack(targetTrack) &&
      (item.id === anchorItem.id || !hasLinkedVideoPeer(items, item))
    ) {
      return { ...item, track: targetTrack };
    }
    return item;
  });
}
