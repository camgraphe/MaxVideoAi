import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { ADMIN_NAV_GROUPS } from '@/lib/admin/navigation';

export default function AdminSettingsPage() {
  const items = ADMIN_NAV_GROUPS.find((group) => group.id === 'settings')!.items.filter(
    (item) => item.id !== 'settings'
  );
  return (
    <div className="space-y-5">
      <AdminPageHeader title="Settings" description="Operations, billing products and compliance." />
      <div className="divide-y divide-border border-y border-border">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            prefetch={false}
            className="flex items-center justify-between py-4 text-sm font-medium hover:text-brand"
          >
            {item.label}
            <span className="text-text-muted">Open</span>
          </Link>
        ))}
      </div>
      <p className="text-sm text-text-secondary">
        Model pricing is managed through the engineering workflow. Existing database overrides remain active.
      </p>
    </div>
  );
}
