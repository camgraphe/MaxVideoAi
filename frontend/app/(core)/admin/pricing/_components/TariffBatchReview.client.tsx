'use client';
import type { TariffBatchOperation, TariffBatchPrice } from '@/server/pricing-admin/tariff-batches/contract';
const modelNames = { 'kling-v4': 'Kling 4', 'kling-v4-flash': 'Kling 4.0 Flash',
  'gpt-image-2-6-flare': 'GPT Image 2.6 Flare', 'gpt-image-2-6-sunburst': 'GPT Image 2.6 Sunburst' };
const money = (cents: number | null) => cents === null ? 'Unavailable' : `$${(cents / 100).toFixed(2)}`;
function literal(price: TariffBatchPrice | undefined) {
  if (!price) return '—';
  return price.kind === 'fixed' ? money(price.customerCents)
    : `${price.terms.map(term => `${term.centsPerUnit}¢ × ${term.unit.replaceAll('_', ' ')}`).join(' + ')}, total rounded up`;
}
export function TariffBatchReview({ operation }: { operation: TariffBatchOperation }) {
  const { plan, receipt } = operation;
  return <div className="min-w-0 space-y-3">
    <p className="font-semibold">{plan.counts.create} create · {plan.counts.update} update · {plan.counts.unchanged} unchanged · {plan.counts.conflict} conflict</p>
    <p className="text-sm text-text-secondary">{modelNames[plan.modelId]} · {plan.rows.length} of {plan.fullScopeCount} canonical classes · USD · revision {plan.revision}. {plan.reason}</p>
    {plan.rows.some(row => row.supplierCostIncomplete) && <p role="note" className="text-sm text-text-secondary">Supplier estimate covers image output only. Text and reference input costs remain unqualified. Commercial reserves do not guarantee a margin. Automatic size or quality uses a conservative output estimate; actual provider settings remain automatic. These customer tariffs do not enable generation.</p>}
    <p className="text-sm text-text-secondary">Each changed price receives its own server timestamp. The complete batch becomes visible together. Unchanged rows keep their IDs, dates and history.</p>
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Complete tariff batch review</caption>
        <thead className="sticky top-0 bg-surface"><tr>{['Class', 'Current example', 'Proposed example', 'Literal price', 'Decision'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{plan.rows.map(row => <tr key={row.key} data-batch-review-row className="border-t border-border">
          <td className="p-3">{row.selector.mode} · {row.selector.resolution} · {row.selector.quality ? `${row.selector.durationSec} image(s) · ${row.selector.quality}` : row.selector.durationSec === 'continuous' ? 'source duration' : `${row.selector.durationSec}s`}<br />{row.selector.quality ? `${row.selector.referenceImageCount ?? '0'} reference(s)` : row.selector.billingInputType === 'video_input' ? 'With video input' : 'Without video input'}</td>
          <td className="p-3">{row.currentCents === null && row.action === 'create' ? 'Missing' : money(row.currentCents)}</td><td className="p-3">{money(row.proposedCents)}<br /><span className="text-xs text-text-secondary">{row.rasterDomain?.conservativeOutput ? 'Conservative output-only LIST estimate' : row.supplierCostIncomplete ? 'Output-only LIST estimate' : 'Supplier LIST'}: {money(row.supplierListCents)}</span></td>
          <td className="p-3"><p>Before: {row.previousCell ? JSON.stringify(row.previousCell.price) : row.action === 'create' ? 'Missing' : 'Unavailable'}</p><p>After: {literal(row.proposedCell?.price as TariffBatchPrice | undefined)}</p>{row.domain && <p className="text-xs text-text-secondary">All valid source durations through {row.domain.maxInputSeconds}s checked.</p>}{row.rasterDomain && <p className="text-xs text-text-secondary">{row.rasterDomain.checkedDimensions} valid pixel sizes; 1–{row.rasterDomain.maxOutputCount} outputs and up to {row.rasterDomain.maxReferenceCount} references checked. Exact prices keep precedence.</p>}</td>
          <td className="p-3">{row.action}{row.issue && <p className="max-w-64 text-xs text-red-600">{row.issue}</p>}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="text-sm"><summary className="cursor-pointer">Complete before and after plan</summary>
      <p className="my-2 text-text-secondary">Includes exact selectors, original expressions, IDs, sources, versions and effective intervals. Proposed versions and dates are placeholders; commit assigns the actual server versions and timestamps.</p>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs" data-batch-plan>{JSON.stringify(plan, null, 2)}</pre>
    </details>
    {receipt && <p className="text-sm">{receipt.changes.length} prices committed. Revision {receipt.revisionBefore} → {receipt.revisionAfter}. {receipt.committedAt}</p>}
    <details className="text-sm"><summary className="cursor-pointer">Operation evidence</summary><p className="break-all">ID: {operation.id}<br />Fingerprint: {operation.fingerprint}<br />Preview expires: {operation.expiresAt}</p>
      {receipt && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(receipt, null, 2)}</pre>}</details>
  </div>;
}
