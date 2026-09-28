'use client';

import React, { useMemo, useState } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import {
  filterProviderComparisonRows,
  formatProviderComparisonScenario,
  formatUsdCents,
  summarizeProviderDraftFinalPairs,
  type ProviderComparisonFilters,
  type ProviderCostComparisonRowView,
} from '../_lib/pricing-cockpit-view-model';

type Props = {
  rows: ProviderCostComparisonRowView[];
  disabled: boolean;
  onInspect: (row: ProviderCostComparisonRowView) => void;
};

const BRAND_LABELS: Record<string, string> = { bytedance: 'ByteDance' };
const PROVIDER_LABELS: Record<string, string> = { byteplus_modelark: 'BytePlus ModelArk', fal: 'Fal' };
const UNAVAILABLE_REASONS: Record<string, string> = {
  supplier_rate_unverified_for_route: 'Supplier rate unverified for this route',
  billable_tokens_unavailable: 'Billable token evidence unavailable',
  image_usage_unavailable: 'Image usage unavailable',
  unsupported_model_options: 'Supplier rate unavailable for these options',
};

function formatCost(amountUsd: number | null): string {
  return amountUsd == null ? 'Unavailable' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
  }).format(amountUsd);
}

function formatGrossGap(cents: number | null): string {
  return cents == null ? 'Unavailable' : formatCost(cents / 100);
}

function groupRows(rows: ProviderCostComparisonRowView[]) {
  const groups = new Map<string, ProviderCostComparisonRowView[]>();
  for (const row of rows) {
    const key = `${row.brandId}|${row.executionProvider}|${row.mediaType}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups].map(([key, entries]) => ({ key, entries, first: entries[0]! }));
}

export function ProviderPriceComparisonTable({ rows, disabled, onInspect }: Props) {
  const [filters, setFilters] = useState<ProviderComparisonFilters>({
    brandId: 'all', executionProvider: 'all', mediaType: 'all', query: '',
  });
  const visible = useMemo(() => filterProviderComparisonRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupRows(visible), [visible]);
  const pairs = useMemo(() => summarizeProviderDraftFinalPairs(visible), [visible]);
  const brands = [...new Set(rows.map((row) => row.brandId))].sort();
  const providers = [...new Set(rows.map((row) => row.executionProvider))].sort();

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary">
        Supplier list amounts are estimates unless marked as usage. Contract and observed costs require separate evidence.
        Gross gaps exclude payment and operating fees. Customer totals come from the current canonical quote.
      </p>
      <AdminFilterBar onSubmit={(event) => event.preventDefault()} fieldsClassName="sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Family</span>
          <select aria-label="Family" value={filters.brandId} disabled={disabled}
            onChange={(event) => setFilters({ ...filters, brandId: event.target.value })}
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary">
            <option value="all">All families</option>
            {brands.map((brand) => <option key={brand} value={brand}>{BRAND_LABELS[brand] ?? brand}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Execution provider</span>
          <select aria-label="Execution provider" value={filters.executionProvider} disabled={disabled}
            onChange={(event) => setFilters({ ...filters, executionProvider: event.target.value })}
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary">
            <option value="all">All providers</option>
            {providers.map((provider) => <option key={provider} value={provider}>{PROVIDER_LABELS[provider] ?? provider}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Media</span>
          <select aria-label="Media" value={filters.mediaType} disabled={disabled}
            onChange={(event) => setFilters({ ...filters, mediaType: event.target.value as ProviderComparisonFilters['mediaType'] })}
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary">
            <option value="all">Video and image</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Model or scenario</span>
          <input aria-label="Model or scenario" value={filters.query} disabled={disabled}
            onChange={(event) => setFilters({ ...filters, query: event.target.value })}
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary" />
        </label>
      </AdminFilterBar>

      {groups.length ? groups.map(({ key, entries, first }) => (
        <section key={key} className="space-y-2" aria-label={`${first.brandId} ${first.executionProvider} ${first.mediaType}`}>
          <h3 className="text-sm font-semibold text-text-primary">
            {BRAND_LABELS[first.brandId] ?? first.brandId} · {PROVIDER_LABELS[first.executionProvider] ?? first.executionProvider} · {first.mediaType === 'image' ? 'Image' : 'Video'}
          </h3>
          <AdminDataTable tone="muted" tableClassName="min-w-[1120px]">
            <thead><tr className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              <th className="px-3 py-3">Model / mode / options</th>
              <th className="px-3 py-3">Supplier list</th>
              <th className="px-3 py-3">Contract</th>
              <th className="px-3 py-3">Observed</th>
              <th className="px-3 py-3">Customer total</th>
              <th className="px-3 py-3">Gross gap</th>
              <th className="px-3 py-3">Source / date</th>
              <th className="px-3 py-3">Policy</th>
            </tr></thead>
            <tbody>{entries.map((row) => (
              <tr key={row.scenarioId} className="border-t border-hairline align-top text-xs text-text-secondary">
                <td className="px-3 py-3">
                  <span className="block font-medium text-text-primary">{row.engineId}</span>
                  <span className="block">{formatProviderComparisonScenario(row)}</span>
                  <span className="block break-all font-mono text-[10px] text-text-muted">{row.scenarioId}</span>
                </td>
                <td className="px-3 py-3">
                  <span className="block font-medium text-text-primary">{formatCost(row.supplierList.amountUsd)}</span>
                  <span className="block">{row.supplierList.status === 'unavailable'
                    ? UNAVAILABLE_REASONS[row.supplierList.reason ?? ''] ?? 'Supplier cost unavailable'
                    : row.supplierList.status === 'published_list_estimate' ? 'Estimated from published list' : 'List from provider usage'}</span>
                  {row.publicPromotion ? <span className="block">Public promotion {formatCost(row.publicPromotion.amountUsd)} until {row.publicPromotion.endsAt.slice(0, 10)}; account rate unconfirmed</span> : null}
                </td>
                <td className="px-3 py-3">{row.supplierEffective.amountUsd == null
                  ? row.supplierEffective.status === 'account_contract_unconfirmed' ? 'Contract unconfirmed' : 'Unavailable'
                  : <><span className="block">{formatCost(row.supplierEffective.amountUsd)}</span><span className="block">Confirmed effective</span></>}</td>
                <td className="px-3 py-3">{row.supplierObserved.amountUsd == null
                  ? 'Observed unavailable'
                  : <><span className="block">{formatCost(row.supplierObserved.amountUsd)}</span><span className="block">Invoice observed</span></>}</td>
                <td className="px-3 py-3">{row.customerQuote
                  ? <><span className="block font-semibold text-text-primary">{formatUsdCents(row.customerQuote.totalCents)}</span>
                      <span className="block">{row.customerQuote.pricingMode === 'manual_tariff' ? 'Manual tariff' : 'Current policy'} · {row.customerQuote.source}</span>
                      <span className="block break-all font-mono text-[10px]">{row.customerQuote.ruleId}</span></>
                  : 'Customer quote unavailable'}</td>
                <td className="px-3 py-3">{row.realizedGrossDifferenceCents != null
                  ? <>{formatGrossGap(row.realizedGrossDifferenceCents)}<span className="block">Observed; fees excluded</span></>
                  : row.indicativeDifferenceVsListCents != null
                    ? <>{formatGrossGap(row.indicativeDifferenceVsListCents)}<span className="block">Indicative vs list; fees excluded</span></>
                    : 'Unavailable'}</td>
                <td className="px-3 py-3">
                  {row.supplierList.sourceUrl ? <a href={row.supplierList.sourceUrl} target="_blank" rel="noreferrer" className="underline">Published list</a> : 'Source unavailable'}
                  {row.supplierList.checkedAt ? <span className="block">Checked {row.supplierList.checkedAt.slice(0, 10)}</span> : null}
                  {row.supplierEffective.source ? <span className="block">{row.supplierEffective.source}</span> : null}
                  {row.supplierEffective.confirmedAt ? <span className="block">Confirmed {row.supplierEffective.confirmedAt.slice(0, 10)}</span> : null}
                  {row.supplierObserved.source ? <span className="block">{row.supplierObserved.source}</span> : null}
                  {row.supplierObserved.observedAt ? <span className="block">Observed {row.supplierObserved.observedAt.slice(0, 10)}</span> : null}
                </td>
                <td className="px-3 py-3"><button type="button" disabled={disabled || !row.customerQuote}
                  onClick={() => onInspect(row)} className="font-medium text-link underline disabled:opacity-50">Inspect policy</button></td>
              </tr>
            ))}</tbody>
          </AdminDataTable>
        </section>
      )) : <AdminEmptyState>No comparison scenarios match these filters.</AdminEmptyState>}

      {pairs.length ? <div className="space-y-1 rounded-xl border border-hairline bg-surface p-4 text-xs text-text-secondary">
        <h3 className="font-semibold text-text-primary">Draft → final combined totals</h3>
        {pairs.map((pair) => <p key={pair.workflowPairId}>
          {pair.workflowPairId}: customer {pair.customerTotalCents == null ? 'unavailable' : formatUsdCents(pair.customerTotalCents)};
          supplier list {formatCost(pair.supplierListUsd)}. Two separately paid steps.
        </p>)}
      </div> : null}
    </div>
  );
}
