import { Button, ButtonLink } from '@/components/ui/Button';
import { fetchRecentJobAudits } from '@/server/admin-job-audit';
import { AdminJobAuditTable } from '@/components/admin/JobAuditTable';

type PageProps = {
  searchParams?: {
    jobId?: string;
    userId?: string;
    engineId?: string;
    status?: string;
    from?: string;
    to?: string;
  };
};

export const dynamic = 'force-dynamic';

export default async function AdminJobsAuditPage({ searchParams = {} }: PageProps) {
  if (!process.env.DATABASE_URL) {
    return (
      <div className="stack-gap-lg">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-text-primary">Job Audit</h1>
          <p className="text-sm text-text-secondary">
            Database connection is not configured. Set <code className="font-mono text-xs">DATABASE_URL</code> to enable job auditing.
          </p>
        </header>
      </div>
    );
  }

  const filters = normalizeFilters(searchParams);
  const { jobs, nextCursor } = await fetchRecentJobAudits({
    limit: 30,
    jobId: filters.jobId || null,
    userId: filters.userId || null,
    engineId: filters.engineId || null,
    status: filters.status || null,
    from: filters.fromDate,
    to: filters.toDate,
  });
  const filtersQuery = buildFiltersQuery(filters);

  return (
    <div className="stack-gap-lg">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Job audit</h1>
        <p className="text-sm text-text-secondary">
          Search render attempts, inspect Fal sync, refund wallet charges, or bring older jobs back online.
        </p>
      </header>

      <JobFilters filters={filters} />
      <AdminJobAuditTable initialJobs={jobs} initialCursor={nextCursor} filtersQuery={filtersQuery} />
    </div>
  );
}

type UiFilters = {
  jobId: string;
  userId: string;
  engineId: string;
  status: string;
  from: string;
  to: string;
  fromDate: Date | null;
  toDate: Date | null;
};

function normalizeFilters(params: PageProps['searchParams']): UiFilters {
  const coerce = (value: string | undefined) => (value?.trim().length ? value.trim() : '');
  const jobId = coerce(params?.jobId);
  const userId = coerce(params?.userId);
  const engineId = coerce(params?.engineId);
  const status = coerce(params?.status);
  const from = coerce(params?.from);
  const to = coerce(params?.to);
  const fromDate = from ? parseDate(from) : null;
  const toDate = to ? parseDate(to) : null;
  return { jobId, userId, engineId, status, from, to, fromDate, toDate };
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
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params.toString();
}

function JobFilters({ filters }: { filters: UiFilters }) {
  return (
    <form className="space-y-4 rounded-2xl border border-border/60 bg-surface-glass-95 p-5 shadow-card" method="get">
      <div className="grid grid-gap-sm md:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Job ID
          <input
            type="text"
            name="jobId"
            defaultValue={filters.jobId}
            placeholder="job_1234 or provider id"
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          User ID
          <input
            type="text"
            name="userId"
            defaultValue={filters.userId}
            placeholder="Supabase user id"
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Engine
          <input
            type="text"
            name="engineId"
            defaultValue={filters.engineId}
            placeholder="engine id or label"
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="grid grid-gap-sm md:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          Status
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All</option>
            {['pending', 'running', 'completed', 'failed'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          From
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          To
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className="mt-1 w-full rounded-lg border border-border/70 bg-bg px-3 py-2 text-sm text-text-primary focus:border-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="submit"
          size="sm"
          className="rounded-full bg-text-primary px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-on-inverse hover:bg-text-primary/90"
        >
          Apply filters
        </Button>
        <ButtonLink
          href="/admin/jobs"
          variant="ghost"
          size="sm"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary"
        >
          Reset
        </ButtonLink>
      </div>
    </form>
  );
}
