'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CircleHelp } from 'lucide-react';

/** A small, touch-accessible explanation without changing the selected reference role. */
export function ReferenceRolesHelp({ label, description }: { label: string; description: string }) {
  const [visibility, setVisibility] = useState<'hover' | 'focus' | 'pinned' | null>(null);
  const open = visibility !== null;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setVisibility(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setVisibility(null);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  return <div ref={root} className="app-reference-roles-help"
    onPointerLeave={() => setVisibility(value => value === 'hover' ? null : value)}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setVisibility(null); }}>
    <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setVisibility(value => value ?? 'hover'); }}
      onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setVisibility('focus'); }}
      onClick={() => setVisibility(value => value === 'pinned' ? null : 'pinned')}>
      <CircleHelp aria-hidden="true" />
    </button>
    {open ? <div id={id} role="tooltip" className="app-reference-roles-tooltip">
      {description}
    </div> : null}
  </div>;
}
