'use client';

import { ChevronDown, ImageIcon, Search, Video } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import {
  filterProviderComparisonRows,
  formatProviderComparisonScenario,
  formatUsdCents,
  summarizeProviderDraftFinalPairs,
  type ProviderComparisonFilters,
  type ProviderCostComparisonRowView,
} from '../_lib/pricing-cockpit-view-model';

type Props = { rows: ProviderCostComparisonRowView[]; disabled: boolean; onInspect: (row: ProviderCostComparisonRowView) => void };

const BRAND_LABELS: Record<string, string> = { bytedance: 'ByteDance' };
const MODEL_LABELS: Record<string, string> = {
  'seedance-2-0-mini': 'Seedance 2.0 Mini', 'seedance-2-0-fast': 'Seedance 2.0 Fast',
  'seedance-2-0': 'Seedance 2.0', 'seedance-2-5': 'Seedance 2.5',
  seedream: 'Seedream 5.0 Lite', 'seedream-5-0-pro': 'Seedream 5.0 Pro',
};
const FEATURED_MODEL_ORDER = ['seedance-2-0-mini', 'seedance-2-0-fast', 'seedance-2-0', 'seedance-2-5', 'seedream', 'seedream-5-0-pro'];
const PROVIDER_LABELS: Record<string, string> = { byteplus_modelark: 'BytePlus ModelArk', fal: 'Fal' };
const UNAVAILABLE_REASONS: Record<string, string> = {
  supplier_rate_unverified_for_route: 'Supplier rate unverified for this route',
  billable_tokens_unavailable: 'Billable token evidence unavailable',
  image_usage_unavailable: 'Image usage unavailable',
  unsupported_model_options: 'Supplier rate unavailable for these options',
};

function displayName(id: string, overrides: Record<string, string>): string {
  return overrides[id] ?? id.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatCost(amountUsd: number | null): string {
  return amountUsd == null ? 'Unavailable' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 6,
  }).format(amountUsd);
}

function groupByBrand(rows: ProviderCostComparisonRowView[]) {
  const groups = new Map<string, ProviderCostComparisonRowView[]>();
  for (const row of rows) groups.set(row.brandId, [...(groups.get(row.brandId) ?? []), row]);
  return [...groups].map(([brandId, entries]) => [brandId, [...entries].sort((left, right) => {
    const leftRank = FEATURED_MODEL_ORDER.indexOf(left.engineId);
    const rightRank = FEATURED_MODEL_ORDER.indexOf(right.engineId);
    if (leftRank !== rightRank) return (leftRank < 0 ? Infinity : leftRank) - (rightRank < 0 ? Infinity : rightRank);
    return left.engineId.localeCompare(right.engineId) || left.scenarioId.localeCompare(right.scenarioId);
  })] as const);
}

function ComparisonDetails({ row, disabled, onInspect }: { row: ProviderCostComparisonRowView } & Pick<Props, 'disabled' | 'onInspect'>) {
  const listDescription = row.supplierList.status === 'published_list_estimate' ? 'Estimated from published list'
    : row.supplierList.status === 'published_list_from_usage' ? 'List from provider usage'
      : UNAVAILABLE_REASONS[row.supplierList.reason ?? ''] ?? 'Supplier cost unavailable';
  const difference = row.realizedGrossDifferenceCents ?? row.indicativeDifferenceVsListCents;
  return (
    <div className="border-t border-hairline bg-bg/50 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
          <h4 className="mb-2 text-sm font-semibold text-text-primary">Supplier evidence</h4>
          <p className="font-medium text-text-primary">Supplier list: {formatCost(row.supplierList.amountUsd)}</p>
          <p className="mt-1">{listDescription}</p>
          {row.publicPromotion ? <p className="mt-2">Public promotion: {formatCost(row.publicPromotion.amountUsd)} until {row.publicPromotion.endsAt.slice(0, 10)}; account rate unconfirmed.</p> : null}
          {row.supplierList.sourceUrl ? <a href={row.supplierList.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-link underline">Published list</a> : <p className="mt-2">Source unavailable</p>}
          {row.supplierList.checkedAt ? <p>Checked {row.supplierList.checkedAt.slice(0, 10)}</p> : null}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
          <h4 className="mb-2 text-sm font-semibold text-text-primary">Contract and invoice</h4>
          <p>{row.supplierEffective.amountUsd == null ? 'Contract unconfirmed' : `Contract: ${formatCost(row.supplierEffective.amountUsd)}`}</p>
          {row.supplierEffective.source ? <p>{row.supplierEffective.source}</p> : null}
          {row.supplierEffective.confirmedAt ? <p>Confirmed {row.supplierEffective.confirmedAt.slice(0, 10)}</p> : null}
          <p className="mt-2">{row.supplierObserved.amountUsd == null ? 'Observed unavailable' : `Invoice: ${formatCost(row.supplierObserved.amountUsd)}`}</p>
          {row.supplierObserved.source ? <p>{row.supplierObserved.source}</p> : null}
          {row.supplierObserved.observedAt ? <p>Observed {row.supplierObserved.observedAt.slice(0, 10)}</p> : null}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
          <h4 className="mb-2 text-sm font-semibold text-text-primary">Customer quote</h4>
          <p className="text-lg font-semibold text-text-primary">{row.customerQuote ? formatUsdCents(row.customerQuote.totalCents) : 'Customer quote unavailable'}</p>
          {row.customerQuote ? <><p>{row.customerQuote.pricingMode === 'manual_tariff' ? 'Manual tariff' : 'Current policy'} · {row.customerQuote.source}</p><p className="mt-1 break-all font-mono">{row.customerQuote.ruleId}</p></> : null}
        </div>
        <div className="rounded-lg border border-border bg-surface p-3 text-xs text-text-secondary">
          <h4 className="mb-2 text-sm font-semibold text-text-primary">Comparison</h4>
          <p>{difference == null ? 'Gross gap unavailable' : `${formatCost(difference / 100)} ${row.realizedGrossDifferenceCents != null ? 'observed' : 'indicative vs list'}`}</p>
          <p className="mt-1">Payment and operating fees excluded.</p>
          <p className="mt-2">{PROVIDER_LABELS[row.executionProvider] ?? row.executionProvider}</p>
          {row.routeConfigured === false ? <p className="mt-1 text-warning">New generation disabled</p> : null}
        </div>
      </div>
      <p className="mt-3 break-all font-mono text-[11px] text-text-muted">{row.scenarioId}</p>
      <AdminActionButton type="button" variant="primary" disabled={disabled || !row.customerQuote} onClick={() => onInspect(row)} className="mt-3">
        Inspect policy
      </AdminActionButton>
    </div>
  );
}

export function ProviderPriceComparisonTable({ rows, disabled, onInspect }: Props) {
  const [filters, setFilters] = useState<ProviderComparisonFilters>({ brandId: 'all', executionProvider: 'all', mediaType: 'all', query: '' });
  const visible = useMemo(() => filterProviderComparisonRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByBrand(visible), [visible]);
  const pairs = useMemo(() => summarizeProviderDraftFinalPairs(visible), [visible]);
  const brands = [...new Set(rows.map((row) => row.brandId))].sort();
  const providers = [...new Set(rows.map((row) => row.executionProvider))].sort();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">Model family</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Model family">
          {[{ id: 'all', label: 'All families' }, ...brands.map((id) => ({ id, label: displayName(id, BRAND_LABELS) }))].map((brand) => (
            <button key={brand.id} type="button" disabled={disabled} aria-pressed={filters.brandId === brand.id}
              onClick={() => setFilters({ ...filters, brandId: brand.id })}
              className={`min-h-10 rounded-lg border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.brandId === brand.id ? 'border-brand bg-brand/10 text-brand' : 'border-border bg-surface text-text-secondary hover:bg-bg'}`}>
              {brand.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-hairline py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex self-start rounded-lg border border-border bg-bg p-1" role="group" aria-label="Media type">
          {([['all', 'All'], ['video', 'Video'], ['image', 'Image']] as const).map(([value, label]) => (
            <button key={value} type="button" disabled={disabled} aria-pressed={filters.mediaType === value}
              onClick={() => setFilters({ ...filters, mediaType: value })}
              className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.mediaType === value ? 'bg-surface text-brand shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
              {value === 'video' ? <Video className="h-4 w-4" aria-hidden="true" /> : value === 'image' ? <ImageIcon className="h-4 w-4" aria-hidden="true" /> : null}{label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:w-[min(100%,460px)]">
          <label className="relative flex-1">
            <span className="sr-only">Search models or scenarios</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
            <input aria-label="Search models or scenarios" value={filters.query} disabled={disabled}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search models or scenarios"
              className="min-h-10 w-full rounded-lg border border-border bg-surface py-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
          </label>
          <label className="sr-only" htmlFor="pricing-execution-provider">Execution provider</label>
          <select id="pricing-execution-provider" aria-label="Execution provider" value={filters.executionProvider} disabled={disabled}
            onChange={(event) => setFilters({ ...filters, executionProvider: event.target.value })}
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary sm:w-[150px]">
            <option value="all">All providers</option>
            {providers.map((provider) => <option key={provider} value={provider}>{PROVIDER_LABELS[provider] ?? provider}</option>)}
          </select>
        </div>
      </div>

      {groups.length ? groups.map(([brandId, entries]) => (
        <section key={brandId} aria-label={`${displayName(brandId, BRAND_LABELS)} price comparison`} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3"><h3 className="text-base font-semibold text-text-primary">{displayName(brandId, BRAND_LABELS)}</h3><span className="text-xs text-text-muted">{entries.length} {entries.length === 1 ? 'scenario' : 'scenarios'}</span></div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="hidden gap-4 border-b border-hairline bg-bg px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(120px,.8fr)_minmax(120px,.8fr)_92px]">
              <span>Model</span><span>Scenario</span><span>Supplier list</span><span>Customer total</span><span>Action</span>
            </div>
            {entries.map((row) => (
              <details key={row.scenarioId} className="group border-b border-hairline last:border-b-0 open:bg-bg/50">
                <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(120px,.8fr)_minmax(120px,.8fr)_92px] lg:items-center lg:gap-4">
                  <span className="flex items-center justify-between gap-2 lg:block"><span className="block font-semibold text-text-primary">{displayName(row.engineId, MODEL_LABELS)}</span><span className="rounded-full bg-bg px-2 py-0.5 text-[11px] text-text-secondary lg:mt-1 lg:inline-block">{row.mediaType === 'image' ? 'Image' : 'Video'}</span></span>
                  <span className="text-sm text-text-secondary">{formatProviderComparisonScenario(row)}</span>
                  <span className="flex items-baseline justify-between gap-2 text-sm lg:block"><span className="text-xs text-text-muted lg:hidden">Supplier list estimate</span><span className="font-medium text-text-primary">{formatCost(row.supplierList.amountUsd)}</span></span>
                  <span className="flex items-baseline justify-between gap-2 text-sm lg:block"><span className="text-xs text-text-muted lg:hidden">Customer price</span><span className="font-semibold text-text-primary">{row.customerQuote ? formatUsdCents(row.customerQuote.totalCents) : 'Unavailable'}</span></span>
                  <span className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-text-primary">Details<ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" /></span>
                </summary>
                <ComparisonDetails row={row} disabled={disabled} onInspect={onInspect} />
              </details>
            ))}
          </div>
        </section>
      )) : <AdminEmptyState>No comparison scenarios match these filters.</AdminEmptyState>}

      {pairs.length ? <details className="rounded-xl border border-border bg-surface p-4 text-xs text-text-secondary">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">Draft → final combined totals</summary>
        <div className="mt-3 space-y-1">{pairs.map((pair) => <p key={pair.workflowPairId}>
          {pair.workflowPairId}: customer {pair.customerTotalCents == null ? 'unavailable' : formatUsdCents(pair.customerTotalCents)}; supplier list {formatCost(pair.supplierListUsd)}. Two separately paid steps.
        </p>)}</div>
      </details> : null}
    </div>
  );
}
