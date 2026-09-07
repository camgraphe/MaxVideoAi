'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { markTimelinePerformance } from '../../_lib/timeline/timeline-performance';

type TimelinePlayheadDragArgs = {
  onPlaybackChange: (isPlaying: boolean) => void;
  onPlayheadChange: (seconds: number) => void;
  secondsFromTimelineElement: (clientX: number, element: HTMLElement) => number;
};

export function useTimelinePlayheadDrag({
  onPlaybackChange,
  onPlayheadChange,
  secondsFromTimelineElement,
}: TimelinePlayheadDragArgs) {
  const playheadDragFrameRef = useRef<number | null>(null);
  const pendingPlayheadDragSecRef = useRef<number | null>(null);

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

  useEffect(() => () => {
    if (playheadDragFrameRef.current !== null) {
      window.cancelAnimationFrame(playheadDragFrameRef.current);
      playheadDragFrameRef.current = null;
    }
  }, []);

  return handleBeginPlayheadDrag;
}
