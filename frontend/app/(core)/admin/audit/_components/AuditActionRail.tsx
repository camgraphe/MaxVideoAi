import { AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import {
  ACTION_OPTIONS,
  buildAuditHref,
  type AuditFilters,
} from '../_lib/admin-audit-helpers';

export function AuditActionRail({ filters }: { filters: AuditFilters }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTION_OPTIONS.map((option) => {
        const active = filters.action === option.value;
        return (
          <AdminActionLink
            key={option.value || 'all'}
            href={buildAuditHref(filters, { action: option.value })}
            variant={active ? 'primary' : 'outline'}
          >
            {option.label}
          </AdminActionLink>
        );
      })}
    </div>
  );
}
