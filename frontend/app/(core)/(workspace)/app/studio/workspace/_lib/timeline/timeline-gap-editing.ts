import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import {
  timelineRangeOverlapsItem,
  timelineTrackHasOverlap,
} from './timeline-collisions';
import {
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline-frames';
import { syncLinkedAudioWithVideo } from './timeline-linked-audio';

export type WorkspaceTimelineGapSelection = {
  endSec: number;
  startSec: number;
  track?: WorkspaceTimelineTrack;
};

function itemContainsTimelineSecond(item: WorkspaceTimelineItem, seconds: number): boolean {
  return item.startSec <= seconds && itemEndSec(item) > seconds;
}

function gapScopedTimelineItems(
  items: WorkspaceTimelineItem[],
  track?: WorkspaceTimelineTrack
): WorkspaceTimelineItem[] {
  return track ? items.filter((item) => item.track === track) : items;
}

function timelineEditIntroducesOverlap(
  originalItems: WorkspaceTimelineItem[],
  candidateItems: WorkspaceTimelineItem[]
): boolean {
  return !timelineTrackHasOverlap(originalItems) && timelineTrackHasOverlap(candidateItems);
}

export function resolveWorkspaceTimelineGapSelection(
  items: WorkspaceTimelineItem[],
  seconds: number,
  track?: WorkspaceTimelineTrack
): WorkspaceTimelineGapSelection | null {
  const scopedItems = gapScopedTimelineItems(items, track);
  if (track && !scopedItems.length) {
    const sharedGap = resolveWorkspaceTimelineGapSelection(items, seconds);
    return sharedGap ? { ...sharedGap, track } : null;
  }
  if (!scopedItems.length) return null;
  const safeSeconds = snapTimelineValue(Math.max(0, seconds));
  if (scopedItems.some((item) => itemContainsTimelineSecond(item, safeSeconds))) return null;

  const previousBoundarySec = scopedItems.reduce((boundarySec, item) => {
    const endSec = itemEndSec(item);
    return endSec <= safeSeconds ? Math.max(boundarySec, endSec) : boundarySec;
  }, 0);
  const nextBoundarySec = scopedItems.reduce((boundarySec, item) => {
    return item.startSec > safeSeconds ? Math.min(boundarySec, item.startSec) : boundarySec;
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(nextBoundarySec)) return null;
  const startSec = snapTimelineValue(previousBoundarySec);
  const endSec = snapTimelineValue(nextBoundarySec);
  return endSec > startSec ? { startSec, endSec, ...(track ? { track } : {}) } : null;
}

export function deleteWorkspaceTimelineGap(
  items: WorkspaceTimelineItem[],
  gap: WorkspaceTimelineGapSelection
): WorkspaceTimelineItem[] {
  const startSec = snapTimelineValue(Math.max(0, Math.min(gap.startSec, gap.endSec)));
  const endSec = snapTimelineValue(Math.max(gap.startSec, gap.endSec));
  const durationSec = snapTimelineValue(endSec - startSec);
  if (durationSec <= 0) return items;
  const scopedItems = gapScopedTimelineItems(items, gap.track);
  if (!scopedItems.length) return items;
  if (scopedItems.some((item) => timelineRangeOverlapsItem(item, startSec, endSec))) return items;

  let changed = false;
  const shiftedItems = items.map((item) => {
    if ((gap.track && item.track !== gap.track) || item.startSec < endSec) return item;
    changed = true;
    return {
      ...item,
      startSec: snapTimelineValue(Math.max(0, item.startSec - durationSec)),
    };
  });
  if (!changed) return items;
  const syncedItems = syncLinkedAudioWithVideo(shiftedItems);
  return timelineEditIntroducesOverlap(items, syncedItems) ? items : syncedItems;
}
