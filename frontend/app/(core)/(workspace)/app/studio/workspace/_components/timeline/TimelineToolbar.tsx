import { MousePointer2, Redo2, Scissors, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { memo } from 'react';

import styles from '../../_styles/timeline-controls.module.css';

export type TimelineTool = 'select' | 'blade';

type TimelineToolbarProps = {
  activeTimelineTool: TimelineTool;
  canRedo: boolean;
  canUndo: boolean;
  currentTimecode: string;
  maxPixelsPerSecond: number;
  minPixelsPerSecond: number;
  onRedo: () => void;
  onSelectTool: () => void;
  onToggleBladeTool: () => void;
  onUndo: () => void;
  onZoomChange: (pixelsPerSecond: number) => void;
  pixelsPerSecond: number;
  playheadSec: number;
};

const TIMELINE_ZOOM_STEP = 8;

export const TimelineToolbar = memo(function TimelineToolbar({
  activeTimelineTool,
  canRedo,
  canUndo,
  currentTimecode,
  maxPixelsPerSecond,
  minPixelsPerSecond,
  onRedo,
  onSelectTool,
  onToggleBladeTool,
  onUndo,
  onZoomChange,
  pixelsPerSecond,
  playheadSec,
}: TimelineToolbarProps) {
  return (
    <div className={styles.timelineTopbar} data-timeline-topbar="true">
      <div className={styles.timelineTimecodeCluster}>
        <time
          className={styles.timelineCurrentTimecode}
          dateTime={`PT${playheadSec}S`}
          data-timeline-current-timecode="true"
        >
          {currentTimecode}
        </time>
      </div>
      <div className={styles.timelineZoomSlot}>
        <div className={styles.timelineTransport} data-timeline-transport="true">
          <button
            type="button"
            data-tooltip="Undo (Cmd/Ctrl + Z)"
            title="Undo timeline edit (Cmd/Ctrl + Z)"
            aria-label="Undo timeline edit"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            data-tooltip="Redo (Cmd/Ctrl + Shift + Z)"
            title="Redo timeline edit (Cmd/Ctrl + Shift + Z)"
            aria-label="Redo timeline edit"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 size={15} />
          </button>
          <div className={styles.timelineToolGroup} role="toolbar" aria-label="Timeline editing tools">
            <button
              type="button"
              className={`${styles.timelineToolButton} ${activeTimelineTool === 'select' ? styles.timelineToolButtonActive : ''}`}
              data-timeline-tool="select"
              data-tooltip="Selection tool (V)"
              title="Selection tool. Drag clips, marquee empty space, and Shift/Cmd-click to toggle selection. (V)"
              onClick={onSelectTool}
              aria-label="Selection tool"
              aria-pressed={activeTimelineTool === 'select'}
            >
              <MousePointer2 size={15} />
            </button>
            <button
              type="button"
              className={`${styles.timelineToolButton} ${activeTimelineTool === 'blade' ? styles.timelineToolButtonActive : ''}`}
              data-timeline-tool="blade"
              data-tooltip="Blade / Cut tool (C)"
              title="Blade / Cut tool. Click a clip to split, or press S to split selected at the playhead. (C)"
              onClick={onToggleBladeTool}
              aria-label="Blade / Cut tool"
              aria-pressed={activeTimelineTool === 'blade'}
            >
              <Scissors size={15} />
            </button>
          </div>
        </div>
        <div className={styles.timelineZoomControl} aria-label="Timeline zoom">
          <button
            type="button"
            data-tooltip="Zoom out (Cmd/Ctrl + -)"
            title="Zoom out timeline (Cmd/Ctrl + -)"
            aria-label="Zoom out timeline"
            onClick={() => onZoomChange(pixelsPerSecond - TIMELINE_ZOOM_STEP)}
            disabled={pixelsPerSecond <= minPixelsPerSecond}
          >
            <ZoomOut size={13} />
          </button>
          <input
            type="range"
            min={minPixelsPerSecond}
            max={maxPixelsPerSecond}
            step={2}
            value={pixelsPerSecond}
            onChange={(event) => onZoomChange(Number(event.currentTarget.value))}
            aria-label="Timeline zoom level"
          />
          <button
            type="button"
            data-tooltip="Zoom in (Cmd/Ctrl + +)"
            title="Zoom in timeline (Cmd/Ctrl + +)"
            aria-label="Zoom in timeline"
            onClick={() => onZoomChange(pixelsPerSecond + TIMELINE_ZOOM_STEP)}
            disabled={pixelsPerSecond >= maxPixelsPerSecond}
          >
            <ZoomIn size={13} />
          </button>
        </div>
      </div>
    </div>
  );
});
