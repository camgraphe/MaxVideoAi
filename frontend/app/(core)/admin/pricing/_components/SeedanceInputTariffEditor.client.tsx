'use client';

import { useState } from 'react';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { CustomerTariffEditor } from '../_hooks/useCustomerTariffEditor';
import { decisionUsd } from '../_lib/pricing-decision';

export function SeedanceInputTariffEditor({ editor, disabled, inputSeconds, outputSeconds }: {
  editor: CustomerTariffEditor; disabled: boolean; inputSeconds: number; outputSeconds: number;
}) {
  const tariff = editor.exact?.continuousInputTariff;
  // Retain full authored precision: rounding this rate can add a cent at the minimum.
  const [rate, setRate] = useState(String((tariff?.inputCentsPerSecond ?? 0) / 100));
  const minimum = tariff?.seedanceMinimum;
  if (!tariff || !minimum || !editor.exact) return null;
  const centsPerSecond = rate.trim() ? Number(rate) * 100 : NaN;
  const valid = Number.isFinite(centsPerSecond) && centsPerSecond > 0;
  const billableSeconds = Math.max(minimum.minimumBillableSeconds, outputSeconds + inputSeconds);
  const total = valid ? Math.ceil(centsPerSecond * billableSeconds - 1e-9) / 100 : null;
  const locked = disabled || editor.busy || editor.loading || !editor.editable;
  const seconds = (value: number) => Number(value.toFixed(6));
  return <div className="mt-2 space-y-2" aria-label="Proportional Seedance pricing">
    <label className="block text-[10px] text-text-secondary">Customer · USD / billable second
      <input aria-label="Customer price per billable second (USD)" type="number" min="0" step="any"
        value={rate} disabled={locked} onInput={event => { setRate(event.currentTarget.value); editor.cancelPreview(); }}
        className="mt-1 h-8 w-full rounded-md border border-[#cbb9ff] bg-surface px-2 text-sm tabular-nums text-text-primary" />
    </label>
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-md border border-hairline bg-surface p-2">
        <p className="text-[10px] text-text-secondary">Minimum · {seconds(minimum.minimumBillableSeconds)} billable seconds</p>
        <strong>{valid ? decisionUsd(Math.ceil(centsPerSecond * minimum.minimumBillableSeconds - 1e-9) / 100) : '—'}</strong>
      </div>
      <div className="rounded-md border border-[#cbb9ff] bg-surface p-2">
        <p className="text-[10px] text-text-secondary">{seconds(billableSeconds)} billable seconds · proposed total</p>
        <strong className="tabular-nums">{decisionUsd(total)}</strong>
      </div>
    </div>
    <p className="text-[10px] text-text-secondary">{outputSeconds} s output + {inputSeconds} s source. The minimum includes up to {seconds(minimum.includedInputSeconds)} s of source; longer sources use the same rate. Gross margin stays proportional to supplier cost, with the final total rounded up to the cent.</p>
    <AdminActionButton type="button" variant="primary" size="sm" disabled={locked || !valid}
      onClick={() => void editor.requestPreview(undefined, { operation: tariff.prepared ? 'update' : 'create',
        scenarioId: editor.exact!.scenarioId, scope: 'continuous_input',
        price: { kind: 'seedance_billable', customerCentsPerBillableSecond: centsPerSecond } })}>
      Preview proportional price
    </AdminActionButton>
  </div>;
}
