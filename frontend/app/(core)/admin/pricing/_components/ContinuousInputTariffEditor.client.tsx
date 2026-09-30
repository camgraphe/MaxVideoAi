'use client';

import { useState } from 'react';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import type { CustomerTariffEditor } from '../_hooks/useCustomerTariffEditor';
import { decisionUsd } from '../_lib/pricing-decision';

export function ContinuousInputTariffEditor({ editor, disabled, inputSeconds, outputSeconds }: {
  editor: CustomerTariffEditor; disabled: boolean; inputSeconds: number; outputSeconds: number;
}) {
  const tariff = editor.exact?.continuousInputTariff;
  const [output, setOutput] = useState(String(Number(((tariff?.outputCents ?? 0) / 100 / outputSeconds).toFixed(9))));
  const [source, setSource] = useState(String(Number(((tariff?.inputCentsPerSecond ?? 0) / 100).toFixed(9))));
  if (!tariff || !editor.exact) return null;
  const audio = tariff.kind === 'audio';
  const locked = disabled || editor.busy || editor.loading || !editor.editable;
  const outputCents = audio ? 0 : output.trim() ? Math.round(Number(output) * outputSeconds * 100) : NaN;
  const inputCentsPerSecond = source.trim() ? Number(source) * 100 : NaN;
  const valid = Number.isSafeInteger(outputCents) && outputCents >= 0 && Number.isFinite(inputCentsPerSecond) && inputCentsPerSecond >= 0;
  const preview = (price: { kind: 'preserve_current' } | { kind: 'linear_input'; outputCents: number; inputCentsPerSecond: number }) =>
    void editor.requestPreview(undefined, { operation: tariff.prepared ? 'update' : 'create', scenarioId: editor.exact!.scenarioId,
      scope: 'continuous_input', price });
  const inputClass = 'mt-1 h-8 w-full rounded-md border border-[#cbb9ff] bg-surface px-2 text-sm tabular-nums text-text-primary';
  return <div className="mt-2" aria-label="Continuous source pricing">
    <div className={`grid ${audio ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
      {!audio ? <label className="text-[10px] text-text-secondary">Output video · USD/s<input aria-label="Output video price per second (USD)" type="number" min="0" step="any" value={output} disabled={locked}
        onInput={event => { setOutput(event.currentTarget.value); editor.cancelPreview(); }} className={inputClass} /></label> : null}
      <label className="text-[10px] text-text-secondary">Source {audio ? 'audio' : 'video'} · USD/s<input aria-label={`Source ${audio ? 'audio' : 'video'} price per second (USD)`} type="number" min="0" step="any" value={source} disabled={locked}
        onInput={event => { setSource(event.currentTarget.value); editor.cancelPreview(); }} className={inputClass} /></label>
    </div>
    <div className="mt-2 rounded-md border border-[#cbb9ff] bg-surface p-2 text-xs">
      <p className="text-[10px] text-text-muted">Draft total · {audio ? `${inputSeconds} s audio` : `${outputSeconds} s output + ${inputSeconds} s source`}</p>
      <strong className="tabular-nums">{decisionUsd(valid ? Math.round(outputCents + inputCentsPerSecond * inputSeconds) / 100 : null)}</strong>
      <p className="mt-1 text-[10px] text-text-secondary">{audio ? 'Audio seconds × audio rate.' : 'Output price + source seconds × source rate.'} Applies to source durations {tariff.minInputSeconds != null ? `from ${tariff.minInputSeconds}` : 'above 0'} and up to {tariff.maxInputSeconds} s for these options.</p>
    </div>
    <p className="mt-2 text-[10px] text-text-secondary">Preserve keeps the current rounding. Unit prices replace it with the displayed formula; review any cent differences before confirming.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <AdminActionButton type="button" size="sm" disabled={locked} onClick={() => preview({ kind: 'preserve_current' })}>Preserve current prices</AdminActionButton>
      <AdminActionButton type="button" variant="primary" size="sm" disabled={locked || !valid}
        onClick={() => preview({ kind: 'linear_input', outputCents, inputCentsPerSecond })}>Preview unit prices</AdminActionButton>
    </div>
    {tariff.prepared ? <p className="mt-2 text-[10px] text-amber-900">Source-rate tariff {editor.inventory?.active ? '· live' : '· prepared, not activated'}</p> : null}
  </div>;
}
