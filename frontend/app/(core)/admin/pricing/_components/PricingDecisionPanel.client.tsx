'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { ProviderCostComparisonRowView } from '../_lib/pricing-cockpit-view-model';
import { customerCentsForTargetMargin, decisionBasisLabel, decisionPercent, decisionUsd,
  pricingDecisionMetrics, simulateCustomerUnitPrice } from '../_lib/pricing-decision';
import { tariffEditorSelection } from '../_lib/tariff-editor-selection';
import { SupplierPriceDetails } from './SupplierPriceDetails';
import { useCustomerTariffEditor, type CustomerTariffEditor } from '../_hooks/useCustomerTariffEditor';
import { TariffVariantControls } from './TariffVariantControls';
import { InlineTariffReview } from './InlineTariffReview';
import { ContinuousInputTariffEditor } from './ContinuousInputTariffEditor.client';

type Props = {
  row: ProviderCostComparisonRowView;
  disabled: boolean;
  onInspect: (row: ProviderCostComparisonRowView) => void;
  enabled?: boolean;
  onScenarioRow?: (row: ProviderCostComparisonRowView) => void;
  onSaved?: () => void | Promise<void>;
};

export function PricingDecisionPanel({ row, disabled, onInspect, enabled = false, onScenarioRow, onSaved }: Props) {
  const selection = useMemo(() => tariffEditorSelection(row), [row]);
  const editor = useCustomerTariffEditor(selection, enabled, onSaved);
  const displayedRow = editor.displayed?.supplierComparison ?? row;
  useEffect(() => { onScenarioRow?.(displayedRow); }, [displayedRow, onScenarioRow]);
  return <div className="border-t border-hairline bg-bg/50 p-3">
    <TariffVariantControls editor={editor} disabled={disabled} />
    <PricingDecisionContent key={displayedRow.scenarioId} row={displayedRow} disabled={disabled}
      onInspect={onInspect} editor={editor} />
  </div>;
}

function PricingDecisionContent({ row, disabled, onInspect, editor }: Pick<Props, 'row' | 'disabled' | 'onInspect'> & { editor: CustomerTariffEditor }) {
  const current = pricingDecisionMetrics(row);
  const [price, setPrice] = useState(current.customerUnitUsd == null ? '' : String(current.customerUnitUsd));
  const [priceEdited, setPriceEdited] = useState(false);
  useEffect(() => {
    if (!priceEdited) setPrice(current.customerUnitUsd == null ? '' : String(current.customerUnitUsd));
  }, [current.customerUnitUsd, priceEdited]);
  const [fees, setFees] = useState('');
  const suffix = current.unit === 'second' ? '/s' : '/image';
  const extraCostPerUnit = current.quantity ? Number(fees || 0) / current.quantity : Number.NaN;
  const simulation = price.trim() ? simulateCustomerUnitPrice(row, Number(price), extraCostPerUnit, 100) : null;
  const locked = disabled || editor.busy || editor.loading;
  const canEdit = editor.editable && editor.exact?.scenarioId === row.scenarioId;
  const selectTarget = (percent: number) => {
    const cents = customerCentsForTargetMargin(row, percent, extraCostPerUnit);
    if (cents != null && current.quantity) { setPriceEdited(true); setPrice(String(Number((cents / 100 / current.quantity).toFixed(9)))); editor.cancelPreview(); }
  };
  return <div>
    <div className="grid gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(280px,.95fr)]">
      <section className="min-w-0 rounded-lg border border-border bg-surface p-3" aria-label="Current profitability">
        <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-xs font-bold text-text-primary">Current profitability</h4>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${current.costBasis === 'contract' ? 'border-info-border bg-info-bg text-info' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{decisionBasisLabel(current.costBasis)}</span></div>
        <table className="mt-2 w-full text-xs"><thead className="text-[10px] text-text-muted"><tr><th className="py-1 text-left font-medium">USD</th><th className="text-right font-medium">{suffix}</th><th className="text-right font-medium">Total · {current.quantity ?? '?'} {current.unit === 'second' ? 's' : 'images'}</th></tr></thead>
          <tbody className="divide-y divide-hairline">
            <tr><th className="py-1.5 text-left font-medium text-info">Supplier cost</th><td className="text-right tabular-nums">{decisionUsd(current.supplierUnitUsd)}</td><td className="text-right tabular-nums">{decisionUsd(current.supplierTotalUsd)}</td></tr>
            <tr><th className="py-1.5 text-left font-medium text-[#5937b8]">Customer price</th><td className="text-right tabular-nums">{decisionUsd(current.customerUnitUsd)}</td><td className="text-right tabular-nums">{decisionUsd(current.customerTotalUsd)}</td></tr>
            <tr><th className="py-1.5 text-left font-semibold">Gross difference</th><td className="text-right font-semibold tabular-nums">{decisionUsd(current.grossUnitUsd)}</td><td className="text-right font-semibold tabular-nums">{decisionUsd(current.grossTotalUsd)}</td></tr>
          </tbody></table>
        <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-hairline pt-2">
          <div><p className="text-[10px] text-text-muted">Margin on sales</p><p className="text-base font-bold tabular-nums">{decisionPercent(current.marginPercent)}</p></div>
          <div><p className="text-[10px] text-text-muted">Markup on cost</p><p className="text-base font-semibold tabular-nums">{decisionPercent(current.markupPercent)}</p></div>
          <div><p className="text-[10px] text-text-muted">Price / cost</p><p className="text-base font-semibold tabular-nums">{current.resaleMultiple == null ? 'Unavailable' : `×${current.resaleMultiple.toFixed(2)}`}</p></div>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-text-secondary">Margin = (price − cost) / price. Markup = (price − cost) / cost. Payment fees, retries and operating costs are excluded unless entered in the simulator.</p>
        {(row.inputVideoDurationSec ?? 0) > 0 ? <p className="mt-1 text-[10px] text-text-secondary">Totals include {row.inputVideoDurationSec} s of source video and {row.durationSec} s of output. The comparable /s rate divides that total by output seconds.</p> : null}
        {current.costBasis === 'other_provider' ? <p className="mt-1 text-[10px] text-amber-900">This cost belongs to another provider; it does not establish profitability on the execution route.</p> : null}
        <div className="mt-2 flex flex-wrap gap-2 border-t border-hairline pt-2">
          <AdminActionButton type="button" size="sm" disabled={disabled || !row.customerQuote} onClick={() => onInspect(row)}>Inspect policy</AdminActionButton>
        </div>
      </section>
      <section className="min-w-0 rounded-lg border border-[#cbb9ff] bg-[#f7f3ff] p-3" aria-label="Price simulator">
        <h4 className="text-xs font-bold text-[#5937b8]">Customer price · selected tariff</h4>
        {editor.exact?.continuousInputTariff ? <ContinuousInputTariffEditor
          key={JSON.stringify(editor.exact.continuousInputTariff.price)} editor={editor} disabled={disabled}
          inputSeconds={editor.exact.continuousInputTariff.kind === 'audio'
            ? Number(editor.exact.selector.inputAudioDurationSec) : row.inputVideoDurationSec ?? 0}
          outputSeconds={Number(editor.exact.selector.durationSec)} /> : <>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[10px] text-text-secondary">Customer price {suffix} · USD<input aria-label={`Proposed customer price / ${current.unit} (USD)`} type="number" min="0" step="any" value={price} disabled={locked}
            onChange={(event) => { setPriceEdited(true); setPrice(event.target.value); editor.cancelPreview(); }} className="mt-1 h-8 w-full rounded-md border border-[#cbb9ff] bg-surface px-2 text-sm tabular-nums text-text-primary" /></label>
          <label className="text-[10px] text-text-secondary">Extra cost / generation · USD<input aria-label="Extra cost per generation (USD)" type="number" min="0" step="0.01" value={fees} placeholder="Not entered" disabled={locked}
            onChange={(event) => { setFees(event.target.value); editor.cancelPreview(); }} className="mt-1 h-8 w-full rounded-md border border-border bg-surface px-2 text-sm tabular-nums text-text-primary" /></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Target margin presets"><span className="mr-1 text-[10px] text-text-secondary">Target margin</span>{[30, 50, 60].map((value) =>
          <button key={value} type="button" disabled={locked || customerCentsForTargetMargin(row, value, extraCostPerUnit) == null} onClick={() => selectTarget(value)}
            className="min-h-7 rounded-md border border-[#cbb9ff] bg-surface px-2 text-xs font-semibold text-[#5937b8] disabled:opacity-40">{value}%</button>)}
          <button type="button" disabled={locked || current.customerUnitUsd == null} onClick={() => { setPriceEdited(false); setPrice(String(current.customerUnitUsd)); editor.cancelPreview(); }} className="min-h-7 rounded-md border border-border bg-surface px-2 text-xs">Current</button></div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-md border border-[#cbb9ff] bg-surface p-2 text-xs" aria-live="polite">
          <div><p className="text-[10px] text-text-muted">Rounded scenario price</p><strong className="tabular-nums">{decisionUsd(simulation?.metrics.customerTotalUsd ?? null)}</strong><span className="ml-1 text-[10px] text-text-muted">{decisionUsd(simulation?.metrics.customerUnitUsd ?? null)}{suffix}</span></div>
          <div><p className="text-[10px] text-text-muted">Margin after entered costs</p><strong className={`tabular-nums ${simulation?.contributionTotalUsd != null && simulation.contributionTotalUsd < 0 ? 'text-red-700' : 'text-text-primary'}`}>{decisionPercent(simulation?.contributionPercent ?? null)}</strong></div>
          <div><p className="text-[10px] text-text-muted">Break-even price {suffix}</p><strong className="tabular-nums">{decisionUsd(simulation?.breakEvenUnitUsd ?? null)}</strong></div>
          <div><p className="text-[10px] text-text-muted">Difference for 100 generations</p><strong className="tabular-nums">{decisionUsd(simulation?.volumeContributionUsd ?? null)}</strong></div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><AdminActionButton type="button" variant="primary" size="sm" disabled={locked || !canEdit || !simulation}
          onClick={() => { if (simulation) void editor.requestPreview(simulation.customerCents); }}>Preview price change</AdminActionButton>
          <span className="text-[10px] text-text-secondary">{editor.loading ? 'Loading tariff…' : editor.inventory?.active ? 'Preview → confirm to apply.' : 'Preview → confirm a prepared price.'}</span></div>
        </>}
        <InlineTariffReview editor={editor} disabled={disabled} />
      </section>
    </div>
    <details className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs"><summary className="cursor-pointer font-semibold text-text-secondary">Supplier data, sources and quote history</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><div><h5 className="mb-2 font-semibold">Supplier list</h5><SupplierPriceDetails row={row} showSettlement={false} /></div>
        <dl className="space-y-2 break-words text-[11px] text-text-secondary">
          <div><dt className="font-semibold">Customer total · current policy</dt><dd>{row.customerQuote ? `${row.customerQuote.ruleId} · ${row.customerQuote.source} · ${row.customerQuote.pricingMode}` : 'Customer quote unavailable'}</dd></div>
          <div><dt className="font-semibold">Observed invoice</dt><dd>{row.supplierObserved.amountUsd == null ? 'Observed unavailable' : decisionUsd(row.supplierObserved.amountUsd)}{row.supplierObserved.source ? ` · ${row.supplierObserved.source}` : ''}{row.supplierObserved.observedAt ? ` · Observed ${row.supplierObserved.observedAt.slice(0, 10)}` : ''}</dd></div>
          <div><dt className="font-semibold">Contract price</dt><dd>{row.supplierEffective.amountUsd == null ? 'Contract unconfirmed' : decisionUsd(row.supplierEffective.amountUsd)}{row.supplierEffective.source ? ` · ${row.supplierEffective.source}` : ''}{row.supplierEffective.confirmedAt ? ` · Confirmed ${row.supplierEffective.confirmedAt.slice(0, 10)}` : ''}</dd></div>
          <div><dt className="font-semibold">Exact scenario</dt><dd className="break-all font-mono text-[10px]">{row.scenarioId}</dd></div>
        </dl></div>
    </details>
  </div>;
}
