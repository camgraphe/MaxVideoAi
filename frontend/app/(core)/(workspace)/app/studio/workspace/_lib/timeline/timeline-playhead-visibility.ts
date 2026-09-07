export type TimelinePlayheadVisibilityOptions = {
  frameStepSec: number;
  playheadSec: number;
  viewportEndSec: number;
  viewportStartSec: number;
};

export function isTimelinePlayheadVisibleInViewport({
  frameStepSec,
  playheadSec,
  viewportEndSec,
  viewportStartSec,
}: TimelinePlayheadVisibilityOptions): boolean {
  if (!Number.isFinite(playheadSec)) return false;
  if (!Number.isFinite(viewportStartSec) || !Number.isFinite(viewportEndSec)) return true;
  if (viewportEndSec < viewportStartSec) return false;

  const frameToleranceSec = Math.max(0, frameStepSec / 2);
  return (
    playheadSec >= Math.max(0, viewportStartSec) - frameToleranceSec &&
    playheadSec <= viewportEndSec + frameToleranceSec
  );
}
