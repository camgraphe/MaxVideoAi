'use client';

import { RefreshCw } from 'lucide-react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingChangePreviewDialog } from '@/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import { AdminPricingHistory } from '@/components/admin-system/pricing/AdminPricingHistory';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Button } from '@/components/ui/Button';
import { useAdminMembershipController } from '../_hooks/useAdminMembershipController';

export function AdminMembershipView() {
  const controller = useAdminMembershipController();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Commercial membership"
        title="Membership pricing"
        description="Edit member, plus, and pro eligibility and discounts as one transactional change. Every update requires a canonical server preview."
        actions={
          <AdminActionButton type="button" onClick={() => void controller.refresh()} disabled={controller.refreshing || controller.refreshLocked}>
            <RefreshCw className={`h-4 w-4 ${controller.refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </AdminActionButton>
        }
      />

      <AdminMetricGrid
        density="compact"
        items={[
          { label: 'Canonical tiers', value: controller.inventory?.tiers.length ?? '—', helper: 'member · plus · pro' },
          { label: 'Database', value: controller.inventory?.databaseStatus ?? 'loading', helper: 'Mutation authority' },
          { label: 'History events', value: controller.history.length, helper: 'Immutable membership events' },
        ]}
      />

      {controller.inventory?.warnings.map((warning) => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
      {controller.error ? <AdminNotice tone="error">{controller.error.message}</AdminNotice> : null}
      {controller.postCommitWarning ? (
        <AdminNotice tone="warning">{controller.postCommitWarning.message}</AdminNotice>
      ) : null}
      {controller.notice ? <AdminNotice tone="success">{controller.notice}</AdminNotice> : null}

      {controller.loading ? <AdminLoadingPanel rows={3} /> : controller.draft.length ? (
        <AdminSection
          title="All membership tiers"
          description="Thresholds are cumulative spend in cents. Discount values are fractions from 0 to 1."
          action={
            <Button type="button" onClick={controller.previewDraft} disabled={controller.interactionLocked}>
              {controller.previewing ? 'Previewing…' : 'Preview all tier changes'}
            </Button>
          }
        >
          <div data-testid="membership-tier-inventory" className="grid gap-4 lg:grid-cols-3">
            {controller.draft.map((tier) => (
              <fieldset key={tier.tier} disabled={controller.interactionLocked} className="rounded-xl border border-hairline bg-surface p-4">
                <legend className="px-1 text-sm font-semibold capitalize text-text-primary">{tier.tier}</legend>
                <label className="mt-3 block text-xs font-medium text-text-secondary">
                  Spend threshold (cents)
                  <input
                    aria-label={`${tier.tier} spend threshold (cents)`}
                    type="number"
                    min="0"
                    step="1"
                    value={tier.spendThresholdCents}
                    onChange={(event) => controller.updateDraft(tier.tier, 'spendThresholdCents', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2 text-sm text-text-primary"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-text-secondary">
                  Discount fraction (0–1)
                  <input
                    aria-label={`${tier.tier} discount fraction (0–1)`}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={tier.discountPercent}
                    onChange={(event) => controller.updateDraft(tier.tier, 'discountPercent', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-hairline bg-bg px-3 py-2 text-sm text-text-primary"
                  />
                </label>
              </fieldset>
            ))}
          </div>
        </AdminSection>
      ) : <AdminEmptyState>No membership inventory is available.</AdminEmptyState>}

      <AdminPricingHistory
        events={controller.history}
        title="Immutable membership history"
        description="Rollback derives historical state on the server and always opens a fresh impact preview."
        emptyLabel="No membership change has been recorded yet."
        loading={controller.historyLoading}
        locked={controller.interactionLocked}
        onPreviewRollback={controller.previewRollback}
      />

      {controller.preview ? (
        <AdminPricingChangePreviewDialog
          preview={controller.preview}
          onConfirm={() => void controller.confirmPreview()}
          onCancel={controller.cancelPreview}
          busy={controller.confirming}
          error={controller.error?.message}
        />
      ) : null}
    </div>
  );
}
