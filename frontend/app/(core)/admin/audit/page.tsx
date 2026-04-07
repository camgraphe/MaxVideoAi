import Link from 'next/link';
import { Activity, History, LogIn, Search, ShieldAlert, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/server/admin';
import { fetchAdminAuditLogs } from '@/server/admin-audit';
import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { type AdminMetricItem, AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button, ButtonLink } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

type SearchParamValue = string | string[] | undefined;

type PageProps = {
  searchParams?: {
    action?: SearchParamValue;
    adminId?: SearchParamValue;
    targetUserId?: SearchParamValue;
  };
};

type AuditFilters = {
  action: string;
  adminId: string;
  targetUserId: string;
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'IMPERSONATE_START', label: 'Impersonate start' },
  { value: 'IMPERSONATE_STOP', label: 'Impersonate stop' },
  { value: 'FORCE_RESYNC_JOB', label: 'Force resync' },
  { value: 'SERVICE_NOTICE_UPDATE', label: 'Service notice' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function AdminAuditLogPage({ searchParams = {} }: PageProps) {
  try {
    await requireAdmin();
  } catch (error) {
    console.warn('[admin/audit] access denied', error);
    notFound();
  }

  const filters = normalizeFilters(searchParams);

  if (!process.env.DATABASE_URL) {
    return (
      <div className="flex flex-col gap-5">
        <AdminPageHeader
          eyebrow="Operations"
          title="Audit trail"
          description="Trace des actions sensibles admin. Cette surface dépend de Postgres pour afficher l’historique complet."
        />
        <AdminSection title="Audit Trail" description="Database access is required to load audit events.">
          <AdminNotice tone="warning">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable audit history.
          </AdminNotice>
        </AdminSection>
      </div>
    );
  }

  const logs = await fetchAdminAuditLogs({
    limit: 150,
    action: filters.action || null,
    adminId: filters.adminId || null,
    targetUserId: filters.targetUserId || null,
  });
  const metrics = buildAuditMetrics(logs);
  const filterCount = [filters.action, filters.adminId, filters.targetUserId].filter(Boolean).length;
  const activeFilters = describeActiveFilters(filters);
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Audit trail"
        description="Journal d’enquête pour l’impersonation, les resyncs et les interventions sensibles. Les filtres restent linkables pour partager un scope précis."
        actions={
          <>
            <ButtonLink href="/admin/users" variant="outline" size="sm" className="border-border bg-surface">
              Users
            </ButtonLink>
            <ButtonLink href="/admin/jobs" variant="outline" size="sm" className="border-border bg-surface">
              Jobs
            </ButtonLink>
          </>
        }
      />

      <AdminSection title="Audit Overview" description="Lecture rapide du lot chargé, pour savoir si on inspecte un incident ciblé ou l’historique global.">
        <AdminMetricGrid items={metrics} columnsClassName="sm:grid-cols-2 xl:grid-cols-5" density="compact" />
      </AdminSection>

      <AdminSection
        title="Audit Trail"
        description="Filtre par action ou par identifiant utilisateur, puis ouvre directement la fiche membre ou la job liée."
        action={
          <AdminSectionMeta
            title={filterCount ? `${filterCount} active filter${filterCount > 1 ? 's' : ''}` : `${logs.length} events loaded`}
            lines={[activeFilters.length ? activeFilters.join(' · ') : 'Latest sensitive events across admin surfaces.']}
          />
        }
      >
        <div className="space-y-4">
          <AuditActionRail filters={filters} />
          <AuditFiltersForm filters={filters} />

          {serviceRoleMissing ? (
            <AdminNotice tone="info">
              Supabase service role key is missing. Actor and target columns therefore fall back to raw user IDs.
            </AdminNotice>
          ) : null}

          {logs.length ? <AuditTable logs={logs} /> : <AdminEmptyState>No audit events match this scope.</AdminEmptyState>}
        </div>
      </AdminSection>
    </div>
  );
}

function normalizeFilters(params: PageProps['searchParams']): AuditFilters {
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

function buildAuditHref(filters: AuditFilters, overrides: Partial<AuditFilters>) {
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

function buildAuditMetrics(logs: Awaited<ReturnType<typeof fetchAdminAuditLogs>>): AdminMetricItem[] {
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

function describeActiveFilters(filters: AuditFilters) {
  return [
    filters.action ? `Action ${formatActionLabel(filters.action)}` : null,
    filters.adminId ? `Admin ${truncateId(filters.adminId)}` : null,
    filters.targetUserId ? `Target ${truncateId(filters.targetUserId)}` : null,
  ].filter((value): value is string => Boolean(value));
}

function AuditActionRail({ filters }: { filters: AuditFilters }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTION_OPTIONS.map((option) => {
        const active = filters.action === option.value;
        return (
          <ButtonLink
            key={option.value || 'all'}
            href={buildAuditHref(filters, { action: option.value })}
            variant={active ? 'primary' : 'outline'}
            size="sm"
            className={active ? '' : 'border-border bg-surface'}
          >
            {option.label}
          </ButtonLink>
        );
      })}
    </div>
  );
}

function AuditFiltersForm({ filters }: { filters: AuditFilters }) {
  return (
    <form method="get" className="grid gap-3 rounded-2xl border border-hairline bg-bg/40 p-4 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Action</span>
        <select
          name="action"
          defaultValue={filters.action}
          className="min-h-[40px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text-primary focus:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {ACTION_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Admin user ID</span>
        <input
          type="text"
          name="adminId"
          defaultValue={filters.adminId}
          placeholder="Actor Supabase ID"
          className="min-h-[40px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text-primary focus:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <label className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Target user ID</span>
        <input
          type="text"
          name="targetUserId"
          defaultValue={filters.targetUserId}
          placeholder="Impacted member ID"
          className="min-h-[40px] w-full rounded-xl border border-border bg-bg px-3 text-sm text-text-primary focus:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <Button type="submit" size="sm" className="self-end rounded-xl px-4">
        <Search className="h-4 w-4" />
        Apply
      </Button>

      <ButtonLink href="/admin/audit" variant="outline" size="sm" className="self-end border-border bg-surface">
        Reset
      </ButtonLink>
    </form>
  );
}

function AuditTable({ logs }: { logs: Awaited<ReturnType<typeof fetchAdminAuditLogs>> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-hairline">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface">
          <tr className="text-[11px] uppercase tracking-[0.18em] text-text-muted">
            <th className="px-4 py-3 font-semibold">Timestamp</th>
            <th className="px-4 py-3 font-semibold">Action</th>
            <th className="px-4 py-3 font-semibold">Admin</th>
            <th className="px-4 py-3 font-semibold">Target</th>
            <th className="px-4 py-3 font-semibold">Context</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline bg-bg/30">
          {logs.map((log) => (
            <tr key={log.id} className="align-top text-text-secondary">
              <td className="px-4 py-3 text-xs">{formatDateTime(log.createdAt)}</td>
              <td className="px-4 py-3">
                <AuditActionBadge action={log.action} />
              </td>
              <td className="px-4 py-3">
                <UserIdentityCell userId={log.adminId} email={log.adminEmail} />
              </td>
              <td className="px-4 py-3">
                {log.targetUserId ? <UserIdentityCell userId={log.targetUserId} email={log.targetEmail} /> : <span className="text-text-muted">—</span>}
              </td>
              <td className="px-4 py-3">
                <AuditContextCell log={log} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserIdentityCell({ userId, email }: { userId: string; email: string | null }) {
  return (
    <div className="space-y-1">
      <Link href={`/admin/users/${userId}`} className="block text-sm font-medium text-text-primary underline-offset-2 hover:underline">
        {email ?? truncateId(userId)}
      </Link>
      <p className="font-mono text-[11px] text-text-muted">{userId}</p>
    </div>
  );
}

function AuditActionBadge({ action }: { action: string }) {
  const toneClass =
    action === 'FORCE_RESYNC_JOB'
      ? 'border-warning-border bg-warning-bg text-warning'
      : action === 'SERVICE_NOTICE_UPDATE'
        ? 'border-warning-border bg-warning-bg text-warning'
      : action === 'IMPERSONATE_START'
        ? 'border-info-border bg-info-bg text-info'
        : 'border-success-border bg-success-bg text-success';

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClass}`}>
      {formatActionLabel(action)}
    </span>
  );
}

function AuditContextCell({ log }: { log: Awaited<ReturnType<typeof fetchAdminAuditLogs>>[number] }) {
  const metadata = log.metadata ?? null;
  const jobId = typeof metadata?.jobId === 'string' ? metadata.jobId : null;
  const engineId = typeof metadata?.engineId === 'string' ? metadata.engineId : null;
  const redirectTo = typeof metadata?.redirectTo === 'string' ? metadata.redirectTo : null;
  const returnTo = typeof metadata?.returnTo === 'string' ? metadata.returnTo : null;
  const preview = typeof metadata?.preview === 'string' ? metadata.preview : null;
  const messageLength = typeof metadata?.messageLength === 'number' ? metadata.messageLength : null;

  return (
    <div className="space-y-2">
      <div className="space-y-1 text-xs">
        {log.route ? (
          <p className="font-mono text-text-muted">
            route <span className="text-text-primary">{log.route}</span>
          </p>
        ) : null}
        {jobId ? (
          <p>
            job{' '}
            <Link href={`/admin/jobs?jobId=${encodeURIComponent(jobId)}`} className="font-mono text-text-primary underline-offset-2 hover:underline">
              {jobId}
            </Link>
            {engineId ? <span className="text-text-muted"> · {engineId}</span> : null}
          </p>
        ) : null}
        {redirectTo ? <p>redirect <span className="font-mono text-text-primary">{redirectTo}</span></p> : null}
        {returnTo ? <p>return <span className="font-mono text-text-primary">{returnTo}</span></p> : null}
        {messageLength !== null ? <p>message length <span className="text-text-primary">{messageLength}</span></p> : null}
        {preview ? <p className="line-clamp-2">preview <span className="text-text-primary">{preview}</span></p> : null}
      </div>

      {metadata ? (
        <details className="rounded-xl border border-hairline bg-bg/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-text-primary">Raw metadata</summary>
          <pre className="mt-2 max-h-40 overflow-auto text-[11px] leading-5 text-text-secondary">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return dateTimeFormatter.format(parsed);
}

function formatActionLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function truncateId(value: string) {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}
