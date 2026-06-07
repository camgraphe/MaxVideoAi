'use client';

/* eslint-disable @next/next/no-img-element */

import { Lock, Magnet, MousePointer2, Music2, Pause, Play, Plus, Redo2, Scissors, SkipBack, SkipForward, Trash2, Undo2, Volume2, WandSparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import styles from '../maxvideoai-editor.module.css';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack, WorkspaceTimelineVideoTrack } from '../_lib/workspace-types';
import type { WorkspaceTimelineInsertMode, WorkspaceTimelineTrimEdge, WorkspaceTimelineTrimMode } from '../_lib/workspace-timeline-editing';
import {
  isWorkspaceTimelineVideoTrack,
  workspaceTimelineVideoTrackId,
  workspaceTimelineVideoTrackIndex,
} from '../_lib/workspace-timeline-tracks';
import { formatWorkspaceTimecode } from '../_lib/workspace-timecode';

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
const AUDIO_TRACKS: Array<{ id: WorkspaceTimelineTrack; label: string; icon: React.ReactNode }> = [
  { id: 'linked-audio', label: 'Linked audio', icon: <Volume2 size={14} /> },
  { id: 'music', label: 'Music', icon: <Music2 size={14} /> },
  { id: 'voiceover', label: 'Voice Over', icon: <Volume2 size={14} /> },
  { id: 'sfx', label: 'SFX', icon: <WandSparkles size={14} /> },
];

type TimelineInteractionKind = 'move' | 'resize-start' | 'resize-end';
type TimelineTool = 'select' | 'cut';

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

function timelineVideoTrackId(index: number): WorkspaceTimelineVideoTrack {
  return workspaceTimelineVideoTrackId(index);
}

function timelineVideoTrackIndex(track: WorkspaceTimelineTrack): number {
  return workspaceTimelineVideoTrackIndex(track);
}

function buildTimelineTracks(videoTrackCount: number, items: WorkspaceTimelineItem[]): TimelineTrackDefinition[] {
  const requiredVideoTrackCount = Math.max(1, videoTrackCount, ...items.map((item) => timelineVideoTrackIndex(item.track)));
  const videoTracks = Array.from({ length: requiredVideoTrackCount }, (_, index): TimelineTrackDefinition => ({
    id: timelineVideoTrackId(index + 1),
    label: `V${index + 1}`,
    icon: <Play size={14} />,
    kind: 'video',
  }));
  const displayedVideoTracks = [...videoTracks].reverse();
  return [...displayedVideoTracks, ...AUDIO_TRACKS.map((track) => ({ ...track, kind: 'audio' as const }))];
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
  if (!interaction || !interactionMatchesItem(interaction, item) || !isVideoTimelineTrack(item.track)) return item.track;
  if (interaction.selectedKeys.length > 1) return item.track;
  if (!isVideoTimelineTrack(interaction.previewTrack)) return item.track;
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

function selectedItemsForInteraction(items: WorkspaceTimelineItem[], interaction: TimelineInteractionState): WorkspaceTimelineItem[] {
  return items.filter((item) => interactionMatchesItem(interaction, item));
}

function constrainSelectedMoveToTrackGaps(
  startSec: number,
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState
): TimelineTrackConstraint {
  const requestedDeltaSec = snapSeconds(startSec - interaction.originStartSec, interaction.snapStepSec);
  const selectedItems = selectedItemsForInteraction(items, interaction);
  let minDeltaSec = Number.NEGATIVE_INFINITY;
  let maxDeltaSec = Number.POSITIVE_INFINITY;

  selectedItems.forEach((selectedItem) => {
    const originLayout = interaction.originLayoutsById[selectedItem.id] ?? {
      startSec: selectedItem.startSec,
      durationSec: selectedItem.durationSec,
    };
    const selectedStartSec = originLayout.startSec;
    const selectedEndSec = originLayout.startSec + originLayout.durationSec;
    minDeltaSec = Math.max(minDeltaSec, -selectedStartSec);

    items
      .filter((blocker) => blocker.track === selectedItem.track && !interactionMatchesItem(interaction, blocker))
      .forEach((blocker) => {
        const blockerStartSec = blocker.startSec;
        const blockerEndSec = blocker.startSec + blocker.durationSec;
        if (blockerEndSec <= selectedStartSec) {
          minDeltaSec = Math.max(minDeltaSec, blockerEndSec - selectedStartSec);
          return;
        }
        if (blockerStartSec >= selectedEndSec) {
          maxDeltaSec = Math.min(maxDeltaSec, blockerStartSec - selectedEndSec);
        }
      });
  });

  let constrainedDeltaSec = requestedDeltaSec;
  if (Number.isFinite(minDeltaSec) && Number.isFinite(maxDeltaSec) && minDeltaSec > maxDeltaSec) {
    constrainedDeltaSec = requestedDeltaSec >= 0 ? maxDeltaSec : minDeltaSec;
  } else {
    if (Number.isFinite(minDeltaSec)) constrainedDeltaSec = Math.max(constrainedDeltaSec, minDeltaSec);
    if (Number.isFinite(maxDeltaSec)) constrainedDeltaSec = Math.min(constrainedDeltaSec, maxDeltaSec);
  }

  const snappedDeltaSec = snapSeconds(constrainedDeltaSec, interaction.snapStepSec);
  return {
    startSec: Math.max(0, snapSeconds(interaction.originStartSec + snappedDeltaSec, interaction.snapStepSec)),
    guideSec: snappedDeltaSec !== requestedDeltaSec ? interaction.originStartSec + snappedDeltaSec : null,
  };
}

function constrainMoveToTrackGaps(
  startSec: number,
  durationSec: number,
  items: WorkspaceTimelineItem[],
  interaction: TimelineInteractionState
): TimelineTrackConstraint {
  let constrainedStartSec = Math.max(0, startSec);
  let guideSec: number | null = null;
  const primaryItem = primaryItemForInteraction(items, interaction);

  sameTrackBlockers(items, interaction).forEach((blocker) => {
    const blockerStartSec = blocker.startSec;
    const blockerEndSec = blocker.startSec + blocker.durationSec;
    const candidateEndSec = constrainedStartSec + durationSec;
    const overlapsBlocker = constrainedStartSec < blockerEndSec && candidateEndSec > blockerStartSec;
    if (!overlapsBlocker) return;

    const blockerMidSec = blockerStartSec + blocker.durationSec / 2;
    const candidateMidSec = constrainedStartSec + durationSec / 2;
    if (primaryItem && primaryItem.startSec > blockerStartSec && candidateMidSec <= blockerMidSec) {
      constrainedStartSec = blockerStartSec;
      guideSec = blockerStartSec;
      return;
    }
    if (primaryItem && primaryItem.startSec < blockerStartSec && candidateMidSec >= blockerMidSec) {
      constrainedStartSec = blockerEndSec;
      guideSec = blockerEndSec;
      return;
    }

    const beforeStartSec = blockerStartSec - durationSec;
    const afterStartSec = blockerEndSec;
    if (beforeStartSec >= 0 && Math.abs(constrainedStartSec - beforeStartSec) <= Math.abs(constrainedStartSec - afterStartSec)) {
      constrainedStartSec = beforeStartSec;
      guideSec = blockerStartSec;
      return;
    }

    constrainedStartSec = afterStartSec;
    guideSec = blockerEndSec;
  });

  return {
    startSec: Math.max(0, snapSeconds(constrainedStartSec, interaction.snapStepSec)),
    guideSec,
  };
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
    const trackConstraint = interaction.selectedKeys.length > 1
      ? constrainSelectedMoveToTrackGaps(snapCandidate.startSec, items, interaction)
      : constrainMoveToTrackGaps(snapCandidate.startSec, interaction.originDurationSec, items, interaction);
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
  isSelected,
  activeTool,
  total,
  timelineWidth,
  pixelsPerSecond,
  snapStepSec,
  onBeginInteraction,
  onCut,
  onMove,
  onPlayheadChange,
  onSelect,
}: {
  item: WorkspaceTimelineItem;
  layout: TimelineClipLayout;
  index: number;
  isInteracting: boolean;
  isSelected: boolean;
  activeTool: TimelineTool;
  total: number;
  timelineWidth: number;
  pixelsPerSecond: number;
  snapStepSec: number;
  onBeginInteraction: (event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => void;
  onCut: (itemId: string, splitOffsetSec?: number) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
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
    suppressNextClickRef.current = true;
    selectionHandledOnPointerRef.current = false;
    if (activeTool === 'cut') {
      event.preventDefault();
      event.stopPropagation();
      if (!canCutClip) return;
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
    onBeginInteraction(event, item, kind);
  };
  const beginMouseResize = (event: MouseEvent<HTMLDivElement>, kind: TimelineInteractionKind) => {
    if (pointerEventHandledRef.current) return;
    onBeginInteraction(event, item, kind);
  };
  return (
    <div
      className={`${styles.timelineClip} ${isCompactClip ? styles.timelineClipCompact : ''} ${isAudio ? styles.timelineClipAudio : ''} ${isSelected ? styles.timelineClipSelected : ''} ${isInteracting ? styles.timelineClipInteracting : ''} ${activeTool === 'cut' && canCutClip ? styles.timelineClipCutMode : ''}`}
      style={{ width, left, maxWidth: timelineWidth - left } as CSSProperties}
      role="button"
      tabIndex={0}
      data-linked-group={item.linkedGroupId ?? undefined}
      data-selected={isSelected ? 'true' : 'false'}
      data-timeline-duration={layout.durationSec}
      data-timeline-item={item.id}
      data-timeline-start={layout.startSec}
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
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(item.id, event.shiftKey || event.metaKey || event.ctrlKey ? 'toggle' : 'replace');
        }
      }}
      onMouseDown={handleClipMouseDown}
      onPointerDown={handleClipPointerDown}
      title={activeTool === 'cut' ? 'Click to cut this clip' : 'Drag to move this clip'}
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
            disabled={index === 0}
            title="Move clip left"
            aria-label="Move clip left"
          >
            <SkipBack size={12} />
          </button>
          <button
            type="button"
            onPointerDown={handleButtonPointer}
            onClick={(event) => { handleActionClick(event); onMove(item.id, 1); }}
            disabled={index === total - 1}
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
  isPlaying: boolean;
  items: WorkspaceTimelineItem[];
  maxVideoTrackCount: number;
  selectedItemId: string | null;
  selectedItemIds: string[];
  videoTrackCount: number;
  playheadSec: number;
  projectFps: number;
  timelineEditMode: WorkspaceTimelineInsertMode;
  onAddVideoTrack: () => void;
  onCutItem: (itemId: string, splitOffsetSec?: number) => void;
  onDeleteItem: (ripple?: boolean) => void;
  onMoveItem: (itemId: string, direction: -1 | 1) => void;
  onPlaybackChange: (isPlaying: boolean) => void;
  onPlayheadChange: (seconds: number) => void;
  onPositionItem: (itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, selectedItemIds?: string[]) => void;
  onPreviewItemsChange?: (items: WorkspaceTimelineItem[] | null, playheadSec: number | null) => void;
  onRedo: () => void;
  onResizeItem: (itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => void;
  onSelectItem: (itemId: string, mode?: TimelineSelectionMode) => void;
  onSelectItems: (itemIds: string[]) => void;
  onTimelineEditModeChange: (mode: WorkspaceTimelineInsertMode) => void;
  onTimelineTrimModeChange: (mode: WorkspaceTimelineTrimMode) => void;
  onTogglePlayback: () => void;
  onToggleTransition: () => void;
  onUndo: () => void;
  timelineTrimMode: WorkspaceTimelineTrimMode;
};

export function WorkspaceTimeline({
  canRedo,
  canUndo,
  isPlaying,
  items,
  maxVideoTrackCount,
  selectedItemId,
  selectedItemIds,
  videoTrackCount,
  playheadSec,
  projectFps,
  timelineEditMode,
  timelineTrimMode,
  onAddVideoTrack,
  onCutItem,
  onDeleteItem,
  onMoveItem,
  onPlaybackChange,
  onPlayheadChange,
  onPositionItem,
  onPreviewItemsChange,
  onRedo,
  onResizeItem,
  onSelectItem,
  onSelectItems,
  onTimelineEditModeChange,
  onTimelineTrimModeChange,
  onTogglePlayback,
  onToggleTransition,
  onUndo,
}: WorkspaceTimelineProps) {
  const [interaction, setInteraction] = useState<TimelineInteractionState | null>(null);
  const [marquee, setMarquee] = useState<TimelineMarqueeState | null>(null);
  const [activeTimelineTool, setActiveTimelineTool] = useState<TimelineTool>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [pixelsPerSecond, setPixelsPerSecond] = useState(DEFAULT_TIMELINE_PIXELS_PER_SECOND);
  const interactionRef = useRef<TimelineInteractionState | null>(null);
  const frameStepSec = frameStepSeconds(projectFps);
  const totalDuration = Math.max(1, ...items.map((item) => item.startSec + item.durationSec), interaction ? interaction.previewStartSec + interaction.previewDurationSec : 0);
  const timelineWidth = Math.max(MIN_TIMELINE_WIDTH, totalDuration * pixelsPerSecond + 64);
  const rulerTickSec = timelineRulerStepFor(pixelsPerSecond);
  const timelineTracks = useMemo(() => buildTimelineTracks(videoTrackCount, items), [items, videoTrackCount]);
  const clampedPlayheadSec = Math.max(0, Math.min(playheadSec, totalDuration));
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedKeys = useMemo(() => selectionKeysForTimelineItemIds(items, selectedItemIds), [items, selectedItemIds]);
  const selectedClipCount = selectedKeys.size;
  const selectedLayout = selectedItem ? layoutForItem(selectedItem, interaction) : null;
  const selectedSplitOffset = selectedLayout ? clampedPlayheadSec - selectedLayout.startSec : null;
  const canCutAtPlayhead = Boolean(
    selectedItem &&
    selectedLayout &&
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
  const secondsFromTimelineElement = useCallback((clientX: number, element: HTMLElement): number => {
    const rect = element.getBoundingClientRect();
    const rawSeconds = (clientX - rect.left) / pixelsPerSecond;
    return Math.max(0, Math.min(totalDuration, snapSeconds(rawSeconds, frameStepSec)));
  }, [frameStepSec, pixelsPerSecond, totalDuration]);
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
        const marqueeItemIds = selectedItemIdsForMarquee(finalMarquee);
        onSelectItems(marqueeItemIds);
        return;
      }
      onPlaybackChange(false);
      onPlayheadChange(secondsFromTimelineElement(pointerEvent.clientX, laneElement));
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [onPlaybackChange, onPlayheadChange, onSelectItems, secondsFromTimelineElement]);
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
    if (!isVideoTimelineTrack(fallbackTrack)) return fallbackTrack;
    const videoTrackIds = new Set(timelineTracks.filter((track) => track.kind === 'video').map((track) => track.id));
    const trackElements = Array.from(document.querySelectorAll<HTMLElement>('[data-timeline-track]'))
      .map((element) => {
        const track = element.dataset.timelineTrack as WorkspaceTimelineTrack | undefined;
        const rect = element.getBoundingClientRect();
        return { element, rect, track };
      })
      .filter((entry): entry is { element: HTMLElement; rect: DOMRect; track: WorkspaceTimelineTrack } =>
        Boolean(entry.track && videoTrackIds.has(entry.track))
      );
    const containingTrack = trackElements.find((entry) => clientY >= entry.rect.top && clientY <= entry.rect.bottom);
    if (containingTrack) return containingTrack.track;
    const nearestTrack = trackElements
      .map((entry) => ({ ...entry, distance: Math.abs(clientY - (entry.rect.top + entry.rect.height / 2)) }))
      .sort((left, right) => left.distance - right.distance)[0];
    return nearestTrack?.track ?? fallbackTrack;
  }, [timelineTracks]);
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
        timelineTrimMode
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
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (isTimelineShortcutTarget(event.target)) return;
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
        return;
      }
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
      if (event.code === 'KeyC') {
        event.preventDefault();
        setActiveTimelineTool((currentTool) => (currentTool === 'cut' ? 'select' : 'cut'));
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
      if (event.code === 'KeyT') {
        event.preventDefault();
        onTimelineTrimModeChange(timelineTrimMode === 'trim' ? 'ripple' : timelineTrimMode === 'ripple' ? 'roll' : 'trim');
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
  }, [frameStepSec, handleCutSelectedAtPlayhead, onDeleteItem, onRedo, onTimelineTrimModeChange, onTogglePlayback, onUndo, pixelsPerSecond, seekBy, setTimelineZoom, timelineTrimMode]);
  const previewItems = useMemo(
    () => items.map((item) => ({
      item,
      layout: layoutForItem(item, interaction),
      trackId: trackForTimelineItem(item, interaction),
    })),
    [interaction, items]
  );
  const previewTimelineItems = useMemo(
    () => interaction
      ? items.map((item) => {
        const layout = layoutForItem(item, interaction);
        return {
          ...item,
          startSec: layout.startSec,
          durationSec: layout.durationSec,
          track: trackForTimelineItem(item, interaction),
        };
      })
      : null,
    [interaction, items]
  );
  const previewPlayheadSec = interaction ? previewPlayheadForInteraction(interaction) : null;
  useEffect(() => {
    onPreviewItemsChange?.(previewTimelineItems, previewPlayheadSec);
  }, [onPreviewItemsChange, previewPlayheadSec, previewTimelineItems]);
  const timelinePanelStyle = {
    '--timeline-content-width': `${timelineWidth}px`,
  } as CSSProperties;

  return (
    <section
      className={styles.timelinePanel}
      style={timelinePanelStyle}
      aria-label="Video timeline"
      data-timeline-frame-step={frameStepSec}
      data-timeline-pixels-per-second={pixelsPerSecond}
    >
      <div className={styles.timelineTopbar}>
        <div>
          <p>Montage timeline</p>
          <span>
            {formatWorkspaceTimecode(clampedPlayheadSec, projectFps)} / {formatWorkspaceTimecode(totalDuration, projectFps)}
            {selectedClipCount > 1
              ? ` · ${selectedClipCount} clips selected`
              : selectedItem
                ? ` · Selected ${selectedItem.title}`
                : ''}
          </span>
        </div>
        <div className={styles.timelineTransport}>
          <button type="button" data-tooltip="Undo (Cmd/Ctrl + Z)" title="Undo timeline edit (Cmd/Ctrl + Z)" aria-label="Undo timeline edit" disabled={!canUndo} onClick={onUndo}>
            <Undo2 size={15} />
          </button>
          <button type="button" data-tooltip="Redo (Cmd/Ctrl + Shift + Z)" title="Redo timeline edit (Cmd/Ctrl + Shift + Z)" aria-label="Redo timeline edit" disabled={!canRedo} onClick={onRedo}>
            <Redo2 size={15} />
          </button>
          <button type="button" data-tooltip="Back 1s (Shift + Left)" title="Back 1s (Shift + Left)" aria-label="Previous" onClick={() => seekBy(-1)}>
            <SkipBack size={15} />
          </button>
          <button
            type="button"
            data-tooltip={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            title={isPlaying ? 'Pause montage (Space)' : 'Play montage (Space)'}
            aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}
            onClick={onTogglePlayback}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" data-tooltip="Forward 1s (Shift + Right)" title="Forward 1s (Shift + Right)" aria-label="Next" onClick={() => seekBy(1)}>
            <SkipForward size={15} />
          </button>
          <button
            type="button"
            className={`${styles.timelineToolButton} ${activeTimelineTool === 'select' ? styles.timelineToolButtonActive : ''}`}
            data-tooltip="Select, drag, marquee (V)"
            title="Select and drag clips. Shift/Cmd-click toggles selection; drag empty timeline space for marquee selection. (V)"
            onClick={() => setActiveTimelineTool('select')}
            aria-label="Select tool"
            aria-pressed={activeTimelineTool === 'select'}
          >
            <MousePointer2 size={15} />
          </button>
          <button
            type="button"
            className={`${styles.timelineToolButton} ${activeTimelineTool === 'cut' ? styles.timelineToolButtonActive : ''}`}
            data-tooltip="Cut tool (C) / Split selected (S)"
            title="Cut tool (C). Click a clip to split, or press S to split at the playhead."
            onClick={() => setActiveTimelineTool((currentTool) => (currentTool === 'cut' ? 'select' : 'cut'))}
            aria-label="Cut tool"
            aria-pressed={activeTimelineTool === 'cut'}
          >
            <Scissors size={15} />
          </button>
          <button
            type="button"
            className={`${styles.timelineToolButton} ${snapEnabled ? styles.timelineToolButtonActive : ''}`}
            data-tooltip="Snapping: clips, playhead, zero (M)"
            title="Snapping to clip edges, playhead, and zero (M)"
            onClick={() => setSnapEnabled((value) => !value)}
            aria-label="Toggle snapping"
            aria-pressed={snapEnabled}
          >
            <Magnet size={15} />
          </button>
          <button
            type="button"
            className={styles.timelineToolButton}
            data-tooltip="Crossfade 1s on next cut"
            title="Toggle a 1s crossfade from the selected clip to the next video clip"
            aria-label="Toggle crossfade transition"
            disabled={!selectedItem}
            onClick={onToggleTransition}
          >
            Xf
          </button>
          <button
            type="button"
            data-tooltip="Delete selected (Delete). Ripple delete with Shift + Delete"
            title="Delete selected clip. Hold Shift for ripple delete."
            aria-label="Delete selected timeline clip"
            disabled={!selectedItem}
            onClick={() => onDeleteItem(false)}
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            className={styles.timelineToolButton}
            data-tooltip="Add video track"
            title="Add a video track for overlays, b-roll, or alternates"
            aria-label="Add video track"
            disabled={videoTrackCount >= maxVideoTrackCount}
            onClick={onAddVideoTrack}
          >
            <Plus size={15} />
          </button>
          <div className={styles.timelineZoomControl} aria-label="Timeline zoom">
            <button
              type="button"
              data-tooltip="Zoom out (Cmd/Ctrl + -)"
              title="Zoom out timeline (Cmd/Ctrl + -)"
              aria-label="Zoom out timeline"
              onClick={() => setTimelineZoom(pixelsPerSecond - 8)}
              disabled={pixelsPerSecond <= MIN_TIMELINE_PIXELS_PER_SECOND}
            >
              <ZoomOut size={13} />
            </button>
            <input
              type="range"
              min={MIN_TIMELINE_PIXELS_PER_SECOND}
              max={MAX_TIMELINE_PIXELS_PER_SECOND}
              step={2}
              value={pixelsPerSecond}
              onChange={(event) => setTimelineZoom(Number(event.currentTarget.value))}
              aria-label="Timeline zoom level"
            />
            <button
              type="button"
              data-tooltip="Zoom in (Cmd/Ctrl + +)"
              title="Zoom in timeline (Cmd/Ctrl + +)"
              aria-label="Zoom in timeline"
              onClick={() => setTimelineZoom(pixelsPerSecond + 8)}
              disabled={pixelsPerSecond >= MAX_TIMELINE_PIXELS_PER_SECOND}
            >
              <ZoomIn size={13} />
            </button>
          </div>
          <div className={styles.timelineModeControl} role="radiogroup" aria-label="Timeline insert mode">
            {(['insert', 'overwrite', 'replace'] as WorkspaceTimelineInsertMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={timelineEditMode === mode ? styles.timelineModeActive : ''}
                data-tooltip={
                  mode === 'insert'
                    ? 'Insert: push later clips'
                    : mode === 'overwrite'
                      ? 'Overwrite: replace the time range'
                      : 'Replace: swap selected clip'
                }
                title={
                  mode === 'insert'
                    ? 'Insert at playhead and push later clips'
                    : mode === 'overwrite'
                      ? 'Overwrite the range under the playhead'
                      : 'Replace the selected clip slot'
                }
                onClick={() => onTimelineEditModeChange(mode)}
                role="radio"
                aria-checked={timelineEditMode === mode}
                aria-label={`${mode} edit mode`}
              >
                {mode === 'insert' ? 'Ins' : mode === 'overwrite' ? 'Ovr' : 'Rep'}
              </button>
            ))}
          </div>
          <div className={styles.timelineModeControl} role="radiogroup" aria-label="Timeline trim mode">
            {(['trim', 'ripple', 'roll'] as WorkspaceTimelineTrimMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={timelineTrimMode === mode ? styles.timelineModeActive : ''}
                data-tooltip={
                  mode === 'trim'
                    ? 'Trim: leave gaps'
                    : mode === 'ripple'
                      ? 'Ripple: close/open the sequence'
                      : 'Roll: move the cut between clips'
                }
                title={
                  mode === 'trim'
                    ? 'Normal trim leaves neighboring clips untouched'
                    : mode === 'ripple'
                      ? 'Ripple trim shifts later clips with the edit'
                      : 'Roll trim moves the cut between adjacent clips'
                }
                onClick={() => onTimelineTrimModeChange(mode)}
                role="radio"
                aria-checked={timelineTrimMode === mode}
                aria-label={`${mode} trim mode`}
              >
                {mode === 'trim' ? 'Trim' : mode === 'ripple' ? 'Rip' : 'Roll'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.timelineViewport}>
        <div className={styles.timelineRuler}>
          <div className={styles.timelineRulerLabel} aria-hidden="true" />
          <div className={styles.timelineRulerLane}>
            <div
              className={styles.timelineRulerInner}
              style={{ width: timelineWidth }}
              onPointerDown={handleBeginTimelineSurfacePointerDown}
              title="Drag to move the timeline playhead"
            >
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
            const trackItems = previewItems
              .filter(({ trackId }) => trackId === track.id)
              .sort((left, right) => left.layout.startSec - right.layout.startSec);
            return (
              <div key={track.id} className={styles.timelineTrack}>
                <div className={styles.trackLabel}>
                  {track.icon}
                  <span>{track.label}</span>
                  <Lock size={12} />
                </div>
                <div className={styles.trackLane}>
                  <div
                    className={styles.trackLaneContent}
                    style={{ width: timelineWidth }}
                    data-timeline-track={track.id}
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
                    {trackItems.length ? (
                      trackItems.map(({ item, layout }, index) => (
                        <TimelineClip
                          key={item.id}
                          item={item}
                          layout={layout}
                          index={index}
                          isInteracting={Boolean(interaction && interactionMatchesItem(interaction, item))}
                          isSelected={selectedKeys.has(selectionKeyForTimelineItem(item))}
                          activeTool={activeTimelineTool}
                          total={trackItems.length}
                          timelineWidth={timelineWidth}
                          pixelsPerSecond={pixelsPerSecond}
                          snapStepSec={frameStepSec}
                          onBeginInteraction={handleBeginInteraction}
                          onCut={onCutItem}
                          onMove={onMoveItem}
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
    </section>
  );
}
