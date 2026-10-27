'use client';
import type { TariffBatchOperation, TariffBatchPrice } from '@/server/pricing-admin/tariff-batches/contract';
const money = (cents: number | null) => cents === null ? 'Unavailable' : `$${(cents / 100).toFixed(2)}`;
function literal(price: TariffBatchPrice | undefined) {
  if (!price) return '—';
  return price.kind === 'fixed' ? money(price.customerCents) : `${price.terms[0].centsPerUnit}¢ × billable seconds, rounded up`;
}
export function TariffBatchReview({ operation }: { operation: TariffBatchOperation }) {
  const { plan, receipt } = operation;
  return <div className="min-w-0 space-y-3">
    <p className="font-semibold">{plan.counts.create} create · {plan.counts.update} update · {plan.counts.unchanged} unchanged · {plan.counts.conflict} conflict</p>
    <p className="text-sm text-text-secondary">Kling 4 · {plan.rows.length} of {plan.fullScopeCount} canonical classes · USD · revision {plan.revision}. {plan.reason}</p>
    <p className="text-sm text-text-secondary">Each changed price receives its own server timestamp. The complete batch becomes visible together. Unchanged rows keep their IDs, dates and history.</p>
    <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-[850px] text-left text-sm"><caption className="sr-only">Complete tariff batch review</caption>
        <thead className="sticky top-0 bg-surface"><tr>{['Class', 'Current example', 'Proposed example', 'Literal price', 'Decision'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{plan.rows.map(row => <tr key={row.key} data-batch-review-row className="border-t border-border">
          <td className="p-3">{row.selector.mode} · {row.selector.resolution} · {row.selector.durationSec === 'continuous' ? 'source duration' : `${row.selector.durationSec}s`}<br />{row.selector.billingInputType === 'video_input' ? 'With video input' : 'Without video input'}</td>
          <td className="p-3">{row.currentCents === null && row.action === 'create' ? 'Missing' : money(row.currentCents)}</td><td className="p-3">{money(row.proposedCents)}<br /><span className="text-xs text-text-secondary">Supplier LIST: {money(row.supplierListCents)}</span></td>
          <td className="p-3"><p>Before: {row.previousCell ? JSON.stringify(row.previousCell.price) : row.action === 'create' ? 'Missing' : 'Unavailable'}</p><p>After: {literal(row.proposedCell?.price as TariffBatchPrice | undefined)}</p>{row.domain && <p className="text-xs text-text-secondary">All valid source durations through {row.domain.maxInputSeconds}s checked.</p>}</td>
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
