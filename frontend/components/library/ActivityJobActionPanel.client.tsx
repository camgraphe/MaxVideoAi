'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useId, type Ref } from 'react';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';

/** Pending/failed jobs have actions, but no proven original to reuse or download. */
export function ActivityJobActionPanel({ menuRef, onClose, onOpen, openLabel, recreateHref, recreateLabel, onRemove }: {
  menuRef: Ref<HTMLDivElement>; onClose: () => void; onOpen: () => void; openLabel: string;
  recreateHref?: string; recreateLabel: string; onRemove?: () => void;
}) {
  const { locale } = useI18n();
  const title = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const labels = locale.startsWith('fr') ? ['Actions', 'Fermer', 'Retirer de l’historique'] : locale.startsWith('es') ? ['Acciones', 'Cerrar', 'Quitar del historial'] : ['Actions', 'Close', 'Remove from history'];
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="app-experience"><div ref={menuRef} className="app-media-panel-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title} tabIndex={-1} onKeyDown={onDialogKeyDown} className="app-media-panel app-scroll-surface">
      <header><h2 id={title}>{labels[0]}</h2><button type="button" data-modal-initial-focus="true" onClick={onClose}>{labels[1]}</button></header>
      <div className="app-media-panel-actions">
        <button type="button" onClick={onOpen}>{openLabel}</button>
        {recreateHref ? <Link href={recreateHref} onClick={onClose}>{recreateLabel}</Link> : null}
        {onRemove ? <button type="button" onClick={onRemove}>{labels[2]}</button> : null}
      </div>
    </section>
  </div></div>, document.body);
}
