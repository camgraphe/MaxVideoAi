import Link from 'next/link';
import { ExternalLink, Filter, Stethoscope } from 'lucide-react';
import { SeoCopyButton } from '@/components/admin/SeoCopyButton';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { normalizeGscRange, type GscRangeKey } from '@/lib/seo/gsc-analysis';
import type { CtrDoctorItem, SeoActionPriority } from '@/lib/seo/internal-seo-types';
import { compactIntentLabel } from '@/lib/seo/seo-intents';
import { stripOrigin } from '@/lib/seo/seo-opportunity-engine';
import { fetchSeoCockpitData } from '@/server/seo/cockpit';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    range?: string | string[];
    priority?: string | string[];
  };
};

const RANGE_OPTIONS: Array<{ value: GscRangeKey; label: string }> = [
  { value: '7d', label: '7 days' },
  { value: '28d', label: '28 days' },
  { value: '3m', label: '3 months' },
];

const priorityOptions: Array<SeoActionPriority | 'all'> = ['all', 'critical', 'high', 'medium', 'low'];
const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const positionFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export default async function AdminSeoCtrDoctorPage({ searchParams }: PageProps) {
  const range = normalizeGscRange(firstParam(searchParams?.range));
  const selectedPriority = normalizePriority(firstParam(searchParams?.priority));
  const data = await fetchSeoCockpitData({ range });
  const items = data.ctrDoctorItems.filter((item) => selectedPriority === 'all' || item.priority === selectedPriority);
  const cacheSummary = data.gsc.fetchedAt
    ? `Last refreshed at ${dateTimeFormatter.format(new Date(data.gsc.fetchedAt))}.`
    : 'No refreshed GSC snapshot yet.';

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="SEO"
        title="CTR Doctor"
        description="Snippet, title, meta, H1, and above-the-fold recommendations generated from cached Search Console clusters."
        actions={
          <>
            <RangeTabs current={range} />
            <AdminActionLink href={`/admin/seo/cockpit?range=${range}`} prefetch={false}>
              Cockpit
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/gsc?range=${range}`} prefetch={false}>
              Raw GSC
            </AdminActionLink>
            <AdminActionLink href={`/admin/seo/actions?range=${range}`} prefetch={false}>
              Action queue
            </AdminActionLink>
          </>
        }
      />

      {data.gsc.error ? (
        <AdminNotice tone={data.gsc.configured ? 'warning' : 'info'}>
          {data.gsc.error}
          {data.gsc.fetchedAt ? ' Showing the latest cached snapshot.' : ''}
        </AdminNotice>
      ) : null}

      <AdminSection
        title="CTR Review Queue"
        description={`${numberFormatter.format(items.length)} of ${numberFormatter.format(data.ctrDoctorItems.length)} CTR Doctor items visible. ${cacheSummary}`}
        action={<span className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary"><Filter className="h-3.5 w-3.5" /> Cached GSC only</span>}
      >
        <div className="flex flex-wrap gap-2">
          {priorityOptions.map((priority) => (
            <Link
              key={priority}
              href={buildPriorityHref(range, priority)}
              prefetch={false}
              className={
                selectedPriority === priority
                  ? 'rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-lg border border-hairline bg-bg px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }
            >
              {labelize(priority)}
            </Link>
          ))}
        </div>
      </AdminSection>

      <AdminSection
        title="Snippet Prescriptions"
        description="Each card is a review brief for Codex or a human editor. It does not claim current metadata unless a safe metadata snapshot exists."
      >
        {items.length ? (
          <div className="grid gap-4">
            {items.map((item) => (
              <CtrDoctorDetails key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <AdminEmptyState>
            <p className="font-semibold text-text-primary">No CTR Doctor items</p>
            <p className="mt-1">Refresh GSC manually or clear the priority filter.</p>
          </AdminEmptyState>
        )}
      </AdminSection>
    </div>
  );
}

function CtrDoctorDetails({ item }: { item: CtrDoctorItem }) {
  return (
    <article className="rounded-2xl border border-hairline bg-bg/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={item.priority} />
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{item.modelFamily}</span>
            <span className="rounded-full border border-hairline bg-surface-2 px-2 py-1 text-[11px] font-semibold text-text-secondary">{compactIntentLabel(item.detectedIntent)}</span>
          </div>
          <h2 className="mt-3 text-base font-semibold leading-6 text-text-primary">{item.title}</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{item.likelyProblem}</p>
        </div>
        <SeoCopyButton value={item.codexTaskDraft} />
      </div>

      <div className="mt-4 grid gap-4 border-t border-hairline pt-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          <Prescription title="Title direction" body={item.recommendedTitleDirection} />
          <Prescription title="Meta direction" body={item.recommendedMetaDescriptionDirection} />
          <Prescription title="H1 / section" body={item.recommendedH1SectionDirection} />
          <Prescription title="Above the fold" body={item.aboveTheFoldRecommendation} />
        </div>
        <aside className="space-y-3">
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-text-muted" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Metrics</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <Metric label="Clicks" value={numberFormatter.format(item.currentMetrics.clicks)} />
              <Metric label="Impr." value={numberFormatter.format(item.currentMetrics.impressions)} />
              <Metric label="CTR" value={percentFormatter.format(item.currentMetrics.ctr)} />
              <Metric label="Position" value={positionFormatter.format(item.currentMetrics.averagePosition)} />
            </div>
          </div>
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Target</p>
            {item.targetUrl ? (
              <a href={item.targetUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
                <span className="truncate">{stripOrigin(item.targetUrl)}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <p className="mt-2 text-sm text-text-secondary">No target URL</p>
            )}
          </div>
          <div className="rounded-2xl border border-hairline bg-surface p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Metadata source</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {item.currentMetadata ? item.currentMetadata.source : 'No metadata snapshot loaded in CTR Doctor 2B-1; review target files before editing.'}
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}

function Prescription({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{title}</p>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-bg px-2 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</p>
      <p className="mt-1 font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function RangeTabs({ current }: { current: GscRangeKey }) {
  return (
    <div className="inline-flex rounded-lg border border-hairline bg-bg p-1">
      {RANGE_OPTIONS.map((option) => (
        <Link
          key={option.value}
          href={`/admin/seo/ctr-doctor?range=${option.value}`}
          prefetch={false}
          className={
            option.value === current
              ? 'rounded-md bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white'
              : 'rounded-md px-3 py-1.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

function PriorityPill({ priority }: { priority: SeoActionPriority }) {
  const base = 'inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]';
  if (priority === 'critical') return <span className={`${base} border-warning-border bg-warning-bg text-warning`}>Critical</span>;
  if (priority === 'high') return <span className={`${base} border-info/25 bg-info/10 text-info`}>High</span>;
  if (priority === 'medium') return <span className={`${base} border-hairline bg-surface-2 text-text-secondary`}>Medium</span>;
  return <span className={`${base} border-hairline bg-surface text-text-muted`}>Low</span>;
}

function buildPriorityHref(range: GscRangeKey, priority: SeoActionPriority | 'all') {
  const params = new URLSearchParams({ range });
  if (priority !== 'all') params.set('priority', priority);
  return `/admin/seo/ctr-doctor?${params.toString()}`;
}

function normalizePriority(value?: string | null): SeoActionPriority | 'all' {
  if (value === 'critical' || value === 'high' || value === 'medium' || value === 'low') return value;
  return 'all';
}

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function labelize(value: string) {
  if (value === 'all') return 'All';
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
