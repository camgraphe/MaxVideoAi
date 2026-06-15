import { Eye, EyeOff, Lock, Plus, Unlock, Volume2, VolumeX } from 'lucide-react';
import type {
  DragEvent as ReactDragEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { memo } from 'react';

import styles from '../../_styles/timeline.module.css';
import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../../_lib/workspace-types';
import type { TimelineExternalDropPreview } from '../../_lib/timeline/timeline-external-drop';
import type { WorkspaceTimelineGapSelection } from '../../_lib/timeline/timeline-gap-editing';
import type { StudioCopy } from '../../../_lib/studio-copy';

type TimelineTrackDefinition = {
  id: WorkspaceTimelineTrack;
  label: string;
  icon: ReactNode;
  kind: 'video' | 'audio';
};

type TimelineTrackRowProps = {
  audioTrackCount: number;
  audioTrackId: WorkspaceTimelineAudioTrack | null;
  children: ReactNode;
  clampedPlayheadSec: number;
  copy: StudioCopy['timeline']['tracks'];
  externalDropPreview: TimelineExternalDropPreview | null;
  formatDropDuration: (seconds: number) => string;
  isAudioTrack: boolean;
  isHighestVideoTrack: boolean;
  isLowestAudioTrack: boolean;
  isPlayheadVisibleInViewport: boolean;
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
  selectedGap: WorkspaceTimelineGapSelection | null;
  snapGuideSec: number | null;
  timelineWidth: number;
  track: TimelineTrackDefinition;
  videoTrackCount: number;
  videoTrackId: WorkspaceTimelineVideoTrack | null;
};

export const TimelineTrackRow = memo(function TimelineTrackRow({
  audioTrackCount,
  audioTrackId,
  children,
  clampedPlayheadSec,
  copy,
  externalDropPreview,
  formatDropDuration,
  isAudioTrack,
  isHighestVideoTrack,
  isLowestAudioTrack,
  isPlayheadVisibleInViewport,
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
  selectedGap,
  snapGuideSec,
  timelineWidth,
  track,
  videoTrackCount,
  videoTrackId,
}: TimelineTrackRowProps) {
  const trackDropGhosts = externalDropPreview?.ghostItems.filter((item) => item.trackId === track.id) ?? [];
  const primaryTrackDropGhost = trackDropGhosts.find((item) => item.isPrimary) ?? null;
  const displacedItems = externalDropPreview?.isValid
    ? externalDropPreview.displacedItems.filter((item) => item.trackId === track.id)
    : [];

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
        title={copy.rightClickActions}
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
              title={copy.addVideoTrack}
              aria-label={copy.addVideoTrack}
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
              title={(isTrackHidden ? copy.showTrack : copy.hideTrack).replace('{track}', track.label)}
              aria-label={(isTrackHidden ? copy.showTrack : copy.hideTrack).replace('{track}', track.label)}
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
              title={(isTrackMuted ? copy.unmuteTrack : copy.muteTrack).replace('{track}', track.label)}
              aria-label={(isTrackMuted ? copy.unmuteTrack : copy.muteTrack).replace('{track}', track.label)}
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
            title={(isTrackLocked ? copy.unlockTrack : copy.lockTrack).replace('{track}', track.label)}
            aria-label={(isTrackLocked ? copy.unlockTrack : copy.lockTrack).replace('{track}', track.label)}
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
              title={copy.addAudioTrack}
              aria-label={copy.addAudioTrack}
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
          onDragEnter={(event) => onExternalDropOver(event, track.id)}
          onDragLeave={onClearExternalDropPreview}
          onDragOver={(event) => onExternalDropOver(event, track.id)}
          onDrop={(event) => onDropExternal(event, track.id)}
          onClick={onSurfaceClick}
          onPointerDown={onSurfacePointerDown}
          title={copy.emptyLaneTitle}
        >
          {selectedGap?.track === track.id ? (
            <span
              data-timeline-gap-selection="true"
              data-timeline-gap-start={selectedGap.startSec}
              data-timeline-gap-end={selectedGap.endSec}
              style={{
                position: 'absolute',
                top: 4,
                bottom: 4,
                zIndex: 1,
                left: selectedGap.startSec * pixelsPerSecond,
                width: Math.max(2, (selectedGap.endSec - selectedGap.startSec) * pixelsPerSecond),
                border: '1px dashed rgba(124, 58, 237, 0.74)',
                borderRadius: 6,
                background: 'rgba(124, 58, 237, 0.1)',
                pointerEvents: 'none',
              }}
              aria-hidden="true"
            />
          ) : null}
          {isPlayheadVisibleInViewport ? (
            <button
              type="button"
              className={styles.timelinePlayhead}
              style={{ left: clampedPlayheadSec * pixelsPerSecond }}
              onPointerDown={(event) => onBeginPlayheadDrag(event, event.currentTarget.parentElement)}
              data-playhead-handle="true"
              data-timeline-control="true"
              title={copy.dragPlayheadOnTrack.replace('{track}', track.label)}
              aria-label={copy.dragPlayheadOnTrack.replace('{track}', track.label)}
            />
          ) : null}
          {snapGuideSec !== null ? (
            <span
              className={styles.timelineSnapGuide}
              style={{ left: snapGuideSec * pixelsPerSecond }}
              aria-hidden="true"
            />
          ) : null}
          {primaryTrackDropGhost && externalDropPreview ? (
            <>
              <span
                className={`${styles.timelineExternalDropGuide} ${externalDropPreview.isValid ? '' : styles.timelineExternalDropInvalid}`}
                style={{ left: primaryTrackDropGhost.startSec * pixelsPerSecond }}
                aria-hidden="true"
              />
            </>
          ) : null}
          {externalDropPreview ? trackDropGhosts.map((ghost) => (
            <span
              key={`${ghost.trackId}-${ghost.mediaKind}-${ghost.isPrimary ? 'primary' : 'linked'}`}
              className={[
                styles.timelineExternalDropGhost,
                ghost.mediaKind === 'audio' ? styles.timelineExternalDropGhostAudio : '',
                ghost.mediaKind === 'image' ? styles.timelineExternalDropGhostImage : '',
                ghost.previewUrl && ghost.mediaKind !== 'audio' ? styles.timelineExternalDropGhostWithPreview : '',
                externalDropPreview.isValid ? '' : styles.timelineExternalDropInvalid,
              ].filter(Boolean).join(' ')}
              data-timeline-external-drop-ghost="true"
              data-timeline-external-drop-linked-audio-ghost={!ghost.isPrimary && ghost.mediaKind === 'audio' ? 'true' : 'false'}
              data-timeline-external-drop-duration={ghost.durationSec}
              data-timeline-external-drop-kind={ghost.mediaKind}
              style={{
                left: ghost.startSec * pixelsPerSecond,
                width: Math.max(36, ghost.durationSec * pixelsPerSecond),
              }}
              aria-hidden="true"
            >
              {ghost.previewUrl && ghost.mediaKind !== 'audio' ? (
                <span
                  className={styles.timelineExternalDropGhostThumb}
                  style={{ backgroundImage: `url(${ghost.previewUrl})` }}
                />
              ) : null}
              <span className={styles.timelineExternalDropGhostTitle}>
                {externalDropPreview.isValid ? ghost.title : copy.invalidDrop}
              </span>
              <span className={styles.timelineExternalDropGhostDuration}>
                {formatDropDuration(ghost.durationSec)}
              </span>
            </span>
          )) : null}
          {displacedItems.map((item) => (
            <span
              key={item.itemId}
              className={[
                styles.timelineExternalDisplacementGhost,
                item.mediaKind === 'audio' ? styles.timelineExternalDisplacementGhostAudio : '',
              ].filter(Boolean).join(' ')}
              data-timeline-external-displacement-ghost="true"
              data-timeline-displacement-item={item.itemId}
              data-timeline-displacement-from={item.fromStartSec}
              data-timeline-displacement-start={item.toStartSec}
              style={{
                left: item.toStartSec * pixelsPerSecond,
                width: Math.max(30, item.durationSec * pixelsPerSecond),
              }}
              aria-hidden="true"
            >
              {item.title}
            </span>
          ))}
          {children}
        </div>
      </div>
    </div>
  );
});
