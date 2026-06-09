'use client';

/* eslint-disable @next/next/no-img-element */

import { Play, Volume2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
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
  interactionMatchesTimelineItem,
  layoutForTimelineItem,
  marqueeRectForState,
  MIN_CLIP_DURATION_SEC,
  previewPlayheadForInteraction,
  selectedItemIdsForMarquee,
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
  snapTimelineSeconds,
  sourceDurationForTimelineItem,
  sourceStartForTimelineItem,
  timelineRulerStepFor,
  trackForTimelineItem,
  nextTimelineInteractionState,
  type TimelineClipLayout,
  type TimelineInteractionKind,
  type TimelineInteractionState,
  type TimelineMarqueeState,
} from '../_lib/timeline/timeline-interaction';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineAudioTrackId,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from '../_lib/workspace-timeline-tracks';
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
import {
  TimelineTrackList,
  type TimelineTrackDefinition,
} from './timeline/TimelineTrackList';
import { TimelineToolbar, type TimelineTool } from './timeline/TimelineToolbar';

const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 34;
const MIN_TIMELINE_PIXELS_PER_SECOND = 18;
const MAX_TIMELINE_PIXELS_PER_SECOND = 92;
const MIN_TIMELINE_WIDTH = 760;
const TIMELINE_CLIP_DRAG_THRESHOLD_PIXELS = 0.5;
const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';
const EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC = 5;
const TIMELINE_PREVIEW_ID_SEED = 'preview';
const TIMELINE_VISIBLE_RANGE_BUFFER_PX = 360;

type TimelineVisibleRange = {
  startSec: number;
  endSec: number;
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

type TimelineNodeDragPayload = {
  assetId?: string;
  durationSec?: number | null;
  mediaKind?: 'audio' | 'image' | 'video';
  nodeId?: string;
  previewUrl?: string | null;
  title?: string | null;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function isVideoTimelineTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineVideoTrack {
  return isWorkspaceTimelineVideoTrack(track);
}

function isAudioTimelineTrack(track: WorkspaceTimelineTrack): track is WorkspaceTimelineAudioTrack {
  return isWorkspaceTimelineAudioTrack(track);
}

function parseTimelineNodeDragPayload(dataTransfer: DataTransfer): TimelineNodeDragPayload | null {
  if (!Array.from(dataTransfer.types).includes(TIMELINE_NODE_DRAG_TYPE)) return null;
  try {
    const payload = JSON.parse(dataTransfer.getData(TIMELINE_NODE_DRAG_TYPE)) as TimelineNodeDragPayload;
    if ((!payload.nodeId && !payload.assetId) || !payload.mediaKind) return null;
    return payload;
  } catch {
    return null;
  }
}

function durationForTimelineDropPayload(payload: TimelineNodeDragPayload): number {
  const durationSec = Number(payload.durationSec);
  if (Number.isFinite(durationSec) && durationSec > 0) return Math.max(MIN_CLIP_DURATION_SEC, durationSec);
  return EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC;
}

function titleForTimelineDropPayload(payload: TimelineNodeDragPayload): string {
  if (payload.title && payload.title.trim()) return payload.title.trim();
  if (payload.mediaKind === 'audio') return 'Audio clip';
  if (payload.mediaKind === 'image') return 'Image clip';
  return 'Video clip';
}

function isExternalTimelineDropCompatible(mediaKind: TimelineExternalDropPreview['mediaKind'], track: WorkspaceTimelineTrack): boolean {
  if (mediaKind === 'audio') return !isVideoTimelineTrack(track);
  return isVideoTimelineTrack(track);
}

function insertionBoundaryForTimelineTrack(items: WorkspaceTimelineItem[], track: WorkspaceTimelineTrack, requestedStartSec: number): number {
  const targetItem = items
    .filter((item) => item.track === track)
    .filter((item) => requestedStartSec > item.startSec && requestedStartSec < item.startSec + item.durationSec)
    .sort((left, right) => left.startSec - right.startSec)[0] ?? null;
  if (!targetItem) return requestedStartSec;

  const midpointSec = targetItem.startSec + targetItem.durationSec / 2;
  return snapTimelineSeconds(requestedStartSec < midpointSec ? targetItem.startSec : targetItem.startSec + targetItem.durationSec);
}

function timelineVideoTrackId(index: number): WorkspaceTimelineVideoTrack {
  return workspaceTimelineVideoTrackId(index);
}

function timelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineVideoTrackIndex(track);
}

function timelineAudioTrackId(index: number): WorkspaceTimelineTrack {
  return workspaceTimelineAudioTrackId(index);
}

function timelineAudioTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineAudioTrackIndex(track);
}

function buildTimelineTracks(videoTrackCount: number, audioTrackCount: number, items: WorkspaceTimelineItem[]): TimelineTrackDefinition[] {
  const requiredVideoTrackCount = Math.max(1, videoTrackCount, ...items.map((item) => timelineVideoTrackIndex(item.track)));
  const videoTracks = Array.from({ length: requiredVideoTrackCount }, (_, index): TimelineTrackDefinition => ({
    id: timelineVideoTrackId(index + 1),
    label: `V${index + 1}`,
    icon: <Play size={14} />,
    kind: 'video',
  }));
  const requiredAudioTrackCount = Math.max(1, audioTrackCount, ...items.map((item) => timelineAudioTrackIndex(item.track)));
  const audioTracks = Array.from({ length: requiredAudioTrackCount }, (_, index): TimelineTrackDefinition => ({
    id: timelineAudioTrackId(index + 1),
    label: `Audio ${index + 1}`,
    icon: <Volume2 size={14} />,
    kind: 'audio',
  }));
  const displayedVideoTracks = [...videoTracks].reverse();
  return [...displayedVideoTracks, ...audioTracks];
}

function isTimelineShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function markTimelinePerformance(name: 'drag-start' | 'drag-frame' | 'drag-commit' | 'playhead-frame' | 'playhead-commit') {
  if (process.env.NODE_ENV === 'production') return;
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  performance.mark(`maxvideoai.timeline.${name}`);
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
  const [interaction, setInteraction] = useState<TimelineInteractionState | null>(null);
  const [marquee, setMarquee] = useState<TimelineMarqueeState | null>(null);
  const [activeTimelineTool, setActiveTimelineTool] = useState<TimelineTool>('select');
  const [externalDropPreview, setExternalDropPreview] = useState<TimelineExternalDropPreview | null>(null);
  const [contextMenu, setContextMenu] = useState<TimelineContextMenuState | null>(null);
  const [trackContextMenu, setTrackContextMenu] = useState<TimelineTrackContextMenuState | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
  const [visibleTimelineRange, setVisibleTimelineRange] = useState<TimelineVisibleRange>(() => ({
    startSec: 0,
    endSec: Number.POSITIVE_INFINITY,
  }));
  const timelinePanelRef = useRef<HTMLElement | null>(null);
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const panelResizePointerHandledRef = useRef(false);
  const interactionRef = useRef<TimelineInteractionState | null>(null);
  const suppressNextSurfaceClickRef = useRef(false);
  const visibleRangeFrameRef = useRef<number | null>(null);
  const playheadDragFrameRef = useRef<number | null>(null);
  const pendingPlayheadDragSecRef = useRef<number | null>(null);
  const frameStepSec = frameStepSeconds(projectFps);
  const totalDuration = Math.max(1, ...items.map((item) => item.startSec + item.durationSec), interaction ? interaction.previewStartSec + interaction.previewDurationSec : 0);
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, totalDuration * pixelsPerSecond + 64);
  const rulerTickSec = timelineRulerStepFor(pixelsPerSecond);
  const safeInPointSec = typeof inPointSec === 'number' && Number.isFinite(inPointSec) ? inPointSec : null;
  const safeOutPointSec = typeof outPointSec === 'number' && Number.isFinite(outPointSec) ? outPointSec : null;
  const hasValidInOutRange = safeInPointSec !== null && safeOutPointSec !== null && safeOutPointSec > safeInPointSec;
  const timelineTracks = useMemo(() => buildTimelineTracks(videoTrackCount, audioTrackCount, items), [audioTrackCount, items, videoTrackCount]);
  const hiddenVideoTrackSet = useMemo(() => new Set<WorkspaceTimelineVideoTrack>(hiddenVideoTracks), [hiddenVideoTracks]);
  const lockedTrackSet = useMemo(() => new Set<WorkspaceTimelineTrack>(lockedTracks), [lockedTracks]);
  const mutedAudioTrackSet = useMemo(() => new Set<WorkspaceTimelineAudioTrack>(mutedAudioTracks), [mutedAudioTracks]);
  const highestVideoTrackId = timelineTracks.find((track) => track.kind === 'video')?.id ?? 'video';
  const lowestAudioTrackId = [...timelineTracks].reverse().find((track) => track.kind === 'audio')?.id ?? 'audio';
  const clampedPlayheadSec = Math.max(0, Math.min(playheadSec, totalDuration));
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedKeys = useMemo(() => selectionKeysForTimelineItemIds(items, selectedItemIds), [items, selectedItemIds]);
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
  const updateVisibleTimelineRange = useCallback(() => {
    const viewportElement = timelineViewportRef.current;
    if (!viewportElement) {
      setVisibleTimelineRange((currentRange) => (
        currentRange.startSec === 0 && currentRange.endSec === totalDuration
          ? currentRange
          : { startSec: 0, endSec: totalDuration }
      ));
      return;
    }

    const bufferSec = TIMELINE_VISIBLE_RANGE_BUFFER_PX / pixelsPerSecond;
    const nextStartSec = Math.max(0, viewportElement.scrollLeft / pixelsPerSecond - bufferSec);
    const nextEndSec = Math.min(
      totalDuration,
      (viewportElement.scrollLeft + viewportElement.clientWidth) / pixelsPerSecond + bufferSec
    );

    setVisibleTimelineRange((currentRange) => {
      const startDelta = Math.abs(currentRange.startSec - nextStartSec);
      const endDelta = Math.abs(currentRange.endSec - nextEndSec);
      if (startDelta < frameStepSec && endDelta < frameStepSec) return currentRange;
      return { startSec: nextStartSec, endSec: nextEndSec };
    });
  }, [frameStepSec, pixelsPerSecond, totalDuration]);
  const scheduleVisibleTimelineRangeUpdate = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (visibleRangeFrameRef.current !== null) return;
    visibleRangeFrameRef.current = window.requestAnimationFrame(() => {
      visibleRangeFrameRef.current = null;
      updateVisibleTimelineRange();
    });
  }, [updateVisibleTimelineRange]);
  const beginTimelinePanelResize = useCallback((
    originClientY: number,
    moveEventName: 'mousemove' | 'pointermove',
    upEventName: 'mouseup' | 'pointerup'
  ) => {
    setContextMenu(null);
    setTrackContextMenu(null);

    const originHeight = timelinePanelRef.current?.getBoundingClientRect().height ?? panelHeight ?? minPanelHeight;
    const clampPanelHeight = (height: number) => Math.max(minPanelHeight, Math.min(maxPanelHeight, Math.round(height)));
    const updatePanelHeight = (clientY: number) => {
      onPanelHeightChange(clampPanelHeight(originHeight - (clientY - originClientY)));
    };
    const handleMove = (dragEvent: PointerEvent | globalThis.MouseEvent) => {
      updatePanelHeight(dragEvent.clientY);
    };
    const handleUp = (dragEvent: PointerEvent | globalThis.MouseEvent) => {
      updatePanelHeight(dragEvent.clientY);
      window.removeEventListener(moveEventName, handleMove as EventListener);
      window.removeEventListener(upEventName, handleUp as EventListener);
    };

    window.addEventListener(moveEventName, handleMove as EventListener);
    window.addEventListener(upEventName, handleUp as EventListener);
  }, [maxPanelHeight, minPanelHeight, onPanelHeightChange, panelHeight]);
  const handleBeginTimelinePanelPointerResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    panelResizePointerHandledRef.current = true;
    window.setTimeout(() => {
      panelResizePointerHandledRef.current = false;
    }, 0);
    event.currentTarget.setPointerCapture(event.pointerId);
    beginTimelinePanelResize(event.clientY, 'pointermove', 'pointerup');
  }, [beginTimelinePanelResize]);
  const handleBeginTimelinePanelMouseResize = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    if (panelResizePointerHandledRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    beginTimelinePanelResize(event.clientY, 'mousemove', 'mouseup');
  }, [beginTimelinePanelResize]);
  const secondsFromTimelineElement = useCallback((clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    const rawSeconds = (clientX - rect.left) / pixelsPerSecond;
    return Math.max(0, Math.min(totalDuration, snapTimelineSeconds(rawSeconds, frameStepSec)));
  }, [frameStepSec, pixelsPerSecond, totalDuration]);
  const updateExternalDropPreview = useCallback((event: ReactDragEvent<HTMLDivElement>, track: WorkspaceTimelineTrack) => {
    const payload = parseTimelineNodeDragPayload(event.dataTransfer);
    if ((!payload?.nodeId && !payload?.assetId) || !payload.mediaKind) return null;
    const rawStartSec = secondsFromTimelineElement(event.clientX, event.currentTarget);
    const startSec = !isInsertIntoClipEnabled
      ? insertionBoundaryForTimelineTrack(items, track, rawStartSec)
      : rawStartSec;
    const isCompatibleDrop = isExternalTimelineDropCompatible(payload.mediaKind, track) && !lockedTrackSet.has(track);
    const durationSec = durationForTimelineDropPayload(payload);
    const preview: TimelineExternalDropPreview = {
      durationSec,
      isValid: isCompatibleDrop,
      mediaKind: payload.mediaKind,
      previewUrl: payload.previewUrl,
      startSec,
      title: titleForTimelineDropPayload(payload),
      trackId: track,
    };
    event.preventDefault();
    event.dataTransfer.dropEffect = preview.isValid ? 'copy' : 'none';
    setExternalDropPreview(preview);
    return { payload, preview };
  }, [isInsertIntoClipEnabled, items, lockedTrackSet, secondsFromTimelineElement]);
  const handleExternalDropOver = useCallback((event: ReactDragEvent<HTMLDivElement>, track: WorkspaceTimelineTrack) => {
    updateExternalDropPreview(event, track);
  }, [updateExternalDropPreview]);
  const handleExternalDrop = useCallback((event: ReactDragEvent<HTMLDivElement>, track: WorkspaceTimelineTrack) => {
    const result = updateExternalDropPreview(event, track);
    setExternalDropPreview(null);
    if (!result?.payload.nodeId && !result?.payload.assetId) return;
    if (lockedTrackSet.has(track)) {
      onInvalidNodeDropToTimeline('locked-track');
      return;
    }
    if (!result.preview.isValid) {
      onInvalidNodeDropToTimeline('incompatible');
      return;
    }
    onPlaybackChange(false);
    if (result.payload.nodeId) {
      onNodeDropToTimeline(result.payload.nodeId, result.preview.startSec, result.preview.trackId);
    } else if (result.payload.assetId) {
      onProjectAssetDropToTimeline(result.payload.assetId, result.preview.startSec, result.preview.trackId);
    }
  }, [lockedTrackSet, onInvalidNodeDropToTimeline, onNodeDropToTimeline, onPlaybackChange, onProjectAssetDropToTimeline, updateExternalDropPreview]);
  const handleBeginPlayheadDrag = useCallback((event: ReactPointerEvent<HTMLElement>, timelineElement: HTMLElement | null) => {
    if (!timelineElement) return;
    event.preventDefault();
    event.stopPropagation();
    onPlaybackChange(false);
    event.currentTarget.setPointerCapture(event.pointerId);

    const flushPendingPlayhead = () => {
      if (playheadDragFrameRef.current !== null) {
        window.cancelAnimationFrame(playheadDragFrameRef.current);
        playheadDragFrameRef.current = null;
      }
      const nextPlayheadSec = pendingPlayheadDragSecRef.current;
      pendingPlayheadDragSecRef.current = null;
      if (nextPlayheadSec === null) return;
      markTimelinePerformance('playhead-commit');
      onPlayheadChange(nextPlayheadSec);
    };
    const schedulePlayhead = (clientX: number) => {
      pendingPlayheadDragSecRef.current = secondsFromTimelineElement(clientX, timelineElement);
      if (playheadDragFrameRef.current !== null) return;
      playheadDragFrameRef.current = window.requestAnimationFrame(() => {
        playheadDragFrameRef.current = null;
        const nextPlayheadSec = pendingPlayheadDragSecRef.current;
        pendingPlayheadDragSecRef.current = null;
        if (nextPlayheadSec === null) return;
        markTimelinePerformance('playhead-frame');
        onPlayheadChange(nextPlayheadSec);
      });
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      schedulePlayhead(pointerEvent.clientX);
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      schedulePlayhead(pointerEvent.clientX);
      flushPendingPlayhead();
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    schedulePlayhead(event.clientX);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [onPlaybackChange, onPlayheadChange, secondsFromTimelineElement]);
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
  const setPreviewInteraction = useCallback((nextInteraction: TimelineInteractionState | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  }, []);
  const trackAtClientY = useCallback((clientY: number, fallbackTrack: WorkspaceTimelineTrack): WorkspaceTimelineTrack => {
    const targetKind = isVideoTimelineTrack(fallbackTrack) ? 'video' : isAudioTimelineTrack(fallbackTrack) ? 'audio' : null;
    if (!targetKind) return fallbackTrack;
    const compatibleTrackIds = new Set(timelineTracks.filter((track) => track.kind === targetKind && !lockedTrackSet.has(track.id)).map((track) => track.id));
    const trackElements = Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-track]'))
      .map((element) => {
        const track = element.dataset.timelineTrack as WorkspaceTimelineTrack | undefined;
        const rect = element.getBoundingClientRect();
        return { element, rect, track };
      })
      .filter((entry): entry is { element: HTMLElement; rect: DOMRect; track: WorkspaceTimelineTrack } =>
        Boolean(entry.track && compatibleTrackIds.has(entry.track))
      );
    const containingTrack = trackElements.find((entry) => clientY >= entry.rect.top && clientY <= entry.rect.bottom);
    if (containingTrack) return containingTrack.track;
    const nearestTrack = trackElements
      .map((entry) => ({ ...entry, distance: Math.abs(clientY - (entry.rect.top + entry.rect.height / 2)) }))
      .sort((left, right) => left.distance - right.distance)[0];
    return nearestTrack?.track ?? fallbackTrack;
  }, [lockedTrackSet, timelineTracks]);
  const handleBeginInteraction = useCallback((event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => {
    event.preventDefault();
    event.stopPropagation();
    markTimelinePerformance('drag-start');
    if ('pointerId' in event) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    const itemSelectionKey = selectionKeyForTimelineItem(item);
    const isSelectedForDrag = selectedKeys.has(itemSelectionKey);
    const dragSelectedItemIds = kind === 'move' && isSelectedForDrag && selectedItemIds.length > 1 ? selectedItemIds : [item.id];
    const dragSelectedKeys = Array.from(selectionKeysForTimelineItemIds(items, dragSelectedItemIds));
    const touchesLockedTrack = items.some((candidate) => dragSelectedKeys.includes(selectionKeyForTimelineItem(candidate)) && lockedTrackSet.has(candidate.track));
    if (touchesLockedTrack) return;
    const originLayoutsById = items.reduce<Record<string, TimelineClipLayout>>((layouts, candidate) => {
      if (!dragSelectedKeys.includes(selectionKeyForTimelineItem(candidate))) return layouts;
      layouts[candidate.id] = layoutForTimelineItem(candidate, interactionRef.current);
      return layouts;
    }, {});
    const currentLayout = layoutForTimelineItem(item, interactionRef.current);
    const initialInteraction: TimelineInteractionState = {
      itemId: item.id,
      linkedGroupId: item.linkedGroupId ?? null,
      selectedItemIds: dragSelectedItemIds,
      selectedKeys: dragSelectedKeys,
      originLayoutsById,
      kind,
      originClientX: event.clientX,
      originTrack: item.track,
      originStartSec: currentLayout.startSec,
      originDurationSec: currentLayout.durationSec,
      originSourceStartSec: sourceStartForTimelineItem(item),
      originSourceDurationSec: sourceDurationForTimelineItem(item),
      snapStepSec: frameStepSec,
      previewTrack: item.track,
      previewStartSec: currentLayout.startSec,
      previewDurationSec: currentLayout.durationSec,
      snapGuideSec: null,
    };
    setPreviewInteraction(initialInteraction);
    onSelectItem(item.id, kind === 'move' && isSelectedForDrag ? 'focus' : 'replace');

    const originClientY = event.clientY;
    let didDrag = false;
    const updateInteractionAtClientX = (clientX: number, clientY: number) => {
      const activeInteraction = interactionRef.current;
      if (!activeInteraction) return;
      if (Math.hypot(clientX - activeInteraction.originClientX, clientY - originClientY) > TIMELINE_CLIP_DRAG_THRESHOLD_PIXELS) {
        didDrag = true;
      }
      const interactionWithTrack = activeInteraction.kind === 'move'
        ? { ...activeInteraction, previewTrack: trackAtClientY(clientY, activeInteraction.originTrack) }
        : activeInteraction;
      markTimelinePerformance('drag-frame');
      setPreviewInteraction(nextTimelineInteractionState(interactionWithTrack, clientX, items, clampedPlayheadSec, snapEnabled, pixelsPerSecond));
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      updateInteractionAtClientX(pointerEvent.clientX, pointerEvent.clientY);
    };
    const handleMouseMove = (mouseEvent: globalThis.MouseEvent) => {
      updateInteractionAtClientX(mouseEvent.clientX, mouseEvent.clientY);
    };
    const completeInteraction = (clientX: number, clientY: number) => {
      updateInteractionAtClientX(clientX, clientY);
      const completedInteraction = interactionRef.current;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (!completedInteraction) {
        setPreviewInteraction(null);
        return;
      }
      if (!didDrag) {
        setPreviewInteraction(null);
        return;
      }
      if (completedInteraction.kind === 'move') {
        onPlaybackChange(false);
        onPositionItem(
          completedInteraction.itemId,
          completedInteraction.previewStartSec,
          completedInteraction.previewTrack,
          completedInteraction.selectedItemIds
        );
        onPlayheadChange(completedInteraction.previewStartSec);
        setPreviewInteraction(null);
        markTimelinePerformance('drag-commit');
        return;
      }
      onPlaybackChange(false);
      onResizeItem(
        completedInteraction.itemId,
        completedInteraction.kind === 'resize-start' ? 'start' : 'end',
        completedInteraction.previewStartSec,
        completedInteraction.previewDurationSec,
        'trim'
      );
      onPlayheadChange(completedInteraction.previewStartSec);
      setPreviewInteraction(null);
      markTimelinePerformance('drag-commit');
    };
    const handlePointerUp = (pointerEvent: PointerEvent) => {
      completeInteraction(pointerEvent.clientX, pointerEvent.clientY);
    };
    const handleMouseUp = (mouseEvent: globalThis.MouseEvent) => {
      completeInteraction(mouseEvent.clientX, mouseEvent.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [
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
    setPreviewInteraction,
    snapEnabled,
    trackAtClientY,
  ]);
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

  useEffect(() => {
    updateVisibleTimelineRange();
  }, [updateVisibleTimelineRange]);

  useEffect(() => () => {
    if (visibleRangeFrameRef.current !== null) {
      window.cancelAnimationFrame(visibleRangeFrameRef.current);
      visibleRangeFrameRef.current = null;
    }
    if (playheadDragFrameRef.current !== null) {
      window.cancelAnimationFrame(playheadDragFrameRef.current);
      playheadDragFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
        if (isTimelineShortcutTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) {
          if (canRedo) onRedo();
        } else if (canUndo) {
          onUndo();
        }
        return;
      }
      if (!isShortcutActive) return;
      if (isTimelineShortcutTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && (event.code === 'Equal' || event.code === 'NumpadAdd')) {
        event.preventDefault();
        setTimelineZoom(pixelsPerSecond + 8);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && (event.code === 'Minus' || event.code === 'NumpadSubtract')) {
        event.preventDefault();
        setTimelineZoom(pixelsPerSecond - 8);
        return;
      }
      if (event.code === 'Space' || event.key === ' ' || event.key === 'Space' || event.key === 'Spacebar') {
        event.preventDefault();
        onTogglePlayback();
        return;
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        seekBy(event.shiftKey ? -1 : -frameStepSec);
        return;
      }
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        seekBy(event.shiftKey ? 1 : frameStepSec);
        return;
      }
      if (event.code === 'ArrowUp') {
        event.preventDefault();
        onGoToCut(-1);
        return;
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        onGoToCut(1);
        return;
      }
      if (event.code === 'KeyC') {
        event.preventDefault();
        setActiveTimelineTool((currentTool) => (currentTool === 'blade' ? 'select' : 'blade'));
        return;
      }
      if (event.code === 'KeyV') {
        event.preventDefault();
        setActiveTimelineTool('select');
        return;
      }
      if (event.code === 'KeyM') {
        event.preventDefault();
        setSnapEnabled((value) => !value);
        return;
      }
      if (event.code === 'KeyI') {
        event.preventDefault();
        onMarkIn();
        return;
      }
      if (event.code === 'KeyO') {
        event.preventDefault();
        onMarkOut();
        return;
      }
      if (event.code === 'Delete' || event.code === 'Backspace') {
        event.preventDefault();
        onDeleteItem(event.shiftKey);
        return;
      }
      if (event.code === 'KeyS' || ((event.metaKey || event.ctrlKey) && event.code === 'KeyB')) {
        event.preventDefault();
        handleCutSelectedAtPlayhead();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canRedo, canUndo, frameStepSec, handleCutSelectedAtPlayhead, isShortcutActive, onDeleteItem, onGoToCut, onMarkIn, onMarkOut, onRedo, onTogglePlayback, onUndo, pixelsPerSecond, seekBy, setTimelineZoom]);
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
  const handleClearExternalDropPreview = useCallback(() => {
    setExternalDropPreview(null);
  }, []);
  const handleTimelineItemInteracting = useCallback(
    (item: WorkspaceTimelineItem) => Boolean(interaction && interactionMatchesTimelineItem(interaction, item)),
    [interaction]
  );
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
        onSelectTool={() => setActiveTimelineTool('select')}
        onToggleBladeTool={() => setActiveTimelineTool((currentTool) => (currentTool === 'blade' ? 'select' : 'blade'))}
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
          onToggleSnap={() => setSnapEnabled((value) => !value)}
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
          isItemInteracting={handleTimelineItemInteracting}
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
