'use client';

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/Button';

const COPY = {
  en: { clear: 'Clear', undo: 'Undo clearing' },
  fr: { clear: 'Effacer', undo: 'Annuler l’effacement' },
  es: { clear: 'Borrar', undo: 'Deshacer borrado' },
};

export function ComposerPromptClear({ prompt, onPromptChange, inputId, locale }: {
  prompt: string;
  onPromptChange: (value: string) => void;
  inputId: string;
  locale: string;
}) {
  const [clearedPrompt, setClearedPrompt] = useState<string | null>(null);
  const copy = COPY[locale === 'fr' || locale === 'es' ? locale : 'en'];
  // Keep only the most recent explicit clear, in memory. Any replacement retires it.
  // Retire it before committing new text, including rapid type-then-delete edits.
  if (prompt.length && clearedPrompt !== null) setClearedPrompt(null);
  const canUndo = !prompt.length && clearedPrompt !== null;
  const activate = () => {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLTextAreaElement)) return;
    // Guard against a newer DOM edit before React delivers its next render.
    if (canUndo && input.value.length) { setClearedPrompt(null); return; }
    const next = canUndo ? clearedPrompt! : '';
    if (!canUndo && !prompt.length) return;
    flushSync(() => {
      setClearedPrompt(canUndo ? null : prompt);
      onPromptChange(next);
    });
    // Stay within the trusted tap/click: deferring focus loses the iOS keyboard.
    input.focus({ preventScroll: true });
    input.setSelectionRange(next.length, next.length);
  };
  return <span className="inline-flex min-h-11 shrink-0 items-center">
    <Button type="button" variant="ghost" size="sm"
      className="!min-h-11 min-w-11 rounded-full px-3 py-0 text-xs"
      disabled={!prompt.length && !canUndo}
      aria-controls={inputId} aria-label={canUndo ? copy.undo : copy.clear} title={canUndo ? copy.undo : copy.clear}
      onPointerDown={event => event.preventDefault()} onClick={activate}>
      {canUndo ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5 4 10l5 5M4 10h9a7 7 0 0 1 7 7v2" />
      </svg> : copy.clear}
    </Button>
  </span>;
}
