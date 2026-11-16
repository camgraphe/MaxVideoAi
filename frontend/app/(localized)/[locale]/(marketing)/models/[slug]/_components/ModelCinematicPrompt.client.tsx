'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';
import { resolveModalTabTarget } from '@/components/ui/useAccessibleModal';
import { ModelCinematicPromptPrice } from './ModelCinematicPromptPrice.client';

/** SSR content, opened in the native top layer without changing the image layout. */
export function ModelCinematicPrompt({ asset, ui, label = ui.prompt, children }: {
  asset: CinematicAsset; ui: CinematicPresentation['ui']; label?: string; children?: ReactNode;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  const close = () => dialog.current?.close();
  return <div className="cinema-prompt">
    <button type="button" className="cinema-prompt-trigger" aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      aria-label={`${label} — ${asset.title}`} onClick={() => { dialog.current?.showModal(); setOpen(true); }}>
      <span>{label}</span><span className="cinema-prompt-plus" aria-hidden="true"><CinematicPlus /></span>
    </button>
    <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} className="cinema-prompt-dialog" onClose={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')).filter(item => item.getClientRects().length > 0);
        const active = document.activeElement;
        const target = resolveModalTabTarget({ activeIndex: items.findIndex(item => item === active), focusableCount: items.length,
          shiftKey: event.shiftKey, activeInside: event.currentTarget.contains(active) });
        if (target === null) return;
        event.preventDefault();
        if (target >= 0) items[target].focus();
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}>
      <div className="cinema-prompt-dialog-shell">
        <header className="cinema-prompt-dialog-header"><p>{label}</p><button type="button" onClick={close} aria-label={ui.close}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button></header>
        <div className="cinema-prompt-dialog-body">
          <h2 id={`${id}-title`}>{asset.title}</h2>
          <ul className="cinema-prompt-settings" aria-label={ui.prompt}>{asset.metadataLabel.split(' · ').map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}<ModelCinematicPromptPrice asset={asset} ui={ui} open={open} /></ul>
          <p className="cinema-prompt-language">{ui.sourcePrompt}</p><p className="cinema-prompt-text" lang="en">{asset.prompt}</p>
          {children ? <div className="cinema-prompt-context">{children}</div> : null}
          <div className="cinema-prompt-originals">
            <a href={asset.original.url} target="_blank" rel="noopener noreferrer">{ui.original}<CinematicArrow direction="external" /></a>
            {asset.source ? <a href={asset.source.original.url} target="_blank" rel="noopener noreferrer">{ui.source}<CinematicArrow direction="external" /></a> : null}
          </div>
        </div>
        <footer className="cinema-prompt-dialog-footer">
          {asset.creation ? <a className="cinema-button" href={asset.creation.href} data-analytics-event="cta_click" data-analytics-cta-name="reuse_example" data-analytics-cta-location="model_prompt" data-analytics-target-family="workspace">{ui.reuse}<CinematicArrow disc /></a> : null}
          <ModelDecisionCopyButton copyText={asset.prompt} label={ui.copy} copiedLabel={ui.copied} analyticsLocation="model_prompt" />
          {asset.creation ? <a className="cinema-prompt-refine" href={asset.creation.refineHref} data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="model_prompt" data-analytics-target-family="workspace">{ui.refine}<CinematicArrow /></a> : null}
        </footer>
      </div>
    </dialog>
  </div>;
}
