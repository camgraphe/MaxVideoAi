'use client';

import type { ReactNode } from 'react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

export function PlacementExplorerDialog({ open, slot, onClose, children }: {
  open: boolean;
  slot: number | null;
  onClose: () => void;
  children: ReactNode;
}) {
  const { dialogRef, onDialogKeyDown } = useAccessibleModal<HTMLElement>({ onClose });
  if (!open) return null;
  return <div data-explorer-overlay className="fixed inset-0 z-50 flex justify-end bg-black/40">
    <button type="button" aria-label="Close explorer backdrop" className="absolute inset-0 cursor-default" onClick={onClose} />
    <aside ref={dialogRef} onKeyDown={onDialogKeyDown} tabIndex={-1} role="dialog" aria-modal="true"
      aria-label={slot === null ? 'Add videos' : `Choose opening slot ${slot + 1}`}
      className="relative z-10 h-full w-full overflow-y-auto bg-surface p-3 shadow-2xl outline-none sm:max-w-[min(680px,78vw)] sm:p-5 xl:max-w-[720px]">
      <header className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Gallery media</p>
          <h2 className="text-lg font-semibold text-text-primary">{slot === null ? 'Add videos' : `Opening slot ${slot + 1}`}</h2></div>
        <button type="button" data-modal-initial-focus="true" onClick={onClose}
          className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-primary hover:bg-surface-2">Close explorer</button>
      </header>
      {children}
    </aside>
  </div>;
}
