'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

const RAIL_THUMB_HEIGHT = 24;
const RAIL_TRACK_OFFSET = 12;

export function useGalleryRailScrollbar({
  isDesktopVariant,
  refreshKey,
}: {
  isDesktopVariant: boolean;
  refreshKey: number | string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const railTrackRef = useRef<HTMLDivElement>(null);
  const railDragPointerId = useRef<number | null>(null);
  const [railProgress, setRailProgress] = useState(0);
  const [showRail, setShowRail] = useState(false);
  const [railTrackHeight, setRailTrackHeight] = useState(200);

  const updateRailFromPointer = useCallback(
    (clientY: number) => {
      const track = railTrackRef.current;
      const scroller = scrollContainerRef.current;
      if (!track || !scroller) return;
      const maxScroll = scroller.scrollHeight - scroller.clientHeight;
      if (maxScroll <= 0) return;
      const rect = track.getBoundingClientRect();
      const trackRange = Math.max(1, railTrackHeight - RAIL_THUMB_HEIGHT);
      const offset = clientY - rect.top - RAIL_THUMB_HEIGHT / 2;
      const clamped = Math.min(Math.max(offset, 0), trackRange);
      scroller.scrollTop = (clamped / trackRange) * maxScroll;
    },
    [railTrackHeight]
  );

  const handleRailPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      railDragPointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateRailFromPointer(event.clientY);
      event.preventDefault();
    },
    [updateRailFromPointer]
  );

  const handleRailPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (railDragPointerId.current !== event.pointerId) return;
      updateRailFromPointer(event.clientY);
      event.preventDefault();
    },
    [updateRailFromPointer]
  );

  const handleRailPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (railDragPointerId.current !== event.pointerId) return;
    railDragPointerId.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const updateRailProgress = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) return;
    const maxScroll = element.scrollHeight - element.clientHeight;
    if (!isDesktopVariant || maxScroll <= 4) {
      setShowRail(false);
      setRailProgress(0);
      return;
    }
    const nextTrackHeight = Math.max(120, element.clientHeight - RAIL_TRACK_OFFSET * 2);
    setRailTrackHeight((prev) => (prev === nextTrackHeight ? prev : nextTrackHeight));
    setShowRail(true);
    setRailProgress(element.scrollTop / maxScroll);
  }, [isDesktopVariant]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) return undefined;

    updateRailProgress();

    const handleScroll = () => updateRailProgress();
    element.addEventListener('scroll', handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateRailProgress());
      resizeObserver.observe(element);
    }

    window.addEventListener('resize', updateRailProgress);

    return () => {
      element.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateRailProgress);
    };
  }, [updateRailProgress]);

  useEffect(() => {
    updateRailProgress();
  }, [refreshKey, updateRailProgress]);

  return {
    handleRailPointerDown,
    handleRailPointerMove,
    handleRailPointerUp,
    railThumbHeight: RAIL_THUMB_HEIGHT,
    railThumbOffset: railProgress * (railTrackHeight - RAIL_THUMB_HEIGHT),
    railTrackHeight,
    railTrackRef,
    scrollContainerRef,
    showRail,
  };
}
