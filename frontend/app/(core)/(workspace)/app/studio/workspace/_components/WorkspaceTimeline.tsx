'use client';

/* eslint-disable @next/next/no-img-element */

import { Eye, EyeOff, Link2, Lock, Magnet, Play, Plus, SkipBack, SkipForward, SplitSquareHorizontal, Trash2, Unlink2, Unlock, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceTimelineAudioTrack, WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from '../_lib/workspace-types';
import {
  moveWorkspaceTimelineSelectionWithMode,
  type WorkspaceTimelineTrimEdge,
  type WorkspaceTimelineTrimMode,
} from '../_lib/workspace-timeline-editing';
import {
  isWorkspaceTimelineAudioTrack,
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineAudioTrackId,
  workspaceTimelineAudioTrackIndex,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from '../_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';
import { TimelineToolbar, type TimelineTool } from './timeline/TimelineToolbar';

const DEFAULT_TIMELINE_PIXELS_PER_SECOND = 34;
const MIN_TIMELINE_PIXELS_PER_SECOND = 18;
const MAX_TIMELINE_PIXELS_PER_SECOND = 92;
const MIN_TIMELINE_WIDTH = 760;
const MIN_CLIP_DURATION_SEC = 1;
const DEFAULT_TIMELINE_FPS = 24;
const DEFAULT_TIMELINE_FRAME_STEP_SECONDS = 1 / DEFAULT_TIMELINE_FPS;
const TIMELINE_SECOND_PRECISION = 1_000_000;
const TIMELINE_CLIP_DRAG_THRESHOLD_PIXELS = 0.5;
const SNAP_TARGET_THRESHOLD_PIXELS = 1;
const TIMELINE_NODE_DRAG_TYPE = 'application/x-maxvideoai-timeline-node';
const EXTERNAL_DROP_GHOST_FALLBACK_DURATION_SEC = 5;
const TIMELINE_PREVIEW_ID_SEED = 'preview';

type TimelineInteractionKind = 'move' | 'resize-start' | 'resize-end';

type TimelineInteractionState = {
  itemId: string;
  linkedGroupId: string | null;
  selectedItemIds: string[];
  selectedKeys: string[];
  originLayoutsById: Record<string, TimelineClipLayout>;
  kind: TimelineInteractionKind;
  originClientX: number;
  originTrack: WorkspaceTimelineTrack;
  originStartSec: number;
  originDurationSec: number;
  originSourceStartSec: number;
  originSourceDurationSec: number;
  snapStepSec: number;
  previewTrack: WorkspaceTimelineTrack;
  previewStartSec: number;
  previewDurationSec: number;
  snapGuideSec: number | null;
};

type TimelineClipLayout = {
  startSec: number;
  durationSec: number;
};

type TimelineSelectionMode = 'replace' | 'toggle' | 'focus';

type TimelineMarqueeState = {
  originClientX: number;
  originClientY: number;
  currentClientX: number;
  currentClientY: number;
  containerLeft: number;
  containerTop: number;
  itemRects: Array<{
    id: string;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>;
};

type TimelineContextMenuState = {
  canLink: boolean;
  canUnlink: boolean;
  itemIds: string[];
  selectedClipCount: number;
  x: number;
  y: number;
};

type TimelineTrackContextMenuState = {
  canAdd: boolean;
  canDelete: boolean;
  kind: 'video' | 'audio';
  label: string;
  trackId: WorkspaceTimelineTrack;
  x: number;
  y: number;
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

type SnapCandidate = {
  startSec: number;
  guideSec: number | null;
};

type TimelineTrackConstraint = {
  startSec: number;
  guideSec: number | null;
};

type TimelineTrackDefinition = {
  id: WorkspaceTimelineTrack;
  label: string;
  icon: React.ReactNode;
  kind: 'video' | 'audio';
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function frameStepSeconds(projectFps: number): number {
  return 1 / Math.max(1, projectFps || DEFAULT_TIMELINE_FPS);
}

function snapSeconds(seconds: number, snapStepSec = DEFAULT_TIMELINE_FRAME_STEP_SECONDS): number {
  const safeStepSec = snapStepSec > 0 ? snapStepSec : DEFAULT_TIMELINE_FRAME_STEP_SECONDS;
  return Math.round((Math.round(seconds / safeStepSec) * safeStepSec) * TIMELINE_SECOND_PRECISION) / TIMELINE_SECOND_PRECISION;
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
  return snapSeconds(requestedStartSec < midpointSec ? targetItem.startSec : targetItem.startSec + targetItem.durationSec);
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

function selectionKeyForTimelineItem(item: WorkspaceTimelineItem): string {
  return item.linkedGroupId ? `group:${item.linkedGroupId}` : `item:${item.id}`;
}

function selectionKeysForTimelineItemIds(items: WorkspaceTimelineItem[], itemIds: string[]): Set<string> {
  const keys = new Set<string>();
  itemIds.forEach((itemId) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (item) keys.add(selectionKeyForTimelineItem(item));
  });
  return keys;
}

function trackForTimelineItem(item: WorkspaceTimelineItem, interaction: TimelineInteractionState | null): WorkspaceTimelineTrack {
  if (!interaction || !interactionMatchesItem(interaction, item)) return item.track;
  if (interaction.selectedKeys.length > 1) return item.track;
  if (isVideoTimelineTrack(item.track) && !isVideoTimelineTrack(interaction.previewTrack)) return item.track;
  if (isAudioTimelineTrack(item.track) && !isAudioTimelineTrack(interaction.previewTrack)) return item.track;
  return interaction.previewTrack;
}

function timelineRulerStepFor(pixelsPerSecond: number): number {
  if (pixelsPerSecond >= 72) return 1;
  if (pixelsPerSecond >= 42) return 2;
  return 4;
}

function waveformBarsForItem(item: WorkspaceTimelineItem): number[] {
  const seed = Array.from(item.id).reduce((value, char, index) => value + char.charCodeAt(0) * (index + 1), 17);
  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin((seed + index * 13) * 0.42);
    const pulse = Math.cos((seed + index * 7) * 0.21);
    return Math.max(18, Math.round(38 + wave * 28 + pulse * 14));
  });
}

function isTimelineShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function interactionMatchesItem(interaction: TimelineInteractionState, item: WorkspaceTimelineItem): boolean {
  if (interaction.selectedKeys.length > 1) return interaction.selectedKeys.includes(selectionKeyForTimelineItem(item));
  if (interaction.linkedGroupId) return item.linkedGroupId === interaction.linkedGroupId;
  return item.id === interaction.itemId;
}

function layoutForItem(item: WorkspaceTimelineItem, interaction: TimelineInteractionState | null): TimelineClipLayout {
  if (!interaction || !interactionMatchesItem(interaction, item)) {
    return { startSec: item.startSec, durationSec: item.durationSec };
  }
  if (interaction.selectedKeys.length > 1) {
    const originLayout = interaction.originLayoutsById[item.id];
    const startDeltaSec = interaction.previewStartSec - interaction.originStartSec;
    return {
      startSec: Math.max(0, snapSeconds((originLayout?.startSec ?? item.startSec) + startDeltaSec, interaction.snapStepSec)),
      durationSec: originLayout?.durationSec ?? item.durationSec,
    };
  }
  return {
    startSec: interaction.previewStartSec,
    durationSec: interaction.previewDurationSec,
  };
}

function sourceDurationForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceStartSec = item.sourceStartSec ?? 0;
  return Math.max(MIN_CLIP_DURATION_SEC, item.sourceDurationSec ?? sourceStartSec + item.durationSec);
}

function sourceStartForTimelineItem(item: WorkspaceTimelineItem): number {
  const sourceDurationSec = sourceDurationForTimelineItem(item);
  return Math.max(0, Math.min(sourceDurationSec - MIN_CLIP_DURATION_SEC, item.sourceStartSec ?? 0));
}

function maxResizeDurationForInteraction(interaction: TimelineInteractionState, edge: WorkspaceTimelineTrimEdge): number {
  if (edge === 'start') return Math.max(MIN_CLIP_DURATION_SEC, interaction.originDurationSec + interaction.originSourceStartSec);
  return Math.max(MIN_CLIP_DURATION_SEC, interaction.originSourceDurationSec - interaction.originSourceStartSec);
}

function buildSnapTargets(items: WorkspaceTimelineItem[], interaction: TimelineInteractionState, playheadSec: number): number[] {
  const targets = new Set<number>([0, snapSeconds(playheadSec, interaction.snapStepSec)]);
  items.forEach((item) => {
    if (interactionMatchesItem(interaction, item)) return;
    targets.add(snapSeconds(item.startSec, interaction.snapStepSec));
    targets.add(snapSeconds(item.startSec + item.durationSec, interaction.snapStepSec));
  });
  return Array.from(targets).sort((left, right) => left - right);
}

function closestSnapCandidate(
  startSec: number,
  durationSec: number,
  snapTargets: number[],
  snapStepSec: number,
  snapThresholdSec: number
): SnapCandidate {
  let bestCandidate: SnapCandidate = { startSec, guideSec: null };
  let bestDistance = snapThresholdSec;

  snapTargets.forEach((targetSec) => {
    const startDistance = Math.abs(startSec - targetSec);
    if (startDistance <= bestDistance) {
      bestDistance = startDistance;
      bestCandidate = { startSec: targetSec, guideSec: targetSec };
    }

    const endDistance = Math.abs(startSec + durationSec - targetSec);
    if (endDistance <= bestDistance) {
      bestDistance = endDistance;
      bestCandidate = { startSec: targetSec - durationSec, guideSec: targetSec };
    }
  });

  return {
    startSec: Math.max(0, snapSeconds(bestCandidate.startSec, snapStepSec)),
    guideSec: bestCandidate.guideSec,
  };
}

function primaryItemForInteraction(items: WorkspaceTimelineItem[], interaction: TimelineInteractionState): WorkspaceTimelineItem | null {
  const activeItem = items.find((item) => item.id === interaction.itemId);
  if (!activeItem?.linkedGroupId) return activeItem ?? null;
  return items.find((item) => item.linkedGroupId === activeItem.linkedGroupId && isVideoTimelineTrack(item.track)) ?? activeItem;
}

function sameTrackBlockers(items: WorkspaceTimelineItem[], interaction: TimelineInteractionState): WorkspaceTimelineItem[] {
  const primaryItem = primaryItemForInteraction(items, interaction);
  if (!primaryItem) return [];
  const blockerTrack = interaction.kind === 'move' && isVideoTimelineTrack(primaryItem.track) && isVideoTimelineTrack(interaction.previewTrack)
    ? interaction.previewTrack
    : primaryItem.track;
  return items
    .filter((item) => item.track === blockerTrack && !interactionMatchesItem(interaction, item))
    .sort((left, right) => left.startSec - right.startSec);
}

function constrainResizeStartToTrackGaps(startSec: number, items: WorkspaceTimelineItem[], interaction: TimelineInteractionState): TimelineTrackConstraint {
  const previousEndSec = sameTrackBlockers(items, interaction)
    .filter((item) => item.startSec + item.durationSec <= interaction.originStartSec)
    .reduce((maxEndSec, item) => Math.max(maxEndSec, item.startSec + item.durationSec), 0);
  const constrainedStartSec = Math.max(previousEndSec, startSec);
  return {
    startSec: snapSeconds(constrainedStartSec, interaction.snapStepSec),
    guideSec: constrainedStartSec !== startSec ? previousEndSec : null,
  };
}

function constrainResizeEndToTrackGaps(endSec: number, items: WorkspaceTimelineItem[], interaction: TimelineInteractionState): TimelineTrackConstraint {
  const nextStartSec = sameTrackBlockers(items, interaction)
    .filter((item) => item.startSec >= interaction.originStartSec + interaction.originDurationSec)
    .reduce((minStartSec, item) => Math.min(minStartSec, item.startSec), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(nextStartSec) || endSec <= nextStartSec) {
    return { startSec: snapSeconds(endSec, interaction.snapStepSec), guideSec: null };
  }
  return {
    startSec: snapSeconds(nextStartSec, interaction.snapStepSec),
    guideSec: nextStartSec,
  };
}

function nextInteractionState(
  interaction: TimelineInteractionState,
  clientX: number,
  items: WorkspaceTimelineItem[],
  playheadSec: number,
  snapEnabled: boolean,
  pixelsPerSecond: number
): TimelineInteractionState {
  const deltaSec = snapSeconds((clientX - interaction.originClientX) / pixelsPerSecond, interaction.snapStepSec);
  const snapTargets = snapEnabled ? buildSnapTargets(items, interaction, playheadSec) : [];
  const snapThresholdSec = SNAP_TARGET_THRESHOLD_PIXELS / pixelsPerSecond;

  if (interaction.kind === 'move') {
    const rawStartSec = Math.max(0, snapSeconds(interaction.originStartSec + deltaSec, interaction.snapStepSec));
    const snapCandidate = snapEnabled
      ? closestSnapCandidate(rawStartSec, interaction.originDurationSec, snapTargets, interaction.snapStepSec, snapThresholdSec)
      : { startSec: rawStartSec, guideSec: null };
    const trackConstraint = snapCandidate;
    return {
      ...interaction,
      previewStartSec: trackConstraint.startSec,
      previewDurationSec: interaction.originDurationSec,
      snapGuideSec: trackConstraint.guideSec ?? snapCandidate.guideSec,
    };
  }

  if (interaction.kind === 'resize-start') {
    const originEndSec = interaction.originStartSec + interaction.originDurationSec;
    const maxDurationSec = maxResizeDurationForInteraction(interaction, 'start');
    const minStartSec = Math.max(0, snapSeconds(originEndSec - maxDurationSec, interaction.snapStepSec));
    const maxStartSec = originEndSec - MIN_CLIP_DURATION_SEC;
    const rawStartSec = Math.max(minStartSec, Math.min(maxStartSec, snapSeconds(interaction.originStartSec + deltaSec, interaction.snapStepSec)));
    const snapCandidate = snapEnabled
      ? closestSnapCandidate(rawStartSec, originEndSec - rawStartSec, snapTargets, interaction.snapStepSec, snapThresholdSec)
      : { startSec: rawStartSec, guideSec: null };
    const trackConstraint = constrainResizeStartToTrackGaps(snapCandidate.startSec, items, interaction);
    const nextStartSec = Math.max(minStartSec, Math.min(maxStartSec, trackConstraint.startSec));
    return {
      ...interaction,
      previewStartSec: nextStartSec,
      previewDurationSec: Math.min(
        maxDurationSec,
        Math.max(MIN_CLIP_DURATION_SEC, snapSeconds(originEndSec - nextStartSec, interaction.snapStepSec))
      ),
      snapGuideSec: trackConstraint.guideSec ?? snapCandidate.guideSec,
    };
  }

  const maxDurationSec = maxResizeDurationForInteraction(interaction, 'end');
  const rawDurationSec = Math.max(
    MIN_CLIP_DURATION_SEC,
    Math.min(maxDurationSec, snapSeconds(interaction.originDurationSec + deltaSec, interaction.snapStepSec))
  );
  const rawEndSec = interaction.originStartSec + rawDurationSec;
  const snapCandidate = snapEnabled
    ? closestSnapCandidate(rawEndSec, 0, snapTargets, interaction.snapStepSec, snapThresholdSec)
    : { startSec: rawEndSec, guideSec: null };
  const nextDurationSec = snapEnabled && snapCandidate.guideSec !== null
    ? Math.max(MIN_CLIP_DURATION_SEC, Math.min(maxDurationSec, snapSeconds(snapCandidate.startSec - interaction.originStartSec, interaction.snapStepSec)))
    : rawDurationSec;
  const trackConstraint = constrainResizeEndToTrackGaps(interaction.originStartSec + nextDurationSec, items, interaction);

  return {
    ...interaction,
    previewStartSec: interaction.originStartSec,
    previewDurationSec: Math.max(
      MIN_CLIP_DURATION_SEC,
      Math.min(maxDurationSec, snapSeconds(trackConstraint.startSec - interaction.originStartSec, interaction.snapStepSec))
    ),
    snapGuideSec: trackConstraint.guideSec ?? snapCandidate.guideSec,
  };
}

function marqueeRectForState(marquee: TimelineMarqueeState): CSSProperties {
  const left = Math.min(marquee.originClientX, marquee.currentClientX) - marquee.containerLeft;
  const top = Math.min(marquee.originClientY, marquee.currentClientY) - marquee.containerTop;
  const width = Math.abs(marquee.currentClientX - marquee.originClientX);
  const height = Math.abs(marquee.currentClientY - marquee.originClientY);
  return { left, top, width, height };
}

function selectedItemIdsForMarquee(marquee: TimelineMarqueeState): string[] {
  const left = Math.min(marquee.originClientX, marquee.currentClientX);
  const right = Math.max(marquee.originClientX, marquee.currentClientX);
  const top = Math.min(marquee.originClientY, marquee.currentClientY);
  const bottom = Math.max(marquee.originClientY, marquee.currentClientY);
  return marquee.itemRects
    .filter((itemRect) => itemRect.left < right && itemRect.right > left && itemRect.top < bottom && itemRect.bottom > top)
    .map((itemRect) => itemRect.id);
}

function previewPlayheadForInteraction(interaction: TimelineInteractionState): number {
  if (interaction.kind === 'resize-end') {
    return Math.max(interaction.previewStartSec, interaction.previewStartSec + interaction.previewDurationSec - interaction.snapStepSec);
  }
  return interaction.previewStartSec;
}

function TimelineClip({
  item,
  layout,
  index,
  isInteracting,
  isLocked,
  isSelected,
  activeTool,
  total,
  timelineWidth,
  pixelsPerSecond,
  snapStepSec,
  onBeginInteraction,
  onCut,
  onMove,
  onOpenContextMenu,
  onPlayheadChange,
  onSelect,
}: {
  item: WorkspaceTimelineItem;
  layout: TimelineClipLayout;
  index: number;
  isInteracting: boolean;
  isLocked: boolean;
  isSelected: boolean;
  activeTool: TimelineTool;
  total: number;
  timelineWidth: number;
  pixelsPerSecond: number;
  snapStepSec: number;
  onBeginInteraction: (event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => void;
  onCut: (itemId: string, splitOffsetSec?: number) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onOpenContextMenu: (event: MouseEvent<HTMLDivElement>, item: WorkspaceTimelineItem) => void;
  onPlayheadChange: (seconds: number) => void;
  onSelect: (itemId: string, mode?: TimelineSelectionMode) => void;
}) {
  const pointerEventHandledRef = useRef(false);
  const selectionHandledOnPointerRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const width = Math.max(24, layout.durationSec * pixelsPerSecond);
  const left = Math.max(0, layout.startSec * pixelsPerSecond);
  const isAudio = item.mediaKind === 'audio' || !isVideoTimelineTrack(item.track);
  const canCutClip = layout.durationSec >= MIN_CLIP_DURATION_SEC * 2;
  const canManipulateClip = !isLocked;
  const isCompactClip = width < 144;
  const showClipThumbnail = Boolean(item.thumbnailUrl && !isCompactClip);
  const showClipActions = !isCompactClip;
  const waveformBars = isAudio ? waveformBarsForItem(item) : [];
  const handleActionClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const handleButtonPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };
  const rememberPointerEvent = () => {
    pointerEventHandledRef.current = true;
    window.setTimeout(() => {
      pointerEventHandledRef.current = false;
    }, 0);
  };
  const handleClipInteractionStart = (event: ReactPointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.focus();
    suppressNextClickRef.current = true;
    selectionHandledOnPointerRef.current = false;
    if (activeTool === 'blade') {
      event.preventDefault();
      event.stopPropagation();
      if (!canCutClip || !canManipulateClip) return;
      const clipRect = event.currentTarget.getBoundingClientRect();
      const pointerOffsetSec = snapSeconds((event.clientX - clipRect.left) / pixelsPerSecond, snapStepSec);
      const splitOffsetSec = Math.max(
        MIN_CLIP_DURATION_SEC,
        Math.min(layout.durationSec - MIN_CLIP_DURATION_SEC, pointerOffsetSec)
      );
      if (splitOffsetSec <= 0 || splitOffsetSec >= layout.durationSec) return;
      onSelect(item.id);
      onPlayheadChange(layout.startSec + splitOffsetSec);
      onCut(item.id, splitOffsetSec);
      return;
    }
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      selectionHandledOnPointerRef.current = true;
      onSelect(item.id, 'toggle');
      return;
    }
    if (!canManipulateClip) {
      onSelect(item.id, 'replace');
      return;
    }
    if (activeTool !== 'select') {
      onSelect(item.id, 'replace');
      return;
    }
    onBeginInteraction(event, item, 'move');
  };
  const handleClipPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    rememberPointerEvent();
    handleClipInteractionStart(event);
  };
  const handleClipMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (pointerEventHandledRef.current) return;
    handleClipInteractionStart(event);
  };
  const beginPointerResize = (event: ReactPointerEvent<HTMLDivElement>, kind: TimelineInteractionKind) => {
    rememberPointerEvent();
    if (!canManipulateClip) return;
    onBeginInteraction(event, item, kind);
  };
  const beginMouseResize = (event: MouseEvent<HTMLDivElement>, kind: TimelineInteractionKind) => {
    if (pointerEventHandledRef.current) return;
    if (!canManipulateClip) return;
    onBeginInteraction(event, item, kind);
  };
  return (
    <div
      className={`${styles.timelineClip} ${isCompactClip ? styles.timelineClipCompact : ''} ${isAudio ? styles.timelineClipAudio : ''} ${isSelected ? styles.timelineClipSelected : ''} ${isInteracting ? styles.timelineClipInteracting : ''} ${activeTool === 'blade' && canCutClip ? styles.timelineClipCutMode : ''}`}
      style={{ width, left, maxWidth: timelineWidth - left } as CSSProperties}
      role="button"
      tabIndex={0}
      data-linked-group={item.linkedGroupId ?? undefined}
      data-timeline-locked={isLocked ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      data-timeline-duration={layout.durationSec}
      data-timeline-item={item.id}
      data-timeline-start={layout.startSec}
      data-timeline-track-id={item.track}
      onClick={(event) => {
        if (suppressNextClickRef.current) {
          const shouldToggleFromClick = (event.shiftKey || event.metaKey || event.ctrlKey) && !selectionHandledOnPointerRef.current;
          selectionHandledOnPointerRef.current = false;
          suppressNextClickRef.current = false;
          if (shouldToggleFromClick) onSelect(item.id, 'toggle');
          return;
        }
        onSelect(item.id, event.shiftKey || event.metaKey || event.ctrlKey ? 'toggle' : 'replace');
      }}
      onContextMenu={(event) => onOpenContextMenu(event, item)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item.id, event.shiftKey || event.metaKey || event.ctrlKey ? 'toggle' : 'replace');
        }
      }}
      onMouseDown={handleClipMouseDown}
      onPointerDown={handleClipPointerDown}
      title={isLocked ? 'Track locked' : activeTool === 'blade' ? 'Click to cut this clip' : activeTool === 'select' ? 'Drag to move this clip' : 'Use the trim handles for this tool'}
      aria-label={`${item.title} timeline clip`}
    >
      <div
        role="button"
        tabIndex={0}
        className={`${styles.trimHandle} ${styles.trimHandleStart}`}
        onMouseDown={(event) => beginMouseResize(event, 'resize-start')}
        onPointerDown={(event) => beginPointerResize(event, 'resize-start')}
        onClick={(event) => event.stopPropagation()}
        title="Trim clip start"
        aria-label="Trim clip start"
      />
      {showClipThumbnail ? <img src={item.thumbnailUrl ?? ''} alt="" /> : null}
      {isAudio ? (
        <div className={styles.timelineWaveform} aria-hidden="true">
          {waveformBars.map((height, index) => (
            <span key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : null}
      <div className={styles.timelineClipText}>
        <strong>{item.title}</strong>
        <span>
          {formatDuration(layout.durationSec)}
          {item.sourceStartSec ? ` · in ${formatDuration(item.sourceStartSec)}` : ''}
        </span>
      </div>
      {item.transitionOut?.type === 'crossfade' ? (
        <span className={styles.timelineTransitionBadge}>Xf {formatDuration(item.transitionOut.durationSec)}</span>
      ) : null}
      {showClipActions ? (
        <div className={styles.clipActions}>
          <button
            type="button"
            onPointerDown={handleButtonPointer}
            onClick={(event) => { handleActionClick(event); onMove(item.id, -1); }}
            disabled={isLocked || index === 0}
            title="Move clip left"
            aria-label="Move clip left"
          >
            <SkipBack size={12} />
          </button>
          <button
            type="button"
            onPointerDown={handleButtonPointer}
            onClick={(event) => { handleActionClick(event); onMove(item.id, 1); }}
            disabled={isLocked || index === total - 1}
            title="Move clip right"
            aria-label="Move clip right"
          >
            <SkipForward size={12} />
          </button>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        className={`${styles.trimHandle} ${styles.trimHandleEnd}`}
        onMouseDown={(event) => beginMouseResize(event, 'resize-end')}
        onPointerDown={(event) => beginPointerResize(event, 'resize-end')}
        onClick={(event) => event.stopPropagation()}
        title="Trim clip end"
        aria-label="Trim clip end"
      />
    </div>
  );
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
  const timelinePanelRef = useRef<HTMLElement | null>(null);
  const panelResizePointerHandledRef = useRef(false);
  const interactionRef = useRef<TimelineInteractionState | null>(null);
  const suppressNextSurfaceClickRef = useRef(false);
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
  const selectedLayout = selectedItem ? layoutForItem(selectedItem, interaction) : null;
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
    return Math.max(0, Math.min(totalDuration, snapSeconds(rawSeconds, frameStepSec)));
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

    const updatePlayhead = (clientX: number) => {
      onPlayheadChange(secondsFromTimelineElement(clientX, timelineElement));
    };
    const handlePointerMove = (pointerEvent: PointerEvent) => {
      updatePlayhead(pointerEvent.clientX);
    };
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    updatePlayhead(event.clientX);
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
  const setPreviewInteraction = (nextInteraction: TimelineInteractionState | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  };
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
  const handleBeginInteraction = (event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => {
    event.preventDefault();
    event.stopPropagation();
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
      layouts[candidate.id] = layoutForItem(candidate, interactionRef.current);
      return layouts;
    }, {});
    const currentLayout = layoutForItem(item, interactionRef.current);
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
      setPreviewInteraction(nextInteractionState(interactionWithTrack, clientX, items, clampedPlayheadSec, snapEnabled, pixelsPerSecond));
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
  };
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
        layout: layoutForItem(item, interaction),
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
            const layout = layoutForItem(item, interaction);
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
        onSelectTool={() => setActiveTimelineTool('select')}
        onToggleBladeTool={() => setActiveTimelineTool((currentTool) => (currentTool === 'blade' ? 'select' : 'blade'))}
        onUndo={onUndo}
        onZoomChange={setTimelineZoom}
        pixelsPerSecond={pixelsPerSecond}
        playheadSec={clampedPlayheadSec}
      />
      <div className={styles.timelineViewport}>
        <div className={styles.timelineRuler} data-timeline-ruler="true">
          <div className={styles.timelineRulerLabel}>
            <div className={styles.timelineRulerToolSlot} data-timeline-ruler-tool-slot="true">
              <button
                type="button"
                className={`${styles.timelineRulerToolButton} ${styles.timelineToolButton} ${snapEnabled ? styles.timelineToolButtonActive : ''}`}
                data-tooltip="Snapping: clips, playhead, zero (M)"
                data-timeline-control="true"
                title="Snapping to clip edges, playhead, and zero (M)"
                onClick={() => setSnapEnabled((value) => !value)}
                aria-label="Toggle snapping"
                aria-pressed={snapEnabled}
              >
                <Magnet size={15} />
              </button>
              <button
                type="button"
                className={`${styles.timelineRulerToolButton} ${styles.timelineToolButton} ${isInsertIntoClipEnabled ? styles.timelineToolButtonActive : ''}`}
                data-tooltip="Splice insert inside clips"
                data-timeline-control="true"
                title="Allow insert drags to split the clip under the drop point"
                aria-label="Toggle insert into clip"
                aria-pressed={isInsertIntoClipEnabled}
                onClick={() => onInsertIntoClipChange(!isInsertIntoClipEnabled)}
              >
                <SplitSquareHorizontal size={15} />
              </button>
            </div>
          </div>
          <div className={styles.timelineRulerLane}>
            <div
              className={styles.timelineRulerInner}
              style={{ width: timelineWidth }}
              onClick={handleTimelineSurfaceClick}
              onPointerDown={handleBeginTimelineSurfacePointerDown}
              title="Drag to move the timeline playhead"
            >
              {hasValidInOutRange ? (
                <span
                  className={styles.timelineInOutRange}
                  data-timeline-in-out-range="true"
                  style={{
                    left: safeInPointSec * pixelsPerSecond,
                    width: Math.max(1, (safeOutPointSec - safeInPointSec) * pixelsPerSecond),
                  }}
                  aria-hidden="true"
                />
              ) : null}
              {safeInPointSec !== null ? (
                <span
                  className={`${styles.timelineInOutMarker} ${styles.timelineInMarker}`}
                  data-timeline-in-marker="true"
                  style={{ left: safeInPointSec * pixelsPerSecond }}
                  aria-hidden="true"
                >
                  I
                </span>
              ) : null}
              {safeOutPointSec !== null ? (
                <span
                  className={`${styles.timelineInOutMarker} ${styles.timelineOutMarker}`}
                  data-timeline-out-marker="true"
                  style={{ left: safeOutPointSec * pixelsPerSecond }}
                  aria-hidden="true"
                >
                  O
                </span>
              ) : null}
              {Array.from({ length: Math.ceil(totalDuration / rulerTickSec) + 1 }, (_, index) => (
                <span key={index} style={{ left: index * rulerTickSec * pixelsPerSecond }}>
                  {formatWorkspaceTimecode(index * rulerTickSec, projectFps)}
                </span>
              ))}
              <button
                type="button"
                className={`${styles.timelinePlayhead} ${styles.timelineRulerPlayhead}`}
                style={{ left: clampedPlayheadSec * pixelsPerSecond }}
                onPointerDown={(event) => handleBeginPlayheadDrag(event, event.currentTarget.parentElement)}
                data-playhead-handle="true"
                data-timeline-control="true"
                title="Drag timeline playhead"
                aria-label="Drag timeline playhead"
              />
              {interaction?.snapGuideSec !== null && interaction?.snapGuideSec !== undefined ? (
                <span
                  className={styles.timelineSnapGuide}
                  style={{ left: interaction.snapGuideSec * pixelsPerSecond }}
                  aria-hidden="true"
                />
              ) : null}
              <input
                className={styles.timelineScrubber}
                type="range"
                min={0}
                max={totalDuration}
                step={frameStepSec}
                value={clampedPlayheadSec}
                onChange={handleScrub}
                onPointerDown={(event) => handleBeginPlayheadDrag(event, event.currentTarget.parentElement)}
                data-timeline-control="true"
                aria-label="Timeline scrubber"
                aria-valuetext={formatWorkspaceTimecode(clampedPlayheadSec, projectFps)}
              />
            </div>
          </div>
        </div>
        <div className={styles.timelineTracks}>
          {timelineTracks.map((track) => {
            const audioTrackId = isAudioTimelineTrack(track.id) ? track.id : null;
            const videoTrackId = isVideoTimelineTrack(track.id) ? track.id : null;
            const isAudioTrack = track.kind === 'audio' && audioTrackId !== null;
            const isVideoTrack = track.kind === 'video' && videoTrackId !== null;
            const isTrackMuted = audioTrackId !== null && mutedAudioTrackSet.has(audioTrackId);
            const isTrackHidden = videoTrackId !== null && hiddenVideoTrackSet.has(videoTrackId);
            const isTrackLocked = lockedTrackSet.has(track.id);
            const trackItems = previewItems
              .filter(({ trackId }) => trackId === track.id)
              .sort((left, right) => left.layout.startSec - right.layout.startSec);
            return (
              <div
                key={track.id}
                className={`${styles.timelineTrack} ${isTrackHidden ? styles.timelineTrackHidden : ''} ${isTrackMuted ? styles.timelineTrackMuted : ''} ${isTrackLocked ? styles.timelineTrackLocked : ''}`}
              >
                <div
                  className={`${styles.trackLabel} ${isVideoTrack ? styles.trackLabelVideo : ''} ${isAudioTrack ? styles.trackLabelAudio : ''}`}
                  data-timeline-track-label={track.id}
                  data-timeline-track-hidden={isTrackHidden ? 'true' : 'false'}
                  data-timeline-track-locked={isTrackLocked ? 'true' : 'false'}
                  data-timeline-track-muted={isTrackMuted ? 'true' : 'false'}
                  onContextMenu={(event) => handleOpenTrackContextMenu(event, track)}
                  title="Right-click for track actions"
                >
                  <div className={styles.trackLabelMain}>
                    {track.icon}
                    <span>{track.label}</span>
                  </div>
                  <div className={`${styles.trackLabelControls} ${isAudioTrack ? styles.trackLabelControlsAudio : ''}`} data-timeline-control="true">
                    {track.kind === 'video' && track.id === highestVideoTrackId ? (
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
                    {track.kind === 'audio' && track.id === lowestAudioTrackId ? (
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
                    onDragLeave={() => setExternalDropPreview(null)}
                    onDragOver={(event) => handleExternalDropOver(event, track.id)}
                    onDrop={(event) => handleExternalDrop(event, track.id)}
                    onClick={handleTimelineSurfaceClick}
                    onPointerDown={handleBeginTimelineSurfacePointerDown}
                    title="Click empty timeline space to move the playhead, or drag to select clips"
                  >
                    <button
                      type="button"
                      className={styles.timelinePlayhead}
                      style={{ left: clampedPlayheadSec * pixelsPerSecond }}
                      onPointerDown={(event) => handleBeginPlayheadDrag(event, event.currentTarget.parentElement)}
                      data-playhead-handle="true"
                      data-timeline-control="true"
                      title="Drag timeline playhead"
                      aria-label={`Drag timeline playhead on ${track.label} track`}
                    />
                    {interaction?.snapGuideSec !== null && interaction?.snapGuideSec !== undefined ? (
                      <span
                        className={styles.timelineSnapGuide}
                        style={{ left: interaction.snapGuideSec * pixelsPerSecond }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {externalDropPreview?.trackId === track.id ? (
                      <>
                        <span
                          className={`${styles.timelineExternalDropGuide} ${externalDropPreview.isValid ? '' : styles.timelineExternalDropInvalid}`}
                          style={{ left: externalDropPreview.startSec * pixelsPerSecond }}
                          aria-hidden="true"
                        />
                        <span
                          className={[
                            styles.timelineExternalDropGhost,
                            externalDropPreview.mediaKind === 'audio' ? styles.timelineExternalDropGhostAudio : '',
                            externalDropPreview.mediaKind === 'image' ? styles.timelineExternalDropGhostImage : '',
                            externalDropPreview.previewUrl && externalDropPreview.mediaKind !== 'audio' ? styles.timelineExternalDropGhostWithPreview : '',
                            externalDropPreview.isValid ? '' : styles.timelineExternalDropInvalid,
                          ].filter(Boolean).join(' ')}
                          data-timeline-external-drop-ghost="true"
                          data-timeline-external-drop-duration={externalDropPreview.durationSec}
                          data-timeline-external-drop-kind={externalDropPreview.mediaKind}
                          style={{
                            left: externalDropPreview.startSec * pixelsPerSecond,
                            width: Math.max(36, externalDropPreview.durationSec * pixelsPerSecond),
                          }}
                          aria-hidden="true"
                        >
                          {externalDropPreview.previewUrl && externalDropPreview.mediaKind !== 'audio' ? (
                            <span
                              className={styles.timelineExternalDropGhostThumb}
                              style={{ backgroundImage: `url(${externalDropPreview.previewUrl})` }}
                            />
                          ) : null}
                          <span className={styles.timelineExternalDropGhostTitle}>
                            {externalDropPreview.isValid ? externalDropPreview.title : 'Invalid drop'}
                          </span>
                          <span className={styles.timelineExternalDropGhostDuration}>
                            {formatDuration(externalDropPreview.durationSec)}
                          </span>
                        </span>
                      </>
                    ) : null}
                    {trackItems.length ? (
                      trackItems.map(({ item, layout }, index) => (
                        <TimelineClip
                          key={item.id}
                          item={item}
                          layout={layout}
                          index={index}
                          isInteracting={Boolean(interaction && interactionMatchesItem(interaction, item))}
                          isLocked={lockedTrackSet.has(item.track)}
                          isSelected={selectedKeys.has(selectionKeyForTimelineItem(item))}
                          activeTool={activeTimelineTool}
                          total={trackItems.length}
                          timelineWidth={timelineWidth}
                          pixelsPerSecond={pixelsPerSecond}
                          snapStepSec={frameStepSec}
                          onBeginInteraction={handleBeginInteraction}
                          onCut={onCutItem}
                          onMove={onMoveItem}
                          onOpenContextMenu={handleOpenClipContextMenu}
                          onPlayheadChange={onPlayheadChange}
                          onSelect={onSelectItem}
                        />
                      ))
                    ) : (
                      <span className={styles.trackEmpty}>Drop generated outputs here</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {marquee ? <span className={styles.timelineMarquee} style={marqueeRectForState(marquee)} aria-hidden="true" /> : null}
      </div>
      {contextMenu ? (
        <div
          className={styles.timelineContextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          data-timeline-control="true"
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span>{contextMenu.selectedClipCount} clip{contextMenu.selectedClipCount > 1 ? 's' : ''} selected</span>
          <button
            type="button"
            role="menuitem"
            disabled={!contextMenu.canUnlink}
            onClick={() => handleContextMenuAction('unlink')}
          >
            <Unlink2 size={14} />
            Unlink selected clips
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!contextMenu.canLink}
            onClick={() => handleContextMenuAction('link')}
          >
            <Link2 size={14} />
            Link selected clips
          </button>
        </div>
      ) : null}
      {trackContextMenu ? (
        <div
          className={styles.timelineContextMenu}
          style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
          role="menu"
          data-timeline-control="true"
          onContextMenu={(event) => event.preventDefault()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span>{trackContextMenu.label} track</span>
          <button
            type="button"
            role="menuitem"
            disabled={!trackContextMenu.canAdd}
            onClick={() => handleTrackContextMenuAction('add')}
          >
            <Plus size={14} />
            Add {trackContextMenu.kind} track
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!trackContextMenu.canDelete}
            onClick={() => handleTrackContextMenuAction('delete')}
          >
            <Trash2 size={14} />
            Delete {trackContextMenu.kind} track
          </button>
        </div>
      ) : null}
    </section>
  );
}
