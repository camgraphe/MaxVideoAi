import { fetchRecentJobAudits } from '@/server/admin-job-audit';
import { AdminJobsAuditView, AdminJobsDatabaseNotice } from './_components/AdminJobsAuditView';
import { normalizeFilters, type SearchParamValue } from './_lib/admin-jobs-helpers';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<{
    jobId?: SearchParamValue;
    userId?: SearchParamValue;
    engineId?: SearchParamValue;
    status?: SearchParamValue;
    outcome?: SearchParamValue;
    from?: SearchParamValue;
    to?: SearchParamValue;
  }>;
};

export default async function AdminJobsAuditPage(props: PageProps) {
  const searchParams = await props.searchParams;
  const filters = normalizeFilters(searchParams);

  if (!process.env.DATABASE_URL) {
    return <AdminJobsDatabaseNotice />;
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

  return <AdminJobsAuditView filters={filters} jobs={jobs} nextCursor={nextCursor} />;
}
