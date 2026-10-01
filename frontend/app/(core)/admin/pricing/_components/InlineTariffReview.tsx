import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { CustomerTariffEditor } from '../_hooks/useCustomerTariffEditor';
import { decisionUsd } from '../_lib/pricing-decision';
import { formatProviderComparisonScenario } from '../_lib/pricing-cockpit-view-model';

export function InlineTariffReview({ editor, disabled }: { editor: CustomerTariffEditor; disabled: boolean }) {
  const locked = disabled || editor.busy || !editor.editable;
  const scope = editor.exact?.continuousInputTariff ? { scope: 'continuous_input' as const } : {};
  const prepared = editor.exact?.continuousInputTariff?.prepared ?? (editor.exact?.stagedCents != null);
  return <>
    {editor.error ? <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{editor.error}</p> : null}
    {editor.notice ? <p role="status" className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">{editor.notice}</p> : null}
    {editor.preview ? <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs" aria-label="Review this exact price">
      <p className="font-bold text-text-primary">Review this exact price</p>
      <p className="mt-1">{decisionUsd(editor.preview.currentCents / 100)} → <strong>{editor.preview.proposedCents == null ? 'Remove prepared price' : decisionUsd(editor.preview.proposedCents / 100)}</strong></p>
      <p className="mt-1 text-[10px] text-text-secondary">{editor.displayed ? formatProviderComparisonScenario(editor.displayed.supplierComparison) : ''}</p>
      {editor.preview.warnings.map(warning => <p key={warning} className="mt-1 text-[10px] text-amber-900">{warning}</p>)}
      {editor.preview.continuousInputRange ? <p className="mt-1 text-[10px] text-text-secondary">{editor.preview.continuousInputRange.unbounded
        ? `All supported integer ${editor.preview.continuousInputRange.quantityUnit === 'reference_tokens' ? 'reference token budgets' : 'billed output seconds'} verified without an artificial cap`
        : `All source durations up to ${editor.preview.continuousInputRange.maxInputSeconds} s verified`} · minimum difference against cost reference: {decisionUsd(editor.preview.continuousInputRange.minimumGrossCents / 100)}.</p> : null}
      <div className="mt-2 flex gap-2"><AdminActionButton type="button" variant="primary" size="sm" disabled={locked} onClick={() => void editor.confirm()}>Confirm</AdminActionButton>
        <AdminActionButton type="button" size="sm" disabled={editor.busy} onClick={editor.cancelPreview}>Cancel</AdminActionButton></div>
    </div> : null}
    {!editor.exact?.continuousInputTariff && editor.exact?.stagedCents != null ? <p className="mt-2 text-[10px] text-amber-900">Prepared value: {decisionUsd(editor.exact.stagedCents / 100)}{editor.inventory?.active ? ' · live' : ' · not activated'}</p> : null}
    {editor.exact ? <details className="mt-2 border-t border-[#cbb9ff] pt-2 text-[10px] text-text-secondary"><summary className="cursor-pointer font-semibold">Prepared price & history</summary>
      {!editor.inventory?.active && prepared ? <div className="mt-2"><AdminActionButton type="button" size="sm" disabled={locked} onClick={() => void editor.requestPreview(undefined, { operation: 'delete', scenarioId: editor.exact!.scenarioId, ...scope })}>Remove prepared price</AdminActionButton></div> : null}
      {editor.historyError ? <p className="mt-2 text-amber-900">Tariff history unavailable.</p> : !editor.history?.length ? <p className="mt-2">No tariff change recorded.</p> : <div className="mt-2 space-y-1">{editor.history.slice(0, 5).map(event => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2">
        <span>{event.operation} · {new Date(event.createdAt).toLocaleString()}</span><AdminActionButton type="button" size="sm" disabled={locked} onClick={() => void editor.requestPreview(undefined, { operation: 'rollback', scenarioId: editor.exact!.scenarioId, eventId: event.id, ...scope })}>Preview rollback</AdminActionButton>
      </div>)}</div>}
    </details> : null}
  </>;
}
