import { AdminJobAuditTable } from '@/components/admin/JobAuditTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminSectionMeta } from '@/components/admin-system/shell/AdminSectionMeta';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { AdminShortcutRail } from '@/components/admin-system/surfaces/AdminShortcutRail';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import {
  buildFiltersQuery,
  buildOutcomeShortcuts,
  buildOverviewCards,
  describeActiveFilters,
  formatNumber,
  type UiFilters,
} from '../_lib/admin-jobs-helpers';
import { JobFilters } from './JobFilters';

export function AdminJobsDatabaseNotice() {
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

export function AdminJobsAuditView({
  filters,
  jobs,
  nextCursor,
}: {
  filters: UiFilters;
  jobs: AdminJobAuditRecord[];
  nextCursor: string | null;
}) {
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
            <AdminActionLink href="/admin/insights">
              Insights
            </AdminActionLink>
            <AdminActionLink href="/admin/users">
              Users
            </AdminActionLink>
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
          <AdminShortcutRail
            items={shortcuts.map((shortcut) => ({
              label: shortcut.label,
              href: shortcut.href,
              active: shortcut.active,
              meta: formatNumber(shortcut.count),
            }))}
          />
          <JobFilters filters={filters} />
          <AdminJobAuditTable key={filtersQuery || 'all-jobs'} initialJobs={jobs} initialCursor={nextCursor} filtersQuery={filtersQuery} />
        </div>
      </AdminSection>
    </div>
  );
}
