'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const TIMELINE_VISIBLE_RANGE_BUFFER_PX = 360;

export type TimelineVisibleRange = {
  startSec: number;
  endSec: number;
  viewportStartSec: number;
  viewportEndSec: number;
};

type UseTimelineVisibleRangeOptions = {
  frameStepSec: number;
  pixelsPerSecond: number;
  timelineViewportRef: RefObject<HTMLDivElement | null>;
  totalDuration: number;
};

export function useTimelineVisibleRange({
  frameStepSec,
  pixelsPerSecond,
  timelineViewportRef,
  totalDuration,
}: UseTimelineVisibleRangeOptions) {
  const visibleRangeFrameRef = useRef<number | null>(null);
  const [visibleTimelineRange, setVisibleTimelineRange] = useState<TimelineVisibleRange>(() => ({
    startSec: 0,
    endSec: Number.POSITIVE_INFINITY,
    viewportStartSec: 0,
    viewportEndSec: Number.POSITIVE_INFINITY,
  }));

  const updateVisibleTimelineRange = useCallback(() => {
    const viewportElement = timelineViewportRef.current;
    if (!viewportElement) {
      setVisibleTimelineRange((currentRange) => (
        currentRange.startSec === 0 &&
        currentRange.endSec === totalDuration &&
        currentRange.viewportStartSec === 0 &&
        currentRange.viewportEndSec === totalDuration
          ? currentRange
          : {
            startSec: 0,
            endSec: totalDuration,
            viewportStartSec: 0,
            viewportEndSec: totalDuration,
          }
      ));
      return;
    }

    const bufferSec = TIMELINE_VISIBLE_RANGE_BUFFER_PX / pixelsPerSecond;
    const nextViewportStartSec = Math.max(0, viewportElement.scrollLeft / pixelsPerSecond);
    const nextViewportEndSec = Math.min(
      totalDuration,
      (viewportElement.scrollLeft + viewportElement.clientWidth) / pixelsPerSecond
    );
    const nextStartSec = Math.max(0, nextViewportStartSec - bufferSec);
    const nextEndSec = Math.min(
      totalDuration,
      nextViewportEndSec + bufferSec
    );

    setVisibleTimelineRange((currentRange) => {
      const startDelta = Math.abs(currentRange.startSec - nextStartSec);
      const endDelta = Math.abs(currentRange.endSec - nextEndSec);
      const viewportStartDelta = Math.abs(currentRange.viewportStartSec - nextViewportStartSec);
      const viewportEndDelta = Math.abs(currentRange.viewportEndSec - nextViewportEndSec);
      if (
        startDelta < frameStepSec &&
        endDelta < frameStepSec &&
        viewportStartDelta < frameStepSec &&
        viewportEndDelta < frameStepSec
      ) {
        return currentRange;
      }
      return {
        startSec: nextStartSec,
        endSec: nextEndSec,
        viewportStartSec: nextViewportStartSec,
        viewportEndSec: nextViewportEndSec,
      };
    });
  }, [frameStepSec, pixelsPerSecond, timelineViewportRef, totalDuration]);

  const scheduleVisibleTimelineRangeUpdate = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (visibleRangeFrameRef.current !== null) return;
    visibleRangeFrameRef.current = window.requestAnimationFrame(() => {
      visibleRangeFrameRef.current = null;
      updateVisibleTimelineRange();
    });
  }, [updateVisibleTimelineRange]);

  useEffect(() => {
    updateVisibleTimelineRange();
  }, [updateVisibleTimelineRange]);

  useEffect(() => () => {
    if (visibleRangeFrameRef.current !== null) {
      window.cancelAnimationFrame(visibleRangeFrameRef.current);
      visibleRangeFrameRef.current = null;
    }
  }, []);

  return {
    scheduleVisibleTimelineRangeUpdate,
    updateVisibleTimelineRange,
    visibleTimelineRange,
  };
}
