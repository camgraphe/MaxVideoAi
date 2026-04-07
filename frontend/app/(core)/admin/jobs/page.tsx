import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, History, ReceiptText, ShieldAlert } from 'lucide-react';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import { fetchRecentJobAudits } from '@/server/admin-job-audit';
import { AdminJobAuditTable } from '@/components/admin/JobAuditTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button, ButtonLink } from '@/components/ui/Button';

type SearchParamValue = string | string[] | undefined;

type PageProps = {
  searchParams?: {
    jobId?: SearchParamValue;
    userId?: SearchParamValue;
    engineId?: SearchParamValue;
    status?: SearchParamValue;
    outcome?: SearchParamValue;
    from?: SearchParamValue;
    to?: SearchParamValue;
  };
};

type UiFilters = {
  jobId: string;
  userId: string;
  engineId: string;
  status: string;
  outcome: string;
  from: string;
  to: string;
  fromDate: Date | null;
  toDate: Date | null;
};

type Shortcut = {
  label: string;
  href: string;
  count: number;
  active: boolean;
};

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const OUTCOME_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'failed_action_required', label: 'Action required' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'refunded_failure_resolved', label: 'Refunded failure' },
  { value: 'unknown', label: 'Unknown' },
];

const numberFormatter = new Intl.NumberFormat('en-US');

export default async function AdminJobsAuditPage({ searchParams = {} }: PageProps) {
  const filters = normalizeFilters(searchParams);

  if (!process.env.DATABASE_URL) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          eyebrow="Operations"
          title="Jobs"
          description="Audit renders, Fal sync, refunds and recovery flows from one operational workspace."
        />
        <AdminSection title="Job Workspace" description="Database access is required for the audit surface.">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable job auditing.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const { jobs, nextCursor } = await fetchRecentJobAudits({
    limit: 30,
    jobId: filters.jobId || null,
    userId: filters.userId || null,
    engineId: filters.engineId || null,
    status: filters.status || null,
    outcome: filters.outcome || null,
    from: filters.fromDate,
    to: filters.toDate,
  });

  const filtersQuery = buildFiltersQuery(filters);
  const overviewCards = buildOverviewCards(jobs);
  const shortcuts = buildOutcomeShortcuts(filters, jobs);
  const activeFilters = describeActiveFilters(filters);
  const filterCount = activeFilters.length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Jobs"
        description="Surface de triage pour les rendus, les erreurs Fal, les débits wallet et les remises en ligne."
        actions={
          <>
            <ButtonLink href="/admin/insights" variant="outline" size="sm" className="border-border bg-surface">
              Insights
            </ButtonLink>
            <ButtonLink href="/admin/users" variant="outline" size="sm" className="border-border bg-surface">
              Users
            </ButtonLink>
          </>
        }
      />

      <AdminSection
        title="Jobs Overview"
        description="Lecture rapide du lot actuellement chargé, pour savoir immédiatement si on est en mode monitoring ou triage."
      >
        <AdminMetricGrid items={overviewCards} columnsClassName="sm:grid-cols-2 xl:grid-cols-6" className="border-0" />
      </AdminSection>

      <AdminSection
        title="Job Workspace"
        description="Filtres linkables, raccourcis outcome et table d’audit compacte."
        action={
          <AdminSectionMeta
            title={filterCount ? `${filterCount} active filter${filterCount > 1 ? 's' : ''}` : 'All jobs'}
            lines={[activeFilters.length ? activeFilters.join(' · ') : 'No scope restriction. The table shows the latest audit slice.']}
          />
        }
      >
        <div className="space-y-4">
          <OutcomeShortcutRail shortcuts={shortcuts} />
          <JobFilters filters={filters} />
          <AdminJobAuditTable key={filtersQuery || 'all-jobs'} initialJobs={jobs} initialCursor={nextCursor} filtersQuery={filtersQuery} />
        </div>
      </AdminSection>
    </div>
  );
}

function normalizeFilters(params: PageProps['searchParams']): UiFilters {
  const coerce = (value: SearchParamValue) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.trim().length ? raw.trim() : '';
  };

  const jobId = coerce(params?.jobId);
  const userId = coerce(params?.userId);
  const engineId = coerce(params?.engineId);
  const status = coerce(params?.status);
  const outcome = coerce(params?.outcome);
  const from = coerce(params?.from);
  const to = coerce(params?.to);
  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;

  return { jobId, userId, engineId, status, outcome, from, to, fromDate, toDate };
}

function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildFiltersQuery(filters: UiFilters): string {
  const params = new URLSearchParams();
  if (filters.jobId) params.set('jobId', filters.jobId);
  if (filters.userId) params.set('userId', filters.userId);
  if (filters.engineId) params.set('engineId', filters.engineId);
  if (filters.status) params.set('status', filters.status);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

function buildJobsHref(filters: UiFilters, overrides: Partial<Record<keyof UiFilters, string>>) {
  const next = {
    jobId: filters.jobId,
    userId: filters.userId,
    engineId: filters.engineId,
    status: filters.status,
    outcome: filters.outcome,
    from: filters.from,
    to: filters.to,
    ...overrides,
  };

  const params = new URLSearchParams();
  if (next.jobId) params.set('jobId', next.jobId);
  if (next.userId) params.set('userId', next.userId);
  if (next.engineId) params.set('engineId', next.engineId);
  if (next.status) params.set('status', next.status);
  if (next.outcome) params.set('outcome', next.outcome);
  if (next.from) params.set('from', next.from);
  if (next.to) params.set('to', next.to);

  const query = params.toString();
  return query ? `/admin/jobs?${query}` : '/admin/jobs';
}

function buildOverviewCards(jobs: AdminJobAuditRecord[]): AdminMetricItem[] {
  const actionRequired = jobs.filter((job) => job.outcome === 'failed_action_required').length;
  const inProgress = jobs.filter((job) => job.outcome === 'in_progress').length;
  const completed = jobs.filter((job) => job.outcome === 'completed').length;
  const refunded = jobs.filter((job) => job.outcome === 'refunded_failure_resolved').length;
  const falIssues = jobs.filter((job) => !job.falOk).length;
  const paymentDrift = jobs.filter((job) => !job.paymentOk).length;

  return [
    {
      label: 'Loaded',
      value: formatNumber(jobs.length),
      helper: 'Current audit slice',
      icon: History,
    },
    {
      label: 'Action required',
      value: formatNumber(actionRequired),
      helper: 'Jobs still failing without refund resolution',
      tone: actionRequired > 0 ? 'warning' : 'success',
      icon: AlertTriangle,
    },
    {
      label: 'In progress',
      value: formatNumber(inProgress),
      helper: 'Pending, queued or actively processing',
      icon: Clock3,
    },
    {
      label: 'Completed',
      value: formatNumber(completed),
      helper: 'Jobs with terminal success state',
      tone: completed > 0 ? 'success' : 'default',
      icon: CheckCircle2,
    },
    {
      label: 'Fal issues',
      value: formatNumber(falIssues),
      helper: 'Rows where provider state still looks unhealthy',
      tone: falIssues > 0 ? 'warning' : 'success',
      icon: ShieldAlert,
    },
    {
      label: 'Payment drift',
      value: formatNumber(paymentDrift + refunded),
      helper: 'Mismatched charges or refunded failure flows',
      tone: paymentDrift + refunded > 0 ? 'warning' : 'success',
      icon: ReceiptText,
    },
  ];
}

function buildOutcomeShortcuts(filters: UiFilters, jobs: AdminJobAuditRecord[]): Shortcut[] {
  const actionRequired = jobs.filter((job) => job.outcome === 'failed_action_required').length;
  const inProgress = jobs.filter((job) => job.outcome === 'in_progress').length;
  const completed = jobs.filter((job) => job.outcome === 'completed').length;
  const refunded = jobs.filter((job) => job.outcome === 'refunded_failure_resolved').length;

  return [
    {
      label: 'All',
      href: buildJobsHref(filters, { outcome: '' }),
      count: jobs.length,
      active: !filters.outcome,
    },
    {
      label: 'Action required',
      href: buildJobsHref(filters, { outcome: 'failed_action_required' }),
      count: actionRequired,
      active: filters.outcome === 'failed_action_required',
    },
    {
      label: 'In progress',
      href: buildJobsHref(filters, { outcome: 'in_progress' }),
      count: inProgress,
      active: filters.outcome === 'in_progress',
    },
    {
      label: 'Completed',
      href: buildJobsHref(filters, { outcome: 'completed' }),
      count: completed,
      active: filters.outcome === 'completed',
    },
    {
      label: 'Refunded',
      href: buildJobsHref(filters, { outcome: 'refunded_failure_resolved' }),
      count: refunded,
      active: filters.outcome === 'refunded_failure_resolved',
    },
  ];
}

function describeActiveFilters(filters: UiFilters): string[] {
  const items: string[] = [];
  if (filters.jobId) items.push(`job ${filters.jobId}`);
  if (filters.userId) items.push(`user ${filters.userId}`);
  if (filters.engineId) items.push(`engine ${filters.engineId}`);
  if (filters.status) items.push(`status ${filters.status}`);
  if (filters.outcome) items.push(`outcome ${filters.outcome}`);
  if (filters.from) items.push(`from ${filters.from}`);
  if (filters.to) items.push(`to ${filters.to}`);
  return items;
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function JobFilters({ filters }: { filters: UiFilters }) {
  return (
    <AdminFilterBar
      method="get"
      fieldsClassName="xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_180px_220px_180px_180px]"
      helper="Search by internal job id, provider id, user id, engine or time window. Filters stay shareable in the URL."
      actions={
        <>
          <Button type="submit" size="sm" className="bg-brand text-on-brand">
            Apply filters
          </Button>
          <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-border bg-surface">
            Reset
          </ButtonLink>
        </>
      }
    >
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Job ID
        <input
          type="text"
          name="jobId"
          defaultValue={filters.jobId}
          placeholder="job_1234 or provider id"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        User ID
        <input
          type="text"
          name="userId"
          defaultValue={filters.userId}
          placeholder="Supabase user id"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Engine
        <input
          type="text"
          name="engineId"
          defaultValue={filters.engineId}
          placeholder="engine id or label"
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Status
        <select
          name="status"
          defaultValue={filters.status}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Outcome
        <select
          name="outcome"
          defaultValue={filters.outcome}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {OUTCOME_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        From
        <input
          type="date"
          name="from"
          defaultValue={filters.from}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        To
        <input
          type="date"
          name="to"
          defaultValue={filters.to}
          className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
    </AdminFilterBar>
  );
}

function OutcomeShortcutRail({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {shortcuts.map((shortcut) => (
        <Link
          key={shortcut.label}
          href={shortcut.href}
          className={[
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition',
            shortcut.active
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary',
          ].join(' ')}
        >
          <span>{shortcut.label}</span>
          <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-medium text-text-primary">{formatNumber(shortcut.count)}</span>
        </Link>
      ))}
    </div>
  );
}
