'use client';

import { ChevronDown, ImageIcon, Search, Video } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AdminEmptyState } from '@/components/admin-system/feedback/AdminEmptyState';
import {
  filterProviderComparisonRows,
  formatProviderComparisonScenario,
  formatUsdCents,
  summarizeProviderDraftFinalPairs,
  type ProviderComparisonFilters,
  type ProviderCostComparisonRowView,
} from '../_lib/pricing-cockpit-view-model';

import { decisionBasisLabel, decisionPercent, decisionUsd, pricingDecisionMetrics } from '../_lib/pricing-decision';
import { PricingDecisionPanel } from './PricingDecisionPanel.client';

type Props = {
  rows: ProviderCostComparisonRowView[];
  disabled: boolean;
  onInspect: (row: ProviderCostComparisonRowView) => void;
  onSaved?: () => void | Promise<void>;
};

const BRAND_LABELS: Record<string, string> = { bytedance: 'ByteDance' };
const MODEL_LABELS: Record<string, string> = {
  'seedance-2-0-mini': 'Seedance 2.0 Mini', 'seedance-2-0-fast': 'Seedance 2.0 Fast',
  'seedance-2-0': 'Seedance 2.0', 'seedance-2-5': 'Seedance 2.5',
  seedream: 'Seedream 5.0 Lite', 'seedream-5-0-pro': 'Seedream 5.0 Pro',
};
const FEATURED_MODEL_ORDER = ['seedance-2-0-mini', 'seedance-2-0-fast', 'seedance-2-0', 'seedance-2-5', 'seedream', 'seedream-5-0-pro'];
const PROVIDER_LABELS: Record<string, string> = { byteplus_modelark: 'BytePlus ModelArk', fal: 'Fal' };

function displayName(id: string, overrides: Record<string, string>): string {
  return overrides[id] ?? id.split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
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

function PriceTile({ label, amount, caption, tone }: {
  label: string; amount: string; caption: string; tone: 'supplier' | 'customer';
}) {
  return <span className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-2 ${tone === 'supplier' ? 'border-info-border bg-info-bg' : 'border-[#cbb9ff] bg-[#f1ebff]'}`}>
    <span className={`text-[10px] font-semibold ${tone === 'supplier' ? 'text-info' : 'text-[#5937b8]'}`}>{label}</span>
    <span className="mt-0.5 break-words text-base font-bold leading-tight tabular-nums text-text-primary">{amount}</span>
    <span className="mt-0.5 text-[10px] tabular-nums text-text-secondary">{caption}</span>
  </span>;
}

function ComparisonRow({ row, disabled, onInspect, onSaved }: { row: ProviderCostComparisonRowView } & Omit<Props, 'rows'>) {
  const [open, setOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ProviderCostComparisonRowView | null>(null);
  const displayedRow = selectedRow ?? row;
  const metrics = pricingDecisionMetrics(displayedRow);
  const suffix = metrics.unit === 'second' ? '/s' : '/image';
  const estimated = metrics.costBasis !== 'contract';
  const loss = metrics.grossTotalUsd != null && metrics.grossTotalUsd < 0;
  const uncertain = metrics.costBasis === 'other_provider' || metrics.costBasis === 'unknown' || metrics.marginPercent == null;
  return <details onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }} className="group overflow-hidden rounded-xl border border-border bg-surface open:border-brand/40">
    <summary className="grid cursor-pointer list-none grid-cols-3 items-center gap-2 p-3 transition hover:bg-bg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden min-[900px]:grid-cols-[minmax(150px,1.5fr)_minmax(100px,.9fr)_minmax(100px,.9fr)_minmax(100px,.9fr)_76px]">
      <span className="col-span-3 min-w-0 min-[900px]:col-span-1">
        <span className="block text-sm font-bold text-text-primary">{displayName(row.engineId, MODEL_LABELS)}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-text-secondary">{formatProviderComparisonScenario(displayedRow)}</span>
        <span className={`mt-0.5 block text-[10px] ${uncertain ? 'text-amber-800' : 'text-text-muted'}`}>{decisionBasisLabel(metrics.costBasis)}{displayedRow.routeConfigured === false ? ' · generation disabled' : ''}</span>
      </span>
      <PriceTile label={`Supplier ${suffix}`} amount={decisionUsd(metrics.supplierUnitUsd)} caption={`${decisionUsd(metrics.supplierTotalUsd)} total`} tone="supplier" />
      <PriceTile label={`Customer ${suffix}`} amount={decisionUsd(metrics.customerUnitUsd)} caption={`${decisionUsd(metrics.customerTotalUsd)} total`} tone="customer" />
      <span className={`flex min-w-0 flex-col rounded-lg border px-2.5 py-2 ${loss ? 'border-red-200 bg-red-50 text-red-800' : uncertain ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
        <span className="text-[10px] font-semibold">{estimated ? 'Est. gross margin' : 'Gross margin'}</span>
        <span className="mt-0.5 text-base font-bold leading-tight tabular-nums">{decisionPercent(metrics.marginPercent)}</span>
        <span className="mt-0.5 break-words text-[10px] tabular-nums">{decisionUsd(metrics.grossUnitUsd)}{metrics.grossUnitUsd == null ? '' : suffix}</span>
      </span>
      <span className="col-span-3 inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-2 text-xs font-semibold text-brand group-open:bg-brand group-open:text-white min-[900px]:col-span-1">Details<ChevronDown className="h-3 w-3 transition group-open:rotate-180" aria-hidden="true" /></span>
    </summary>
    <PricingDecisionPanel row={row} disabled={disabled} onInspect={onInspect} enabled={open} onScenarioRow={setSelectedRow} onSaved={onSaved} />
  </details>;
}

export function ProviderPriceComparisonTable({ rows, disabled, onInspect, onSaved }: Props) {
  const [filters, setFilters] = useState<ProviderComparisonFilters>({ brandId: 'all', executionProvider: 'all', mediaType: 'all', query: '' });
  const visible = useMemo(() => filterProviderComparisonRows(rows, filters), [rows, filters]);
  const groups = useMemo(() => groupByFamily(visible), [visible]);
  const pairs = useMemo(() => summarizeProviderDraftFinalPairs(visible), [visible]);
  const brands = [...new Set(rows.map((row) => row.familyId ?? row.brandId))].sort();
  const providers = [...new Set(rows.map((row) => row.executionProvider))].sort();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-3">
        <h3 className="text-sm font-semibold text-text-primary">Filters</h3>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Model family">
          {[{ id: 'all', label: 'All families' }, ...brands.map((id) => ({ id, label: displayName(id, BRAND_LABELS) }))].map((brand) => (
            <button key={brand.id} type="button" disabled={disabled} aria-pressed={filters.brandId === brand.id}
              onClick={() => setFilters({ ...filters, brandId: brand.id })}
              className={`min-h-8 rounded-md border px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.brandId === brand.id ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-border bg-bg text-text-secondary hover:border-brand/40 hover:text-text-primary'}`}>
              {brand.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 border-t border-hairline pt-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          <div className="inline-flex w-fit rounded-lg border border-border bg-bg p-1" role="group" aria-label="Media type">
            {([['all', 'All'], ['video', 'Video'], ['image', 'Image']] as const).map(([value, label]) => (
              <button key={value} type="button" disabled={disabled} aria-pressed={filters.mediaType === value}
                onClick={() => setFilters({ ...filters, mediaType: value })}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${filters.mediaType === value ? 'bg-surface text-brand shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}>
                {value === 'video' ? <Video className="h-4 w-4" aria-hidden="true" /> : value === 'image' ? <ImageIcon className="h-4 w-4" aria-hidden="true" /> : null}{label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
            <label className="relative w-full sm:max-w-sm">
              <span className="sr-only">Search models or scenarios</span>
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" aria-hidden="true" />
              <input aria-label="Search models or scenarios" value={filters.query} disabled={disabled}
                onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Search models or scenarios"
                className="min-h-9 w-full rounded-lg border border-border bg-bg py-1.5 pl-8 pr-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
            </label>
            <label className="sr-only" htmlFor="pricing-execution-provider">Execution provider</label>
            <select id="pricing-execution-provider" aria-label="Execution provider" value={filters.executionProvider} disabled={disabled}
              onChange={(event) => setFilters({ ...filters, executionProvider: event.target.value })}
              className="min-h-9 rounded-lg border border-border bg-bg px-2.5 text-xs text-text-primary sm:w-[170px]">
              <option value="all">All providers</option>
              {providers.map((provider) => <option key={provider} value={provider}>{PROVIDER_LABELS[provider] ?? provider}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-text-secondary" aria-label="Price color key">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-info-border bg-info-bg" aria-hidden="true" />Supplier cost</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-[#cbb9ff] bg-[#f1ebff]" aria-hidden="true" />Customer price</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-emerald-200 bg-emerald-50" aria-hidden="true" />Gross margin · before fees</span>
        <span className="text-text-muted">USD / second for video · / image for images · scenario totals below</span>
      </div>

      {groups.length ? groups.map(([familyId, entries]) => (
        <section key={familyId} aria-label={`${displayName(familyId, BRAND_LABELS)} price comparison`} className="space-y-2">
          <div className="flex items-baseline justify-between gap-3"><h3 className="text-lg font-semibold text-text-primary">{displayName(familyId, BRAND_LABELS)}</h3><span className="text-xs text-text-muted">{entries.length} {entries.length === 1 ? 'scenario' : 'scenarios'}</span></div>
          <div className="grid gap-2">
            {entries.map((row) => <ComparisonRow key={row.scenarioId} row={row} disabled={disabled} onInspect={onInspect} onSaved={onSaved} />)}
          </div>
        </section>
      )) : <AdminEmptyState>No comparison scenarios match these filters.</AdminEmptyState>}

      {pairs.length ? <details className="rounded-xl border border-border bg-surface p-4 text-xs text-text-secondary">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">Draft → final combined totals</summary>
        <div className="mt-3 space-y-1">{pairs.map((pair) => <p key={pair.workflowPairId}>
          {pair.workflowPairId}: customer {pair.customerTotalCents == null ? 'unavailable' : formatUsdCents(pair.customerTotalCents)}; supplier list {decisionUsd(pair.supplierListUsd)}. Two separately paid steps.
        </p>)}</div>
      </details> : null}
    </div>
  );
}
