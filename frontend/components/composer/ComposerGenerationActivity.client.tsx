'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { PendingGeneration } from '@/lib/pending-generations';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { generationActivityCopy } from './generation-activity-copy';

export function GenerationSpinner() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="app-generation-spinner">
    <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
    <path d="M10 3a7 7 0 0 1 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

export function ComposerGenerationActivity({ entries, submitting, children }: {
  entries: readonly PendingGeneration[];
  submitting: boolean;
  children: ReactNode;
}) {
  const { locale } = useI18n();
  const copy = generationActivityCopy(locale);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const count = entries.length;

  useEffect(() => {
    if (submitting) setOpen(false);
  }, [submitting]);

  useEffect(() => {
    if (!open) return;
    if (!count) {
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('.app-generation-action')?.focus({ preventScroll: true });
      return;
    }
    closeRef.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open, count]);

  return <div ref={rootRef} className={count ? 'app-generation-cluster' : 'contents'}>
    {children}
    <span className="sr-only" role="status" aria-live="polite">{count ? copy.count(count) : copy.empty}</span>
    {count > 0 ? <button
      type="button" ref={triggerRef} className="app-generation-count"
      aria-label={copy.open(count)} title={copy.count(count)}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}
    ><GenerationSpinner /><span>{count}</span></button> : null}
    {open && count > 0 ? <section id={id} role="dialog" aria-label={copy.title} aria-modal="false" className="app-generation-popover">
      <header><strong>{copy.count(count)}</strong><button type="button" ref={closeRef} aria-label={copy.close} onClick={() => {
        setOpen(false); triggerRef.current?.focus({ preventScroll: true });
      }}>×</button></header>
      <ol className="app-generation-list">{entries.map((entry, index) => <li key={entry.id} className="app-generation-row">
        <span className="app-generation-number" aria-hidden="true">{index + 1}</span>
        <div className="app-generation-info"><strong>{entry.engineLabel}</strong><span title={entry.prompt}>{entry.prompt}{entry.durationSec > 0 ? ` · ${entry.durationSec}s` : ''}</span></div>
        <GenerationSpinner />
      </li>)}</ol>
    </section> : null}
  </div>;
}
