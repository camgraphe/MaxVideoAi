import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { Button } from '@/components/ui/Button';
import { OUTCOME_OPTIONS, STATUS_OPTIONS, type UiFilters } from '../_lib/admin-jobs-helpers';

const fieldClass = 'mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring';
const labelClass = 'min-w-0 text-xs font-medium text-text-secondary';

export function JobFilters({ filters }: { filters: UiFilters }) {
  const hasAdvancedFilters = Boolean(filters.userId || filters.outcome || filters.from || filters.to);
  return (
    <form method="get" className="space-y-3 border-b border-hairline pb-4">
      <div className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.5fr)_minmax(140px,1fr)_160px_auto]">
        <label className={labelClass}>
          Job ID
          <input name="jobId" defaultValue={filters.jobId} placeholder="Job or provider ID" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Model
          <input name="engineId" defaultValue={filters.engineId} placeholder="Model ID or label" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Status
          <select name="status" defaultValue={filters.status} className={fieldClass}>
            {STATUS_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">Apply filters</Button>
          <AdminActionLink href="/admin/jobs">Reset</AdminActionLink>
        </div>
      </div>
      <details open={hasAdvancedFilters}>
        <summary className="w-fit cursor-pointer text-xs font-medium text-text-secondary">More filters{hasAdvancedFilters ? ' · active' : ''}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>
            User ID
            <input name="userId" defaultValue={filters.userId} placeholder="User ID" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Outcome
            <select name="outcome" defaultValue={filters.outcome} className={fieldClass}>
              {OUTCOME_OPTIONS.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className={labelClass}>
            From
            <input type="date" name="from" defaultValue={filters.from} className={fieldClass} />
          </label>
          <label className={labelClass}>
            To
            <input type="date" name="to" defaultValue={filters.to} className={fieldClass} />
          </label>
        </div>
      </details>
    </form>
  );
}
