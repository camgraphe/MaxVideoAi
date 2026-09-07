'use client';

import { RefreshCw } from 'lucide-react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingHistory } from '@/components/admin-system/pricing/AdminPricingHistory';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { useAdminMembershipController } from '../_hooks/useAdminMembershipController';

export function AdminMembershipView() {
  const controller = useAdminMembershipController();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Commercial membership"
        title="Membership history"
        description="Membership discounts are retired. New generations use standard pricing. Stored settings and audit events remain available for historical reference."
        actions={
          <AdminActionButton type="button" onClick={() => void controller.refresh()} disabled={controller.refreshing}>
            <RefreshCw className={`h-4 w-4 ${controller.refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </AdminActionButton>
        }
      />

      <AdminMetricGrid
        density="compact"
        items={[
          { label: 'Canonical tiers', value: controller.inventory?.tiers.length ?? '—', helper: 'member · plus · pro' },
          { label: 'Database', value: controller.inventory?.databaseStatus ?? 'loading', helper: 'Historical inventory' },
          { label: 'History events', value: controller.history.length, helper: 'Immutable membership events' },
        ]}
      />

      {controller.inventory?.warnings.map((warning) => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
      {controller.error ? <AdminNotice tone="error">{controller.error.message}</AdminNotice> : null}
      {controller.loading ? <AdminLoadingPanel rows={3} /> : controller.inventory?.tiers.length ? (
        <AdminSection
          title="Historical membership tiers"
          description="Thresholds are cumulative spend in cents. Discount values are fractions from 0 to 1."

        >
          <div data-testid="membership-tier-inventory" className="grid gap-4 lg:grid-cols-3">
            {controller.inventory.tiers.map((tier) => (
              <dl key={tier.tier} className="rounded-xl border border-hairline bg-surface p-4 text-sm">
                <dt className="font-semibold capitalize">{tier.tier}</dt>
                <dd>Historical threshold: {tier.spendThresholdCents} cents</dd>
                <dd>Historical discount: {tier.discountPercent * 100}%</dd>
              </dl>
            ))}
          </div>
        </AdminSection>
      ) : <AdminEmptyState>No membership inventory is available.</AdminEmptyState>}

      <AdminPricingHistory
        events={controller.history}
        title="Immutable membership history"
        description="Historical events are immutable. Editing and rollback are retired."
        emptyLabel="No membership change has been recorded yet."
        loading={controller.historyLoading}
        locked
      />

    </div>
  );
}
