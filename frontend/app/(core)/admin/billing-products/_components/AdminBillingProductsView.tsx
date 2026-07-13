'use client';

import { RefreshCw } from 'lucide-react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingChangePreviewDialog } from '@/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import { AdminPricingHistory } from '@/components/admin-system/pricing/AdminPricingHistory';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminMetricGrid } from '@/components/admin-system/surfaces/AdminMetricGrid';
import { Input } from '@/components/ui/Input';
import { useAdminBillingProductsController } from '../_hooks/useAdminBillingProductsController';

function formatCents(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function AdminBillingProductsView() {
  const controller = useAdminBillingProductsController();

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        eyebrow="Commercial products"
        title="Billing products"
        description="Manage only fixed products referenced by live product flows. Every update requires a canonical server preview and applies transactionally."
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
          { label: 'Live products', value: controller.inventory?.products.length ?? '—', helper: 'Derived from current consumers' },
          { label: 'Database', value: controller.inventory?.databaseStatus ?? 'loading', helper: 'Mutation authority' },
          { label: 'Historical rows', value: controller.inventory?.historicalProductCount ?? '—', helper: 'Preserved, not editable' },
          { label: 'History events', value: controller.history.length, helper: 'Immutable product events' },
        ]}
      />

      {controller.inventory?.warnings.map((warning) => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
      {controller.error ? <AdminNotice tone="error">{controller.error.message}</AdminNotice> : null}
      {controller.notice ? <AdminNotice tone="success">{controller.notice}</AdminNotice> : null}
      {controller.postCommitWarning ? (
        <AdminNotice tone="warning">{controller.postCommitWarning.message}</AdminNotice>
      ) : null}

      {controller.loading ? <AdminLoadingPanel rows={6} /> : controller.inventory ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
          <AdminSection
            title="Live fixed-product inventory"
            description="The list is generated from Character Builder, Angle, Upscale, and Background Removal product-key producers."
          >
            <div className="space-y-4">
              <Input
                aria-label="Search billing products"
                placeholder="Search product key, label, or surface"
                value={controller.query}
                onChange={(event) => controller.setQuery(event.target.value)}
                disabled={controller.interactionLocked}
              />
              <div data-testid="billing-products-inventory">
                {controller.filteredProducts.length ? (
                  <AdminDataTable tableClassName="min-w-[720px]">
                    <thead className="bg-surface">
                      <tr className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                        <th className="px-4 py-3 font-semibold">Product</th>
                        <th className="px-4 py-3 font-semibold">Surface</th>
                        <th className="px-4 py-3 font-semibold">Unit price</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {controller.filteredProducts.map((product) => (
                        <tr
                          key={product.productKey}
                          className={`cursor-pointer border-t border-hairline ${controller.selectedProductKey === product.productKey ? 'bg-surface-hover' : ''}`}
                          onClick={() => controller.selectProduct(product.productKey)}
                        >
                          <td className="px-4 py-3">
                            <button type="button" className="text-left" disabled={controller.interactionLocked}>
                              <span className="block font-medium text-text-primary">{product.label}</span>
                              <span className="mt-1 block font-mono text-xs text-text-muted">{product.productKey}</span>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-text-secondary">{product.surface} · {product.unitKind}</td>
                          <td className="px-4 py-3 font-medium text-text-primary">{formatCents(product.unitPriceCents, product.currency)}</td>
                          <td className="px-4 py-3 text-text-secondary">{product.active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </AdminDataTable>
                ) : <AdminEmptyState>No live billing products match this filter.</AdminEmptyState>}
              </div>
            </div>
          </AdminSection>

          {controller.draft && controller.selectedProduct ? (
            <AdminInspectorPanel
              title="Product inspector"
              description="Edit persisted inputs only. Current and proposed totals are calculated on the server."
            >
              <div className="space-y-4">
                <label className="block space-y-1 text-xs text-text-secondary">
                  <span>Product key</span>
                  <Input value={controller.draft.productKey} readOnly disabled />
                </label>
                <label className="block space-y-1 text-xs text-text-secondary">
                  <span>Label</span>
                  <Input aria-label="Billing product label" value={controller.draft.label} disabled={controller.interactionLocked} onChange={(event) => controller.updateDraft('label', event.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-1 text-xs text-text-secondary">
                    <span>Currency</span>
                    <Input aria-label="Billing product currency" value={controller.draft.currency} disabled={controller.interactionLocked} onChange={(event) => controller.updateDraft('currency', event.target.value)} />
                  </label>
                  <label className="block space-y-1 text-xs text-text-secondary">
                    <span>Unit price (cents)</span>
                    <Input aria-label="Billing product unit price (cents)" type="number" min={0} step={1} value={controller.draft.unitPriceCents} disabled={controller.interactionLocked} onChange={(event) => controller.updateDraft('unitPriceCents', event.target.value)} />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input type="checkbox" checked={controller.draft.active} disabled={controller.interactionLocked} onChange={(event) => controller.updateActive(event.target.checked)} />
                  Active in production billing
                </label>
                <AdminNotice>
                  Surface and unit kind remain immutable: {controller.selectedProduct.surface} · {controller.selectedProduct.unitKind}.
                </AdminNotice>
                <AdminActionButton type="button" variant="primary" onClick={controller.previewDraft} disabled={controller.interactionLocked}>
                  {controller.previewing ? 'Building preview…' : 'Preview billing product change'}
                </AdminActionButton>
              </div>
            </AdminInspectorPanel>
          ) : null}
        </div>
      ) : <AdminEmptyState>No billing product inventory is available.</AdminEmptyState>}

      <AdminPricingHistory
        events={controller.history}
        title="Immutable billing product history"
        description="Rollback derives historical state on the server and always opens a fresh impact preview."
        emptyLabel="No billing product changes have been recorded."
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
