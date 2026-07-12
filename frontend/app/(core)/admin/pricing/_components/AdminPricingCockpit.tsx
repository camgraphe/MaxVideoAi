'use client';

import { RefreshCw } from 'lucide-react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingChangePreviewDialog } from '@/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import { AdminActionButton, AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { useAdminPricingCockpitController } from '../_hooks/useAdminPricingCockpitController';
import { PricingPolicyInspector } from './PricingPolicyInspector';
import { PricingPolicyTable } from './PricingPolicyTable';

export function AdminPricingCockpit() {
  const controller = useAdminPricingCockpitController();
  const inventoryRows = controller.inventory?.rows ?? [];
  const databaseOverrideCount = inventoryRows.filter((row) => row.databaseOverride).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Commercial policy"
        title="Canonical pricing policy"
        description="Inspect and propose canonical engine policy changes. Every mutation requires a fresh server-computed impact preview and explicit confirmation."
        actions={
          <>
            <AdminActionButton type="button" onClick={() => void controller.refresh()} disabled={controller.refreshing || controller.interactionLocked}>
              <RefreshCw className={`h-4 w-4 ${controller.refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </AdminActionButton>
            <AdminActionLink href="/admin/engines">Engines</AdminActionLink>
            <AdminActionLink href="/admin/transactions">Transactions</AdminActionLink>
          </>
        }
      />

      <AdminMetricGrid
        density="compact"
        items={[
          { label: 'Policy selectors', value: inventoryRows.length, helper: 'Canonical inventory rows' },
          { label: 'Database-backed rows', value: databaseOverrideCount, helper: 'Rows with an effective override', tone: 'info' },
          { label: 'Policy version', value: controller.inventory?.versionedPolicyVersion ?? '—', helper: 'Versioned fallback' },
          { label: 'History events', value: controller.history.length, helper: 'Latest immutable events loaded' },
        ]}
      />

      {controller.inventory?.warnings.map((warning) => (
        <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>
      ))}
      {controller.error ? <AdminNotice tone="error">{controller.error.message}</AdminNotice> : null}
      {controller.notice ? <AdminNotice tone="success">{controller.notice}</AdminNotice> : null}

      {controller.loading ? (
        <AdminLoadingPanel rows={6} />
      ) : inventoryRows.length ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.75fr)]">
          <AdminSection
            title="Policy inventory"
            description="Filter selectors, inspect effective provenance, and choose the exact policy row to edit."
          >
            {controller.rows.length ? (
              <PricingPolicyTable
                rows={controller.rows}
                filters={controller.filters}
                onFiltersChange={controller.setFilters}
                selectedKey={controller.selectedKey}
                onSelect={controller.selectRow}
                disabled={controller.interactionLocked}
              />
            ) : (
              <AdminEmptyState>No pricing policy rows match the current filters.</AdminEmptyState>
            )}
          </AdminSection>

          {controller.selectedRow && controller.draft ? (
            <PricingPolicyInspector
              row={controller.selectedRow}
              draft={controller.draft}
              busy={controller.previewing || controller.confirming}
              locked={controller.interactionLocked}
              onChange={controller.updateDraft}
              onPreview={() => void controller.openPreview('save')}
              onPreviewDelete={() => void controller.openPreview('delete')}
            />
          ) : (
            <AdminEmptyState>Select a pricing policy row to inspect it.</AdminEmptyState>
          )}
        </div>
      ) : (
        <AdminEmptyState>No canonical pricing policy rows are available.</AdminEmptyState>
      )}

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
