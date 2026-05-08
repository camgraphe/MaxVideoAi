import { Search } from 'lucide-react';
import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { Button } from '@/components/ui/Button';
import {
  ACTION_OPTIONS,
  type AuditFilters,
} from '../_lib/admin-audit-helpers';

export function AuditFiltersForm({ filters }: { filters: AuditFilters }) {
  return (
    <AdminFilterBar
      method="get"
      fieldsClassName="lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_auto_auto]"
    >
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

      <AdminActionLink href="/admin/audit" className="self-end">
        Reset
      </AdminActionLink>
    </AdminFilterBar>
  );
}
