import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { workspaceTimelineItemEndSec } from './timeline-frames';

export function timelineRangeOverlapsItem(
  item: WorkspaceTimelineItem,
  rangeStartSec: number,
  rangeEndSec: number
): boolean {
  return workspaceTimelineItemEndSec(item) > rangeStartSec && item.startSec < rangeEndSec;
}

export function timelineItemsOverlapOnSameTrack(
  left: WorkspaceTimelineItem,
  right: WorkspaceTimelineItem
): boolean {
  return left.track === right.track && timelineRangeOverlapsItem(left, right.startSec, workspaceTimelineItemEndSec(right));
}

export function timelineTrackHasOverlap(
  items: WorkspaceTimelineItem[],
  track?: WorkspaceTimelineTrack
): boolean {
  const trackItems = items
    .filter((item) => !track || item.track === track)
    .sort((left, right) => left.track.localeCompare(right.track) || left.startSec - right.startSec);

  return trackItems.some((item, index) => {
    const nextItem = trackItems[index + 1];
    return Boolean(nextItem && timelineItemsOverlapOnSameTrack(item, nextItem));
  });
}

