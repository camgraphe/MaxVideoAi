'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { resolveModalTabTarget } from '@/components/ui/useAccessibleModal';
import type { CinematicAsset, CinematicPresentation } from '../_lib/model-page-cinematic-data';
import { ModelDecisionCopyButton } from './ModelDecisionCopyButton.client';
import { CinematicArrow, CinematicPlus } from './ModelCinematicMarks';

/** A video direction is distinct from the prompt that generated its concept image. */
export function ModelCinematicVideoPrompt({ title, prompt, note, imageDetailsLabel, ui, asset, triggerLabel, details, creation, compactTrigger = false }: {
  title: string; prompt: string; note: string; imageDetailsLabel: string;
  ui: CinematicPresentation['ui']; asset?: CinematicAsset;
  triggerLabel?: string; details?: ReactNode; creation?: { href: string; refineHref: string };
  compactTrigger?: boolean;
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
  return <div className={`cinema-prompt cinema-video-prompt${triggerLabel ? ' cinema-video-prompt--button' : ''}${compactTrigger ? ' cinema-video-prompt--overlay' : ''}`}>
    <button type="button" className="cinema-prompt-trigger" aria-label={`${ui.videoPrompt} — ${title}`} aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      onClick={() => { dialog.current?.showModal(); setOpen(true); }}><span>{triggerLabel ?? ui.prompt}</span><span className="cinema-prompt-plus" aria-hidden="true"><CinematicPlus /></span></button>
    <dialog ref={dialog} id={id} className="cinema-prompt-dialog" aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary')).filter(item => item.getClientRects().length > 0);
        const active = document.activeElement;
        const target = resolveModalTabTarget({ activeIndex: items.findIndex(item => item === active), focusableCount: items.length, shiftKey: event.shiftKey, activeInside: event.currentTarget.contains(active) });
        if (target === null) return;
        event.preventDefault();
        if (target >= 0) items[target].focus();
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
      }}>
      <div className="cinema-prompt-dialog-shell">
        <header className="cinema-prompt-dialog-header"><p>{ui.videoPrompt}</p><button type="button" aria-label={ui.close} onClick={() => dialog.current?.close()}><X size={20} strokeWidth={1.75} aria-hidden="true" /></button></header>
        <div className="cinema-prompt-dialog-body">
          <h2 id={`${id}-title`}>{title}</h2><p className="cinema-video-prompt-note">{note}</p>{details}<p lang="en" className="cinema-prompt-text">{prompt}</p>
          {asset ? <details className="cinema-disclosure cinema-video-source"><summary>{imageDetailsLabel}<CinematicPlus /></summary><div>
            <p>{asset.metadataLabel}</p><p className="cinema-prompt-language">{ui.sourcePrompt}</p><p lang="en">{asset.prompt}</p>
            <a href={asset.original.url} target="_blank" rel="noopener noreferrer">{ui.original}<CinematicArrow direction="external" /></a>
          </div></details> : null}
        </div>
        <footer className="cinema-prompt-dialog-footer">
          {creation ? <a className="cinema-button" href={creation.href} data-analytics-event="cta_click" data-analytics-cta-name="reuse_example" data-analytics-cta-location="model_prompt" data-analytics-target-family="workspace">{ui.reuse}<CinematicArrow disc /></a> : null}
          <ModelDecisionCopyButton copyText={prompt} label={ui.copyVideo} copiedLabel={ui.copied} analyticsLocation="model_prompt_guide" />
          {creation ? <a className="cinema-prompt-refine" href={creation.refineHref} data-analytics-event="cta_click" data-analytics-cta-name="milo_try" data-analytics-cta-location="model_prompt" data-analytics-target-family="workspace">{ui.refine}<CinematicArrow /></a> : null}
        </footer>
      </div>
    </dialog>
  </div>;
}
