import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import type { AdminAuditLog } from '@/server/admin-audit';
import {
  buildAuditMetrics,
  describeActiveFilters,
  type AuditFilters,
} from '../_lib/admin-audit-helpers';
import { AuditActionRail } from './AuditActionRail';
import { AuditFiltersForm } from './AuditFiltersForm';
import { AuditTable } from './AuditTable';

export function AdminAuditDatabaseNotice() {
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

export function AdminAuditView({
  filters,
  logs,
  serviceRoleMissing,
}: {
  filters: AuditFilters;
  logs: AdminAuditLog[];
  serviceRoleMissing: boolean;
}) {
  const metrics = buildAuditMetrics(logs);
  const filterCount = [filters.action, filters.adminId, filters.targetUserId].filter(Boolean).length;
  const activeFilters = describeActiveFilters(filters);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Audit trail"
        description="Journal d’enquête pour l’impersonation, les resyncs et les interventions sensibles. Les filtres restent linkables pour partager un scope précis."
        actions={
          <>
            <AdminActionLink href="/admin/users">
              Users
            </AdminActionLink>
            <AdminActionLink href="/admin/jobs">
              Jobs
            </AdminActionLink>
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
