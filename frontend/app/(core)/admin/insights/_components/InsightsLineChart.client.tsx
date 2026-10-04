'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { ChartPoint, ChartTheme } from '../_lib/insights-types';
import { chartLabelIndices } from '../_lib/insights-chart-model';
import { formatAxisCurrency, formatCompactNumber, formatCurrency, formatNumber } from '../_lib/insights-formatters';

const INITIAL_WIDTH = 1000;
const HEIGHT = 320;
const PLOT = { left: 52, top: 22, right: 24, bottom: 46 };

type InsightsLineChartProps = {
  ariaLabel: string;
  currentPoints: ChartPoint[];
  previousPoints: ChartPoint[];
  showComparison: boolean;
  theme: ChartTheme;
  valueKind: 'count' | 'currency';
  ticks: number[];
  tabs: ReactNode;
  lastPointIsPartial: boolean;
};

export function InsightsLineChart({
  ariaLabel,
  currentPoints,
  previousPoints,
  showComparison,
  theme,
  valueKind,
  ticks,
  tabs,
  lastPointIsPartial,
}: InsightsLineChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showPoints, setShowPoints] = useState(currentPoints.length <= 30);
  const [showTable, setShowTable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(INITIAL_WIDTH);
  const chartRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const plotWidth = canvasWidth - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const maxTick = ticks[ticks.length - 1] || 1;
  const xAt = (index: number) => PLOT.left + (currentPoints.length === 1 ? plotWidth / 2 : (index * plotWidth) / (currentPoints.length - 1));
  const yAt = (value: number) => PLOT.top + plotHeight - (value / maxTick) * plotHeight;
  const pathFor = (points: ChartPoint[]) => points.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point.value).toFixed(2)}`,
  ).join(' ');
  const formatValue = (value: number) => valueKind === 'currency'
    ? formatCurrency(value, { precise: value < 100 })
    : formatNumber(value);
  const formatAxis = valueKind === 'currency' ? formatAxisCurrency : formatCompactNumber;
  const current = activeIndex == null ? null : currentPoints[activeIndex];
  const previous = activeIndex == null ? null : previousPoints[activeIndex];
  const completeCurrentPoints = lastPointIsPartial ? currentPoints.slice(0, -1) : currentPoints;
  const partialPoint = lastPointIsPartial ? currentPoints.at(-1) : undefined;
  const activeX = activeIndex == null ? 0 : xAt(activeIndex);
  const activeY = current ? yAt(current.value) : 0;
  const hasActivity = currentPoints.some((point) => point.value > 0) ||
    (showComparison && previousPoints.some((point) => point.value > 0));

  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCanvasWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function movePointer(event: PointerEvent<SVGSVGElement>) {
    if (!currentPoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * canvasWidth;
    const index = currentPoints.length === 1 ? 0 : Math.round(((viewX - PLOT.left) / plotWidth) * (currentPoints.length - 1));
    setActiveIndex(Math.max(0, Math.min(currentPoints.length - 1, index)));
  }

  function moveKeyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!currentPoints.length) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const start = activeIndex ?? (event.key === 'ArrowLeft' ? currentPoints.length : -1);
      setActiveIndex(Math.max(0, Math.min(currentPoints.length - 1, start + (event.key === 'ArrowLeft' ? -1 : 1))));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setActiveIndex(event.key === 'Home' ? 0 : currentPoints.length - 1);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-hairline">
        <div className="min-w-0">{tabs}</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.bar }} />Current period</span>
            {showComparison ? <span className="inline-flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-slate-400" />Previous period</span> : null}
          </div>
          <div className="relative">
            <button
              type="button"
              aria-expanded={settingsOpen}
              aria-controls={`${helpId}-settings`}
              onClick={() => setSettingsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-brand/40 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Customize
            </button>
            {settingsOpen ? (
              <div id={`${helpId}-settings`} className="absolute right-0 top-full z-20 mt-2 w-52 rounded-lg border border-border bg-surface p-3 shadow-lg">
                <p className="mb-2 text-xs font-semibold text-text-primary">Chart display</p>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text-secondary">
                  <input type="checkbox" checked={showPoints} onChange={(event) => setShowPoints(event.target.checked)} /> Show data points
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-xs text-text-secondary">
                  <input type="checkbox" checked={showTable} onChange={(event) => setShowTable(event.target.checked)} /> Show data table
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <p id={helpId} className="sr-only">Move over the chart to inspect values, or focus it and use the left and right arrow keys.</p>
      <div className="pt-3 pb-1">
        <div ref={chartRef} className="relative min-w-0">
          <svg
            viewBox={`0 0 ${canvasWidth} ${HEIGHT}`}
            className="block h-[320px] w-full cursor-crosshair"
            role="img"
            aria-label={ariaLabel}
            aria-describedby={helpId}
            tabIndex={0}
            onPointerMove={movePointer}
            onPointerLeave={() => setActiveIndex(null)}
            onKeyDown={moveKeyboard}
          >
            {ticks.map((tick) => {
              const y = yAt(tick);
              return (
                <g key={tick}>
                  <line x1={PLOT.left} x2={canvasWidth - PLOT.right} y1={y} y2={y} stroke="var(--hairline)" strokeDasharray={tick === 0 ? undefined : '3 4'} />
                  <text x={PLOT.left - 12} y={y + 4} textAnchor="end" fontSize="12" fill="var(--text-muted)">{formatAxis(tick)}</text>
                </g>
              );
            })}
            {chartLabelIndices(currentPoints.length, canvasWidth < 520 ? 3 : 5).map((index) => (
              <text key={index} x={xAt(index)} y={HEIGHT - 12} textAnchor={index === 0 ? 'start' : index === currentPoints.length - 1 ? 'end' : 'middle'} fontSize="12" fill="var(--text-muted)">
                {currentPoints[index]?.label}
              </text>
            ))}
            {showComparison && previousPoints.length > 1 ? <path d={pathFor(previousPoints)} fill="none" stroke={theme.line} strokeWidth="2" strokeDasharray="6 6" strokeLinejoin="round" /> : null}
            {showComparison && previousPoints.length === 1 ? <circle cx={xAt(0)} cy={yAt(previousPoints[0].value)} r="6" fill="white" stroke={theme.line} strokeWidth="2" /> : null}
            {completeCurrentPoints.length > 1 ? <path d={pathFor(completeCurrentPoints)} fill="none" stroke={theme.bar} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {partialPoint && completeCurrentPoints.length ? <line x1={xAt(completeCurrentPoints.length - 1)} y1={yAt(completeCurrentPoints[completeCurrentPoints.length - 1].value)} x2={xAt(currentPoints.length - 1)} y2={yAt(partialPoint.value)} stroke={theme.bar} strokeWidth="2" strokeDasharray="4 5" /> : null}
            {showPoints ? completeCurrentPoints.map((point, index) => <circle key={`${point.date}-${index}`} cx={xAt(index)} cy={yAt(point.value)} r="2.5" fill={theme.bar} />) : null}
            {completeCurrentPoints.length === 1 ? <circle cx={xAt(0)} cy={yAt(completeCurrentPoints[0].value)} r="5" fill={theme.bar} /> : null}
            {partialPoint ? <circle cx={xAt(currentPoints.length - 1)} cy={yAt(partialPoint.value)} r="5" fill="white" stroke={theme.bar} strokeWidth="2.5" /> : null}
            {current ? (
              <g aria-hidden="true">
                <line x1={activeX} x2={activeX} y1={PLOT.top} y2={PLOT.top + plotHeight} stroke={theme.line} strokeDasharray="4 4" />
                <circle cx={activeX} cy={activeY} r="6" fill={theme.bar} stroke="white" strokeWidth="2" />
                {showComparison && previous ? <circle cx={activeX} cy={yAt(previous.value)} r="5" fill={theme.line} stroke="white" strokeWidth="2" /> : null}
              </g>
            ) : null}
            {!hasActivity ? <text x={canvasWidth / 2} y={HEIGHT / 2} textAnchor="middle" fontSize="14" fill="var(--text-muted)">No activity in this period</text> : null}
          </svg>
          {current ? (
            <div
              className="pointer-events-none absolute z-10 min-w-40 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-sm"
              style={{ left: `${Math.min(canvasWidth - 180, Math.max(8, activeX - 80))}px`, top: `${Math.max(5, (activeY / HEIGHT) * 100 - 25)}%` }}
            >
              <p className="mb-1.5 font-semibold text-text-primary">{current.label}</p>
              {lastPointIsPartial && activeIndex === currentPoints.length - 1 ? <p className="mb-1 text-text-muted">Includes today (in progress)</p> : null}
              {current.bucketDays && current.bucketDays < 7 ? <p className="mb-1 text-text-muted">Partial total · {current.bucketDays} days</p> : null}
              <p className="flex justify-between gap-4 text-text-secondary"><span>Current</span><strong className="text-text-primary">{formatValue(current.value)}</strong></p>
              {showComparison && previous ? <p className="mt-1 flex justify-between gap-4 text-text-secondary"><span>Previous · {previous.label}</span><strong className="text-text-primary">{formatValue(previous.value)}</strong></p> : null}
            </div>
          ) : null}
        </div>
      </div>

      {showTable ? (
        <div className="mt-4 max-h-72 overflow-auto border-y border-hairline">
          <table className="w-full min-w-[420px] text-left text-xs">
            <caption className="sr-only">{ariaLabel} data</caption>
            <thead className="sticky top-0 bg-surface text-text-muted"><tr><th className="px-3 py-2">Period</th><th className="px-3 py-2 text-right">Current</th>{showComparison ? <th className="px-3 py-2 text-right">Previous</th> : null}</tr></thead>
            <tbody className="divide-y divide-hairline">
              {currentPoints.map((point, index) => <tr key={`${point.date}-${index}`}><th className="px-3 py-2 font-medium text-text-primary">{point.label}{point.bucketDays && point.bucketDays < 7 ? ` · ${point.bucketDays} days` : ''}{lastPointIsPartial && index === currentPoints.length - 1 ? ' · in progress' : ''}</th><td className="px-3 py-2 text-right tabular-nums">{formatValue(point.value)}</td>{showComparison ? <td className="px-3 py-2 text-right tabular-nums">{formatValue(previousPoints[index]?.value ?? 0)}</td> : null}</tr>)}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
