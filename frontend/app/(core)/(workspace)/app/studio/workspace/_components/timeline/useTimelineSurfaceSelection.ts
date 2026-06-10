'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';

import {
  marqueeRectForState,
  selectedItemIdsForMarquee,
  type TimelineMarqueeRect,
  type TimelineMarqueeState,
} from '../../_lib/timeline/timeline-interaction';

type UseTimelineSurfaceSelectionOptions = {
  onPlaybackChange: (isPlaying: boolean) => void;
  onPlayheadChange: (seconds: number) => void;
  onSelectItems: (itemIds: string[]) => void;
  secondsFromTimelineElement: (clientX: number, element: HTMLElement) => number;
  timelineViewportClassName: string;
};

export function useTimelineSurfaceSelection({
  onPlaybackChange,
  onPlayheadChange,
  onSelectItems,
  secondsFromTimelineElement,
  timelineViewportClassName,
}: UseTimelineSurfaceSelectionOptions) {
  const [marquee, setMarquee] = useState<TimelineMarqueeState | null>(null);
  const suppressNextSurfaceClickRef = useRef(false);

  const handleBeginTimelineSurfacePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-timeline-item], [data-timeline-control="true"]')) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const laneElement = event.currentTarget;
    onSelectItems([]);
    const viewportElement = laneElement.closest(`.${timelineViewportClassName}`) as HTMLElement | null;
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
  }, [onPlaybackChange, onPlayheadChange, onSelectItems, secondsFromTimelineElement, timelineViewportClassName]);

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

  const marqueeStyle = useMemo<TimelineMarqueeRect | null>(
    () => marquee ? marqueeRectForState(marquee) : null,
    [marquee]
  );

  return {
    handleBeginTimelineSurfacePointerDown,
    handleTimelineSurfaceClick,
    marqueeStyle,
  };
}
