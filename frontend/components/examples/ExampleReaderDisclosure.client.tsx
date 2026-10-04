'use client';

import type { ReactNode, SyntheticEvent } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

/** Native disclosure keeps its editorial children in the initial watch HTML. */
export function ExampleReaderDisclosure({ label, children }: { label: string; children: ReactNode }) {
  function revealContent(event: SyntheticEvent<HTMLDetailsElement>) {
    const disclosure = event.currentTarget;
    if (!disclosure.open) return;
    const body = disclosure.lastElementChild;
    if (!body) return;
    const dialog = disclosure.closest('.video-reader-dialog');
    const visibleBottom = Math.min(window.innerHeight, dialog?.getBoundingClientRect().bottom ?? window.innerHeight);
    // Only move a newly opened panel whose first content would be below the fold.
    if (body.getBoundingClientRect().top > visibleBottom - Math.min(180, window.innerHeight / 3)) {
      disclosure.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }

  return <details onToggle={revealContent}>
    <summary>
      <SlidersHorizontal size={16} aria-hidden="true" />
      <span>{label}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </summary>
    <div>{children}</div>
  </details>;
}
