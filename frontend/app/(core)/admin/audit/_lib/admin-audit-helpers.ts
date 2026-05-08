import { Activity, History, LogIn, ShieldAlert, UserRound } from 'lucide-react';
import type { AdminAuditLog } from '@/server/admin-audit';
import type { AdminMetricItem } from '@/components/admin-system/surfaces/AdminMetricGrid';

export type SearchParamValue = string | string[] | undefined;

export type AuditFilters = {
  action: string;
  adminId: string;
  targetUserId: string;
};

export const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'IMPERSONATE_START', label: 'Impersonate start' },
  { value: 'IMPERSONATE_STOP', label: 'Impersonate stop' },
  { value: 'FORCE_RESYNC_JOB', label: 'Force resync' },
  { value: 'SERVICE_NOTICE_UPDATE', label: 'Service notice' },
  { value: 'THEME_TOKENS_UPDATE', label: 'Theme update' },
  { value: 'THEME_TOKENS_RESET', label: 'Theme reset' },
  { value: 'HOMEPAGE_SECTION_CREATE', label: 'Homepage create' },
  { value: 'HOMEPAGE_SECTION_UPDATE', label: 'Homepage update' },
  { value: 'HOMEPAGE_SECTION_DELETE', label: 'Homepage delete' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function normalizeFilters(params: { action?: SearchParamValue; adminId?: SearchParamValue; targetUserId?: SearchParamValue } | undefined): AuditFilters {
  const coerce = (value: SearchParamValue) => {
    const raw = Array.isArray(value) ? value[0] : value;
    return raw?.trim().length ? raw.trim() : '';
  };

  return {
    action: coerce(params?.action),
    adminId: coerce(params?.adminId),
    targetUserId: coerce(params?.targetUserId),
  };
}

export function buildAuditHref(filters: AuditFilters, overrides: Partial<AuditFilters>) {
  const next = {
    action: filters.action,
    adminId: filters.adminId,
    targetUserId: filters.targetUserId,
    ...overrides,
  };

  const params = new URLSearchParams();
  if (next.action) params.set('action', next.action);
  if (next.adminId) params.set('adminId', next.adminId);
  if (next.targetUserId) params.set('targetUserId', next.targetUserId);

  const query = params.toString();
  return query ? `/admin/audit?${query}` : '/admin/audit';
}

export function buildAuditMetrics(logs: AdminAuditLog[]): AdminMetricItem[] {
  const uniqueAdmins = new Set(logs.map((log) => log.adminId)).size;
  const uniqueTargets = new Set(logs.map((log) => log.targetUserId).filter((value): value is string => Boolean(value))).size;
  const impersonationStarts = logs.filter((log) => log.action === 'IMPERSONATE_START').length;
  const impersonationStops = logs.filter((log) => log.action === 'IMPERSONATE_STOP').length;
  const resyncs = logs.filter((log) => log.action === 'FORCE_RESYNC_JOB').length;

  return [
    { label: 'Loaded', value: formatNumber(logs.length), helper: 'Current audit slice', icon: History },
    {
      label: 'Unique admins',
      value: formatNumber(uniqueAdmins),
      helper: 'Actors represented in the current scope',
      icon: UserRound,
    },
    {
      label: 'Unique targets',
      value: formatNumber(uniqueTargets),
      helper: 'Members touched by the selected events',
      icon: ShieldAlert,
    },
    {
      label: 'Impersonation',
      value: formatNumber(impersonationStarts),
      helper: `${formatNumber(impersonationStops)} stop events recorded`,
      tone: impersonationStarts > 0 ? 'info' : 'default',
      icon: LogIn,
    },
    {
      label: 'Job resync',
      value: formatNumber(resyncs),
      helper: 'Manual provider relinks from admin',
      tone: resyncs > 0 ? 'warning' : 'default',
      icon: Activity,
    },
  ];
}

export function describeActiveFilters(filters: AuditFilters) {
  return [
    filters.action ? `Action ${formatActionLabel(filters.action)}` : null,
    filters.adminId ? `Admin ${truncateId(filters.adminId)}` : null,
    filters.targetUserId ? `Target ${truncateId(filters.targetUserId)}` : null,
  ].filter((value): value is string => Boolean(value));
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return dateTimeFormatter.format(parsed);
}

export function formatActionLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function truncateId(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
