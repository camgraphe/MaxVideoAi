'use client';

import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

/** Mounted only while open; unmount releases focus and body lock before Library opens. */
export function WorkspaceReferencePopup({ title, closeLabel, onClose, children, singleRole }: {
  title: string; singleRole?: boolean; closeLabel: string; onClose: () => void; children: ReactNode;
}) {
  const titleId = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  return createPortal(<div className="app-experience app-reference-modal-layer" onClick={(event) => {
    if (event.target === event.currentTarget) onClose();
  }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      data-single-role={singleRole || undefined} className="app-reference-popup app-workspace-references" onKeyDown={onDialogKeyDown}>
      <div className="app-reference-heading"><h2 id={titleId}>{title}</h2>
        <button type="button" data-modal-initial-focus="true" onClick={onClose}>{closeLabel}</button>
      </div>
      <div className="app-reference-inventory">{children}</div>
    </div>
  </div>, document.body);
}
