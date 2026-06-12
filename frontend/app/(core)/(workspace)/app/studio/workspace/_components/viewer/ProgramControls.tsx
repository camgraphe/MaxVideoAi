'use client';

import { Camera, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import styles from '../../_styles/viewer.module.css';
import type { StudioCopy } from '../../../_lib/studio-copy';

type ProgramControlsProps = {
  copy: StudioCopy['viewer']['controls'];
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
  copy,
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
      <div className={styles.viewerScrubRow} aria-label={copy.scrubPreview}>
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
          title={copy.previousCutTitle}
          aria-label={copy.previousCut}
        >
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className={styles.viewerPlaybackPrimary}
          onClick={onTogglePlayback}
          title={isPlaying ? copy.pauseTitle : copy.playTitle}
          aria-label={isPlaying ? copy.pauseTimeline : copy.playTimeline}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          type="button"
          onClick={onGoToNextCut}
          disabled={!canGoToNextCut}
          title={copy.nextCutTitle}
          aria-label={copy.nextCut}
        >
          <SkipForward size={16} />
        </button>
        <span className={styles.viewerPlaybackDivider} aria-hidden="true" />
        <button
          type="button"
          className={styles.viewerMarkButton}
          onClick={onMarkIn}
          title={copy.markInTitle}
          aria-label={copy.markIn}
        >
          I
        </button>
        <button
          type="button"
          className={styles.viewerMarkButton}
          onClick={onMarkOut}
          title={copy.markOutTitle}
          aria-label={copy.markOut}
        >
          O
        </button>
        <span className={styles.viewerInOutSummary} data-viewer-in-out-summary="true">
          <span className={styles.viewerMarkField}>{copy.in} {inTimecode}</span>
          <span className={styles.viewerMarkField}>{copy.out} {outTimecode}</span>
        </span>
        <button
          type="button"
          className={styles.viewerSnapshotButton}
          onClick={onSendSnapshotToCanvas}
          disabled={!hasVisiblePlayableLayer}
          title={copy.snapshotTitle}
          aria-label={copy.snapshotAria}
        >
          <Camera size={16} />
          {copy.snapshot}
        </button>
        <button
          type="button"
          className={styles.viewerMarkClearButton}
          onClick={onClearInOut}
          disabled={!hasInOutMarks}
          title={copy.clearTitle}
          aria-label={copy.clearAria}
        >
          {copy.clear}
        </button>
      </div>
    </div>
  );
}
