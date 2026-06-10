'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import styles from '../_styles/timeline.module.css';
import type { WorkspaceTimelineAudioTrack, WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from '../_lib/workspace-types';
import {
  moveWorkspaceTimelineSelectionWithMode,
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from '../_lib/workspace-timeline-editing';
import {
  frameStepSeconds,
  layoutForTimelineItem,
  marqueeRectForState,
  MIN_CLIP_DURATION_SEC,
  previewPlayheadForInteraction,
  selectedItemIdsForMarquee,
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
  snapTimelineSeconds,
  timelineRulerStepFor,
  trackForTimelineItem,
  type TimelineMarqueeState,
} from '../_lib/timeline/timeline-interaction';
import {
  buildTimelineTracks,
  type TimelineTrackDefinition,
} from './timeline/timelineTrackDefinitions';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import type {
  TimelineSelectionMode,
} from './timeline/TimelineClip';
import {
  TimelineContextMenus,
  type TimelineContextMenuState,
  type TimelineTrackContextMenuState,
} from './timeline/TimelineContextMenus';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineTrackList } from './timeline/TimelineTrackList';
import { TimelineToolbar, type TimelineTool } from './timeline/TimelineToolbar';
import { useTimelineClipInteraction } from './timeline/useTimelineClipInteraction';
import { useTimelineExternalDrop } from './timeline/useTimelineExternalDrop';
import { useTimelineKeyboardShortcuts } from './timeline/useTimelineKeyboardShortcuts';
import { useTimelinePanelResize } from './timeline/useTimelinePanelResize';
import { useTimelinePlayheadDrag } from './timeline/useTimelinePlayheadDrag';
import { useTimelineVisibleRange } from './timeline/useTimelineVisibleRange';

const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 34;
const MIN_TIMELINE_PIXELS_PER_SECOND = 18;
const MAX_TIMELINE_PIXELS_PER_SECOND = 92;
const MIN_TIMELINE_WIDTH = 760;
const TIMELINE_PREVIEW_ID_SEED = 'preview';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

type WorkspaceTimelineProps = {
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
  const [marquee, setMarquee] = useState<TimelineMarqueeState | null>(null);
  const [activeTimelineTool, setActiveTimelineTool] = useState<TimelineTool>('select');
  const [contextMenu, setContextMenu] = useState<TimelineContextMenuState | null>(null);
  const [trackContextMenu, setTrackContextMenu] = useState<TimelineTrackContextMenuState | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const suppressNextSurfaceClickRef = useRef(false);
  const {
    handleBeginTimelinePanelMouseResize,
    handleBeginTimelinePanelPointerResize,
    timelinePanelRef,
  } = useTimelinePanelResize({
    maxPanelHeight,
    minPanelHeight,
    onBeginResize: () => {
      setContextMenu(null);
      setTrackContextMenu(null);
    },
    onPanelHeightChange,
    panelHeight,
  });
  const frameStepSec = frameStepSeconds(projectFps);
  const baseTimelineDuration = Math.max(1, ...items.map((item) => item.startSec + item.durationSec));
  const timelineTracks = useMemo(() => buildTimelineTracks(videoTrackCount, audioTrackCount, items), [audioTrackCount, items, videoTrackCount]);
  const hiddenVideoTrackSet = useMemo(() => new Set<WorkspaceTimelineVideoTrack>(hiddenVideoTracks), [hiddenVideoTracks]);
  const lockedTrackSet = useMemo(() => new Set<WorkspaceTimelineTrack>(lockedTracks), [lockedTracks]);
  const mutedAudioTrackSet = useMemo(() => new Set<WorkspaceTimelineAudioTrack>(mutedAudioTracks), [mutedAudioTracks]);
  const highestVideoTrackId = timelineTracks.find((track) => track.kind === 'video')?.id ?? 'video';
  const lowestAudioTrackId = [...timelineTracks].reverse().find((track) => track.kind === 'audio')?.id ?? 'audio';
  const clampedPlayheadSec = Math.max(0, Math.min(playheadSec, baseTimelineDuration));
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedKeys = useMemo(() => selectionKeysForTimelineItemIds(items, selectedItemIds), [items, selectedItemIds]);
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
  const handleBeginTimelineSurfacePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-timeline-item], [data-timeline-control="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const laneElement = event.currentTarget;
    onSelectItems([]);
    const viewportElement = laneElement.closest(`.${styles.timelineViewport}`) as HTMLElement | null;
    const viewportRect = viewportElement?.getBoundingClientRect() ?? laneElement.getBoundingClientRect();
    const itemRects = Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-item]')).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.timelineItem ?? '',
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    }).filter((itemRect) => itemRect.id);
    const initialMarquee: TimelineMarqueeState = {
      originClientX: event.clientX,
      originClientY: event.clientY,
      currentClientX: event.clientX,
      currentClientY: event.clientY,
      containerLeft: viewportRect.left,
      containerTop: viewportRect.top,
      itemRects,
    };
    let didDrag = false;
    setMarquee(initialMarquee);

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      const distance = Math.hypot(pointerEvent.clientX - initialMarquee.originClientX, pointerEvent.clientY - initialMarquee.originClientY);
      if (distance > 4) didDrag = true;
      setMarquee((current) => current ? {
        ...current,
        currentClientX: pointerEvent.clientX,
        currentClientY: pointerEvent.clientY,
      } : current);
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      const finalMarquee: TimelineMarqueeState = {
        ...initialMarquee,
        currentClientX: pointerEvent.clientX,
        currentClientY: pointerEvent.clientY,
      };
      setMarquee(null);
      if (didDrag) {
        suppressNextSurfaceClickRef.current = true;
        window.setTimeout(() => {
          suppressNextSurfaceClickRef.current = false;
        }, 0);
        const marqueeItemIds = selectedItemIdsForMarquee(finalMarquee);
        onSelectItems(marqueeItemIds);
        return;
      }
      onPlaybackChange(false);
      onSelectItems([]);
      onPlayheadChange(secondsFromTimelineElement(pointerEvent.clientX, laneElement));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [onPlaybackChange, onPlayheadChange, onSelectItems, secondsFromTimelineElement]);
  const handleTimelineSurfaceClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-timeline-item], [data-timeline-control="true"]')) return;
    if (suppressNextSurfaceClickRef.current) {
      suppressNextSurfaceClickRef.current = false;
      return;
    }
    onPlaybackChange(false);
    onSelectItems([]);
    onPlayheadChange(secondsFromTimelineElement(event.clientX, event.currentTarget));
  }, [onPlaybackChange, onPlayheadChange, onSelectItems, secondsFromTimelineElement]);
  const handleOpenClipContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, item: WorkspaceTimelineItem) => {
    event.preventDefault();
    event.stopPropagation();
    const clickedKey = selectionKeyForTimelineItem(item);
    const isClickedSelected = selectedKeys.has(clickedKey);
    const menuItemIds = isClickedSelected && selectedItemIds.length ? selectedItemIds : [item.id];
    const menuKeys = selectionKeysForTimelineItemIds(items, menuItemIds);
    const menuItems = items.filter((candidate) => menuKeys.has(selectionKeyForTimelineItem(candidate)));
    const linkedGroupIds = new Set(
      menuItems
        .map((candidate) => candidate.linkedGroupId)
        .filter((groupId): groupId is string => Boolean(groupId))
    );
    if (!isClickedSelected) {
      onSelectItem(item.id, 'replace');
    }
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    setContextMenu({
      canLink: menuKeys.size > 1,
      canUnlink: linkedGroupIds.size > 0,
      itemIds: menuItemIds,
      selectedClipCount: menuItems.length,
      x: viewportWidth ? Math.min(event.clientX, Math.max(12, viewportWidth - 224)) : event.clientX,
      y: viewportHeight ? Math.min(event.clientY, Math.max(12, viewportHeight - 120)) : event.clientY,
    });
  }, [items, onSelectItem, selectedItemIds, selectedKeys]);
  const handleContextMenuAction = useCallback((action: 'link' | 'unlink') => {
    if (!contextMenu) return;
    if (action === 'link') onLinkItems(contextMenu.itemIds);
    else onUnlinkItems(contextMenu.itemIds);
    setContextMenu(null);
  }, [contextMenu, onLinkItems, onUnlinkItems]);
  const handleOpenTrackContextMenu = useCallback((event: MouseEvent<HTMLDivElement>, track: TimelineTrackDefinition) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu(null);
    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
    setTrackContextMenu({
      canAdd: track.kind === 'video' ? videoTrackCount < maxVideoTrackCount : audioTrackCount < maxAudioTrackCount,
      canDelete: track.kind === 'video' ? videoTrackCount > 1 : audioTrackCount > minAudioTrackCount,
      kind: track.kind,
      label: track.label,
      trackId: track.id,
      x: viewportWidth ? Math.min(event.clientX, Math.max(12, viewportWidth - 212)) : event.clientX,
      y: viewportHeight ? Math.min(event.clientY, Math.max(12, viewportHeight - 118)) : event.clientY,
    });
  }, [audioTrackCount, maxAudioTrackCount, maxVideoTrackCount, minAudioTrackCount, videoTrackCount]);
  const handleTrackContextMenuAction = useCallback((action: 'add' | 'delete') => {
    if (!trackContextMenu) return;
    if (action === 'add') {
      if (trackContextMenu.kind === 'video') onAddVideoTrack();
      else onAddAudioTrack();
    } else {
      onDeleteTrack(trackContextMenu.trackId);
    }
    setTrackContextMenu(null);
  }, [onAddAudioTrack, onAddVideoTrack, onDeleteTrack, trackContextMenu]);
  const seekBy = useCallback((deltaSec: number) => {
    onPlaybackChange(false);
    onPlayheadChange(Math.max(0, Math.min(totalDuration, clampedPlayheadSec + deltaSec)));
  }, [clampedPlayheadSec, onPlaybackChange, onPlayheadChange, totalDuration]);
  const handleCutSelectedAtPlayhead = useCallback(() => {
    if (!selectedItem || selectedSplitOffset === null || !canCutAtPlayhead) return;
    onCutItem(selectedItem.id, selectedSplitOffset);
  }, [canCutAtPlayhead, onCutItem, selectedItem, selectedSplitOffset]);
  useEffect(() => {
    if (!contextMenu && !trackContextMenu) return undefined;
    const closeContextMenu = () => {
      setContextMenu(null);
      setTrackContextMenu(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeContextMenu();
    };
    window.addEventListener('pointerdown', closeContextMenu);
    window.addEventListener('scroll', closeContextMenu, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', closeContextMenu);
      window.removeEventListener('scroll', closeContextMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, trackContextMenu]);

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
  const resolvedPreviewTimelineItems = useMemo(() => {
    if (!interaction || interaction.kind !== 'move') return null;
    return moveWorkspaceTimelineSelectionWithMode({
      items,
      itemIds: interaction.selectedItemIds,
      anchorItemId: interaction.itemId,
      nextStartSec: interaction.previewStartSec,
      nextTrack: interaction.previewTrack,
      mode: 'insert',
      idSeed: TIMELINE_PREVIEW_ID_SEED,
      allowInsertIntoClip: isInsertIntoClipEnabled,
    });
  }, [interaction, isInsertIntoClipEnabled, items]);
  const previewItems = useMemo(
    () => {
      if (resolvedPreviewTimelineItems) {
        return resolvedPreviewTimelineItems.map((item) => ({
          item,
          layout: { startSec: item.startSec, durationSec: item.durationSec },
          trackId: item.track,
        }));
      }
      return items.map((item) => ({
        item,
        layout: layoutForTimelineItem(item, interaction),
        trackId: trackForTimelineItem(item, interaction),
      }));
    },
    [interaction, items, resolvedPreviewTimelineItems]
  );
  const previewTimelineItems = useMemo(
    () => {
      if (resolvedPreviewTimelineItems) return resolvedPreviewTimelineItems;
      return interaction
        ? items.map((item) => {
            const layout = layoutForTimelineItem(item, interaction);
            return {
              ...item,
              startSec: layout.startSec,
              durationSec: layout.durationSec,
              track: trackForTimelineItem(item, interaction),
            };
          })
        : null;
    },
    [interaction, items, resolvedPreviewTimelineItems]
  );
  const previewPlayheadSec = interaction
    ? resolvedPreviewTimelineItems?.find((item) => item.id === interaction.itemId)?.startSec ?? previewPlayheadForInteraction(interaction)
    : null;
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
      aria-label="Video timeline"
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
        title="Drag to resize montage timeline"
        aria-label="Resize montage timeline"
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
        />
        <TimelineTrackList
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
        {marquee ? <span className={styles.timelineMarquee} style={marqueeRectForState(marquee)} aria-hidden="true" /> : null}
      </div>
      <TimelineContextMenus
        clipMenu={contextMenu}
        onClipMenuAction={handleContextMenuAction}
        onTrackMenuAction={handleTrackContextMenuAction}
        trackMenu={trackContextMenu}
      />
    </section>
  );
}
