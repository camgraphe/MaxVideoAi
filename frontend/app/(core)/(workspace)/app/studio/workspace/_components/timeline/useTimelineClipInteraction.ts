'use client';

import { useCallback, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';

import {
  interactionMatchesTimelineItem,
  layoutForTimelineItem,
  nextTimelineInteractionState,
  selectionKeyForTimelineItem,
  selectionKeysForTimelineItemIds,
  sourceDurationForTimelineItem,
  sourceStartForTimelineItem,
  type TimelineClipLayout,
  type TimelineInteractionKind,
  type TimelineInteractionState,
} from '../../_lib/timeline/timeline-interaction';
import { markTimelinePerformance } from '../../_lib/timeline/timeline-performance';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../../_lib/workspace-types';
import type { WorkspaceTimelineTrimEdge, WorkspaceTimelineTrimMode } from '../../_lib/workspace-timeline-editing';
import type { TimelineSelectionMode } from './TimelineClip';
import { isAudioTimelineTrack, isVideoTimelineTrack, type TimelineTrackDefinition } from './timelineTrackDefinitions';

const TIMELINE_CLIP_DRAG_THRESHOLD_PIXELS = 0.5;

type UseTimelineClipInteractionOptions = {
  clampedPlayheadSec: number;
  frameStepSec: number;
  items: WorkspaceTimelineItem[];
  lockedTrackSet: ReadonlySet<WorkspaceTimelineTrack>;
  onPlaybackChange: (isPlaying: boolean) => void;
  onPlayheadChange: (seconds: number) => void;
  onPositionItem: (itemId: string, nextStartSec: number, nextTrack?: WorkspaceTimelineTrack, selectedItemIds?: string[]) => void;
  onResizeItem: (itemId: string, edge: WorkspaceTimelineTrimEdge, nextStartSec: number, nextDurationSec: number, mode: WorkspaceTimelineTrimMode) => void;
  onSelectItem: (itemId: string, mode?: TimelineSelectionMode) => void;
  pixelsPerSecond: number;
  selectedItemIds: string[];
  selectedKeys: ReadonlySet<string>;
  snapEnabled: boolean;
  timelineTracks: TimelineTrackDefinition[];
};

export function useTimelineClipInteraction({
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
}: UseTimelineClipInteractionOptions) {
  const [interaction, setInteraction] = useState<TimelineInteractionState | null>(null);
  const interactionRef = useRef<TimelineInteractionState | null>(null);

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
        completedInteraction.kind === 'resize-end' && completedInteraction.previewDurationSec < completedInteraction.originDurationSec
          ? 'ripple'
          : 'trim'
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

  const isItemInteracting = useCallback(
    (item: WorkspaceTimelineItem) => Boolean(interaction && interactionMatchesTimelineItem(interaction, item)),
    [interaction]
  );

  return {
    handleBeginInteraction,
    interaction,
    isItemInteracting,
  };
}
