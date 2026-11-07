'use client';

import { useEffect, useId, useRef } from 'react';
import type { getRecastSessionCopy } from '../_lib/recast-session-copy';

/** Protects the local scene without a browser-blocking JavaScript confirmation. */
export function CharacterStudioRecastResetDialog({ copy, onClose, onConfirm }: {
  copy: ReturnType<typeof getRecastSessionCopy>;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    cancel.current?.focus();
    return () => {
      node?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    className="m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-text-primary shadow-xl backdrop:bg-black/65">
    <form onSubmit={event => { event.preventDefault(); onConfirm(); }}>
      <h2 id={titleId} className="text-lg font-semibold">{copy.newScene}</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-text-secondary">{copy.reset}</p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button ref={cancel} type="button" onClick={onClose}
          className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface-hover focus-visible:outline-brand">
          {copy.keepScene}
        </button>
        <button type="submit"
          className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand focus-visible:outline-brand">
          {copy.confirmReset}
        </button>
      </div>
    </form>
  </dialog>;
}
