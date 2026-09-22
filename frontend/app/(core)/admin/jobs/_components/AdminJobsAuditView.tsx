import { AdminJobAuditTable } from '@/components/admin/JobAuditTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminShortcutRail } from '@/components/admin-system/surfaces/AdminShortcutRail';
import type { AdminJobAuditRecord } from '@/server/admin-job-audit';
import {
  buildFiltersQuery,
  buildOutcomeShortcuts,
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
        title="Generations"
        description="Review generation outcomes and resolve incidents."
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
  const shortcuts = buildOutcomeShortcuts(filters, jobs);
  const activeFilters = describeActiveFilters(filters);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Operations"
        title="Generations"
        description="Review generation outcomes and resolve incidents."
        actions={<AdminActionLink href="/admin/engines">Model activity</AdminActionLink>}
      />

      <section aria-label="Generation audit" className="space-y-4">
          <AdminShortcutRail
            items={shortcuts.map((shortcut) => ({
              label: shortcut.label,
              href: shortcut.href,
              active: shortcut.active,
              meta: formatNumber(shortcut.count),
            }))}
          />
          <p className="text-xs text-text-secondary">{jobs.length} loaded generations · Counts apply to this result set{activeFilters.length ? ` · ${activeFilters.join(' · ')}` : ''}</p>
          <JobFilters filters={filters} />
          <AdminJobAuditTable key={filtersQuery || 'all-jobs'} initialJobs={jobs} initialCursor={nextCursor} filtersQuery={filtersQuery} />
      </section>
    </div>
  );
}
