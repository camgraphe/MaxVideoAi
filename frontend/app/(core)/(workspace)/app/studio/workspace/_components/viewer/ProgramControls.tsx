'use client';

import { Camera, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import styles from '../../maxvideoai-editor.module.css';

type ProgramControlsProps = {
  canGoToNextCut: boolean;
  canGoToPreviousCut: boolean;
  hasInOutMarks: boolean;
  hasVisiblePlayableLayer: boolean;
  inTimecode: string;
  isPlaying: boolean;
  outTimecode: string;
  playheadSec: number;
  playheadTimecode: string;
  timelineDurationSec: number;
  timelineDurationTimecode: string;
  onClearInOut: () => void;
  onGoToNextCut: () => void;
  onGoToPreviousCut: () => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onSendSnapshotToCanvas: () => void;
  onTogglePlayback: () => void;
};

export function ProgramControls({
  canGoToNextCut,
  canGoToPreviousCut,
  hasInOutMarks,
  hasVisiblePlayableLayer,
  inTimecode,
  isPlaying,
  outTimecode,
  playheadSec,
  playheadTimecode,
  timelineDurationSec,
  timelineDurationTimecode,
  onClearInOut,
  onGoToNextCut,
  onGoToPreviousCut,
  onMarkIn,
  onMarkOut,
  onSendSnapshotToCanvas,
  onTogglePlayback,
}: ProgramControlsProps) {
  return (
    <div className={styles.viewerProgramControlsPanel}>
      <div className={styles.viewerScrubRow} aria-label="Program scrub preview">
        <span>{playheadTimecode}</span>
        <div className={styles.viewerScrubTrack} aria-hidden="true">
          <span style={{ width: `${timelineDurationSec > 0 ? Math.min(100, Math.max(0, (playheadSec / timelineDurationSec) * 100)) : 0}%` }} />
        </div>
        <span>{timelineDurationTimecode}</span>
      </div>
      <div className={styles.viewerPlaybackControls} data-viewer-playback-controls="true">
        <button
          type="button"
          onClick={onGoToPreviousCut}
          disabled={!canGoToPreviousCut}
          title="Go to previous edit cut"
          aria-label="Previous cut"
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className={styles.viewerPlaybackPrimary}
          onClick={onTogglePlayback}
          title={isPlaying ? 'Pause montage (Space)' : 'Play montage (Space)'}
          aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          type="button"
          onClick={onGoToNextCut}
          disabled={!canGoToNextCut}
          title="Go to next edit cut"
          aria-label="Next cut"
        >
          <SkipForward size={16} />
        </button>
        <span className={styles.viewerPlaybackDivider} aria-hidden="true" />
        <button
          type="button"
          className={styles.viewerMarkButton}
          onClick={onMarkIn}
          title="Mark In (I)"
          aria-label="Mark In"
        >
          I
        </button>
        <button
          type="button"
          className={styles.viewerMarkButton}
          onClick={onMarkOut}
          title="Mark Out (O)"
          aria-label="Mark Out"
        >
          O
        </button>
        <span className={styles.viewerInOutSummary} data-viewer-in-out-summary="true">
          <span className={styles.viewerMarkField}>In {inTimecode}</span>
          <span className={styles.viewerMarkField}>Out {outTimecode}</span>
        </span>
        <button
          type="button"
          className={styles.viewerSnapshotButton}
          onClick={onSendSnapshotToCanvas}
          disabled={!hasVisiblePlayableLayer}
          title="Send current frame snapshot to canvas"
          aria-label="Send snapshot to canvas"
        >
          <Camera size={16} />
          Snapshot
        </button>
        <button
          type="button"
          className={styles.viewerMarkClearButton}
          onClick={onClearInOut}
          disabled={!hasInOutMarks}
          title="Clear In and Out marks"
          aria-label="Clear In and Out"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
