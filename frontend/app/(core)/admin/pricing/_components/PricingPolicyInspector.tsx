'use client';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import type {
  PricingPolicyDraft,
  PricingPolicyInventoryRow,
} from '../_lib/pricing-cockpit-view-model';

type PricingPolicyInspectorProps = {
  row: PricingPolicyInventoryRow;
  draft: PricingPolicyDraft;
  busy: boolean;
  onChange: (field: keyof PricingPolicyDraft, value: string) => void;
  onPreview: () => void;
  onPreviewDelete: () => void;
};

const EDITABLE_FIELDS: Array<{
  field: keyof PricingPolicyDraft;
  label: string;
  type?: 'text' | 'number';
  step?: string;
}> = [
  { field: 'engineId', label: 'Engine', type: 'text' },
  { field: 'mode', label: 'Mode', type: 'text' },
  { field: 'resolution', label: 'Resolution', type: 'text' },
  { field: 'marginPercent', label: 'Margin (%)', type: 'number', step: '0.01' },
  { field: 'marginFlatCents', label: 'Flat margin (cents)', type: 'number', step: '1' },
  { field: 'surchargeAudioPercent', label: 'Audio surcharge (%)', type: 'number', step: '0.01' },
  { field: 'surchargeUpscalePercent', label: 'Upscale surcharge (%)', type: 'number', step: '0.01' },
  { field: 'currency', label: 'Currency', type: 'text' },
  { field: 'compatibilityProfile', label: 'Compatibility profile', type: 'text' },
];

export function PricingPolicyInspector({
  row,
  draft,
  busy,
  onChange,
  onPreview,
  onPreviewDelete,
}: PricingPolicyInspectorProps) {
  const vendorAccount = row.routingContext?.vendorAccountId ?? 'No routing override';
  const canDelete = Boolean(row.databaseOverride && row.databaseOverride.id !== 'default');

  return (
    <AdminInspectorPanel
      title="Policy inspector"
      description="Edit canonical policy inputs. The server computes every quote and impact preview."
    >
      <div className="space-y-4">
        <label className="block space-y-1 text-xs text-text-secondary">
          <span>Rule ID</span>
          <input
            value={draft.id}
            readOnly={Boolean(row.databaseOverride)}
            onChange={(event) => onChange('id', event.target.value)}
            className="min-h-[40px] w-full rounded-input border border-border bg-bg px-3 font-mono text-sm text-text-primary read-only:text-text-muted focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {EDITABLE_FIELDS.map(({ field, label, type = 'text', step }) => (
            <label key={field} className="block space-y-1 text-xs text-text-secondary">
              <span>{label}</span>
              <input
                name={field}
                aria-label={label}
                type={type}
                min={type === 'number' ? 0 : undefined}
                step={step}
                value={draft[field]}
                onChange={(event) => onChange(field, event.target.value)}
                className="min-h-[40px] w-full rounded-input border border-border bg-bg px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          ))}
        </div>

        <AdminNotice>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Vendor account</span>
          <span className="mt-1 block break-all font-mono text-xs">{vendorAccount}</span>
          <span className="mt-2 block text-xs">Routing context is read-only and is never sent by this editor.</span>
        </AdminNotice>

        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" variant="primary" onClick={onPreview} disabled={busy}>
            {busy ? 'Building preview…' : 'Preview policy change'}
          </AdminActionButton>
          {canDelete ? (
            <AdminActionButton type="button" onClick={onPreviewDelete} disabled={busy || Boolean(row.routingContext?.vendorAccountId)}>
              Preview override deletion
            </AdminActionButton>
          ) : null}
        </div>
      </div>
    </AdminInspectorPanel>
  );
}
