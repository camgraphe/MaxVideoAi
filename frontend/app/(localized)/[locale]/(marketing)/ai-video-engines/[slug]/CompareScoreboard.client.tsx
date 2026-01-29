'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';

export type CompareMetric = {
  id: string;
  label: string;
  leftValue: number | null;
  rightValue: number | null;
};

type CompareScoreboardProps = {
  leftLabel: string;
  rightLabel: string;
  metrics: CompareMetric[];
  className?: string;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(10, value));
}

function formatScore(value: number | null) {
  if (typeof value !== 'number') return '-';
  return value.toFixed(1);
}

function winnerSide(left: number | null, right: number | null): 'left' | 'right' | 'none' {
  if (typeof left !== 'number' || typeof right !== 'number') return 'none';
  if (left - right > 0.3) return 'left';
  if (right - left > 0.3) return 'right';
  return 'none';
}

export function CompareScoreboard({
  leftLabel,
  rightLabel,
  metrics,
  className,
}: CompareScoreboardProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [animateBars, setAnimateBars] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAnimateBars(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setAnimateBars(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  const rows = useMemo(
    () =>
      metrics.map((metric) => {
        const leftValue = typeof metric.leftValue === 'number' ? clampScore(metric.leftValue) : null;
        const rightValue = typeof metric.rightValue === 'number' ? clampScore(metric.rightValue) : null;
        return {
          ...metric,
          leftValue,
          rightValue,
          winner: winnerSide(leftValue, rightValue),
        };
      }),
    [metrics]
  );

  return (
    <div ref={containerRef} className={clsx('grid gap-4', className)}>
      {rows.map((row) => {
        const leftWidth = typeof row.leftValue === 'number' ? `${row.leftValue * 10}%` : '0%';
        const rightWidth = typeof row.rightValue === 'number' ? `${row.rightValue * 10}%` : '0%';
        const leftBarClass =
          row.winner === 'left' ? 'bg-emerald-500' : row.winner === 'right' ? 'bg-orange-500' : 'bg-surface-2';
        const rightBarClass =
          row.winner === 'right' ? 'bg-emerald-500' : row.winner === 'left' ? 'bg-orange-500' : 'bg-surface-2';

        return (
          <div
            key={row.id}
            className="grid items-center gap-3 grid-cols-[minmax(0,1fr)_minmax(140px,0.8fr)_minmax(0,1fr)] sm:gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(200px,1fr)_minmax(0,1.6fr)] lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_minmax(0,2fr)]"
          >
            <div className="flex items-center justify-end gap-2">
              <div className="relative h-[7px] w-full max-w-[120px] sm:max-w-[160px] lg:max-w-[180px] overflow-hidden rounded-full bg-surface-3">
                <div
                  className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', leftBarClass)}
                  style={{
                    width: animateBars ? leftWidth : '0%',
                    marginLeft: 'auto',
                  }}
                />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-text-primary sm:text-xs">
                <span className="w-8 text-right tabular-nums">{formatScore(row.leftValue)}</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-medium text-text-muted sm:text-xs">{row.label}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-text-primary sm:text-xs">
                <span className="w-8 tabular-nums">{formatScore(row.rightValue)}</span>
              </div>
              <div className="relative h-[7px] w-full max-w-[120px] sm:max-w-[160px] lg:max-w-[180px] overflow-hidden rounded-full bg-surface-3">
                <div
                  className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', rightBarClass)}
                  style={{
                    width: animateBars ? rightWidth : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
