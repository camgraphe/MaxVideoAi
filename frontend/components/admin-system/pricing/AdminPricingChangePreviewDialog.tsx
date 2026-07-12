'use client';

import type { PricingChangePreview } from '@/lib/admin/pricing-change-contract';
import { Button } from '@/components/ui/Button';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { AdminDataTable } from '@/components/admin-system/surfaces/AdminDataTable';
import { AdminNotice } from '@/components/admin-system/feedback/AdminNotice';

type AdminPricingChangePreviewDialogProps = {
  preview: PricingChangePreview;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  error?: string | null;
};

function formatCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatProvenance(value: PricingChangePreview['rows'][number]['currentProvenance']) {
  return `${value.source}:${value.sourceRuleId} · ${value.matchedBy} · ${value.compatibilityProfile}`;
}

export function AdminPricingChangePreviewDialog({
  preview,
  onConfirm,
  onCancel,
  busy,
  error,
}: AdminPricingChangePreviewDialogProps) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLElement>({ onClose: onCancel, closeDisabled: busy });
  const titleId = `pricing-preview-${preview.previewFingerprint.slice(0, 12)}`;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-surface-on-media-dark-60 px-3 py-4 backdrop-blur-sm">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-hairline bg-bg shadow-2xl"
      >
        <header className="border-b border-hairline bg-surface px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">Canonical server preview</p>
          <h2 id={titleId} className="mt-1 text-xl font-semibold text-text-primary">
            {preview.operation} · {preview.targetId}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            Surfaces: {preview.affectedSurfaces.join(', ') || 'none'} · {preview.rows.length} changed scenarios
          </p>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-5">
          {error ? <AdminNotice tone="error">{error}</AdminNotice> : null}
          {preview.warnings.map((warning) => <AdminNotice key={warning} tone="warning">{warning}</AdminNotice>)}
          <AdminDataTable tone="muted" tableClassName="min-w-[980px]">
            <thead className="bg-surface">
              <tr className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                <th className="px-4 py-3 font-semibold">Scenario / surface</th>
                <th className="px-4 py-3 font-semibold">Current</th>
                <th className="px-4 py-3 font-semibold">Proposed</th>
                <th className="px-4 py-3 font-semibold">Delta</th>
                <th className="px-4 py-3 font-semibold">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => (
                <tr key={row.scenarioId} className="border-t border-hairline align-top">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-text-primary">{row.scenarioId}</span>
                    <span className="mt-1 block text-xs text-text-muted">{row.surface} · {row.engineId}</span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatCents(row.currentTotalCents)}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{formatCents(row.proposedTotalCents)}</td>
                  <td className={`px-4 py-3 font-medium ${row.deltaCents > 0 ? 'text-warning' : 'text-success'}`}>
                    {row.deltaCents > 0 ? '+' : ''}{formatCents(row.deltaCents)}
                    <span className="mt-1 block text-xs text-text-muted">
                      {row.deltaPercent == null ? 'No percent baseline' : `${(row.deltaPercent * 100).toFixed(2)}%`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    <span className="block">Current: {formatProvenance(row.currentProvenance)}</span>
                    <span className="mt-1 block">Proposed: {formatProvenance(row.proposedProvenance)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminDataTable>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-hairline bg-surface px-5 py-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy} data-modal-initial-focus="true">
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy ? 'Applying…' : 'Confirm and apply now'}
          </Button>
        </footer>
      </section>
    </div>
  );
}
