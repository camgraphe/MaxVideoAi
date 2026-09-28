'use client';

import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import type { CurationPreview } from '@/lib/admin/playlist-curation';

export function PlacementPreviewDialog({ preview, onClose, onSave }: {
  preview: CurationPreview;
  onClose: () => void;
  onSave?: () => void;
}) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLElement>({ onClose });
  const effective = preview.effective;
  const firstPageIds = effective?.firstPageIds ?? preview.items.slice(0, 24).map(item => item.id);
  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
    <button type="button" className="absolute inset-0" aria-label="Close preview backdrop" onClick={onClose} />
    <section ref={dialogRef} onKeyDown={onDialogKeyDown} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Page preview"
      className="relative z-10 flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-surface shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-2xl">
      <header className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Before publishing the selection</p>
          <h3 className="mt-1 text-xl font-semibold text-text-primary">Page preview · {effective?.total ?? preview.items.length} videos</h3></div>
        <button type="button" data-modal-initial-focus="true" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-surface-2">Close preview</button>
      </header>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
        {effective ? <>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <div><span className="block text-xs text-text-secondary">Current page</span><strong className="text-2xl tabular-nums">{effective.currentTotal}</strong></div>
            <div><span className="block text-xs text-text-secondary">After saving</span><strong className="text-2xl tabular-nums">{effective.total}</strong></div>
            <p className="col-span-2 text-xs text-text-secondary">Currently {effective.currentTotal} videos → after saving {effective.total} videos. {effective.addedCount} added · {effective.removedCount} removed.</p>
          </div>
          {effective.removedCount > 0 ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">{effective.removedCount} removed from the effective page. Review the first page below.</p> : null}
          {effective.warnings.map(warning => <p key={warning} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>)}
          {effective.suppressedSourceSlugs.length ? <p className="mt-3 text-xs text-text-secondary">Suppressed inherited sources: {effective.suppressedSourceSlugs.join(', ')}</p> : null}
          {effective.openingFormats.length ? <p className="mt-1 text-xs text-text-secondary">Opening formats: {effective.openingFormats.map(format => format ?? 'Unknown').join(' · ')}</p> : null}
        </> : null}
        <h4 className="mb-2 mt-5 text-sm font-semibold">First page · up to 24 videos</h4>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {firstPageIds.map((id, index) => <li key={id} className="flex min-w-0 gap-2 rounded-lg bg-surface-2 px-3 py-2">
            <span className="shrink-0 text-xs font-semibold tabular-nums text-text-muted">{index + 1}.</span>
            {' '}
            <span className="truncate">{preview.items.find(item => item.id === id)?.prompt || id}</span>
          </li>)}
        </ol>
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface p-4">
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2">Continue editing</button>
        {onSave ? <button type="button" onClick={onSave} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">Save this selection</button> : null}
      </footer>
    </section>
  </div>;
}
