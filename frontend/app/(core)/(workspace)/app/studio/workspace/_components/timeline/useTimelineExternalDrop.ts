'use client';

import { useCallback, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';

import {
  clearTimelineNodeDragPayload,
  parseTimelineNodeDragPayload,
  resolveTimelineExternalDropPreview,
  type TimelineExternalDropPreview,
} from '../../_lib/timeline/timeline-external-drop';
import type { WorkspaceTimelineItem, WorkspaceTimelineTrack } from '../../_lib/workspace-types';

type UseTimelineExternalDropOptions = {
  isInsertIntoClipEnabled: boolean;
  items: WorkspaceTimelineItem[];
  lockedTrackSet: ReadonlySet<WorkspaceTimelineTrack>;
  onInvalidNodeDropToTimeline: (reason: 'incompatible' | 'locked-track' | 'occupied-clip') => void;
  onNodeDropToTimeline: (nodeId: string, startSec: number, track: WorkspaceTimelineTrack) => void;
  onPlaybackChange: (isPlaying: boolean) => void;
  onProjectAssetDropToTimeline: (assetId: string, startSec: number, track: WorkspaceTimelineTrack) => void;
  secondsFromTimelineElement: (clientX: number, element: HTMLElement) => number;
};

export function useTimelineExternalDrop({
  isInsertIntoClipEnabled,
  items,
  lockedTrackSet,
  onInvalidNodeDropToTimeline,
  onNodeDropToTimeline,
  onPlaybackChange,
  onProjectAssetDropToTimeline,
  secondsFromTimelineElement,
}: UseTimelineExternalDropOptions) {
  const [externalDropPreview, setExternalDropPreview] = useState<TimelineExternalDropPreview | null>(null);

  const updateExternalDropPreview = useCallback((event: ReactDragEvent<HTMLDivElement>, track: WorkspaceTimelineTrack) => {
    const payload = parseTimelineNodeDragPayload(event.dataTransfer);
    if ((!payload?.nodeId && !payload?.assetId) || !payload.mediaKind) return null;
    const rawStartSec = secondsFromTimelineElement(event.clientX, event.currentTarget);
    const preview = resolveTimelineExternalDropPreview({
      isInsertIntoClipEnabled,
      items,
      lockedTracks: lockedTrackSet,
      payload,
      rawStartSec,
      track,
    });
    if (!preview) return null;
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
    clearTimelineNodeDragPayload();
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

  const handleClearExternalDropPreview = useCallback(() => {
    setExternalDropPreview(null);
  }, []);

  return {
    externalDropPreview,
    handleClearExternalDropPreview,
    handleExternalDrop,
    handleExternalDropOver,
  };
}
