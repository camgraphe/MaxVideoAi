'use client';

import { History, RefreshCw, Scale, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminLoadingPanel } from '@/components/admin-system/feedback/AdminLoadingPanel';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingChangePreviewDialog } from '@/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import { AdminPricingHistory } from '@/components/admin-system/pricing/AdminPricingHistory';
import { AdminActionButton, AdminActionLink } from '@/components/admin-system/shell/AdminActionLink';
import { AdminPageHeader } from '@/components/admin-system/shell/AdminPageHeader';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { buildLoginHref } from '@/lib/auth-entry-href';
import { useAdminPricingCockpitController } from '../_hooks/useAdminPricingCockpitController';
import { providerComparisonPolicySelectorKey, type ProviderCostComparisonRowView } from '../_lib/pricing-cockpit-view-model';
import { PricingPolicyInspector } from './PricingPolicyInspector';
import { PricingPolicyTable } from './PricingPolicyTable';
import { ProviderPriceComparisonTable } from './ProviderPriceComparisonTable';

export function AdminPricingCockpit() {
  const controller = useAdminPricingCockpitController();
  const [activeTab, setActiveTab] = useState<'comparison' | 'rules' | 'history'>('comparison');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const inventoryRows = controller.inventory?.rows ?? [];
  const databaseOverrideCount = inventoryRows.filter((row) => row.databaseOverride).length;
  const inspectComparison = (row: ProviderCostComparisonRowView) => {
    controller.setFilters({ query: '', source: 'all', status: 'all' });
    controller.selectRow(providerComparisonPolicySelectorKey(row));
    setInspectorOpen(true);
    setActiveTab('rules');
  };
  const selectPolicyRow = (key: string) => {
    controller.selectRow(key);
    setInspectorOpen(true);
  };

  useEffect(() => {
    if (activeTab === 'rules' && inspectorOpen) inspectorRef.current?.scrollIntoView({ block: 'start' });
  }, [activeTab, inspectorOpen, controller.selectedKey]);

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="Model pricing"
        description="See the customer price beside supplier evidence for each model."
        actions={
          <AdminActionButton type="button" onClick={() => void controller.refresh()} disabled={controller.refreshing || controller.refreshLocked}>
            <RefreshCw className={`h-4 w-4 ${controller.refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </AdminActionButton>
        }
      />

      <div className="grid grid-cols-3 gap-1 border-b border-hairline sm:flex" role="tablist" aria-label="Model pricing sections">
        {([
          { id: 'comparison', label: 'Price comparison', icon: Scale },
          { id: 'rules', label: 'Pricing rules', icon: SlidersHorizontal },
          { id: 'history', label: 'History', icon: History },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} id={`pricing-tab-${id}`} type="button" role="tab"
            aria-selected={activeTab === id} aria-controls={`pricing-panel-${id}`}
            tabIndex={activeTab === id ? 0 : -1}
            onClick={() => setActiveTab(id)}
            onKeyDown={(event) => {
              const tabs = ['comparison', 'rules', 'history'] as const;
              const index = tabs.indexOf(id);
              const nextIndex = event.key === 'ArrowRight' ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
              if (nextIndex < 0) return;
              event.preventDefault();
              setActiveTab(tabs[nextIndex]);
              document.getElementById(`pricing-tab-${tabs[nextIndex]}`)?.focus();
            }}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 border-b-2 px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:shrink-0 sm:px-4 sm:text-sm ${activeTab === id ? 'border-brand text-brand' : 'border-transparent text-text-secondary hover:text-text-primary'}`}>
            <Icon className="hidden h-4 w-4 sm:block" aria-hidden="true" />{label}
          </button>
        ))}
      </div>

      {controller.inventory?.warnings.map((warning) => (
        <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>
      ))}
      {controller.error ? <AdminNotice tone="error">{controller.error.message}</AdminNotice> : null}
      {controller.postCommitWarning ? (
        <AdminNotice tone="warning">{controller.postCommitWarning.message}</AdminNotice>
      ) : null}
      {controller.notice ? <AdminNotice tone="success">{controller.notice}</AdminNotice> : null}

      {controller.loading ? <AdminLoadingPanel rows={6} /> : !controller.inventory ? (
        <AdminEmptyState>
          Current prices are unavailable. Refresh the page or sign in again to load an authoritative admin view.
          <span className="mt-3 block"><AdminActionLink href={buildLoginHref({ mode: 'signin', nextPath: '/admin/pricing' })}>Sign in again</AdminActionLink></span>
        </AdminEmptyState>
      ) : (
        <>
          <div id="pricing-panel-comparison" role="tabpanel" aria-labelledby="pricing-tab-comparison" hidden={activeTab !== 'comparison'}>
            {activeTab === 'comparison' ? <AdminSection
              title="Supplier cost and customer price"
              description="Customer quotes are current. Supplier list amounts are estimates until contract or invoice evidence is confirmed."
            >
              <ProviderPriceComparisonTable rows={controller.inventory.providerComparisons}
                disabled={controller.interactionLocked} onInspect={inspectComparison} />
            </AdminSection> : null}
          </div>

          <div id="pricing-panel-rules" role="tabpanel" aria-labelledby="pricing-tab-rules" hidden={activeTab !== 'rules'}>
            {activeTab === 'rules' ? <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-4 text-sm text-text-secondary">
                <p><strong className="text-text-primary">{inventoryRows.length} rules</strong> · {databaseOverrideCount} database overrides · policy version {controller.inventory.versionedPolicyVersion}</p>
                <p>Preview and confirm every change. Exact customer tariff cells are not active yet.</p>
              </div>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
                <div className="order-1 min-w-0 xl:order-1"><AdminSection title="Policy inventory" description="Search a rule, then inspect its effective price and source.">
                  {controller.rows.length ? <PricingPolicyTable rows={controller.rows} filters={controller.filters}
                    onFiltersChange={controller.setFilters} selectedKey={inspectorOpen ? controller.selectedKey : null}
                    onSelect={selectPolicyRow} disabled={controller.interactionLocked} />
                    : <AdminEmptyState>No pricing policy rows match the current filters.</AdminEmptyState>}
                </AdminSection></div>
                <div ref={inspectorRef} className={`min-w-0 scroll-mt-4 xl:order-2 ${inspectorOpen ? 'order-first' : 'order-2'}`}>{inspectorOpen && controller.selectedRow && controller.draft ? (
                  <PricingPolicyInspector row={controller.selectedRow} draft={controller.draft}
                    busy={controller.previewing || controller.confirming} locked={controller.interactionLocked}
                    onChange={controller.updateDraft} onPreview={() => void controller.openPreview('save')}
                    onPreviewDelete={() => void controller.openPreview('delete')} />
                ) : <AdminEmptyState>Select a pricing policy row to inspect it.</AdminEmptyState>}</div>
              </div>
            </div> : null}
          </div>

          <div id="pricing-panel-history" role="tabpanel" aria-labelledby="pricing-tab-history" hidden={activeTab !== 'history'}>
            {activeTab === 'history' ? <AdminPricingHistory events={controller.history}
              title="Immutable pricing policy history"
              description="Rollback opens a fresh impact preview before any change is applied."
              emptyLabel="No pricing policy change has been recorded yet."
              loading={controller.historyLoading} locked={controller.interactionLocked}
              onPreviewRollback={controller.previewRollback} /> : null}
          </div>
        </>
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
