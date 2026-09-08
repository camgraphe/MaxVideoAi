import type { WorkspaceTimelineItem } from '../workspace-types';

export const MIN_CLIP_DURATION_SEC = 1;
export const TIMELINE_SECOND_PRECISION = 1_000_000;

export function clampTimelineValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function snapTimelineValue(value: number): number {
  return Math.round(value * TIMELINE_SECOND_PRECISION) / TIMELINE_SECOND_PRECISION;
}

export function workspaceTimelineItemEndSec(item: WorkspaceTimelineItem): number {
  return item.startSec + item.durationSec;
}

export function secondsToTimelineFrame(seconds: number, fps: number): number {
  return Math.round(Math.max(0, seconds) * Math.max(1, fps));
}

export function timelineFrameToSeconds(frame: number, fps: number): number {
  return snapTimelineValue(Math.max(0, frame) / Math.max(1, fps));
}

export function snapSecondsToTimelineFrame(seconds: number, fps: number): number {
  return timelineFrameToSeconds(secondsToTimelineFrame(seconds, fps), fps);
}
