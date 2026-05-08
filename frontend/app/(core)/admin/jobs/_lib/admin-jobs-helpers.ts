import { AlertTriangle, CheckCircle2, Clock3, History, ReceiptText, ShieldAlert } from 'lucide-react';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';

export type SearchParamValue = string | string[] | undefined;

export type UiFilters = {
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

export type Shortcut = {
  label: string;
  href: string;
  count: number;
  active: boolean;
};

export const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

export const OUTCOME_OPTIONS = [
  { value: '', label: 'All outcomes' },
  { value: 'failed_action_required', label: 'Action required' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'refunded_failure_resolved', label: 'Refunded failure' },
  { value: 'unknown', label: 'Unknown' },
];

const numberFormatter = new Intl.NumberFormat('en-US');

export function normalizeFilters(params: {
  jobId?: SearchParamValue;
  userId?: SearchParamValue;
  engineId?: SearchParamValue;
  status?: SearchParamValue;
  outcome?: SearchParamValue;
  from?: SearchParamValue;
  to?: SearchParamValue;
} | undefined): UiFilters {
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

export function parseDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function buildFiltersQuery(filters: UiFilters): string {
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

export function buildJobsHref(filters: UiFilters, overrides: Partial<Record<keyof UiFilters, string>>) {
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

export function buildOverviewCards(jobs: AdminJobAuditRecord[]): AdminMetricItem[] {
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

export function buildOutcomeShortcuts(filters: UiFilters, jobs: AdminJobAuditRecord[]): Shortcut[] {
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

export function describeActiveFilters(filters: UiFilters): string[] {
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

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}
