import Link from 'next/link';
import type { PrioritySignal, PulseCard, SmallStat } from '../_lib/insights-types';
import { toneBadgeClass, toneValueClass } from '../_lib/insights-formatters';

export function PrioritySignalPanel({
  signals,
  humanRange,
}: {
  signals: PrioritySignal[];
  humanRange: string;
}) {
  return (
    <div className="px-5 py-5">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Priority queue</p>
        <p className="mt-1 text-sm text-text-secondary">What needs attention in the current {humanRange} before drilling into users, jobs or billing.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
        <div className="divide-y divide-hairline">
          {signals.map((signal) => (
            <Link key={signal.label} href={signal.href} className="flex items-start justify-between gap-4 px-4 py-4 transition hover:bg-bg">
              <div>
                <p className="text-sm font-medium text-text-primary">{signal.label}</p>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{signal.helper}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${toneValueClass(signal.tone)}`}>{signal.value}</p>
                <p className="mt-1 text-[11px] text-text-muted">Open</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WindowPulseGrid({
  cards,
  humanRange,
  className = '',
}: {
  cards: PulseCard[];
  humanRange: string;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-hairline bg-bg/40 ${className}`}>
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Window pulse</p>
        <p className="mt-1 text-sm text-text-secondary">Current {humanRange} compared to the previous {humanRange}.</p>
      </div>
      <div className="grid gap-px bg-hairline sm:grid-cols-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-surface px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{card.label}</p>
                <p className="mt-1 text-xs text-text-secondary">Previous {card.previousValue}</p>
              </div>
              <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${toneBadgeClass(card.tone)}`}>{card.delta}</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-text-primary">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-text-secondary">{card.helper}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MetricSnapshotPanel({
  title,
  items,
}: {
  title: string;
  items: SmallStat[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">Current window, previous window and the most useful reading cues for the selected metric.</p>
      </div>
      <div className="divide-y divide-hairline">
        {items.map((item) => (
          <div key={item.label} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{item.label}</p>
                {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
              </div>
              <p className={`text-sm font-semibold ${toneValueClass(item.tone)}`}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NarrativePanel({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-bg/40">
      <div className="border-b border-hairline px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
        <p className="mt-1 text-sm text-text-secondary">Short narrative cues extracted from the current window to reduce scanning time.</p>
      </div>
      <ul className="space-y-3 px-4 py-4 text-sm text-text-secondary">
        {lines.map((line, index) => (
          <li key={`${title}-${index}`} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatStrip({ items, className = '' }: { items: SmallStat[]; className?: string }) {
  return (
    <div className={`grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{item.label}</p>
          <p className={`mt-1 text-sm font-semibold ${toneValueClass(item.tone)}`}>{item.value}</p>
          {item.helper ? <p className="mt-1 text-xs leading-5 text-text-secondary">{item.helper}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function SummaryCell({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string;
  helper: string;
  tone?: SmallStat['tone'];
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
      <p className={`mt-2 text-lg font-semibold ${toneValueClass(tone)}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
    </div>
  );
}
