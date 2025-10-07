'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

interface AutoScrollerProps {
  items: ReactNode[];
  gap?: number;
  speed?: number; // pixels per second
  className?: string;
}

export function AutoScroller({ items, gap = 12, speed = 60, className }: AutoScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const hoverRef = useRef(false);

  const renderedItems = useMemo(() => {
    const primary = items.map((child, index) => (
      <div key={`primary-${index}`} className="flex-none">
        {child}
      </div>
    ));
    const duplicate = items.map((child, index) => (
      <div key={`duplicate-${index}`} className="flex-none" aria-hidden>
        {child}
      </div>
    ));
    return [...primary, ...duplicate];
  }, [items]);

  useEffect(() => {
    const step = (timestamp: number) => {
      const container = containerRef.current;
      const track = trackRef.current;
      if (!container || !track) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      const contentWidth = track.scrollWidth / 2;
      if (contentWidth <= 0) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }

      if (!hoverRef.current) {
        if (lastTimestampRef.current != null) {
          const deltaMs = timestamp - lastTimestampRef.current;
          const deltaPx = (speed * deltaMs) / 1000;
          const nextScroll = container.scrollLeft + deltaPx;
          container.scrollLeft = nextScroll >= contentWidth ? nextScroll - contentWidth : nextScroll;
        }
      }

      lastTimestampRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame(step);
    };

    animationFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [speed, renderedItems]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollLeft = 0;
    lastTimestampRef.current = null;
  }, [items]);

  return (
    <div
      ref={containerRef}
      className={className ? `relative overflow-hidden ${className}` : 'relative overflow-hidden'}
      onMouseEnter={() => {
        hoverRef.current = true;
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
      }}
    >
      <div
        ref={trackRef}
        className="flex"
        style={{ gap: `${gap}px`, paddingInlineEnd: `${gap}px` }}
      >
        {renderedItems}
      </div>
    </div>
  );
}
