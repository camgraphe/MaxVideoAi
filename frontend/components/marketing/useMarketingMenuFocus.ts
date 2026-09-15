'use client';

import { useEffect, useRef } from 'react';

export function useMarketingMenuFocus() {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () => Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, [tabindex="0"]')).filter((node) => node.getClientRects().length > 0);
    focusables()[0]?.focus();
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener('keydown', trapFocus);
    return () => { panel.removeEventListener('keydown', trapFocus); previous?.focus(); };
  }, []);
  return panelRef;
}
