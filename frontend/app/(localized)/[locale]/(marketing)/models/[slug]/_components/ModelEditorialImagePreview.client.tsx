'use client';

import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAccessibleModal } from '@/components/ui/useAccessibleModal';
import { readerCopy } from '@/components/examples/example-reader-copy';
import { useI18n } from '@/lib/i18n/I18nProvider';
import type { Nano21EditorialImage } from '@/lib/nano21-editorial-images';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';

/** Public editorial image viewer; no app job lookup or authenticated library action. */
export function ModelEditorialImagePreview({image,onClose}:{image:Nano21EditorialImage;onClose:()=>void}){
  const {locale}=useI18n();
  const copy=readerCopy(locale);
  const closeLabel=locale==='fr'?'Fermer l’image':locale==='es'?'Cerrar imagen':'Close image viewer';
  const {dialogRef,onDialogKeyDown}=useAccessibleModal({onClose});
  return createPortal(<div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={image.title} tabIndex={-1} onKeyDown={onDialogKeyDown}
      className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-surface text-text-primary shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-hairline bg-surface p-4">
        <div><h2 className="text-lg font-semibold">{image.title}</h2><p className="text-xs text-text-secondary">Nano Banana 2.1 · 1K · 16:9 · MEDIUM</p></div>
        <button type="button" data-modal-initial-focus="true" aria-label={closeLabel} onClick={onClose} className="rounded-lg border border-hairline p-2"><X size={18}/></button>
      </header>
      {/* Exact original is deliberately requested only after opening the viewer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.original.url} alt={image.title} width={image.original.width} height={image.original.height}
        className="max-h-[68vh] w-full bg-black object-contain"/>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <a href={image.original.url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-hairline px-3 py-2 text-sm font-semibold">{copy.original}</a>
          <ModelDecisionCopyButton copyText={image.prompt} label={copy.copy} copiedLabel={copy.copied}/>
        </div>
        <details><summary className="cursor-pointer text-sm font-semibold">{copy.prompt}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{image.prompt}</p></details>
      </div>
    </section>
  </div>,document.body);
}
