import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../workspace-types';
import { timelineRangeOverlapsItem } from './timeline-collisions';
import {
  snapTimelineValue,
  workspaceTimelineItemEndSec as itemEndSec,
} from './timeline-frames';

export type WorkspaceTimelineGapSelection = {
  endSec: number;
  startSec: number;
  track?: WorkspaceTimelineTrack;
};

function itemContainsTimelineSecond(item: WorkspaceTimelineItem, seconds: number): boolean {
  return item.startSec <= seconds && itemEndSec(item) > seconds;
}

export function resolveWorkspaceTimelineGapSelection(
  items: WorkspaceTimelineItem[],
  seconds: number,
  track?: WorkspaceTimelineTrack
): WorkspaceTimelineGapSelection | null {
  if (!items.length) return null;
  const safeSeconds = snapTimelineValue(Math.max(0, seconds));
  if (items.some((item) => itemContainsTimelineSecond(item, safeSeconds))) return null;

  const previousBoundarySec = items.reduce((boundarySec, item) => {
    const endSec = itemEndSec(item);
    return endSec <= safeSeconds ? Math.max(boundarySec, endSec) : boundarySec;
  }, 0);
  const nextBoundarySec = items.reduce((boundarySec, item) => {
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
  if (items.some((item) => timelineRangeOverlapsItem(item, startSec, endSec))) return items;

  return items.map((item) => {
    if (item.startSec < endSec) return item;
    return {
      ...item,
      startSec: snapTimelineValue(Math.max(0, item.startSec - durationSec)),
    };
  });
}
