'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
} from 'react';
import styles from '../_styles/timeline.module.css';
import type { WorkspaceTimelineAudioTrack, WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from '../_lib/workspace-types';
import {
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from '../_lib/workspace-timeline-editing';
import {
  frameStepSeconds,
  layoutForTimelineItem,
  MIN_CLIP_DURATION_SEC,
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
  snapTimelineSeconds,
  timelineRulerStepFor,
} from '../_lib/timeline/timeline-interaction';
import { buildTimelineTracks } from './timeline/timelineTrackDefinitions';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import type {
  TimelineSelectionMode,
} from './timeline/TimelineClip';
import { TimelineContextMenus } from './timeline/TimelineContextMenus';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineTrackList } from './timeline/TimelineTrackList';
import { TimelineToolbar, type TimelineTool } from './timeline/TimelineToolbar';
import { useTimelineClipInteraction } from './timeline/useTimelineClipInteraction';
import { useTimelineContextMenus } from './timeline/useTimelineContextMenus';
import { useTimelineExternalDrop } from './timeline/useTimelineExternalDrop';
import { useTimelineKeyboardShortcuts } from './timeline/useTimelineKeyboardShortcuts';
import { useTimelinePanelResize } from './timeline/useTimelinePanelResize';
import { useTimelinePlayheadDrag } from './timeline/useTimelinePlayheadDrag';
import { useTimelinePreviewItems } from './timeline/useTimelinePreviewItems';
import { useTimelineSurfaceSelection } from './timeline/useTimelineSurfaceSelection';
import { useTimelineVisibleRange } from './timeline/useTimelineVisibleRange';
import type { StudioCopy } from '../../_lib/studio-copy';

const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 34;
const MIN_TIMELINE_PIXELS_PER_SECOND = 18;
const MAX_TIMELINE_PIXELS_PER_SECOND = 92;
const MIN_TIMELINE_WIDTH = 760;

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

type WorkspaceTimelineProps = {
  copy: StudioCopy['timeline'];
  canRedo: boolean;
  canUndo: boolean;
  isShortcutActive: boolean;
  audioTrackCount: number;
  items: WorkspaceTimelineItem[];
  hiddenVideoTracks: WorkspaceTimelineVideoTrack[];
  isInsertIntoClipEnabled: boolean;
  inPointSec: number | null;
  lockedTracks: WorkspaceTimelineTrack[];
  mutedAudioTracks: WorkspaceTimelineAudioTrack[];
  maxAudioTrackCount: number;
  maxPanelHeight: number;
  maxVideoTrackCount: number;
  minAudioTrackCount: number;
  minPanelHeight: number;
  panelHeight: number | null;
  selectedItemId: string | null;
  selectedItemIds: string[];
  outPointSec: number | null;
  videoTrackCount: number;
  playheadSec: number;
  projectFps: number;
  onAddAudioTrack: () => void;
  onAddVideoTrack: () => void;
  onCutItem: (itemId: string, splitOffsetSec?: number) => void;
  onDeleteItem: (ripple?: boolean) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onInvalidNodeDropToTimeline: (reason: 'incompatible' | 'locked-track' | 'occupied-clip') => void;
  onGoToCut: (direction: -1 | 1) => void;
  onMarkIn: () => void;
  onMarkOut: () => void;
  onNodeDropToTimeline: (nodeId: string, startSec: number, track: WorkspaceTimelineTrack) => void;
  onPanelHeightChange: (height: number) => void;
  onPlaybackChange: (isPlaying: boolean) => void;
  onPlayheadChange: (seconds: number) => void;
  onProjectAssetDropToTimeline: (assetId: string, startSec: number, track: WorkspaceTimelineTrack) => void;
  onPositionItem: (itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, selectedItemIds?: string[]) => void;
  onPreviewItemsChange?: (items: WorkspaceTimelineItem[] | null, playheadSec: number | null) => void;
  onRedo: () => void;
  onResizeItem: (itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => void;
  onSelectItem: (itemId: string, mode?: TimelineSelectionMode) => void;
  onSelectItems: (itemIds: string[]) => void;
  onInsertIntoClipChange: (enabled: boolean) => void;
  onLinkItems: (itemIds: string[]) => void;
  onDeleteTrack: (track: WorkspaceTimelineTrack) => void;
  onToggleAudioTrackMute: (track: WorkspaceTimelineAudioTrack) => void;
  onToggleTrackLock: (track: WorkspaceTimelineTrack) => void;
  onToggleVideoTrackVisibility: (track: WorkspaceTimelineVideoTrack) => void;
  onTogglePlayback: () => void;
  onUnlinkItems: (itemIds: string[]) => void;
  onUndo: () => void;
};

export function WorkspaceTimeline({
  copy,
  canRedo,
  canUndo,
  isShortcutActive,
  audioTrackCount,
  items,
  hiddenVideoTracks,
  isInsertIntoClipEnabled,
  inPointSec,
  lockedTracks,
  mutedAudioTracks,
  maxAudioTrackCount,
  maxPanelHeight,
  maxVideoTrackCount,
  minAudioTrackCount,
  minPanelHeight,
  panelHeight,
  selectedItemId,
  selectedItemIds,
  outPointSec,
  videoTrackCount,
  playheadSec,
  projectFps,
  onAddAudioTrack,
  onAddVideoTrack,
  onCutItem,
  onDeleteItem,
  onGoToCut,
  onInvalidNodeDropToTimeline,
  onMarkIn,
  onMarkOut,
  onMoveItem,
  onNodeDropToTimeline,
  onPanelHeightChange,
  onPlaybackChange,
  onPlayheadChange,
  onProjectAssetDropToTimeline,
  onPositionItem,
  onPreviewItemsChange,
  onRedo,
  onResizeItem,
  onSelectItem,
  onSelectItems,
  onInsertIntoClipChange,
  onLinkItems,
  onDeleteTrack,
  onToggleAudioTrackMute,
  onToggleTrackLock,
  onToggleVideoTrackVisibility,
  onTogglePlayback,
  onUnlinkItems,
  onUndo,
}: WorkspaceTimelineProps) {
  const [activeTimelineTool, setActiveTimelineTool] = useState<TimelineTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const frameStepSec = frameStepSeconds(projectFps);
  const baseTimelineDuration = Math.max(1, ...items.map((item) => item.startSec + item.durationSec));
  const timelineTracks = useMemo(() => buildTimelineTracks(videoTrackCount, audioTrackCount, items, copy.tracks), [audioTrackCount, copy.tracks, items, videoTrackCount]);
  const hiddenVideoTrackSet = useMemo(() => new Set<WorkspaceTimelineVideoTrack>(hiddenVideoTracks), [hiddenVideoTracks]);
  const lockedTrackSet = useMemo(() => new Set<WorkspaceTimelineTrack>(lockedTracks), [lockedTracks]);
  const mutedAudioTrackSet = useMemo(() => new Set<WorkspaceTimelineAudioTrack>(mutedAudioTracks), [mutedAudioTracks]);
  const highestVideoTrackId = timelineTracks.find((track) => track.kind === 'video')?.id ?? 'video';
  const lowestAudioTrackId = [...timelineTracks].reverse().find((track) => track.kind === 'audio')?.id ?? 'audio';
  const clampedPlayheadSec = Math.max(0, Math.min(playheadSec, baseTimelineDuration));
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedKeys = useMemo(() => selectionKeysForTimelineItemIds(items, selectedItemIds), [items, selectedItemIds]);
  const {
    clearTimelineContextMenus,
    clipMenu,
    handleClipContextMenuAction,
    handleOpenClipContextMenu,
    handleOpenTrackContextMenu,
    handleTrackContextMenuAction,
    trackMenu,
  } = useTimelineContextMenus({
    audioTrackCount,
    items,
    maxAudioTrackCount,
    maxVideoTrackCount,
    minAudioTrackCount,
    onAddAudioTrack,
    onAddVideoTrack,
    onDeleteTrack,
    onLinkItems,
    onSelectItem,
    onUnlinkItems,
    selectedItemIds,
    selectedKeys,
    videoTrackCount,
  });
  const {
    handleBeginTimelinePanelMouseResize,
    handleBeginTimelinePanelPointerResize,
    timelinePanelRef,
  } = useTimelinePanelResize({
    maxPanelHeight,
    minPanelHeight,
    onBeginResize: clearTimelineContextMenus,
    onPanelHeightChange,
    panelHeight,
  });
  const {
    handleBeginInteraction,
    interaction,
    isItemInteracting,
  } = useTimelineClipInteraction({
    clampedPlayheadSec,
    frameStepSec,
    items,
    lockedTrackSet,
    onPlaybackChange,
    onPlayheadChange,
    onPositionItem,
    onResizeItem,
    onSelectItem,
    pixelsPerSecond,
    selectedItemIds,
    selectedKeys,
    snapEnabled,
    timelineTracks,
  });
  const totalDuration = Math.max(baseTimelineDuration, interaction ? interaction.previewStartSec + interaction.previewDurationSec : 0);
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, totalDuration * pixelsPerSecond + 64);
  const rulerTickSec = timelineRulerStepFor(pixelsPerSecond);
  const safeInPointSec = typeof inPointSec === 'number' && Number.isFinite(inPointSec) ? inPointSec : null;
  const safeOutPointSec = typeof outPointSec === 'number' && Number.isFinite(outPointSec) ? outPointSec : null;
  const hasValidInOutRange = safeInPointSec !== null && safeOutPointSec !== null && safeOutPointSec > safeInPointSec;
  const selectedTouchesLockedTrack = useMemo(
    () => items.some((item) => selectedKeys.has(selectionKeyForTimelineItem(item)) && lockedTrackSet.has(item.track)),
    [items, lockedTrackSet, selectedKeys]
  );
  const selectedLayout = selectedItem ? layoutForTimelineItem(selectedItem, interaction) : null;
  const selectedSplitOffset = selectedLayout ? clampedPlayheadSec - selectedLayout.startSec : null;
  const canCutAtPlayhead = Boolean(
    selectedItem &&
    selectedLayout &&
    !selectedTouchesLockedTrack &&
    selectedSplitOffset !== null &&
    selectedSplitOffset >= MIN_CLIP_DURATION_SEC &&
    selectedSplitOffset <= selectedLayout.durationSec - MIN_CLIP_DURATION_SEC
  );
  const handleScrub = (event: ChangeEvent<HTMLInputElement>) => {
    onPlaybackChange(false);
    onPlayheadChange(Number(event.currentTarget.value));
  };
  const setTimelineZoom = useCallback((nextPixelsPerSecond: number) => {
    setPixelsPerSecond(Math.max(MIN_TIMELINE_PIXELS_PER_SECOND, Math.min(MAX_TIMELINE_PIXELS_PER_SECOND, nextPixelsPerSecond)));
  }, []);
  const handleSelectTimelineTool = useCallback(() => {
    setActiveTimelineTool('select');
  }, []);
  const handleToggleBladeTimelineTool = useCallback(() => {
    setActiveTimelineTool((currentTool) => (currentTool === 'blade' ? 'select' : 'blade'));
  }, []);
  const handleToggleTimelineSnap = useCallback(() => {
    setSnapEnabled((value) => !value);
  }, []);
  const handleZoomBy = useCallback((deltaPixelsPerSecond: number) => {
    setTimelineZoom(pixelsPerSecond + deltaPixelsPerSecond);
  }, [pixelsPerSecond, setTimelineZoom]);
  const {
    scheduleVisibleTimelineRangeUpdate,
    visibleTimelineRange,
  } = useTimelineVisibleRange({
    frameStepSec,
    pixelsPerSecond,
    timelineViewportRef,
    totalDuration,
  });
  const secondsFromTimelineElement = useCallback((clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    const rawSeconds = (clientX - rect.left) / pixelsPerSecond;
    return Math.max(0, Math.min(totalDuration, snapTimelineSeconds(rawSeconds, frameStepSec)));
  }, [frameStepSec, pixelsPerSecond, totalDuration]);
  const {
    handleBeginTimelineSurfacePointerDown,
    handleTimelineSurfaceClick,
    marqueeStyle,
  } = useTimelineSurfaceSelection({
    onPlaybackChange,
    onPlayheadChange,
    onSelectItems,
    secondsFromTimelineElement,
    timelineViewportClassName: styles.timelineViewport,
  });
  const {
    externalDropPreview,
    handleClearExternalDropPreview,
    handleExternalDrop,
    handleExternalDropOver,
  } = useTimelineExternalDrop({
    isInsertIntoClipEnabled,
    items,
    lockedTrackSet,
    onInvalidNodeDropToTimeline,
    onNodeDropToTimeline,
    onPlaybackChange,
    onProjectAssetDropToTimeline,
    secondsFromTimelineElement,
  });
  const handleBeginPlayheadDrag = useTimelinePlayheadDrag({
    onPlaybackChange,
    onPlayheadChange,
    secondsFromTimelineElement,
  });
  const seekBy = useCallback((deltaSec: number) => {
    onPlaybackChange(false);
    onPlayheadChange(Math.max(0, Math.min(totalDuration, clampedPlayheadSec + deltaSec)));
  }, [clampedPlayheadSec, onPlaybackChange, onPlayheadChange, totalDuration]);
  const handleCutSelectedAtPlayhead = useCallback(() => {
    if (!selectedItem || selectedSplitOffset === null || !canCutAtPlayhead) return;
    onCutItem(selectedItem.id, selectedSplitOffset);
  }, [canCutAtPlayhead, onCutItem, selectedItem, selectedSplitOffset]);

  useTimelineKeyboardShortcuts({
    canRedo,
    canUndo,
    frameStepSec,
    isShortcutActive,
    onCutAtPlayhead: handleCutSelectedAtPlayhead,
    onDeleteItem,
    onGoToCut,
    onMarkIn,
    onMarkOut,
    onRedo,
    onSeekBy: seekBy,
    onSelectTool: handleSelectTimelineTool,
    onToggleBladeTool: handleToggleBladeTimelineTool,
    onTogglePlayback,
    onToggleSnap: handleToggleTimelineSnap,
    onUndo,
    onZoomBy: handleZoomBy,
  });
  const {
    previewItems,
    previewPlayheadSec,
    previewTimelineItems,
  } = useTimelinePreviewItems({
    interaction,
    isInsertIntoClipEnabled,
    items,
  });
  useEffect(() => {
    onPreviewItemsChange?.(previewTimelineItems, previewPlayheadSec);
  }, [onPreviewItemsChange, previewPlayheadSec, previewTimelineItems]);
  const timelinePanelStyle = {
    '--timeline-content-width': `${timelineWidth}px`,
  } as CSSProperties;

  return (
    <section
      ref={timelinePanelRef}
      className={styles.timelinePanel}
      style={timelinePanelStyle}
      aria-label={copy.tools.videoTimeline}
      data-timeline-frame-step={frameStepSec}
      data-timeline-pixels-per-second={pixelsPerSecond}
    >
      <button
        type="button"
        className={styles.timelineResizeHandle}
        data-timeline-control="true"
        data-timeline-resize-handle="true"
        onMouseDown={handleBeginTimelinePanelMouseResize}
        onPointerDown={handleBeginTimelinePanelPointerResize}
        title={copy.tools.resizeTimelineTitle}
        aria-label={copy.tools.resizeTimeline}
      />
      <TimelineToolbar
        activeTimelineTool={activeTimelineTool}
        canRedo={canRedo}
        canUndo={canUndo}
        currentTimecode={formatWorkspaceTimecode(clampedPlayheadSec, projectFps)}
        maxPixelsPerSecond={MAX_TIMELINE_PIXELS_PER_SECOND}
        minPixelsPerSecond={MIN_TIMELINE_PIXELS_PER_SECOND}
        onRedo={onRedo}
        onSelectTool={handleSelectTimelineTool}
        onToggleBladeTool={handleToggleBladeTimelineTool}
        onUndo={onUndo}
        onZoomChange={setTimelineZoom}
        pixelsPerSecond={pixelsPerSecond}
        playheadSec={clampedPlayheadSec}
        copy={copy.tools}
      />
      <div
        ref={timelineViewportRef}
        className={styles.timelineViewport}
        onScroll={scheduleVisibleTimelineRangeUpdate}
      >
        <TimelineRuler
          clampedPlayheadSec={clampedPlayheadSec}
          frameStepSec={frameStepSec}
          hasValidInOutRange={hasValidInOutRange}
          isInsertIntoClipEnabled={isInsertIntoClipEnabled}
          onBeginPlayheadDrag={handleBeginPlayheadDrag}
          onInsertIntoClipChange={onInsertIntoClipChange}
          onScrub={handleScrub}
          onSurfaceClick={handleTimelineSurfaceClick}
          onSurfacePointerDown={handleBeginTimelineSurfacePointerDown}
          onToggleSnap={handleToggleTimelineSnap}
          pixelsPerSecond={pixelsPerSecond}
          projectFps={projectFps}
          rulerTickSec={rulerTickSec}
          safeInPointSec={safeInPointSec}
          safeOutPointSec={safeOutPointSec}
          snapEnabled={snapEnabled}
          snapGuideSec={interaction?.snapGuideSec ?? null}
          timelineWidth={timelineWidth}
          totalDuration={totalDuration}
          copy={copy.tools}
        />
        <TimelineTrackList
          copy={copy}
          activeTool={activeTimelineTool}
          audioTrackCount={audioTrackCount}
          clampedPlayheadSec={clampedPlayheadSec}
          externalDropPreview={externalDropPreview}
          formatDropDuration={formatDuration}
          hiddenVideoTrackSet={hiddenVideoTrackSet}
          highestVideoTrackId={highestVideoTrackId}
          isItemInteracting={isItemInteracting}
          lockedTrackSet={lockedTrackSet}
          lowestAudioTrackId={lowestAudioTrackId}
          maxAudioTrackCount={maxAudioTrackCount}
          maxVideoTrackCount={maxVideoTrackCount}
          mutedAudioTrackSet={mutedAudioTrackSet}
          onAddAudioTrack={onAddAudioTrack}
          onAddVideoTrack={onAddVideoTrack}
          onBeginClipInteraction={handleBeginInteraction}
          onBeginPlayheadDrag={handleBeginPlayheadDrag}
          onClearExternalDropPreview={handleClearExternalDropPreview}
          onCutItem={onCutItem}
          onDropExternal={handleExternalDrop}
          onExternalDropOver={handleExternalDropOver}
          onMoveItem={onMoveItem}
          onOpenClipContextMenu={handleOpenClipContextMenu}
          onOpenTrackContextMenu={handleOpenTrackContextMenu}
          onPlayheadChange={onPlayheadChange}
          onSelectItem={onSelectItem}
          onSurfaceClick={handleTimelineSurfaceClick}
          onSurfacePointerDown={handleBeginTimelineSurfacePointerDown}
          onToggleAudioTrackMute={onToggleAudioTrackMute}
          onToggleTrackLock={onToggleTrackLock}
          onToggleVideoTrackVisibility={onToggleVideoTrackVisibility}
          pixelsPerSecond={pixelsPerSecond}
          previewItems={previewItems}
          selectedKeys={selectedKeys}
          selectionKeyForItem={selectionKeyForTimelineItem}
          snapGuideSec={interaction?.snapGuideSec ?? null}
          snapStepSec={frameStepSec}
          timelineWidth={timelineWidth}
          tracks={timelineTracks}
          visibleEndSec={visibleTimelineRange.endSec}
          visibleStartSec={visibleTimelineRange.startSec}
          videoTrackCount={videoTrackCount}
        />
        {marqueeStyle ? <span className={styles.timelineMarquee} style={marqueeStyle} aria-hidden="true" /> : null}
      </div>
      <TimelineContextMenus
        copy={copy}
        clipMenu={clipMenu}
        onClipMenuAction={handleClipContextMenuAction}
        onTrackMenuAction={handleTrackContextMenuAction}
        trackMenu={trackMenu}
      />
    </section>
  );
}
