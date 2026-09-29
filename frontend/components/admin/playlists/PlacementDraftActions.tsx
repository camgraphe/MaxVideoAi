'use client';

import { Button } from '@/components/ui/Button';
import type { CurationDraft, CurationPreview } from '@/lib/admin/playlist-curation';

export function PlacementDraftActions({ dirty, busy, preview, openingError, mode, canPreview, needsAdoption,
  onModeChange, onCancel, onPreview, onSave, onReload }: {
  dirty: boolean;
  busy: boolean;
  preview: CurationPreview | null;
  openingError: string | null;
  mode: CurationDraft['mode'];
  canPreview: boolean;
  needsAdoption?: boolean;
  onModeChange: (mode: CurationDraft['mode']) => void;
  onCancel: () => void;
  onPreview: () => void;
  onSave: () => void;
  onReload?: () => void;
}) {
  const status = openingError ? 'Opening needs attention' : preview ? 'Preview ready' : dirty ? 'Unsaved changes' : needsAdoption ? 'Ready to preview' : 'Saved';
  return <div data-draft-actions className="sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur-sm">
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <span data-draft-status className={`rounded-full px-2.5 py-1 text-xs font-semibold ${openingError ? 'bg-amber-100 text-amber-900' : preview ? 'bg-brand/10 text-brand' : dirty ? 'bg-amber-50 text-amber-900' : 'bg-surface-2 text-text-secondary'}`}>{status}</span>
      <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">Page order
        <select aria-label="Page order" value={mode} disabled={busy} onChange={event => onModeChange(event.target.value as CurationDraft['mode'])}
          className="max-w-[230px] rounded-lg border border-border bg-surface px-2 py-2 text-xs text-text-primary">
          <option value="manual">unselected videos hidden</option>
          <option value="hybrid">eligible new videos appended automatically</option>
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-2">
      {onReload ? <Button size="sm" variant="ghost" disabled={busy} onClick={onReload}>Reload</Button> : null}
      <Button size="sm" variant="outline" disabled={busy || !dirty} onClick={onCancel}>Cancel</Button>
      <Button size="sm" variant="outline" disabled={busy || Boolean(openingError) || !canPreview} onClick={onPreview}>Preview changes</Button>
      <Button size="sm" disabled={busy || !preview} onClick={onSave}>Save changes</Button>
    </div>
  </div>;
}
