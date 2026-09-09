'use client';

import { createPortal } from 'react-dom';
import { useId, type ReactNode, type Ref } from 'react';
import { X } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

/** Shared boundary for inspecting a result and choosing a reference. */
export function MediaDialog({ title, closeLabel, onClose, children, boundaryRef, navigation }: {
  title: string; closeLabel: string; onClose: () => void; children: ReactNode;
  boundaryRef?: Ref<HTMLDivElement>; navigation?: ReactNode;
}) {
  const id = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const content = (<div className="app-experience"><div ref={boundaryRef} className="app-media-panel-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onKeyDown={onDialogKeyDown} className="app-media-panel app-scroll-surface">
      <header><h2 id={id}>{title}</h2><button type="button" data-modal-initial-focus="true" aria-label={closeLabel} title={closeLabel} onClick={onClose}><X size={18} aria-hidden /></button></header>
      {navigation ? <div className="app-media-output-switcher">{navigation}</div> : null}
      {children}
    </section>
  </div></div>);
  return typeof document === 'undefined' ? content : createPortal(content, document.body);
}
