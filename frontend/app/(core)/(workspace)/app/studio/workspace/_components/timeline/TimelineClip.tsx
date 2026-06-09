'use client';

/* eslint-disable @next/next/no-img-element */

import { SkipBack, SkipForward } from 'lucide-react';
import { memo, useRef } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import styles from '../../_styles/timeline.module.css';
import type { WorkspaceTimelineItem } from '../../_lib/workspace-types';
import { isWorkspaceTimelineVideoTrack } from '../../_lib/workspace-timeline-tracks';
import type { TimelineTool } from './TimelineToolbar';

const MIN_CLIP_DURATION_SEC = 1;
const DEFAULT_TIMELINE_FPS = 24;
const DEFAULT_TIMELINE_FRAME_STEP_SECONDS = 1 / DEFAULT_TIMELINE_FPS;
const TIMELINE_SECOND_PRECISION = 1_000_000;

export type TimelineInteractionKind = 'move' | 'resize-start' | 'resize-end';

export type TimelineClipLayout = {
  startSec: number;
  durationSec: number;
};

export type TimelineSelectionMode = 'replace' | 'toggle' | 'focus';

type TimelineClipProps = {
  activeTool: TimelineTool;
  index: number;
  isInteracting: boolean;
  isLocked: boolean;
  isSelected: boolean;
  item: WorkspaceTimelineItem;
  layout: TimelineClipLayout;
  onBeginInteraction: (event: ReactPointerEvent<HTMLElement> | MouseEvent<HTMLElement>, item: WorkspaceTimelineItem, kind: TimelineInteractionKind) => void;
  onCut: (itemId: string, splitOffsetSec?: number) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onOpenContextMenu: (event: MouseEvent<HTMLDivElement>, item: WorkspaceTimelineItem) => void;
  onPlayheadChange: (seconds: number) => void;
  onSelect: (itemId: string, mode?: TimelineSelectionMode) => void;
  pixelsPerSecond: number;
  snapStepSec: number;
  timelineWidth: number;
  total: number;
};

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.max(0, Math.round(seconds % 60));
  return `${minutes}:${remaining.toString().padStart(2, '0')}`;
}

function snapSeconds(seconds: number, snapStepSec = DEFAULT_TIMELINE_FRAME_STEP_SECONDS): number {
  const safeStepSec = snapStepSec > 0 ? snapStepSec : DEFAULT_TIMELINE_FRAME_STEP_SECONDS;
  return Math.round((Math.round(seconds / safeStepSec) * safeStepSec) * TIMELINE_SECOND_PRECISION) / TIMELINE_SECOND_PRECISION;
}

function waveformBarsForItem(item: WorkspaceTimelineItem): number[] {
  const seed = Array.from(item.id).reduce((value, char, index) => value + char.charCodeAt(0) * (index + 1), 17);
  return Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin((seed + index * 13) * 0.42);
    const pulse = Math.cos((seed + index * 7) * 0.21);
    return Math.max(18, Math.round(38 + wave * 28 + pulse * 14));
  });
}

export const TimelineClip = memo(function TimelineClip({
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
}: TimelineClipProps) {
  const pointerEventHandledRef = useRef(false);
  const selectionHandledOnPointerRef = useRef(false);
  const suppressNextClickRef = useRef(false);
  const width = Math.max(24, layout.durationSec * pixelsPerSecond);
  const left = Math.max(0, layout.startSec * pixelsPerSecond);
  const isAudio = item.mediaKind === 'audio' || !isWorkspaceTimelineVideoTrack(item.track);
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
});
