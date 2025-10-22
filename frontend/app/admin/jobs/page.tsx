import { fetchRecentJobAudits } from '@/server/admin-job-audit';
import { AdminJobAuditTable } from '@/components/admin/JobAuditTable';

export const dynamic = 'force-dynamic';

export default async function AdminJobsAuditPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-text-primary">Job Audit</h1>
          <p className="text-sm text-text-secondary">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable job auditing.
          </p>
        </header>
      </div>
    );
  }

  const jobs = await fetchRecentJobAudits(30);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Job Audit</h1>
        <p className="text-sm text-text-secondary">
          Last 30 generation attempts with display, debit, and Fal status checks. Use this view to spot placeholder fallbacks and billing mismatches quickly.
        </p>
      </header>
      <AdminJobAuditTable initialJobs={jobs} />
    </div>
  );
}
