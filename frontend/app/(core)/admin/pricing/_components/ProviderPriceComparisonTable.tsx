'use client';

import { ChevronDown, ExternalLink, ImageIcon, Search, Video } from 'lucide-react';
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

function groupByFamily(rows: ProviderCostComparisonRowView[]) {
  const groups = new Map<string, ProviderCostComparisonRowView[]>();
  for (const row of rows) {
    const familyId = row.familyId ?? row.brandId;
    groups.set(familyId, [...(groups.get(familyId) ?? []), row]);
  }
  return [...groups].map(([familyId, entries]) => [familyId, [...entries].sort((left, right) => {
    const leftRank = FEATURED_MODEL_ORDER.indexOf(left.engineId);
    const rightRank = FEATURED_MODEL_ORDER.indexOf(right.engineId);
    if (leftRank !== rightRank) return (leftRank < 0 ? Infinity : leftRank) - (rightRank < 0 ? Infinity : rightRank);
    return left.engineId.localeCompare(right.engineId) || left.scenarioId.localeCompare(right.scenarioId);
  })] as const);
}

function PriceTile({ label, amount, tone }: { label: string; amount: string; tone: 'supplier' | 'customer' }) {
  return (
    <span className={`flex min-h-[72px] min-w-0 flex-col justify-center rounded-xl border px-3 py-2 ${tone === 'supplier' ? 'border-info-border bg-info-bg' : 'border-[#cbb9ff] bg-[#f1ebff]'}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'supplier' ? 'text-info' : 'text-[#5937b8]'}`}>{label}</span>
      <span className="mt-1 break-words text-lg font-bold leading-tight text-text-primary">{amount}</span>
    </span>
  );
}

function ComparisonDetails({ row, disabled, onInspect }: { row: ProviderCostComparisonRowView } & Pick<Props, 'disabled' | 'onInspect'>) {
  const listDescription = row.supplierList.status === 'published_list_estimate' ? 'Estimated from published list'
    : row.supplierList.status === 'published_list_from_usage' ? 'List from provider usage'
      : UNAVAILABLE_REASONS[row.supplierList.reason ?? ''] ?? 'Supplier cost unavailable';
  const difference = row.realizedGrossDifferenceCents ?? row.indicativeDifferenceVsListCents;
  return (
    <div className="border-t border-hairline bg-bg/60 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-base font-semibold text-text-primary">{displayName(row.engineId, MODEL_LABELS)}</h4>
          <p className="mt-0.5 text-xs text-text-secondary">{formatProviderComparisonScenario(row)} · {PROVIDER_LABELS[row.executionProvider] ?? row.executionProvider}</p>
        </div>
        <AdminActionButton type="button" variant="primary" disabled={disabled || !row.customerQuote} onClick={() => onInspect(row)} className="self-start sm:self-auto">
          Inspect policy <ExternalLink className="ml-1 h-4 w-4" aria-hidden="true" />
        </AdminActionButton>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-info-border bg-info-bg p-4">
          <h5 className="text-xs font-bold uppercase tracking-wide text-info">Supplier information</h5>
          <p className="mt-3 text-2xl font-bold text-text-primary">{formatCost(row.supplierList.amountUsd)}</p>
          <p className="mt-1 text-xs text-text-secondary">Supplier list · {listDescription}</p>
          <div className="mt-4 border-t border-info-border pt-3 text-xs text-text-secondary">
            {row.publicPromotion ? <p>Public promotion: {formatCost(row.publicPromotion.amountUsd)} until {row.publicPromotion.endsAt.slice(0, 10)}; account rate unconfirmed.</p> : null}
            {row.supplierList.sourceUrl ? <a href={row.supplierList.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-info underline">Published list <ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <p>Source unavailable</p>}
            {row.supplierList.checkedAt ? <p className="mt-1">Checked {row.supplierList.checkedAt.slice(0, 10)}</p> : null}
          </div>
        </section>
        <section className="rounded-xl border border-[#cbb9ff] bg-[#f1ebff] p-4">
          <h5 className="text-xs font-bold uppercase tracking-wide text-[#5937b8]">Customer pricing</h5>
          <p className="mt-3 text-2xl font-bold text-text-primary">{row.customerQuote ? formatUsdCents(row.customerQuote.totalCents) : 'Customer quote unavailable'}</p>
          <p className="mt-1 text-xs text-text-secondary">Customer total · current quote</p>
          {row.customerQuote ? <div className="mt-4 border-t border-[#d9cbff] pt-3 text-xs text-text-secondary">
            <p>{row.customerQuote.pricingMode === 'manual_tariff' ? 'Manual tariff' : 'Current policy'} · {row.customerQuote.source}</p>
            <p className="mt-1 break-all font-mono">{row.customerQuote.ruleId}</p>
          </div> : null}
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h5 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Contract and invoice</h5>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-xs text-text-muted">Contract price</p><p className="mt-1 font-semibold text-text-primary">{row.supplierEffective.amountUsd == null ? 'Contract unconfirmed' : formatCost(row.supplierEffective.amountUsd)}</p>
              {row.supplierEffective.source ? <p className="mt-1 text-xs text-text-secondary">{row.supplierEffective.source}</p> : null}
              {row.supplierEffective.confirmedAt ? <p className="mt-1 text-xs text-text-secondary">Confirmed {row.supplierEffective.confirmedAt.slice(0, 10)}</p> : null}</div>
            <div><p className="text-xs text-text-muted">Observed invoice</p><p className="mt-1 font-semibold text-text-primary">{row.supplierObserved.amountUsd == null ? 'Observed unavailable' : formatCost(row.supplierObserved.amountUsd)}</p>
              {row.supplierObserved.source ? <p className="mt-1 text-xs text-text-secondary">{row.supplierObserved.source}</p> : null}
              {row.supplierObserved.observedAt ? <p className="mt-1 text-xs text-text-secondary">Observed {row.supplierObserved.observedAt.slice(0, 10)}</p> : null}</div>
          </div>
        </section>
        <section className="rounded-xl border border-border bg-surface p-4">
          <h5 className="text-xs font-bold uppercase tracking-wide text-text-secondary">Comparable scenario</h5>
          <p className="mt-3 text-sm font-semibold text-text-primary">{formatProviderComparisonScenario(row)}</p>
          <p className="mt-2 text-xs text-text-secondary">{difference == null ? 'Gross gap unavailable' : `${formatCost(difference / 100)} ${row.realizedGrossDifferenceCents != null ? 'observed' : 'indicative vs list'}`}</p>
          <p className="mt-1 text-xs text-text-muted">Payment and operating fees excluded.</p>
          {row.routeConfigured === false ? <p className="mt-2 text-xs font-medium text-warning">New generation disabled</p> : null}
          <p className="mt-3 break-all font-mono text-[11px] text-text-muted">{row.scenarioId}</p>
        </section>
      </div>
    </div>
  );
}

export function ProviderPriceComparisonTable({ rows, disabled, onInspect }: Props) {
  const [filters, setFilters] = useState<ProviderComparisonFilters>({ brandId: 'all', executionProvider: 'all', mediaType: 'all', query: '' });
  const visible = useMemo(() => filterProviderComparisonRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByFamily(visible), [visible]);
  const pairs = useMemo(() => summarizeProviderDraftFinalPairs(visible), [visible]);
  const brands = [...new Set(rows.map((row) => row.familyId ?? row.brandId))].sort();
  const providers = [...new Set(rows.map((row) => row.executionProvider))].sort();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Model family">
          {[{ id: 'all', label: 'All families' }, ...brands.map((id) => ({ id, label: displayName(id, BRAND_LABELS) }))].map((brand) => (
            <button key={brand.id} type="button" disabled={disabled} aria-pressed={filters.brandId === brand.id}
              onClick={() => setFilters({ ...filters, brandId: brand.id })}
              className={`min-h-10 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.brandId === brand.id ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-border bg-bg text-text-secondary hover:border-brand/40 hover:text-text-primary'}`}>
              {brand.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 border-t border-hairline pt-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="inline-flex w-fit rounded-xl border border-border bg-bg p-1" role="group" aria-label="Media type">
            {([['all', 'All'], ['video', 'Video'], ['image', 'Image']] as const).map(([value, label]) => (
              <button key={value} type="button" disabled={disabled} aria-pressed={filters.mediaType === value}
                onClick={() => setFilters({ ...filters, mediaType: value })}
                className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.mediaType === value ? 'bg-surface text-brand shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                {value === 'video' ? <Video className="h-4 w-4" aria-hidden="true" /> : value === 'image' ? <ImageIcon className="h-4 w-4" aria-hidden="true" /> : null}{label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            <label className="relative w-full sm:max-w-sm">
              <span className="sr-only">Search models or scenarios</span>
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden="true" />
              <input aria-label="Search models or scenarios" value={filters.query} disabled={disabled}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search models or scenarios"
                className="min-h-10 w-full rounded-xl border border-border bg-bg py-2 pl-10 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
            </label>
            <label className="sr-only" htmlFor="pricing-execution-provider">Execution provider</label>
            <select id="pricing-execution-provider" aria-label="Execution provider" value={filters.executionProvider} disabled={disabled}
              onChange={(event) => setFilters({ ...filters, executionProvider: event.target.value })}
              className="min-h-10 rounded-xl border border-border bg-bg px-3 text-sm text-text-primary sm:w-[170px]">
              <option value="all">All providers</option>
              {providers.map((provider) => <option key={provider} value={provider}>{PROVIDER_LABELS[provider] ?? provider}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs text-text-secondary" aria-label="Price color key">
        <span className="font-semibold text-text-primary">Reading the prices</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-info-border bg-info-bg" aria-hidden="true" />Blue: supplier list estimate</span>
        <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm border border-[#cbb9ff] bg-[#f1ebff]" aria-hidden="true" />Purple: customer total</span>
      </div>

      {groups.length ? groups.map(([familyId, entries]) => (
        <section key={familyId} aria-label={`${displayName(familyId, BRAND_LABELS)} price comparison`} className="space-y-3">
          <div className="flex items-baseline justify-between gap-3"><h3 className="text-lg font-semibold text-text-primary">{displayName(familyId, BRAND_LABELS)}</h3><span className="text-xs text-text-muted">{entries.length} {entries.length === 1 ? 'scenario' : 'scenarios'}</span></div>
          <div className="grid gap-3">
            {entries.map((row) => (
              <details key={row.scenarioId} className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-sm open:border-brand/40 open:shadow-md">
                <summary className="grid cursor-pointer list-none grid-cols-2 items-center gap-3 p-4 transition hover:bg-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden sm:p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(135px,.85fr)_minmax(135px,.85fr)_auto]">
                  <span className="col-span-2 min-w-0 lg:col-span-1"><span className="block text-base font-bold text-text-primary">{displayName(row.engineId, MODEL_LABELS)}</span><span className="mt-1 inline-flex rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-medium text-text-secondary">{row.mediaType === 'image' ? 'Image' : 'Video'}</span></span>
                  <span className="col-span-2 min-w-0 text-sm text-text-secondary lg:col-span-1">{formatProviderComparisonScenario(row)}</span>
                  <PriceTile label="Supplier list" amount={formatCost(row.supplierList.amountUsd)} tone="supplier" />
                  <PriceTile label="Customer total" amount={row.customerQuote ? formatUsdCents(row.customerQuote.totalCents) : 'Unavailable'} tone="customer" />
                  <span className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-brand bg-brand px-3 text-xs font-semibold text-white transition group-open:bg-brand-hover lg:col-span-1">View details<ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" /></span>
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
