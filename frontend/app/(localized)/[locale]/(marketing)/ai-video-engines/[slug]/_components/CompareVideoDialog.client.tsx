'use client';

import { createPortal } from 'react-dom';
import { useId } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { AppLocale } from '@/i18n/locales';
import type { CompareGalleryVideo } from '../_lib/compare-gallery-data';

export default function CompareVideoDialog({ item, name, locale, href, onClose }: {
  item: CompareGalleryVideo; name: string; locale: AppLocale; href: string; onClose: () => void;
}) {
  const id = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const copy = locale === 'fr' ? { close: 'Fermer la vidéo', details: 'Voir le prompt et les réglages' }
    : locale === 'es' ? { close: 'Cerrar el video', details: 'Ver el prompt y los ajustes' }
    : { close: 'Close video', details: 'View prompt and settings' };
  return createPortal(<div className="compare-video-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="compare-video-dialog" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onKeyDown={onDialogKeyDown}>
      <header><h2 id={id}>{name}<span>{item.duration > 0 ? `${item.duration} s · ` : ''}{item.aspectRatio}</span></h2>
        <button type="button" data-modal-initial-focus="true" aria-label={copy.close} onClick={onClose}><X size={22} aria-hidden="true" /></button></header>
      <div className="compare-video-reader"><PublicVideoPlayer src={item.video} poster={item.poster} title={name} locale={locale} className="compare-video-full" /></div>
      <a href={href}>{copy.details}<ArrowUpRight size={16} aria-hidden="true" /></a>
    </section>
  </div>, document.body);
}
