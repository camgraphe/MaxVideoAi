import { Eye, EyeOff, Lock, Plus, Unlock, Volume2, VolumeX } from 'lucide-react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';

import styles from '../../maxvideoai-editor.module.css';
import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../../_lib/workspace-types';

type TimelineTrackDefinition = {
  id: WorkspaceTimelineTrack;
  label: string;
  icon: ReactNode;
  kind: 'video' | 'audio';
};

type TimelineExternalDropPreview = {
  durationSec: number;
  isValid: boolean;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  startSec: number;
  title: string;
  trackId: WorkspaceTimelineTrack;
};

type TimelineTrackRowProps = {
  audioTrackCount: number;
  audioTrackId: WorkspaceTimelineAudioTrack | null;
  children: ReactNode;
  clampedPlayheadSec: number;
  externalDropPreview: TimelineExternalDropPreview | null;
  formatDropDuration: (seconds: number) => string;
  isAudioTrack: boolean;
  isHighestVideoTrack: boolean;
  isLowestAudioTrack: boolean;
  isTrackHidden: boolean;
  isTrackLocked: boolean;
  isTrackMuted: boolean;
  isVideoTrack: boolean;
  maxAudioTrackCount: number;
  maxVideoTrackCount: number;
  onAddAudioTrack: () => void;
  onAddVideoTrack: () => void;
  onBeginPlayheadDrag: (event: ReactPointerEvent<HTMLElement>, containerElement: HTMLElement | null) => void;
  onClearExternalDropPreview: () => void;
  onDropExternal: (event: ReactDragEvent<HTMLDivElement>, trackId: WorkspaceTimelineTrack) => void;
  onExternalDropOver: (event: ReactDragEvent<HTMLDivElement>, trackId: WorkspaceTimelineTrack) => void;
  onOpenTrackContextMenu: (event: MouseEvent<HTMLDivElement>, track: TimelineTrackDefinition) => void;
  onSurfaceClick: (event: MouseEvent<HTMLDivElement>) => void;
  onSurfacePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleAudioTrackMute: (trackId: WorkspaceTimelineAudioTrack) => void;
  onToggleTrackLock: (trackId: WorkspaceTimelineTrack) => void;
  onToggleVideoTrackVisibility: (trackId: WorkspaceTimelineVideoTrack) => void;
  pixelsPerSecond: number;
  snapGuideSec: number | null;
  timelineWidth: number;
  track: TimelineTrackDefinition;
  videoTrackCount: number;
  videoTrackId: WorkspaceTimelineVideoTrack | null;
};

export function TimelineTrackRow({
  audioTrackCount,
  audioTrackId,
  children,
  clampedPlayheadSec,
  externalDropPreview,
  formatDropDuration,
  isAudioTrack,
  isHighestVideoTrack,
  isLowestAudioTrack,
  isTrackHidden,
  isTrackLocked,
  isTrackMuted,
  isVideoTrack,
  maxAudioTrackCount,
  maxVideoTrackCount,
  onAddAudioTrack,
  onAddVideoTrack,
  onBeginPlayheadDrag,
  onClearExternalDropPreview,
  onDropExternal,
  onExternalDropOver,
  onOpenTrackContextMenu,
  onSurfaceClick,
  onSurfacePointerDown,
  onToggleAudioTrackMute,
  onToggleTrackLock,
  onToggleVideoTrackVisibility,
  pixelsPerSecond,
  snapGuideSec,
  timelineWidth,
  track,
  videoTrackCount,
  videoTrackId,
}: TimelineTrackRowProps) {
  const trackDropPreview = externalDropPreview?.trackId === track.id ? externalDropPreview : null;

  return (
    <div
      className={`${styles.timelineTrack} ${isTrackHidden ? styles.timelineTrackHidden : ''} ${isTrackMuted ? styles.timelineTrackMuted : ''} ${isTrackLocked ? styles.timelineTrackLocked : ''}`}
    >
      <div
        className={`${styles.trackLabel} ${isVideoTrack ? styles.trackLabelVideo : ''} ${isAudioTrack ? styles.trackLabelAudio : ''}`}
        data-timeline-track-label={track.id}
        data-timeline-track-hidden={isTrackHidden ? 'true' : 'false'}
        data-timeline-track-locked={isTrackLocked ? 'true' : 'false'}
        data-timeline-track-muted={isTrackMuted ? 'true' : 'false'}
        onContextMenu={(event) => onOpenTrackContextMenu(event, track)}
        title="Right-click for track actions"
      >
        <div className={styles.trackLabelMain}>
          {track.icon}
          <span>{track.label}</span>
        </div>
        <div className={`${styles.trackLabelControls} ${isAudioTrack ? styles.trackLabelControlsAudio : ''}`} data-timeline-control="true">
          {track.kind === 'video' && isHighestVideoTrack ? (
            <button
              type="button"
              className={styles.trackAddButton}
              data-timeline-add-track="video"
              disabled={videoTrackCount >= maxVideoTrackCount}
              onClick={(event) => {
                event.stopPropagation();
                onAddVideoTrack();
              }}
              title="Add video track"
              aria-label="Add video track"
            >
              <Plus size={12} />
            </button>
          ) : null}
          {isVideoTrack && videoTrackId !== null ? (
            <button
              type="button"
              className={`${styles.trackIconButton} ${isTrackHidden ? styles.trackIconButtonActive : ''} ${styles.trackVisibilityButton}`}
              data-timeline-video-visibility={videoTrackId}
              onClick={(event) => {
                event.stopPropagation();
                onToggleVideoTrackVisibility(videoTrackId);
              }}
              title={isTrackHidden ? `Show ${track.label} track` : `Hide ${track.label} track`}
              aria-label={isTrackHidden ? `Show ${track.label} track` : `Hide ${track.label} track`}
              aria-pressed={isTrackHidden}
            >
              {isTrackHidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          ) : null}
          {isAudioTrack && audioTrackId !== null ? (
            <button
              type="button"
              className={`${styles.trackIconButton} ${isTrackMuted ? styles.trackIconButtonActive : ''} ${styles.trackMuteButton}`}
              data-timeline-audio-mute={audioTrackId}
              onClick={(event) => {
                event.stopPropagation();
                onToggleAudioTrackMute(audioTrackId);
              }}
              title={isTrackMuted ? `Unmute ${track.label} track` : `Mute ${track.label} track`}
              aria-label={isTrackMuted ? `Unmute ${track.label} track` : `Mute ${track.label} track`}
              aria-pressed={isTrackMuted}
            >
              {isTrackMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          ) : null}
          <button
            type="button"
            className={`${styles.trackIconButton} ${isTrackLocked ? styles.trackIconButtonActive : ''} ${styles.trackLockButton}`}
            data-timeline-track-lock={track.id}
            onClick={(event) => {
              event.stopPropagation();
              onToggleTrackLock(track.id);
            }}
            title={isTrackLocked ? `Unlock ${track.label} track` : `Lock ${track.label} track`}
            aria-label={isTrackLocked ? `Unlock ${track.label} track` : `Lock ${track.label} track`}
            aria-pressed={isTrackLocked}
          >
            {isTrackLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
          {track.kind === 'audio' && isLowestAudioTrack ? (
            <button
              type="button"
              className={`${styles.trackAddButton} ${styles.trackAudioAddButton}`}
              data-timeline-add-track="audio"
              disabled={audioTrackCount >= maxAudioTrackCount}
              onClick={(event) => {
                event.stopPropagation();
                onAddAudioTrack();
              }}
              title="Add audio track"
              aria-label="Add audio track"
            >
              <Plus size={12} />
            </button>
          ) : null}
        </div>
      </div>
      <div className={styles.trackLane}>
        <div
          className={styles.trackLaneContent}
          style={{ width: timelineWidth }}
          data-timeline-track={track.id}
          onDragLeave={onClearExternalDropPreview}
          onDragOver={(event) => onExternalDropOver(event, track.id)}
          onDrop={(event) => onDropExternal(event, track.id)}
          onClick={onSurfaceClick}
          onPointerDown={onSurfacePointerDown}
          title="Click empty timeline space to move the playhead, or drag to select clips"
        >
          <button
            type="button"
            className={styles.timelinePlayhead}
            style={{ left: clampedPlayheadSec * pixelsPerSecond }}
            onPointerDown={(event) => onBeginPlayheadDrag(event, event.currentTarget.parentElement)}
            data-playhead-handle="true"
            data-timeline-control="true"
            title="Drag timeline playhead"
            aria-label={`Drag timeline playhead on ${track.label} track`}
          />
          {snapGuideSec !== null ? (
            <span
              className={styles.timelineSnapGuide}
              style={{ left: snapGuideSec * pixelsPerSecond }}
              aria-hidden="true"
            />
          ) : null}
          {trackDropPreview ? (
            <>
              <span
                className={`${styles.timelineExternalDropGuide} ${trackDropPreview.isValid ? '' : styles.timelineExternalDropInvalid}`}
                style={{ left: trackDropPreview.startSec * pixelsPerSecond }}
                aria-hidden="true"
              />
              <span
                className={[
                  styles.timelineExternalDropGhost,
                  trackDropPreview.mediaKind === 'audio' ? styles.timelineExternalDropGhostAudio : '',
                  trackDropPreview.mediaKind === 'image' ? styles.timelineExternalDropGhostImage : '',
                  trackDropPreview.previewUrl && trackDropPreview.mediaKind !== 'audio' ? styles.timelineExternalDropGhostWithPreview : '',
                  trackDropPreview.isValid ? '' : styles.timelineExternalDropInvalid,
                ].filter(Boolean).join(' ')}
                data-timeline-external-drop-ghost="true"
                data-timeline-external-drop-duration={trackDropPreview.durationSec}
                data-timeline-external-drop-kind={trackDropPreview.mediaKind}
                style={{
                  left: trackDropPreview.startSec * pixelsPerSecond,
                  width: Math.max(36, trackDropPreview.durationSec * pixelsPerSecond),
                }}
                aria-hidden="true"
              >
                {trackDropPreview.previewUrl && trackDropPreview.mediaKind !== 'audio' ? (
                  <span
                    className={styles.timelineExternalDropGhostThumb}
                    style={{ backgroundImage: `url(${trackDropPreview.previewUrl})` }}
                  />
                ) : null}
                <span className={styles.timelineExternalDropGhostTitle}>
                  {trackDropPreview.isValid ? trackDropPreview.title : 'Invalid drop'}
                </span>
                <span className={styles.timelineExternalDropGhostDuration}>
                  {formatDropDuration(trackDropPreview.durationSec)}
                </span>
              </span>
            </>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
