'use client';

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Mobile command disclosure; desktop keeps the existing controls visible. */
export function CompactLibraryDisclosure({ className, label, reveal = false, children }: {
  className: string;
  label: string;
  reveal?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const previous = useRef(reveal);
  const focusedCommand = useRef(false);
  useLayoutEffect(() => {
    if (reveal) setOpen(true);
    else if (previous.current) {
      const active = document.activeElement;
      if (focusedCommand.current && (content.current?.contains(active) || active === document.body)) {
        if (window.matchMedia('(max-width: 767px)').matches) toggle.current?.focus();
        else content.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
      }
      focusedCommand.current = false;
      setOpen(false);
    }
    previous.current = reveal;
  }, [reveal]);
  return (
    <div className={className} data-disclosure-open={open}>
      <button ref={toggle} type="button" className="compact-library-disclosure-toggle" aria-expanded={open}
        aria-controls={id} onClick={() => setOpen(value => !value)}>
        {label}<span aria-hidden="true">{open ? ' −' : ' +'}</span>
      </button>
      <div ref={content} id={id} className="compact-library-disclosure-content"
        onFocusCapture={() => { focusedCommand.current = true; }}
        onBlurCapture={event => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focusedCommand.current = false;
        }}>{children}</div>
    </div>
  );
}
