'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MetricsRangeLabel } from '@/lib/admin/types';
import type { ChartGranularity, FocusMetric } from '../_lib/insights-types';
import { buildInsightsHref, FOCUS_OPTIONS } from '../_lib/insights-navigation';

type ControlState = {
  current: MetricsRangeLabel;
  days: number;
  excludeAdmin: boolean;
  focus: FocusMetric;
  grain: ChartGranularity;
  compare: boolean;
};

const PRESETS: Array<{ value: MetricsRangeLabel; label: string }> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function InsightsControls({ current, days, excludeAdmin, focus, grain, compare }: ControlState) {
  const [openMenu, setOpenMenu] = useState<'custom' | 'granularity' | null>(null);
  const href = (overrides: Partial<{ range: MetricsRangeLabel; grain: ChartGranularity; compare: boolean; excludeAdmin: boolean }>) => {
    const range = overrides.range ?? current;
    return buildInsightsHref({
      range,
      days,
      excludeAdmin: overrides.excludeAdmin ?? excludeAdmin,
      focus,
      grain: range === '24h' || range === '7d' ? 'daily' : overrides.grain ?? grain,
      compare: overrides.compare ?? compare,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-hairline py-3">
      <div className="flex flex-wrap items-center gap-1" aria-label="Insights period">
        {PRESETS.map((option) => (
          <Link
            key={option.value}
            href={href({ range: option.value })}
            onClick={() => setOpenMenu(null)}
            aria-current={current === option.value ? 'page' : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-brand ${current === option.value ? 'bg-brand text-on-brand' : 'text-text-secondary hover:bg-bg hover:text-text-primary'}`}
          >
            {option.label}
          </Link>
        ))}
        <div className="relative">
          <button type="button" aria-expanded={openMenu === 'custom'} aria-controls="insights-custom-period" onClick={() => setOpenMenu(openMenu === 'custom' ? null : 'custom')} className={`rounded-md px-3 py-2 text-sm font-medium transition ${current === 'custom' ? 'bg-brand text-on-brand' : 'text-text-secondary hover:bg-bg hover:text-text-primary'}`}>
            Custom days{current === 'custom' ? ` · ${days}d` : ''}
          </button>
          {openMenu === 'custom' ? <form id="insights-custom-period" action="/admin/insights" method="get" className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-border bg-surface p-4 shadow-lg">
            <input type="hidden" name="range" value="custom" />
            <input type="hidden" name="excludeAdmin" value={excludeAdmin ? '1' : '0'} />
            <input type="hidden" name="focus" value={focus} />
            {grain !== 'daily' ? <input type="hidden" name="grain" value={grain} /> : null}
            {!compare ? <input type="hidden" name="compare" value="0" /> : null}
            <label htmlFor="insights-custom-days" className="block text-sm font-medium text-text-primary">Last number of days</label>
            <p className="mt-1 text-xs text-text-secondary">Choose 2 to 90 days ending today.</p>
            <div className="mt-3 flex gap-2">
              <input id="insights-custom-days" type="number" name="days" min="2" max="90" required defaultValue={current === 'custom' ? days : 45} className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary" />
              <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-on-brand">Apply</button>
            </div>
          </form> : null}
        </div>
      </div>

      <div className="hidden h-6 border-l border-hairline lg:block" aria-hidden />

      <div className="relative">
        <button type="button" aria-expanded={openMenu === 'granularity'} aria-controls="insights-granularity-options" onClick={() => setOpenMenu(openMenu === 'granularity' ? null : 'granularity')} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-text-secondary hover:text-text-primary">
          <span className="inline-flex items-center gap-2">{grain === 'daily' ? 'Daily' : '7-day totals'} <ChevronDown size={14} aria-hidden /></span>
        </button>
        {openMenu === 'granularity' ? <div id="insights-granularity-options" className="absolute left-0 top-full z-20 mt-2 min-w-44 rounded-lg border border-border bg-surface p-1 shadow-lg">
          <Link href={href({ grain: 'daily' })} onClick={() => setOpenMenu(null)} aria-current={grain === 'daily' ? 'page' : undefined} className="block rounded px-3 py-2 text-sm text-text-primary hover:bg-bg">Daily</Link>
          {days >= 14 ? <Link href={href({ grain: 'weekly' })} onClick={() => setOpenMenu(null)} aria-current={grain === 'weekly' ? 'page' : undefined} className="block rounded px-3 py-2 text-sm text-text-primary hover:bg-bg">7-day totals</Link> : null}
        </div> : null}
      </div>

      <Link
        href={href({ compare: !compare })}
        onClick={() => setOpenMenu(null)}
        role="switch"
        aria-checked={compare}
        aria-label="Compare previous period on chart"
        className="inline-flex items-center gap-2 text-sm text-text-secondary focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${compare ? 'bg-brand' : 'bg-hairline'}`} aria-hidden>
          <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition ${compare ? 'translate-x-4' : ''}`} />
        </span>
        Compare on chart
      </Link>

      <Link
        href={href({ excludeAdmin: !excludeAdmin })}
        onClick={() => setOpenMenu(null)}
        className={`ml-auto rounded-md border px-3 py-1.5 text-xs font-medium transition ${excludeAdmin ? 'border-success-border bg-success-bg text-success' : 'border-border text-text-secondary hover:bg-bg'}`}
      >
        {excludeAdmin ? 'Internal activity excluded' : 'Include internal activity'}
      </Link>
    </div>
  );
}

export function MetricFocusTabs({
  current,
  range,
  days,
  excludeAdmin,
  grain,
  compare,
}: {
  current: FocusMetric;
  range: MetricsRangeLabel;
  days: number;
  excludeAdmin: boolean;
  grain: ChartGranularity;
  compare: boolean;
}) {
  return (
    <nav aria-label="Chart metric" className="flex flex-wrap gap-x-6 gap-y-1">
      {FOCUS_OPTIONS.map((option) => (
        <Link
          key={option.key}
          href={buildInsightsHref({ range, days, excludeAdmin, focus: option.key, grain, compare })}
          aria-current={current === option.key ? 'page' : undefined}
          className={`border-b-2 px-1 py-3 text-sm font-medium transition ${current === option.key ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}
