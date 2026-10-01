import { ExternalLink } from 'lucide-react';
import type { ProviderCostComparisonRowView } from '../_lib/pricing-cockpit-view-model';

const REASONS: Record<string, string> = {
  supplier_rate_unverified_for_route: 'No supplier rate is recorded for this execution route.',
  billable_tokens_unavailable: 'The billable video tokens cannot be determined from these inputs.',
  image_usage_unavailable: 'Exact output dimensions or the number of input images are missing.',
  unsupported_model_options: 'No supplier rate is recorded for these model options.',
};
const PROVIDERS: Record<string, string> = {
  fal: 'Fal', byteplus_modelark: 'BytePlus ModelArk', google_vertex_image: 'Google Vertex',
  google_vertex_veo_direct: 'Google Vertex Veo', google_vertex_omni_direct: 'Google Vertex Omni',
  alibaba_model_studio: 'Alibaba Model Studio', luma_agents_direct: 'Luma Agents', kling_direct: 'Kling direct', minimax: 'MiniMax',
};
const UNITS = { second: 'second', image: 'image', '1000_tokens': '1,000 tokens', task: 'task' };

export function supplierAmount(usd: number | null): string {
  return usd == null ? 'Unavailable' : new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 9,
  }).format(usd);
}

export function supplierEvidenceLabel(list: ProviderCostComparisonRowView['supplierList']): string {
  return list.status === 'catalog_reference_estimate' ? 'Catalogue reference'
    : list.status === 'unavailable' ? 'Data missing' : 'Published LIST estimate';
}

export function SupplierContractDetails({ row }: { row: ProviderCostComparisonRowView }) {
  const contract = row.supplierEffective.contract;
  if (!contract) return null;
  const validThrough = new Date(Date.parse(contract.endsAt) - 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });
  return <div className="mt-1 space-y-1 rounded-md border border-info-border bg-info-bg p-2">
    <p className="font-semibold text-info">{contract.discountPercent}% off LIST · {contract.id}</p>
    <p>Valid {contract.startsAt.slice(0, 10)} → {validThrough} · Johor · USD before tax and credits</p>
    {contract.unitPriceUsdPer1kTokens != null ? <p>Contract rate: <strong>{supplierAmount(contract.unitPriceUsdPer1kTokens)} / 1,000 tokens</strong></p> : null}
    <details><summary className="cursor-pointer font-semibold text-info">Contract source and billing units</summary>
      <div className="mt-1 space-y-1"><a href={contract.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-info">Open BytePlus contract <ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
        {contract.billingUnits.map(unit => <p key={unit} className="break-all font-mono text-[10px]">{unit}</p>)}</div>
    </details>
  </div>;
}

/** Formats server evidence only; neither supplier nor customer prices are calculated in this view. */
export function SupplierPriceDetails({ row, showSettlement = true }: { row: ProviderCostComparisonRowView; showSettlement?: boolean }) {
  const list = row.supplierList;
  const reference = list.status === 'catalog_reference_estimate';
  return <div className="space-y-3 text-xs text-text-secondary">
    <span className={`inline-block rounded-full border px-2 py-1 font-semibold ${reference ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-info-border bg-info-bg text-info'}`}>
      {supplierEvidenceLabel(list)}
    </span>
    <p>Execution route: <strong>{PROVIDERS[row.executionProvider] ?? row.executionProvider}</strong>{row.routeConfigured === false ? ' · disabled in this environment' : ''}</p>
    {list.status === 'unavailable' ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">{REASONS[list.reason ?? ''] ?? 'Supplier data is unavailable for this scenario.'}</p> : <>
      {reference ? <p>Catalogue rate · current supplier tariff not yet verified.</p> : <p>Estimate for the selected options.</p>}
      {list.routeMatches === false ? <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-amber-900">Reference provider: {PROVIDERS[list.referenceProvider ?? ''] ?? list.referenceProvider}. This is not a confirmed rate for the execution route.</p> : null}
      <details className="rounded-lg border border-info-border bg-surface/70 p-3"><summary className="cursor-pointer font-semibold text-info">Rates and source</summary><div className="mt-3 space-y-3">
      {list.rateBreakdown?.length ? <div className="space-y-2 rounded-lg border border-info-border bg-surface/70 p-3">{list.rateBreakdown.map((line, index) => <div key={`${line.label}:${index}`}>
        <div className="flex justify-between gap-2"><span>{line.label}</span><strong className="text-text-primary">{supplierAmount(line.amountUsd)}</strong></div>
        <p className="mt-0.5 text-text-muted">{Number(line.quantity.toFixed(6)).toLocaleString('en-US')} × {supplierAmount(line.unitPriceUsd)} / {UNITS[line.unit]}</p>
      </div>)}</div> : null}
      <div className="space-y-1 border-t border-info-border pt-2">
        {list.sourceLabel ? <p className="break-words">{list.sourceLabel}</p> : null}
        {list.sourceUrl ? <a href={list.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-info-border bg-surface px-2 py-1.5 font-semibold text-info">Open supplier source <ExternalLink className="h-3 w-3" aria-hidden="true" /></a> : <p>Public source link not recorded.</p>}
        {list.checkedAt ? <p>Supplier tariff checked: {list.checkedAt.slice(0, 10)}</p> : <p>Supplier tariff not yet rechecked.</p>}
        {list.versionedAt ? <p>Catalogue model version: {list.versionedAt.slice(0, 10)} · not a tariff verification date</p> : null}
      </div>
      </div></details>
    </>}
    {row.publicPromotion ? <p className="rounded-lg border border-info-border p-2">Public promotion: <strong>{supplierAmount(row.publicPromotion.amountUsd)}</strong> until {row.publicPromotion.endsAt.slice(0, 10)}. Account eligibility unconfirmed.</p> : null}
    {showSettlement ? <div className="grid gap-2 border-t border-info-border pt-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface p-2"><p>Account contract</p><strong className="text-text-primary">{row.supplierEffective.amountUsd == null ? 'Not confirmed' : supplierAmount(row.supplierEffective.amountUsd)}</strong><SupplierContractDetails row={row} /></div>
      <div className="rounded-lg border border-border bg-surface p-2"><p>Observed invoice</p><strong className="text-text-primary">{row.supplierObserved.amountUsd == null ? 'No invoice evidence' : supplierAmount(row.supplierObserved.amountUsd)}</strong></div>
    </div> : null}
  </div>;
}
