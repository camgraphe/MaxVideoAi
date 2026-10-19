'use client';

import { createPortal } from 'react-dom';
import { useId } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { PublicVideoPlayer } from '@/components/media/PublicVideoPlayer.client';
import type { AppLocale } from '@/i18n/locales';
import type { ExamplePreviewPick } from '../_lib/best-for-detail-config';
import { EDITORIAL_COPY as C } from '../_lib/best-for-editorial-copy';

export default function BestForSceneDialog({ scene, name, locale, href, onClose }: {
  scene: NonNullable<ExamplePreviewPick['example']>; name: string; locale: AppLocale; href: string; onClose: () => void;
}) {
  const id = useId();
  const { dialogRef, onDialogKeyDown } = useAccessibleModal({ onClose });
  const close = { en: 'Close video', fr: 'Fermer la vidéo', es: 'Cerrar el vídeo' }[locale];
  return createPortal(<div className="bf-video-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="bf-video-dialog" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} onKeyDown={onDialogKeyDown}>
      <header><div><h2 id={id}>{scene.title}</h2><p>{name}</p></div>
        <button type="button" data-modal-initial-focus="true" aria-label={close} onClick={onClose}><X size={22} aria-hidden /></button>
      </header>
      <div className="bf-video-reader"><PublicVideoPlayer src={scene.videoUrl} poster={scene.poster} title={scene.title} locale={locale} className="bf-video-full" /></div>
      <a href={href}>{C.prompt[locale]}<ArrowUpRight size={16} aria-hidden /></a>
    </section>
  </div>, document.body);
}
