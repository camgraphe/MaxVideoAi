import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { Button } from '@/components/ui/Button';
import {
  OUTCOME_OPTIONS,
  STATUS_OPTIONS,
  type UiFilters,
} from '../_lib/admin-jobs-helpers';

export function JobFilters({ filters }: { filters: UiFilters }) {
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
          <AdminActionLink href="/admin/jobs">
            Reset
          </AdminActionLink>
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
