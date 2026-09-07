'use client';

import { useCallback, useRef } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';

type TimelinePanelResizeArgs = {
  maxPanelHeight: number;
  minPanelHeight: number;
  onBeginResize?: () => void;
  onPanelHeightChange: (height: number) => void;
  panelHeight: number | null;
};

export function useTimelinePanelResize({
  maxPanelHeight,
  minPanelHeight,
  onBeginResize,
  onPanelHeightChange,
  panelHeight,
}: TimelinePanelResizeArgs) {
  const timelinePanelRef = useRef<HTMLElement | null>(null);
  const panelResizePointerHandledRef = useRef(false);

  const beginTimelinePanelResize = useCallback((
    originClientY: number,
    moveEventName: 'mousemove' | 'pointermove',
    upEventName: 'mouseup' | 'pointerup'
  ) => {
    onBeginResize?.();
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
  }, [maxPanelHeight, minPanelHeight, onBeginResize, onPanelHeightChange, panelHeight]);

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

  return {
    handleBeginTimelinePanelMouseResize,
    handleBeginTimelinePanelPointerResize,
    timelinePanelRef,
  };
}
