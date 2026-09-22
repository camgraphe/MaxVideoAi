import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { ADMIN_NAV_GROUPS } from '@/lib/admin/navigation';

export default function AdminSettingsPage() {
  const items = ADMIN_NAV_GROUPS.find((group) => group.id === 'settings')!.items;
  const groups = [
    { title: 'Operations', ids: ['service-notice', 'infra-costs', 'audit-log'] },
    { title: 'Billing', ids: ['billing-products'] },
    { title: 'Compliance', ids: ['legal', 'marketing', 'consents'] },
  ];
  return (
    <div className="space-y-8">
      <AdminPageHeader title="Settings" description="Operational tools, billing products and compliance." />
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title}>
          <h2 className="pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">{group.title}</h2>
          <div className="divide-y divide-border border-y border-border">
            {group.ids.map((id) => {
              const item = items.find((candidate) => candidate.id === id)!;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={false}
                  className="flex items-center justify-between gap-4 py-3 text-sm font-medium hover:text-brand"
                >
                  {item.label}
                  <span className="text-text-muted">Open</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
      <p className="border-t border-border pt-4 text-sm text-text-secondary">
        Model prices are managed through the engineering workflow. Existing database overrides remain active.
        Existing theme settings also remain active; visual changes are now managed in code.
      </p>
    </div>
  );
}
