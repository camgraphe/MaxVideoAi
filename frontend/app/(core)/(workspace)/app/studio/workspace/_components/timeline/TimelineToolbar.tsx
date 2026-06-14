import { Download, MousePointer2, Redo2, Scissors, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { memo } from 'react';

import styles from '../../_styles/timeline-controls.module.css';
import type { StudioCopy } from '../../../_lib/studio-copy';

export type TimelineTool = 'select' | 'blade';

type TimelineToolbarProps = {
  copy: StudioCopy['timeline']['tools'];
  activeTimelineTool: TimelineTool;
  canRedo: boolean;
  canUndo: boolean;
  currentTimecode: string;
  maxPixelsPerSecond: number;
  minPixelsPerSecond: number;
  onRedo: () => void;
  onOpenExportDialog: () => void;
  onSelectTool: () => void;
  onToggleBladeTool: () => void;
  onUndo: () => void;
  onZoomChange: (pixelsPerSecond: number) => void;
  pixelsPerSecond: number;
  playheadSec: number;
};

const TIMELINE_ZOOM_STEP = 8;

export const TimelineToolbar = memo(function TimelineToolbar({
  copy,
  activeTimelineTool,
  canRedo,
  canUndo,
  currentTimecode,
  maxPixelsPerSecond,
  minPixelsPerSecond,
  onRedo,
  onOpenExportDialog,
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
            data-tooltip={copy.undoTooltip}
            title={copy.undoTitle}
            aria-label={copy.undo}
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            data-tooltip={copy.redoTooltip}
            title={copy.redoTitle}
            aria-label={copy.redo}
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 size={15} />
          </button>
          <div className={styles.timelineToolGroup} role="toolbar" aria-label={copy.editingTools}>
            <button
              type="button"
              className={`${styles.timelineToolButton} ${activeTimelineTool === 'select' ? styles.timelineToolButtonActive : ''}`}
              data-timeline-tool="select"
              data-tooltip={copy.selectionTooltip}
              title={copy.selectionTitle}
              onClick={onSelectTool}
              aria-label={copy.selection}
              aria-pressed={activeTimelineTool === 'select'}
            >
              <MousePointer2 size={15} />
            </button>
            <button
              type="button"
              className={`${styles.timelineToolButton} ${activeTimelineTool === 'blade' ? styles.timelineToolButtonActive : ''}`}
              data-timeline-tool="blade"
              data-tooltip={copy.bladeTooltip}
              title={copy.bladeTitle}
              onClick={onToggleBladeTool}
              aria-label={copy.blade}
              aria-pressed={activeTimelineTool === 'blade'}
            >
              <Scissors size={15} />
            </button>
          </div>
        </div>
        <div className={styles.timelineZoomControl} aria-label={copy.zoom}>
          <button
            type="button"
            data-tooltip={copy.zoomOutTooltip}
            title={copy.zoomOutTitle}
            aria-label={copy.zoomOut}
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
            aria-label={copy.zoomLevel}
          />
          <button
            type="button"
            data-tooltip={copy.zoomInTooltip}
            title={copy.zoomInTitle}
            aria-label={copy.zoomIn}
            onClick={() => onZoomChange(pixelsPerSecond + TIMELINE_ZOOM_STEP)}
            disabled={pixelsPerSecond >= maxPixelsPerSecond}
          >
            <ZoomIn size={13} />
          </button>
        </div>
        <button
          type="button"
          className={styles.timelineExportButton}
          data-tooltip={copy.export}
          title={copy.export}
          aria-label={copy.exportAria}
          onClick={onOpenExportDialog}
        >
          <Download size={14} />
          <span>{copy.export}</span>
        </button>
      </div>
    </div>
  );
});
