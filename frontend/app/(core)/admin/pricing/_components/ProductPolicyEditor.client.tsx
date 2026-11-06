'use client';

import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { RECAST_PRICING_SELECTOR } from '@/lib/character-recast-pricing';
import type { PricingPolicyDraft, PricingPolicyInventoryRow } from '../_lib/pricing-cockpit-view-model';

type Props = {
  row: PricingPolicyInventoryRow;
  draft: PricingPolicyDraft;
  locked: boolean;
  busy: boolean;
  onChange: (field: keyof PricingPolicyDraft, value: string) => void;
  onPreview: () => void;
  onClose: () => void;
};

export function ProductPolicyEditor({ row, draft, locked, busy, onChange, onPreview, onClose }: Props) {
  const recast = draft.engineId === RECAST_PRICING_SELECTOR.engineId;
  const field = (key: keyof PricingPolicyDraft, label: string, step = '0.01') => <label className="space-y-1 text-xs">
    <span className="block">{label}</span>
    <input aria-label={label} type="number" min={0} step={step} value={draft[key]} disabled={locked}
      onChange={(event) => onChange(key, event.target.value)} className="w-36 rounded-md border border-border bg-surface px-3 py-2 text-sm" />
  </label>;
  return <div className="space-y-3 rounded-lg border border-[#cbb9ff] bg-[#f1ebff] p-3" aria-label="Product policy editor">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-sm">{draft.engineId} · {draft.mode || 'all modes'} · {draft.currency}</strong>
      <button type="button" disabled={locked} onClick={onClose} className="text-xs underline">Close editor</button>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      {recast ? <label className="space-y-1 text-xs"><span className="block">Supplier cost coefficient (×)</span>
        <input aria-label="Supplier cost coefficient (×)" type="number" min={1} max={10} step="0.01" disabled={locked}
          value={draft.marginPercent === '' ? '' : Number(draft.marginPercent) / 100 + 1}
          onChange={event => onChange('marginPercent', event.target.value === '' ? '' : String(Number(((Number(event.target.value) - 1) * 100).toFixed(8))))}
          className="w-36 rounded-md border border-border bg-surface px-3 py-2 text-sm" /></label>
        : <>{field('marginPercent', 'Supplier cost markup (%)')}{field('marginFlatCents', 'Additional flat fee (cents)', '1')}</>}
      <AdminActionButton type="button" variant="primary" disabled={locked} onClick={onPreview}>
        {busy ? 'Building preview…' : 'Preview policy change'}
      </AdminActionButton>
    </div>
    <p className="text-xs text-text-secondary">{recast
      ? 'Customer price uses provider cost × coefficient, with canonical cent rounding. ×2 corresponds to 100% markup and approximately 50% gross margin. Source and output seconds both contribute when a source video is used. This policy applies only to Recast.'
      : 'Markup applies to the supplier cost; gross margin is the share of the customer price. Rounding and minimums remain in the billing calculation. Preview all affected variants before confirming.'}</p>
    <details className="rounded-md border border-border bg-surface p-2 text-xs">
      <summary className="cursor-pointer font-semibold">Scope, extras and current source</summary>
      <p className="my-2 break-all font-mono">{draft.id} · {draft.mode || 'all modes'} · {draft.resolution || 'all tiers'} · {draft.compatibilityProfile}</p>
      <p className="mb-2 text-text-secondary">Current source: {row.effectiveProvenance?.sourceRuleId ?? (recast ? 'Unavailable — configure a scoped rule' : 'versioned policy')}. This editor preserves the selected scope.</p>
      {recast ? <p>USD · standard billing · no flat fee or audio/upscale surcharge.</p>
        : <div className="flex flex-wrap gap-3">{field('surchargeAudioPercent', 'Audio surcharge (%)')}{field('surchargeUpscalePercent', 'Upscale surcharge (%)')}</div>}
    </details>
  </div>;
}
