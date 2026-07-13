'use client';

import { AdminFilterBar } from '@/components/admin-system/surfaces/AdminFilterBar';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import {
  formatPercentRatio,
  formatPricingSelector,
  formatUsdCents,
  pricingPolicyRowKey,
  type PricingCockpitFilters,
  type PricingPolicyInventoryRow,
} from '../_lib/pricing-cockpit-view-model';

type PricingPolicyTableProps = {
  rows: PricingPolicyInventoryRow[];
  filters: PricingCockpitFilters;
  onFiltersChange: (filters: PricingCockpitFilters) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  disabled: boolean;
};

export function PricingPolicyTable({
  rows,
  filters,
  onFiltersChange,
  selectedKey,
  onSelect,
  disabled,
}: PricingPolicyTableProps) {
  return (
    <div className="space-y-4">
      <AdminFilterBar onSubmit={(event) => event.preventDefault()} fieldsClassName="sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Search policy selectors</span>
          <input
            aria-label="Search policy selectors"
            value={filters.query}
            disabled={disabled}
            onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
            placeholder="Engine, mode, resolution or rule ID"
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="space-y-1 text-xs text-text-secondary">
          <span>Policy source</span>
          <select
            aria-label="Policy source"
            value={filters.source}
            disabled={disabled}
            onChange={(event) => onFiltersChange({ ...filters, source: event.target.value as PricingCockpitFilters['source'] })}
            className="min-h-[40px] w-full rounded-input border border-border bg-surface px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All sources</option>
            <option value="database">Database overrides</option>
            <option value="versioned">Versioned policy</option>
          </select>
        </label>
      </AdminFilterBar>

      <div data-testid="pricing-policy-inventory">
        <AdminDataTable tone="muted" tableClassName="min-w-[920px]">
          <thead className="bg-surface">
            <tr className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              <th className="px-4 py-3 font-semibold">Selector</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Margin</th>
              <th className="px-4 py-3 font-semibold">Flat</th>
              <th className="px-4 py-3 font-semibold">Profile</th>
              <th className="px-4 py-3 font-semibold">Representative total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = pricingPolicyRowKey(row);
              const rule = row.databaseOverride ?? row.versionedRule;
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  data-selected={selected ? 'true' : undefined}
                  aria-disabled={disabled}
                  className={`${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:bg-bg'} border-t border-hairline transition ${selected ? 'bg-info-bg' : ''}`}
                  onClick={() => { if (!disabled) onSelect(key); }}
                >
                  <td className="px-4 py-3">
                    <button type="button" disabled={disabled} className="text-left" onClick={() => onSelect(key)}>
                      <span className="block font-medium text-text-primary">{formatPricingSelector(row.selector)}</span>
                      <span className="mt-1 block font-mono text-[11px] text-text-muted">{rule?.id ?? 'No rule'}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {row.databaseOverride ? 'Database override' : 'Versioned policy'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{rule ? formatPercentRatio(rule.marginPercent) : '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{rule ? formatUsdCents(rule.marginFlatCents) : '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{rule?.compatibilityProfile ?? 'standard'}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {row.representativeQuotes[0] ? formatUsdCents(row.representativeQuotes[0].totalCents) : 'Unavailable'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminDataTable>
      </div>
    </div>
  );
}
