import { isWorkspaceTimelineAudioTrack, isWorkspaceTimelineVideoTrack } from '../workspace-timeline-tracks';
import type { WorkspaceTimelineItem } from '../workspace-types';
import { timelineItemsOverlapOnSameTrack, timelineTrackHasOverlap } from './timeline-collisions';
import { snapTimelineValue } from './timeline-frames';

export type LinkedTimelineMoveResult = {
  collidingItemIds: string[];
  items: WorkspaceTimelineItem[];
  ok: boolean;
  reason: string | null;
};

export function primaryTimelineItemFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem {
  if (!item.linkedGroupId) return item;
  return items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track)) ?? item;
}

export function shouldMirrorLinkedVideo(item: WorkspaceTimelineItem, items: WorkspaceTimelineItem[]): boolean {
  if (!item.linkedGroupId || item.linkedGroupKind === 'manual' || !isWorkspaceTimelineAudioTrack(item.track)) return false;
  return items.some((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
}

export function groupItemsFor(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): WorkspaceTimelineItem[] {
  return item.linkedGroupId ? items.filter((candidate) => candidate.linkedGroupId === item.linkedGroupId) : [item];
}

export function hasLinkedVideoPeer(items: WorkspaceTimelineItem[], item: WorkspaceTimelineItem): boolean {
  return Boolean(item.linkedGroupId && items.some((candidate) => (
    candidate.linkedGroupId === item.linkedGroupId &&
    item.linkedGroupKind !== 'manual' &&
    isWorkspaceTimelineVideoTrack(candidate.track)
  )));
}

export function syncLinkedAudioWithVideo(items: WorkspaceTimelineItem[]): WorkspaceTimelineItem[] {
  return items.map((item) => {
    if (!shouldMirrorLinkedVideo(item, items)) return item;
    const videoItem = items.find((candidate) => candidate.linkedGroupId === item.linkedGroupId && isWorkspaceTimelineVideoTrack(candidate.track));
    if (!videoItem) return item;
    return {
      ...item,
      startSec: videoItem.startSec,
      durationSec: videoItem.durationSec,
      sourceStartSec: videoItem.sourceStartSec,
      sourceDurationSec: videoItem.sourceDurationSec,
    };
  });
}

export function moveLinkedTimelineSelection(params: {
  deltaSec: number;
  items: WorkspaceTimelineItem[];
  selectedItemId: string;
  targetTrack?: WorkspaceTimelineItem['track'];
}): LinkedTimelineMoveResult {
  const selectedItem = params.items.find((item) => item.id === params.selectedItemId);
  if (!selectedItem) {
    return {
      collidingItemIds: [],
      items: params.items,
      ok: false,
      reason: 'The selected timeline item no longer exists.',
    };
  }

  const movedItems = groupItemsFor(params.items, selectedItem);
  const movedIds = new Set(movedItems.map((item) => item.id));
  const deltaSec = snapTimelineValue(params.deltaSec);
  const nextItems = params.items.map((item) => {
    if (!movedIds.has(item.id)) return item;
    return {
      ...item,
      track: item.id === selectedItem.id && params.targetTrack ? params.targetTrack : item.track,
      startSec: snapTimelineValue(Math.max(0, item.startSec + deltaSec)),
    };
  });
  const collidingItemIds = nextItems
    .filter((item) => movedIds.has(item.id))
    .filter((item) => nextItems.some((candidate) => (
      !movedIds.has(candidate.id) && timelineItemsOverlapOnSameTrack(item, candidate)
    )))
    .map((item) => item.id);

  if (collidingItemIds.length || timelineTrackHasOverlap(nextItems)) {
    return {
      collidingItemIds,
      items: params.items,
      ok: false,
      reason: 'The linked timeline move would overlap an occupied track.',
    };
  }

  return { collidingItemIds: [], items: nextItems, ok: true, reason: null };
}
