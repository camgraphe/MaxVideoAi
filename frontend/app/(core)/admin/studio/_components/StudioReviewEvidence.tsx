import type { ReactNode } from 'react';
import { AdminSection } from '@/components/admin-system/shell/AdminSection';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import type { ReviewDetail, ReviewSource, ReviewUsage } from '@/server/admin-studio-review/contracts';

const value = (item: string | number | null) => item ?? 'Unknown';
const usdNano = (amount: string | null) => amount === null ? 'Unknown' : `$${BigInt(amount) / BigInt(1_000_000_000)}.${(BigInt(amount) % BigInt(1_000_000_000)).toString().padStart(9, '0')} USD`;
const usdCents = (amount: number | null) => amount === null ? 'Unknown' : `$${(amount / 100).toFixed(2)} USD`;
function Source<T>({ title, data, children }: { title: string; data: ReviewSource<T>; children: (items: T[]) => ReactNode }) {
  return <AdminSection title={title}>{data.status === 'unavailable' ? <AdminNotice tone="warning">This evidence source is unavailable. Absence of records has not been established.</AdminNotice> : !data.items.length ? <p className="text-sm text-text-secondary">No records were retained in this source for this turn.</p> : <>{children(data.items)}{data.truncated ? <p className="mt-3 text-sm text-warning">Only the first 20 records are shown. This view is truncated.</p> : null}</>}</AdminSection>;
}
function UsageRows({ rows }: { rows: ReviewUsage[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Model / state', 'Input', 'Cached input', 'Output', 'Reasoning token count', 'Latency (ms)'].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td className="border-t border-border p-2">{value(row.model)}<small className="block text-text-muted">{value(row.state)}</small></td>{[row.inputTokens, row.cachedTokens, row.outputTokens, row.reasoningTokens, row.elapsedMs].map((count, column) => <td className="border-t border-border p-2" key={column}>{value(count)}</td>)}</tr>)}</tbody></table></div>;
}
export function StudioReviewEvidence({ detail }: { detail: ReviewDetail }) {
  return <div className="space-y-5">
    <AdminNotice>Partial evidence · access {detail.accessId}. Full context, instruction/tool-schema versions and external-host dialogue are unavailable. Reasoning content is excluded; a token count is usage metadata.</AdminNotice>
    <AdminSection title="Submitted user text"><p className="whitespace-pre-wrap break-words text-sm">{detail.message ?? 'No submitted text retained.'}</p></AdminSection>
    <AdminSection title="Visible assistant reply"><p className="whitespace-pre-wrap break-words text-sm">{detail.reply ?? 'No final visible reply retained. The turn may be incomplete.'}</p></AdminSection>
    <Source title="Recorded actions" data={detail.actions}>{rows => <ol className="space-y-3 text-sm">{rows.map((row, index) => <li key={index} className="rounded border border-border p-3"><strong>{value(row.action)}</strong> · {value(row.state)}<p className="mt-1 text-text-secondary">Result: {row.ok === null ? 'Unknown' : row.ok ? 'Succeeded' : 'Failed'} · observed project revision: {value(row.observedRevision)} · model: {value(row.modelId)} · error code: {value(row.errorCode)}</p><small className="text-text-muted">{row.createdAt}</small></li>)}</ol>}</Source>
    <Source title="Conversation model usage" data={detail.responses}>{rows => <UsageRows rows={rows} />}</Source>
    <Source title="Legacy image director usage" data={detail.legacyUsage}>{rows => <UsageRows rows={rows} />}</Source>
    <Source title="Assistant cost and customer charges" data={detail.assistance}>{rows => <div className="space-y-4 text-sm">{rows.map((row, index) => <article key={index} className="rounded border border-border p-4"><p className="font-medium">{value(row.model)} · {value(row.mode)} · {value(row.state)}</p><dl className="mt-3 grid gap-3 sm:grid-cols-2">
      <div><dt className="text-text-muted">Provider cost estimate range</dt><dd>{usdNano(row.providerMinNanoUsd)} – {usdNano(row.providerMaxNanoUsd)}</dd></div>
      <div><dt className="text-text-muted">Settled customer charge</dt><dd>{row.state === 'settled' ? usdCents(row.chargedCents) : 'Unknown / not settled'}</dd></div>
      <div><dt className="text-text-muted">Reserved provider exposure</dt><dd>{usdNano(row.reservedNanoUsd)}</dd></div>
      <div><dt className="text-text-muted">Original customer reservation (not a settled charge)</dt><dd>{usdCents(row.reservedCents)}</dd></div>
      {typeof row.waivedCents === 'number' && <div><dt className="text-text-muted">Customer reservation released by support</dt><dd>{usdCents(row.waivedCents)} · Supplier usage remains separate.</dd></div>}
      <div><dt className="text-text-muted">Returned model</dt><dd>{value(row.returnedModel)}</dd></div>
      <div><dt className="text-text-muted">Policy / provider rates / tariff</dt><dd>{value(row.policyVersion)} / {value(row.rateVersion)} / {value(row.tariffVersion)}</dd></div>
    </dl></article>)}</div>}</Source>
  </div>;
}
