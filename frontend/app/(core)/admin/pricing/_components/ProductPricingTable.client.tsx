'use client';

import { useEffect, useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { ChevronDown } from 'lucide-react';
import type { ProductPricingCategory, ProductPricingInventory } from '@/lib/admin/product-pricing-contract';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminPricingChangePreviewDialog } from '@/components/admin-system/pricing/AdminPricingChangePreviewDialog';
import { AdminPricingHistory } from '@/components/admin-system/pricing/AdminPricingHistory';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminDynamicToolPriceField } from '@/components/admin-system/pricing/AdminDynamicToolPriceField.client';
import { useAdminBillingProductsController } from '../../billing-products/_hooks/useAdminBillingProductsController';
import { pricingPolicySelectorKey } from '../_lib/pricing-cockpit-view-model';

type Selector = { engineId: string; mode?: string; resolution?: string };
type Props = { category: ProductPricingCategory; onInspectPolicy: (selector: Selector) => void; onLock: (locked: boolean) => void;
  policyEditor?: ReactNode; policyEditorKey?: string | null; policyLocked?: boolean };
async function fetchInventory(url: string): Promise<{ inventory: ProductPricingInventory }> {
  const response = await fetch(url, { cache: 'no-store' });
  const body = await response.json();
  if (!response.ok || !body.ok) throw new Error('Unable to load current product prices.');
  return body;
}
function money(cents: number | null, currency: string, digits = 2) {
  return cents == null || !Number.isFinite(cents) ? 'Unknown' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: digits,
  }).format(cents / 100);
}

export function ProductPricingTable({ category, onInspectPolicy, onLock, policyEditor, policyEditorKey, policyLocked = false }: Props) {
  const [duration, setDuration] = useState(10);
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [policyEditorRow, setPolicyEditorRow] = useState<string | null>(null);
  const inventory = useSWR(`/api/admin/pricing/products?durationSec=${duration}`, fetchInventory);
  const billing = useAdminBillingProductsController();
  const locked = billing.refreshLocked || policyLocked;
  useEffect(() => { onLock(billing.refreshLocked); return () => onLock(false); }, [billing.refreshLocked, onLock]);
  const currentInventory = !inventory.error ? inventory.data?.inventory : undefined;
  const rows = currentInventory?.rows.filter((row) => row.category === category &&
    `${row.label} ${row.scenario}`.toLowerCase().includes(query.toLowerCase())) ?? [];
  const productEditor = editorOpen && billing.draft && billing.selectedProduct ? <div className="space-y-3 rounded-lg border border-[#cbb9ff] bg-[#f1ebff] p-3">
      <div className="flex items-center justify-between gap-2"><strong className="text-sm">{billing.selectedProduct.label} · current {billing.draft.dynamicPriceMultiplier === undefined ? '' : 'minimum '}{money(billing.selectedProduct.unitPriceCents, billing.selectedProduct.currency)}/{billing.selectedProduct.unitKind}</strong>
        <button type="button" disabled={locked} onClick={() => setEditorOpen(false)} className="text-xs underline">Close editor</button></div>
      <div className="flex flex-wrap items-end gap-3"><label className="space-y-1 text-xs"><span className="block">{billing.draft.dynamicPriceMultiplier === undefined ? 'Unit price' : 'Minimum'} in cents (100 = {billing.draft.currency} 1)</span>
        <input aria-label="Product unit price in cents" type="number" min={0} step={1} value={billing.draft.unitPriceCents}
          disabled={billing.interactionLocked || policyLocked} onChange={(event) => billing.updateDraft('unitPriceCents', event.target.value)} className="w-36 rounded-md border border-border bg-surface px-3 py-2 text-sm" /></label>
        <AdminDynamicToolPriceField value={billing.draft.dynamicPriceMultiplier} disabled={billing.interactionLocked || policyLocked}
          onChange={value => billing.updateDraft('dynamicPriceMultiplier', value)} />
        <AdminActionButton type="button" variant="primary" disabled={billing.interactionLocked || policyLocked} onClick={billing.previewDraft}>Preview price change</AdminActionButton></div>
      <p className="text-xs text-text-secondary">{billing.draft.dynamicPriceMultiplier === undefined ? 'Applies after explicit confirmation.'
        : 'Customer total = max(minimum, supplier processing estimate × coefficient). Preview compares actual totals across several reference durations and resolutions.'}</p>
    </div> : null;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-bg p-3">
      <input aria-label="Search product prices" placeholder="Search products…" value={query} disabled={locked}
        onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm" />
      {category !== 'storyboard' ? <label className="flex items-center gap-2 text-xs text-text-secondary">Reference duration
        <select aria-label="Product reference duration" value={duration} disabled={locked}
          onChange={(event) => setDuration(Number(event.target.value))} className="rounded-md border border-border bg-surface px-2 py-2 text-sm">
          {[3, 5, 10, 30, 60, 120, 184].map((value) => <option key={value} value={value}>{value} s</option>)}
        </select>
      </label> : null}
    </div>
    <p className="text-xs text-text-secondary">Blue: supplier catalogue estimate or budget · Purple: current customer price · Green: estimated gross margin before fees. /s compares this exact reference; it does not change provider billing units.</p>
    {inventory.isLoading ? <p className="text-sm">Loading current product prices…</p> : null}
    {inventory.error ? <AdminNotice tone="warning">Unable to load current product prices.</AdminNotice> : null}
    {currentInventory && !rows.length ? <p className="text-sm text-text-secondary">No matching product prices.</p> : null}
    {currentInventory?.warnings.map((warning) => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
    {rows.map((row) => {
      const customerUnit = row.totalCents == null ? null : row.totalCents / row.quantity;
      const supplierUnit = row.supplierCents == null ? null : row.supplierCents / row.quantity;
      const difference = row.totalCents == null || row.supplierCents == null ? null : row.totalCents - row.supplierCents;
      const margin = difference == null || !row.totalCents ? null : difference / row.totalCents * 100;
      return <details key={row.id} className="group overflow-hidden rounded-lg border border-border bg-surface">
        <summary className="relative grid grid-cols-3 cursor-pointer list-none items-center gap-2 p-3 min-[900px]:grid-cols-[minmax(160px,1fr)_minmax(100px,.6fr)_minmax(110px,.65fr)_minmax(95px,.5fr)_auto]">
          <span className="col-span-3 min-w-0 pr-6 min-[900px]:col-span-1"><strong className="block text-sm capitalize text-text-primary">{row.label}</strong><span className="mt-0.5 block text-xs text-text-secondary">{row.scenario}</span></span>
          <span className="rounded-md border border-info-border bg-info-bg px-2 py-1.5"><span className="block text-[10px] font-semibold uppercase text-info">Supplier {row.supplierBasis}</span><strong className="block text-sm tabular-nums">{money(supplierUnit, row.currency, 4)}/{row.unit}</strong><span className="block text-[10px]">{money(row.supplierCents, row.currency, 4)} total</span></span>
          <span className="rounded-md border border-[#cbb9ff] bg-[#f1ebff] px-2 py-1.5"><span className="block text-[10px] font-semibold uppercase text-[#5937b8]">Customer current</span><strong className="block text-sm tabular-nums">{money(customerUnit, row.currency, 4)}/{row.unit}</strong><span className="block text-[10px]">{money(row.totalCents, row.currency)} total</span></span>
          <span className={`rounded-md border px-2 py-1.5 ${difference == null ? 'border-border bg-bg' : difference < 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><span className="block text-[10px] font-semibold uppercase">Est. gross margin</span><strong className="block text-sm tabular-nums">{margin == null ? 'Unknown' : `${margin.toFixed(1)}%`}</strong><span className="block text-[10px]">{money(difference, row.currency, 4)} / scenario</span></span>
          <ChevronDown className="absolute right-3 top-3 h-4 w-4 transition-transform group-open:rotate-180 min-[900px]:static" aria-hidden="true" />
        </summary>
        <div className="flex flex-wrap items-start justify-between gap-3 border-t border-border bg-bg p-3">
          <ul className="min-w-0 flex-1 space-y-1 text-xs text-text-secondary">{row.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          {row.billingProductKey ? <AdminActionButton type="button" disabled={billing.interactionLocked || policyLocked || !billing.inventory?.products.some((product) => product.productKey === row.billingProductKey)}
            onClick={() => { billing.selectProduct(row.billingProductKey!); setEditorOpen(true); }}>Edit pricing</AdminActionButton>
            : row.policySelector ? <AdminActionButton type="button" disabled={locked || row.totalCents == null} onClick={() => { setPolicyEditorRow(row.id); onInspectPolicy(row.policySelector!); }}>Edit pricing policy</AdminActionButton> : null}
        </div>
        {row.billingProductKey === billing.selectedProductKey ? productEditor : null}
        {row.id === policyEditorRow && row.policySelector && pricingPolicySelectorKey(row.policySelector) === policyEditorKey ? policyEditor : null}
      </details>;
    })}
    {billing.error ? <AdminNotice tone="warning">{billing.error.message}</AdminNotice> : null}
    {billing.notice ? <AdminNotice>{billing.notice}</AdminNotice> : null}
    {billing.postCommitWarning ? <AdminNotice tone="warning">{billing.postCommitWarning.message}</AdminNotice> : null}
    {category === 'tools' ? <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-semibold">Product price history and rollback</summary>
      <AdminPricingHistory events={billing.history} loading={billing.historyLoading} locked={billing.interactionLocked || policyLocked}
        title="Product price history" description="Rollback requires a fresh server preview." emptyLabel="No product price changes."
        onPreviewRollback={billing.previewRollback} /></details> : null}
    {billing.preview ? <AdminPricingChangePreviewDialog preview={billing.preview} busy={billing.confirming} error={billing.error?.message}
      onCancel={billing.cancelPreview} onConfirm={() => void billing.confirmPreview().then(() => inventory.mutate())} /> : null}
  </div>;
}
