import type { WorkspaceTimelineItem } from '../workspace-types';
import {
  MIN_CLIP_DURATION_SEC,
  clampTimelineValue,
  snapTimelineValue,
  workspaceTimelineItemEndSec,
} from './timeline-frames';

export type WorkspaceTimelineTrimEdge = 'start' | 'end';

export function sourceDurationForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceStartSec = item.sourceStartSec ?? 0;
  return Math.max(MIN_CLIP_DURATION_SEC, item.sourceDurationSec ?? sourceStartSec + item.durationSec);
}

export function sourceStartForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceDurationSec = sourceDurationForTimelineItem(item);
  return clampTimelineValue(item.sourceStartSec ?? 0, 0, Math.max(0, sourceDurationSec - MIN_CLIP_DURATION_SEC));
}

export function sourceRightRoomForTimelineItem(item: WorkspaceTimelineItem): number {
  return Math.max(0, sourceDurationForTimelineItem(item) - sourceStartForTimelineItem(item) - item.durationSec);
}

export function maxResizeDurationForTimelineItem(item: WorkspaceTimelineItem, edge: WorkspaceTimelineTrimEdge): number {
  if (edge === 'start') return Math.max(MIN_CLIP_DURATION_SEC, item.durationSec + sourceStartForTimelineItem(item));
  return Math.max(MIN_CLIP_DURATION_SEC, item.durationSec + sourceRightRoomForTimelineItem(item));
}

export function clampSourceStartForDuration(
  item: WorkspaceTimelineItem,
  sourceStartSec: number,
  durationSec: number
): number {
  return clampTimelineValue(
    sourceStartSec,
    0,
    Math.max(0, sourceDurationForTimelineItem(item) - durationSec)
  );
}

export function resolveResizeTarget(params: {
  item: WorkspaceTimelineItem;
  edge: WorkspaceTimelineTrimEdge;
  nextDurationSec: number;
}): { safeDurationSec: number; safeStartSec: number; sourceDeltaSec: number } {
  const itemEnd = workspaceTimelineItemEndSec(params.item);
  const maxDurationSec = maxResizeDurationForTimelineItem(params.item, params.edge);
  const requestedDurationSec = snapTimelineValue(clampTimelineValue(params.nextDurationSec, MIN_CLIP_DURATION_SEC, maxDurationSec));

  if (params.edge === 'end') {
    return {
      safeDurationSec: requestedDurationSec,
      safeStartSec: params.item.startSec,
      sourceDeltaSec: 0,
    };
  }

  const safeStartSec = snapTimelineValue(clampTimelineValue(
    itemEnd - requestedDurationSec,
    0,
    itemEnd - MIN_CLIP_DURATION_SEC
  ));
  return {
    safeDurationSec: snapTimelineValue(itemEnd - safeStartSec),
    safeStartSec,
    sourceDeltaSec: snapTimelineValue(safeStartSec - params.item.startSec),
  };
}

export function resolveTimelineSplitOffset(item: WorkspaceTimelineItem, splitOffsetSec?: number): number | null {
  if (item.durationSec < MIN_CLIP_DURATION_SEC * 2) return null;
  const splitAt = clampTimelineValue(
    snapTimelineValue(splitOffsetSec ?? item.durationSec / 2),
    MIN_CLIP_DURATION_SEC,
    item.durationSec - MIN_CLIP_DURATION_SEC
  );
  if (splitAt <= 0 || splitAt >= item.durationSec) return null;
  return splitAt;
}

export function resolveTimelineTrimAmount(item: WorkspaceTimelineItem, deltaSec: number): number {
  return Math.max(0, Math.min(item.durationSec - MIN_CLIP_DURATION_SEC, snapTimelineValue(deltaSec)));
}
