import { Magnet, SplitSquareHorizontal } from 'lucide-react';
import type {
  ChangeEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { memo, useMemo } from 'react';

import controlStyles from '../../_styles/timeline-controls.module.css';
import styles from '../../_styles/timeline.module.css';
import { formatWorkspaceTimecode } from '../../_lib/workspace-timecode';
import type { StudioCopy } from '../../../_lib/studio-copy';

type TimelineRulerProps = {
  copy: StudioCopy['timeline']['tools'];
  clampedPlayheadSec: number;
  frameStepSec: number;
  hasValidInOutRange: boolean;
  isInsertIntoClipEnabled: boolean;
  onBeginPlayheadDrag: (event: ReactPointerEvent<HTMLElement>, containerElement: HTMLElement | null) => void;
  onInsertIntoClipChange: (enabled: boolean) => void;
  onScrub: (event: ChangeEvent<HTMLInputElement>) => void;
  onSurfaceClick: (event: MouseEvent<HTMLDivElement>) => void;
  onSurfacePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleSnap: () => void;
  pixelsPerSecond: number;
  projectFps: number;
  rulerTickSec: number;
  safeInPointSec: number | null;
  safeOutPointSec: number | null;
  snapEnabled: boolean;
  snapGuideSec: number | null;
  timelineWidth: number;
  totalDuration: number;
};

export const TimelineRuler = memo(function TimelineRuler({
  copy,
  clampedPlayheadSec,
  frameStepSec,
  hasValidInOutRange,
  isInsertIntoClipEnabled,
  onBeginPlayheadDrag,
  onInsertIntoClipChange,
  onScrub,
  onSurfaceClick,
  onSurfacePointerDown,
  onToggleSnap,
  pixelsPerSecond,
  projectFps,
  rulerTickSec,
  safeInPointSec,
  safeOutPointSec,
  snapEnabled,
  snapGuideSec,
  timelineWidth,
  totalDuration,
}: TimelineRulerProps) {
  const rulerTicks = useMemo(
    () => Array.from({ length: Math.ceil(totalDuration / rulerTickSec) + 1 }, (_, index) => index * rulerTickSec),
    [rulerTickSec, totalDuration]
  );

  return (
    <div className={styles.timelineRuler} data-timeline-ruler="true">
      <div className={styles.timelineRulerLabel}>
        <div className={styles.timelineRulerToolSlot} data-timeline-ruler-tool-slot="true">
          <button
            type="button"
            className={`${styles.timelineRulerToolButton} ${controlStyles.timelineToolButton} ${snapEnabled ? controlStyles.timelineToolButtonActive : ''}`}
            data-tooltip={copy.snappingTooltip}
            data-timeline-control="true"
            title={copy.snappingTitle}
            onClick={onToggleSnap}
            aria-label={copy.toggleSnapping}
            aria-pressed={snapEnabled}
          >
            <Magnet size={15} />
          </button>
          <button
            type="button"
            className={`${styles.timelineRulerToolButton} ${controlStyles.timelineToolButton} ${isInsertIntoClipEnabled ? controlStyles.timelineToolButtonActive : ''}`}
            data-tooltip={copy.insertIntoClipTooltip}
            data-timeline-control="true"
            title={copy.insertIntoClipTitle}
            aria-label={copy.toggleInsertIntoClip}
            aria-pressed={isInsertIntoClipEnabled}
            onClick={() => onInsertIntoClipChange(!isInsertIntoClipEnabled)}
          >
            <SplitSquareHorizontal size={15} />
          </button>
        </div>
      </div>
      <div className={styles.timelineRulerLane}>
        <div
          className={styles.timelineRulerInner}
          style={{ width: timelineWidth }}
          onClick={onSurfaceClick}
          onPointerDown={onSurfacePointerDown}
          title={copy.dragPlayhead}
        >
          {hasValidInOutRange && safeInPointSec !== null && safeOutPointSec !== null ? (
            <span
              className={styles.timelineInOutRange}
              data-timeline-in-out-range="true"
              style={{
                left: safeInPointSec * pixelsPerSecond,
                width: Math.max(1, (safeOutPointSec - safeInPointSec) * pixelsPerSecond),
              }}
              aria-hidden="true"
            />
          ) : null}
          {safeInPointSec !== null ? (
            <span
              className={`${styles.timelineInOutMarker} ${styles.timelineInMarker}`}
              data-timeline-in-marker="true"
              style={{ left: safeInPointSec * pixelsPerSecond }}
              aria-hidden="true"
            >
              I
            </span>
          ) : null}
          {safeOutPointSec !== null ? (
            <span
              className={`${styles.timelineInOutMarker} ${styles.timelineOutMarker}`}
              data-timeline-out-marker="true"
              style={{ left: safeOutPointSec * pixelsPerSecond }}
              aria-hidden="true"
            >
              O
            </span>
          ) : null}
          {rulerTicks.map((tickSec) => (
            <span key={tickSec} style={{ left: tickSec * pixelsPerSecond }}>
              {formatWorkspaceTimecode(tickSec, projectFps)}
            </span>
          ))}
          <button
            type="button"
            className={`${styles.timelinePlayhead} ${styles.timelineRulerPlayhead}`}
            style={{ left: clampedPlayheadSec * pixelsPerSecond }}
            onPointerDown={(event) => onBeginPlayheadDrag(event, event.currentTarget.parentElement)}
            data-playhead-handle="true"
            data-timeline-control="true"
            title={copy.dragPlayhead}
            aria-label={copy.dragPlayhead}
          />
          {snapGuideSec !== null ? (
            <span
              className={styles.timelineSnapGuide}
              style={{ left: snapGuideSec * pixelsPerSecond }}
              aria-hidden="true"
            />
          ) : null}
          <input
            className={styles.timelineScrubber}
            type="range"
            min={0}
            max={totalDuration}
            step={frameStepSec}
            value={clampedPlayheadSec}
            onChange={onScrub}
            onPointerDown={(event) => onBeginPlayheadDrag(event, event.currentTarget.parentElement)}
            data-timeline-control="true"
            aria-label={copy.scrubber}
            aria-valuetext={formatWorkspaceTimecode(clampedPlayheadSec, projectFps)}
          />
        </div>
      </div>
    </div>
  );
});
