'use client';

import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
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
      {field('marginPercent', 'Supplier cost markup (%)')}
      {field('marginFlatCents', 'Additional flat fee (cents)', '1')}
      <AdminActionButton type="button" variant="primary" disabled={locked} onClick={onPreview}>
        {busy ? 'Building preview…' : 'Preview policy change'}
      </AdminActionButton>
    </div>
    <p className="text-xs text-text-secondary">Markup applies to the supplier cost; gross margin is the share of the customer price. Rounding and minimums remain in the billing calculation. Preview all affected variants before confirming.</p>
    <details className="rounded-md border border-border bg-surface p-2 text-xs">
      <summary className="cursor-pointer font-semibold">Scope, extras and current source</summary>
      <p className="my-2 break-all font-mono">{draft.id} · {draft.mode || 'all modes'} · {draft.resolution || 'all tiers'} · {draft.compatibilityProfile}</p>
      <p className="mb-2 text-text-secondary">Current source: {row.effectiveProvenance?.sourceRuleId ?? 'versioned policy'}. This editor preserves the selected scope.</p>
      <div className="flex flex-wrap gap-3">{field('surchargeAudioPercent', 'Audio surcharge (%)')}{field('surchargeUpscalePercent', 'Upscale surcharge (%)')}</div>
    </details>
  </div>;
}
