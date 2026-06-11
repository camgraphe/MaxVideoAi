import type {
  DragEvent as ReactDragEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { memo, useMemo } from 'react';

import styles from '../../_styles/timeline.module.css';
import type {
  WorkspaceTimelineAudioTrack,
  WorkspaceTimelineItem,
  WorkspaceTimelineTrack,
  WorkspaceTimelineVideoTrack,
} from '../../_lib/workspace-types';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
} from '../../_lib/workspace-timeline-tracks';
import type {
  TimelineClipLayout,
  TimelineInteractionKind,
} from '../../_lib/timeline/timeline-interaction';
import {
  TimelineClip,
  type TimelineSelectionMode,
} from './TimelineClip';
import { TimelineTrackRow } from './TimelineTrackRow';
import type { TimelineTrackDefinition } from './timelineTrackDefinitions';
import type { TimelineTool } from './TimelineToolbar';

export type TimelinePreviewTrackItem = {
  item: WorkspaceTimelineItem;
  layout: TimelineClipLayout;
  trackId: WorkspaceTimelineTrack;
};

type TimelineExternalDropPreview = {
  displacedItems: Array<{
    durationSec: number;
    fromStartSec: number;
    itemId: string;
    mediaKind?: WorkspaceTimelineItem['mediaKind'];
    title: string;
    toStartSec: number;
    trackId: WorkspaceTimelineTrack;
  }>;
  durationSec: number;
  isValid: boolean;
  mediaKind: 'audio' | 'image' | 'video';
  previewUrl?: string | null;
  startSec: number;
  title: string;
  trackId: WorkspaceTimelineTrack;
};

type TimelineRenderedTrackItem = TimelinePreviewTrackItem & {
  trackIndex: number;
  trackTotal: number;
};

type TimelineTrackListProps = {
  activeTool: TimelineTool;
  audioTrackCount: number;
  clampedPlayheadSec: number;
  externalDropPreview: TimelineExternalDropPreview | null;
  formatDropDuration: (seconds: number) => string;
  hiddenVideoTrackSet: ReadonlySet<WorkspaceTimelineVideoTrack>;
  highestVideoTrackId: WorkspaceTimelineTrack;
  isItemInteracting: (item: WorkspaceTimelineItem) => boolean;
  lockedTrackSet: ReadonlySet<WorkspaceTimelineTrack>;
  lowestAudioTrackId: WorkspaceTimelineTrack;
  maxAudioTrackCount: number;
  maxVideoTrackCount: number;
  mutedAudioTrackSet: ReadonlySet<WorkspaceTimelineAudioTrack>;
  onAddAudioTrack: () => void;
  onAddVideoTrack: () => void;
  onBeginClipInteraction: (event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => void;
  onBeginPlayheadDrag: (event: ReactPointerEvent<HTMLElement>, containerElement: HTMLElement | null) => void;
  onClearExternalDropPreview: () => void;
  onCutItem: (itemId: string, splitOffsetSec?: number) => void;
  onDropExternal: (event: ReactDragEvent<HTMLDivElement>, trackId: WorkspaceTimelineTrack) => void;
  onExternalDropOver: (event: ReactDragEvent<HTMLDivElement>, trackId: WorkspaceTimelineTrack) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onOpenClipContextMenu: (event: MouseEvent<HTMLDivElement>, item: WorkspaceTimelineItem) => void;
  onOpenTrackContextMenu: (event: MouseEvent<HTMLDivElement>, track: TimelineTrackDefinition) => void;
  onPlayheadChange: (seconds: number) => void;
  onSelectItem: (itemId: string, mode?: TimelineSelectionMode) => void;
  onSurfaceClick: (event: MouseEvent<HTMLDivElement>) => void;
  onSurfacePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onToggleAudioTrackMute: (trackId: WorkspaceTimelineAudioTrack) => void;
  onToggleTrackLock: (trackId: WorkspaceTimelineTrack) => void;
  onToggleVideoTrackVisibility: (trackId: WorkspaceTimelineVideoTrack) => void;
  pixelsPerSecond: number;
  previewItems: TimelinePreviewTrackItem[];
  selectedKeys: ReadonlySet<string>;
  selectionKeyForItem: (item: WorkspaceTimelineItem) => string;
  snapGuideSec: number | null;
  snapStepSec: number;
  timelineWidth: number;
  tracks: TimelineTrackDefinition[];
  visibleEndSec: number;
  visibleStartSec: number;
  videoTrackCount: number;
};

function timelineRangesIntersect(startSec: number, durationSec: number, visibleStartSec: number, visibleEndSec: number): boolean {
  const endSec = startSec + durationSec;
  return endSec >= visibleStartSec && startSec <= visibleEndSec;
}

export const TimelineTrackList = memo(function TimelineTrackList({
  activeTool,
  audioTrackCount,
  clampedPlayheadSec,
  externalDropPreview,
  formatDropDuration,
  hiddenVideoTrackSet,
  highestVideoTrackId,
  isItemInteracting,
  lockedTrackSet,
  lowestAudioTrackId,
  maxAudioTrackCount,
  maxVideoTrackCount,
  mutedAudioTrackSet,
  onAddAudioTrack,
  onAddVideoTrack,
  onBeginClipInteraction,
  onBeginPlayheadDrag,
  onClearExternalDropPreview,
  onCutItem,
  onDropExternal,
  onExternalDropOver,
  onMoveItem,
  onOpenClipContextMenu,
  onOpenTrackContextMenu,
  onPlayheadChange,
  onSelectItem,
  onSurfaceClick,
  onSurfacePointerDown,
  onToggleAudioTrackMute,
  onToggleTrackLock,
  onToggleVideoTrackVisibility,
  pixelsPerSecond,
  previewItems,
  selectedKeys,
  selectionKeyForItem,
  snapGuideSec,
  snapStepSec,
  timelineWidth,
  tracks,
  visibleEndSec,
  visibleStartSec,
  videoTrackCount,
}: TimelineTrackListProps) {
  const visibleItemsByTrack = useMemo(() => {
    const allItemsByTrack = new Map<WorkspaceTimelineTrack, TimelinePreviewTrackItem[]>();
    const nextItemsByTrack = new Map<WorkspaceTimelineTrack, TimelineRenderedTrackItem[]>();

    previewItems.forEach((previewItem) => {
      const trackItems = allItemsByTrack.get(previewItem.trackId);
      if (trackItems) {
        trackItems.push(previewItem);
      } else {
        allItemsByTrack.set(previewItem.trackId, [previewItem]);
      }
    });

    allItemsByTrack.forEach((trackItems, trackId) => {
      trackItems.sort((left, right) => left.layout.startSec - right.layout.startSec);
      const trackTotal = trackItems.length;
      const visibleTrackItems = trackItems
        .map((trackItem, trackIndex) => ({ ...trackItem, trackIndex, trackTotal }))
        .filter((trackItem) => timelineRangesIntersect(
          trackItem.layout.startSec,
          trackItem.layout.durationSec,
          visibleStartSec,
          visibleEndSec
        ));

      if (visibleTrackItems.length) {
        nextItemsByTrack.set(trackId, visibleTrackItems);
      }
    });

    return nextItemsByTrack;
  }, [previewItems, visibleEndSec, visibleStartSec]);

  return (
    <div className={styles.timelineTracks}>
      {tracks.map((track) => {
        const audioTrackId = isWorkspaceTimelineAudioTrack(track.id) ? track.id : null;
        const videoTrackId = isWorkspaceTimelineVideoTrack(track.id) ? track.id : null;
        const isAudioTrack = track.kind === 'audio' && audioTrackId !== null;
        const isVideoTrack = track.kind === 'video' && videoTrackId !== null;
        const isTrackMuted = audioTrackId !== null && mutedAudioTrackSet.has(audioTrackId);
        const isTrackHidden = videoTrackId !== null && hiddenVideoTrackSet.has(videoTrackId);
        const isTrackLocked = lockedTrackSet.has(track.id);
        const trackItems = visibleItemsByTrack.get(track.id) ?? [];

        return (
          <TimelineTrackRow
            key={track.id}
            audioTrackCount={audioTrackCount}
            audioTrackId={audioTrackId}
            clampedPlayheadSec={clampedPlayheadSec}
            externalDropPreview={externalDropPreview}
            formatDropDuration={formatDropDuration}
            isAudioTrack={isAudioTrack}
            isHighestVideoTrack={track.id === highestVideoTrackId}
            isLowestAudioTrack={track.id === lowestAudioTrackId}
            isTrackHidden={isTrackHidden}
            isTrackLocked={isTrackLocked}
            isTrackMuted={isTrackMuted}
            isVideoTrack={isVideoTrack}
            maxAudioTrackCount={maxAudioTrackCount}
            maxVideoTrackCount={maxVideoTrackCount}
            onAddAudioTrack={onAddAudioTrack}
            onAddVideoTrack={onAddVideoTrack}
            onBeginPlayheadDrag={onBeginPlayheadDrag}
            onClearExternalDropPreview={onClearExternalDropPreview}
            onDropExternal={onDropExternal}
            onExternalDropOver={onExternalDropOver}
            onOpenTrackContextMenu={onOpenTrackContextMenu}
            onSurfaceClick={onSurfaceClick}
            onSurfacePointerDown={onSurfacePointerDown}
            onToggleAudioTrackMute={onToggleAudioTrackMute}
            onToggleTrackLock={onToggleTrackLock}
            onToggleVideoTrackVisibility={onToggleVideoTrackVisibility}
            pixelsPerSecond={pixelsPerSecond}
            snapGuideSec={snapGuideSec}
            timelineWidth={timelineWidth}
            track={track}
            videoTrackCount={videoTrackCount}
            videoTrackId={videoTrackId}
          >
            {trackItems.length ? (
              trackItems.map(({ item, layout, trackIndex, trackTotal }) => (
                <TimelineClip
                  key={item.id}
                  item={item}
                  layout={layout}
                  index={trackIndex}
                  isInteracting={isItemInteracting(item)}
                  isLocked={lockedTrackSet.has(item.track)}
                  isSelected={selectedKeys.has(selectionKeyForItem(item))}
                  activeTool={activeTool}
                  total={trackTotal}
                  timelineWidth={timelineWidth}
                  pixelsPerSecond={pixelsPerSecond}
                  snapStepSec={snapStepSec}
                  onBeginInteraction={onBeginClipInteraction}
                  onCut={onCutItem}
                  onMove={onMoveItem}
                  onOpenContextMenu={onOpenClipContextMenu}
                  onPlayheadChange={onPlayheadChange}
                  onSelect={onSelectItem}
                />
              ))
            ) : (
              <span className={styles.trackEmpty}>Drop generated outputs here</span>
            )}
          </TimelineTrackRow>
        );
      })}
    </div>
  );
});
