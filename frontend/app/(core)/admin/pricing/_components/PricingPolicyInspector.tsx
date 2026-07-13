'use client';

import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';
import { AdminActionButton } from '@/components/admin-system/shell/AdminActionLink';
import { AdminInspectorPanel } from '@/components/admin-system/shell/AdminInspectorPanel';
import type {
  PricingPolicyDraft,
  PricingPolicyInventoryRow,
} from '../_lib/pricing-cockpit-view-model';
import { formatAdminTimestamp, formatUsdCents } from '../_lib/pricing-cockpit-view-model';

type PricingPolicyInspectorProps = {
  row: PricingPolicyInventoryRow;
  draft: PricingPolicyDraft;
  busy: boolean;
  locked: boolean;
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
  locked,
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
            disabled={locked}
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
                disabled={locked}
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

        <div className="space-y-3 rounded-xl border border-hairline bg-surface p-4 text-xs text-text-secondary">
          <h3 className="text-sm font-semibold text-text-primary">Effective policy context</h3>
          <dl className="grid gap-2">
            <div>
              <dt className="font-medium text-text-muted">Matched versioned rule</dt>
              <dd className="font-mono">{row.versionedRule?.id ?? 'No matched versioned rule'}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-muted">Database override</dt>
              <dd className="font-mono">{row.databaseOverride?.id ?? 'No database override — versioned policy is effective'}</dd>
            </div>
            <div>
              <dt className="font-medium text-text-muted">Effective provenance</dt>
              <dd>
                {row.effectiveProvenance
                  ? `${row.effectiveProvenance?.source} · ${row.effectiveProvenance?.matchedBy} · ${row.effectiveProvenance?.sourceRuleId}`
                  : 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-text-muted">Last mutation</dt>
              <dd>
                {row.lastEvent
                  ? `${row.lastEvent?.actorId} · ${formatAdminTimestamp(row.lastEvent?.createdAt)}`
                  : 'No mutation event recorded'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-3 rounded-xl border border-hairline bg-surface p-4">
          <h3 className="text-sm font-semibold text-text-primary">Representative canonical projections</h3>
          {row.representativeQuotes.length ? (
            <ul className="space-y-3">
              {row.representativeQuotes.map((quote) => (
                <li key={quote.scenarioId} className="rounded-lg border border-hairline bg-bg p-3 text-xs text-text-secondary">
                  <span className="block font-medium text-text-primary">{quote.surface}</span>
                  <span className="mt-1 block break-all font-mono text-[11px] text-text-muted">{quote.scenarioId}</span>
                  <span className="mt-2 block">Supplier subtotal: {formatUsdCents(quote.vendorSubtotalCents)}</span>
                  <span className="block">Billing/public total: {formatUsdCents(quote.totalCents)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-text-muted">Representative projections are unavailable for this selector.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <AdminActionButton type="button" variant="primary" onClick={onPreview} disabled={locked}>
            {busy ? 'Building preview…' : 'Preview policy change'}
          </AdminActionButton>
          {canDelete ? (
            <AdminActionButton type="button" onClick={onPreviewDelete} disabled={locked || Boolean(row.routingContext?.vendorAccountId)}>
              Preview override deletion
            </AdminActionButton>
          ) : null}
        </div>
      </div>
    </AdminInspectorPanel>
  );
}
