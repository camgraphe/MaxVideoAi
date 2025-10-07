'use client';

import clsx from 'clsx';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface MasonryGridProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey?: (item: T, index: number) => string;
  minColumnWidth?: number;
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

type Position = {
  top: number;
  left: number;
};

type LayoutResult = {
  positions: Map<string, Position>;
  containerHeight: number;
  columnWidth: number;
};

export function MasonryGrid<T>({
  items,
  renderItem,
  getKey,
  minColumnWidth = 260,
  gap = 12,
  className,
  style,
}: MasonryGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heightsRef = useRef(new Map<string, number>());
  const [containerWidth, setContainerWidth] = useState(0);
  const [, forceLayoutRecalc] = useState(0);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const currentWidth = containerRef.current.getBoundingClientRect().width;
    if (currentWidth > 0) {
      setContainerWidth(currentWidth);
    }
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width } = entries[0].contentRect;
      setContainerWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const registerItem = useCallback((key: string, height: number) => {
    if (!Number.isFinite(height)) return;
    const current = heightsRef.current.get(key);
    if (current !== undefined && Math.abs(current - height) < 0.5) {
      return;
    }
    heightsRef.current.set(key, height);
    forceLayoutRecalc((version) => version + 1);
  }, []);

  const { positions, containerHeight, columnWidth }: LayoutResult = useMemo(() => {
    const layoutPositions = new Map<string, Position>();
    let resolvedColumnWidth = 0;
    let resolvedHeight = 0;

    if (containerWidth <= 0 || items.length === 0) {
      return { positions: layoutPositions, containerHeight: resolvedHeight, columnWidth: resolvedColumnWidth };
    }

    const keys = items.map((item, index) => (getKey ? getKey(item, index) : String(index)));
    const keySet = new Set(keys);
    // Remove stale measurements
    for (const existingKey of Array.from(heightsRef.current.keys())) {
      if (!keySet.has(existingKey)) {
        heightsRef.current.delete(existingKey);
      }
    }

    const effectiveMinWidth = Math.max(1, minColumnWidth);
    const columnCount = Math.max(1, Math.floor((containerWidth + gap) / (effectiveMinWidth + gap)));
    resolvedColumnWidth = Math.max(
      1,
      (containerWidth - gap * (columnCount - 1)) / columnCount
    );
    const fallbackHeight = resolvedColumnWidth * (9 / 16) + 120;
    const columnHeights = new Array(columnCount).fill(0);

    keys.forEach((key) => {
      const measuredHeight = heightsRef.current.get(key);
      const itemHeight = measuredHeight && measuredHeight > 0 ? measuredHeight : fallbackHeight;
      let targetColumn = 0;
      let smallestHeight = columnHeights[0];
      for (let col = 1; col < columnCount; col += 1) {
        if (columnHeights[col] < smallestHeight) {
          smallestHeight = columnHeights[col];
          targetColumn = col;
        }
      }
      const top = columnHeights[targetColumn];
      const left = targetColumn * (resolvedColumnWidth + gap);
      layoutPositions.set(key, { top, left });
      columnHeights[targetColumn] = top + itemHeight + gap;
    });

    resolvedHeight = columnHeights.reduce((max, value) => Math.max(max, value), 0);
    if (resolvedHeight > 0) {
      resolvedHeight -= gap;
    }

    return {
      positions: layoutPositions,
      containerHeight: resolvedHeight,
      columnWidth: resolvedColumnWidth,
    };
  }, [containerWidth, gap, getKey, items, minColumnWidth]);

  return (
    <div
      ref={containerRef}
      className={clsx('relative w-full', className)}
      style={{ ...style, height: containerHeight }}
    >
      {columnWidth > 0 &&
        items.map((item, index) => {
          const key = getKey ? getKey(item, index) : String(index);
          const position = positions.get(key);
          const ready = Boolean(position);
        const itemStyle: CSSProperties = ready
          ? {
              top: position!.top,
              left: position!.left,
              opacity: 1,
            }
          : {
              opacity: 0,
              transform: 'translateY(8px)',
            };

          return (
            <MasonryItem
              key={key}
              itemKey={key}
              onResize={registerItem}
              columnWidth={columnWidth}
              style={itemStyle}
              ready={ready}
            >
              {renderItem(item, index)}
            </MasonryItem>
          );
        })}
    </div>
  );
}

function MasonryItem({
  itemKey,
  onResize,
  columnWidth,
  style,
  ready,
  children,
}: {
  itemKey: string;
  onResize: (key: string, height: number) => void;
  columnWidth: number;
  style: CSSProperties;
  ready: boolean;
  children: ReactNode;
}) {
  const elementRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = elementRef.current;
    if (!node) return;
    onResize(itemKey, node.getBoundingClientRect().height);
  }, [itemKey, onResize]);

  useEffect(() => {
    const node = elementRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { height } = entries[0].contentRect;
      onResize(itemKey, height);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [itemKey, onResize]);

  return (
    <div
      ref={elementRef}
      style={{
        position: 'absolute',
        width: columnWidth,
        transition: 'top 180ms ease, left 180ms ease, opacity 160ms ease, transform 160ms ease',
        pointerEvents: ready ? undefined : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
