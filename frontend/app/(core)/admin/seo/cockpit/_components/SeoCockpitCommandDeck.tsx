import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleGauge,
  ClipboardList,
  FileQuestion,
  Gauge,
  Layers3,
  MousePointerClick,
  Network,
  RadioTower,
  Search,
  SearchCheck,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { GscRangeKey } from '@/lib/seo/gsc-analysis';
import { getSeoFamilyDictionary } from '@/lib/seo/seo-intents';
import type { SeoCockpitData } from '@/server/seo/cockpit';

const numberFormatter = new Intl.NumberFormat('en-US');
const compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const precisePercentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function SeoCommandDeck({
  data,
  range,
  urlInspectionCount,
}: {
  data: SeoCockpitData;
  range: GscRangeKey;
  urlInspectionCount: number;
}) {
  const statusTone = data.gsc.ok ? 'text-success' : data.gsc.configured ? 'text-warning' : 'text-info';
  const familyCount = getSeoFamilyDictionary().length;

  return (
    <section className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-card">
      <div className="grid xl:grid-cols-[minmax(0,1.35fr)_380px]">
        <div className="border-b border-hairline px-5 py-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Command deck</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-normal text-text-primary">SEO Cockpit</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Action-first read of MaxVideoAI Search Console demand, model-family priority, and Codex implementation work.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/seo/gsc?range=${range}`}
                prefetch={false}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-hairline bg-bg px-3 text-xs font-semibold text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              >
                Raw GSC
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/admin/seo/actions?range=${range}`}
                prefetch={false}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white shadow-[0_14px_35px_rgba(15,23,42,0.18)] transition hover:bg-slate-800"
              >
                Action Queue
                <ClipboardList className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-4">
            <CommandMetric icon={MousePointerClick} label="Clicks" value={numberFormatter.format(data.gsc.summary.clicks)} helper="GSC property total" />
            <CommandMetric icon={BarChart3} label="Impressions" value={compactFormatter.format(data.gsc.summary.impressions)} helper="GSC property total" tone="info" />
            <CommandMetric icon={CircleGauge} label="CTR" value={precisePercentFormatter.format(data.gsc.summary.ctr)} helper="Average click-through" tone={data.gsc.summary.ctr < 0.015 ? 'warning' : 'success'} />
            <CommandMetric icon={TrendingUp} label="Avg position" value={positionFormatter.format(data.gsc.summary.position)} helper="Weighted rank" />
            <CommandMetric icon={Search} label="Visible detail clicks" value={numberFormatter.format(data.gsc.detailSummary.clicks)} helper={`${formatShare(data.gsc.detailSummary.clicks, data.gsc.summary.clicks)} of total`} tone="info" />
            <CommandMetric icon={Target} label="High actions" value={numberFormatter.format(data.overview.highPriorityActions)} helper="Critical or high" tone={data.overview.highPriorityActions ? 'warning' : 'success'} />
            <CommandMetric icon={AlertTriangle} label="Opportunities" value={numberFormatter.format(data.overview.totalOpportunities)} helper="Strategic clusters" tone={data.overview.totalOpportunities ? 'warning' : 'default'} />
            <CommandMetric icon={FileQuestion} label="Missing content" value={numberFormatter.format(data.missingContentItems.length)} helper="Sections, FAQs, pages" tone={data.missingContentItems.length ? 'info' : 'default'} />
            <CommandMetric icon={Network} label="Internal links" value={numberFormatter.format(data.internalLinkSuggestions.length)} helper="Source to target suggestions" tone={data.internalLinkSuggestions.length ? 'info' : 'default'} />
            <CommandMetric icon={Activity} label="Momentum" value={numberFormatter.format(data.momentumItems.length)} helper="Rising and declining signals" tone={data.momentumItems.length ? 'info' : 'default'} />
            <CommandMetric icon={SearchCheck} label="URL inspection" value={numberFormatter.format(urlInspectionCount)} helper="Curated index checks" tone="info" />
            <CommandMetric icon={Sparkles} label="Strongest family" value={data.overview.strongestFamily?.family ?? 'None'} helper={data.overview.strongestFamily ? `${compactFormatter.format(data.overview.strongestFamily.impressions)} impressions` : `${familyCount} real families tracked`} tone="success" />
            <CommandMetric icon={Gauge} label="Weak CTR family" value={data.overview.weakestCtrFamily?.family ?? 'None'} helper={data.overview.weakestCtrFamily ? precisePercentFormatter.format(data.overview.weakestCtrFamily.ctr) : 'No weak family rows'} tone={data.overview.weakestCtrFamily ? 'warning' : 'default'} />
          </div>
        </div>

        <aside className="bg-bg/45 px-5 py-5">
          <div className="grid gap-3">
            <StatusTile
              icon={data.gsc.ok ? CheckCircle2 : AlertTriangle}
              label="GSC status"
              value={data.gsc.ok ? 'Connected' : data.gsc.configured ? 'Stale/error' : 'Not configured'}
              helper={data.gsc.fetchedAt ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}` : 'No refreshed snapshot'}
              className={statusTone}
            />
            <StatusTile
              icon={RadioTower}
              label="Window"
              value={`${data.gsc.windows.current.startDate} to ${data.gsc.windows.current.endDate}`}
              helper={`Previous: ${data.gsc.windows.previous.startDate} to ${data.gsc.windows.previous.endDate}`}
            />
            <StatusTile
              icon={Layers3}
              label="Family dictionary"
              value={`${familyCount} app families`}
              helper="Derived from MaxVideoAI model-family config"
            />
          </div>
        </aside>
      </div>
    </section>
  );
}

function CommandMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'default',
}: {
  icon: typeof Search;
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'success' | 'warning' | 'info';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'info'
          ? 'text-info'
          : 'text-text-primary';
  return (
    <div className="bg-surface px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className={`mt-2 text-[1.45rem] font-semibold leading-tight ${toneClass}`}>{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
        </div>
        <Icon className="h-4 w-4 shrink-0 text-text-muted" />
      </div>
    </div>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  helper,
  className = 'text-text-primary',
}: {
  icon: typeof Search;
  label: string;
  value: string;
  helper: string;
  className?: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-bg text-text-secondary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</p>
          <p className={`mt-1 truncate text-sm font-semibold ${className}`}>{value}</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function formatShare(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0.00%';
  return precisePercentFormatter.format(Math.max(0, Math.min(1, part / total)));
}
